import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, CheckCircle, AlertCircle, FileText, Code,
  ArrowRight, ArrowLeft, Search, Database, MessageSquare,
  ChevronRight, ChevronDown, RefreshCw, Terminal,
  Cpu, ShieldCheck, Zap, Upload, X, Clock, Trash2, Home
} from 'lucide-react';

const DEMO_REQUIREMENT = {
  name: "衍生品持仓市值",
  trigger: "当收到期货(FUT)、期权(OPT)的持仓或成交消息时触发计算。",
  logic: "计算公式：Σ(持仓数量 * 合约乘数 * 最新价)。\n特殊处理：需要根据参数PR#10007(轧差方式)判断：\n1. 不轧差：直接累加。\n2. 轧差：空头持仓取负值。\n注意：最新价是可变因子，必须在时序汇总之后再乘。",
  drill: "展示维度：业务类型、持仓数量(买-卖)。"
};

const MOCK_ASSETS = [
  { id: 'MF#63', name: '证券一级分类', status: 'exists', description: '用于区分FUT/OPT' },
  { id: 'MF#11', name: '投资类型', status: 'exists', description: '投机/套保等' },
  { id: 'MF#7', name: '持仓数量', status: 'exists', description: '期初持仓量' },
  { id: 'MF#131', name: '合约乘数', status: 'exists', description: '每手合约对应标的数量' },
  { id: 'MF#129', name: '最新价', status: 'exists', description: '行情最新成交价' },
  { id: 'MF#23', name: '持仓方向标识', status: 'exists', description: '用于区分多头/空头持仓' },
  { id: 'MF#11', name: '风险敞口系数', status: 'exists', description: '根据业务类型计算的风险系数' },
  { id: 'MF#NEW_01', name: '轧差方向系数', status: 'missing', description: '需根据PR#10007生成的中间逻辑', suggestedDSL: 'switch(MF#23, \n  [2,3,5]: -1,  // 空头方向取负\n  default: 1    // 多头方向取正\n)' },
];

const GENERATED_DSL = `// 1. 相关性判断
switch(MF#63, ["FUT","OPT"]:true)
and switch(MF#0, 6:MF#7!=0, 4:MF#5!=0 or MF#6!=0)


// 2. 计算逻辑
switch(PR#10007,
  // 不轧差逻辑
  2: sum(GROUP(MF#1, 
       SUM(switch(MF#0, 
         6:MF#7, 
         4:MF#5-MF#6) * MF#131)
     )) * firstNotZero(MF#129, MF#77),
     
  // 轧差逻辑
  3: sum(GROUP(MF#1, 
       SUM(switch(MF#0, 
         6:switch(MF#23, [2,3]:-MF#7, MF#7), 
         4:switch(MF#23, [2,3]:MF#6-MF#5, MF#5-MF#6)) * MF#131)
     )) * firstNotZero(MF#129, MF#77)
)


// 3. 下钻/导出定义
$detailFixed#业务类型(MF#BUSI_TYPE)
$inceSum#持仓数量(MF#5-MF#6)
`;

const EXPLANATION_TEXT = `
1. **触发条件**：系统将过滤所有消息，仅当证券类型为“期货”或“期权”，且持仓/成交数量不为0时，触发计算。
2. **核心计算**：
   - 系统根据参数 **PR#10007 (轧差方式)** 进行分支处理。
   - **分支A (不轧差)**：对同一证券内码的持仓数量进行直接累加，最后乘以合约乘数和最新价。
   - **分支B (轧差)**：识别持仓方向，若为卖方(空头)，则数量取负值进行抵消，最后乘以合约乘数和最新价。
   - **注意**：最新价(MF#129)被放置在 sum(GROUP(...)) 外部，符合时序计算规范。
3. **展示输出**：在详情页中，将额外展示“业务类型”列，以及每笔交易的“持仓数量”明细。
`;

const StepIndicator = ({ currentStep, steps }) => (
  <div className="flex justify-between items-center mb-8 px-4">
    {steps.map((step, index) => {
      const isCompleted = index < currentStep;
      const isActive = index === currentStep;

      return (
        <React.Fragment key={index}>
          <div className={`flex flex-col items-center z-10 ${isActive ? 'scale-110 transition-transform' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-colors duration-300
              ${isCompleted || isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}
            `}>
              {isCompleted ? <CheckCircle size={16} /> : index + 1}
            </div>
            <span className={`text-xs font-medium ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
              {step.title}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 transition-colors duration-300 ${index < currentStep ? 'bg-blue-600' : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

const Card = ({ title, children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
    {title && (
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
    )}
    <div className="p-5">
      {children}
    </div>
  </div>
);

const Badge = ({ type, text }) => {
  const styles = {
    exists: "bg-green-100 text-green-700 border-green-200",
    missing: "bg-red-100 text-red-700 border-red-200",
    info: "bg-blue-100 text-blue-700 border-blue-200"
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${styles[type] || styles.info}`}>
      {text}
    </span>
  );
};

export default function ReqToDSL() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [requirement, setRequirement] = useState(DEMO_REQUIREMENT);
  const [analyzed, setAnalyzed] = useState(false);
  const [displayedDSL, setDisplayedDSL] = useState('');
  const [expandedFactors, setExpandedFactors] = useState({}); // 记录哪些缺失因子已展开
  const [definedFactors, setDefinedFactors] = useState({}); // 记录哪些缺失因子已定义
  const dslStreamingRef = useRef(false);
  const streamIntervalRef = useRef(null);
  const [dslEditable, setDslEditable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploadedFile, setUploadedFile] = useState({
    name: '《衍生品持仓市值因子需求说明书.docx》',
    size: 0,
    uploadTime: new Date().toLocaleString('zh-CN')
  }); // 默认显示已上传状态
  const [uploadStatus, setUploadStatus] = useState('parsed'); // idle, uploading, uploaded, parsing, parsed
  const [parseProgress, setParseProgress] = useState(100); // 解析进度 0-100
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const steps = [
    { title: "需求输入", icon: FileText },
    { title: "完整性检查", icon: Database },
    { title: "开发", icon: Code },
    { title: "验证", icon: ShieldCheck }
  ];

  const handleNext = () => {
    // 检查第二步是否有未定义的缺失因子
    if (currentStep === 1) {
      const missingFactors = MOCK_ASSETS.filter(asset => asset.status === 'missing');
      const definedCount = missingFactors.filter(factor => definedFactors[factor.id]).length;
      const allDefined = missingFactors.length === 0 || definedCount === missingFactors.length;
      
      if (!allDefined) {
        // 如果有未定义的缺失因子，不允许进入下一步
        return;
      }
    }
    
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setCurrentStep(prev => prev + 1);
      if (currentStep === 0) setAnalyzed(true);
    }, 1000);
  };

  const toggleFactorExpand = (factorId) => {
    setExpandedFactors(prev => ({
      ...prev,
      [factorId]: !prev[factorId]
    }));
  };

  const handleDefineFactor = (factorId) => {
    setDefinedFactors(prev => ({
      ...prev,
      [factorId]: true
    }));
    // 定义后自动收起
    setExpandedFactors(prev => ({
      ...prev,
      [factorId]: false
    }));
  };

  const handleSubmit = () => {
    setSubmitting(true);
    // 模拟提交过程
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 1500);
  };

  // 文件上传处理
  const handleFileSelect = (file) => {
    const allowedExtensions = ['.docx', '.pdf'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      alert('仅支持 .docx 和 .pdf 格式的文件');
      return;
    }

    // 开始上传（重新上传时会覆盖当前文档和表单内容）
    setUploadStatus('uploading');
    setUploadedFile({
      name: file.name,
      size: file.size,
      uploadTime: new Date().toLocaleString('zh-CN')
    });

    // 模拟上传过程
    setTimeout(() => {
      setUploadStatus('uploaded');
      // 开始解析
      setUploadStatus('parsing');
      setParseProgress(0);
      
      // 模拟解析进度
      const parseInterval = setInterval(() => {
        setParseProgress(prev => {
          if (prev >= 100) {
            clearInterval(parseInterval);
            setUploadStatus('parsed');
            // 解析完成后，AI会自动填充表单内容（实际实现中会调用后端API获取解析结果）
            // 这里为演示，保持现有表单数据不变
            return 100;
          }
          return prev + 10;
        });
      }, 200);
    }, 1000);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDeleteFile = () => {
    if (window.confirm('确定要删除已上传的文档吗？')) {
      setUploadedFile({
        name: '',
        size: 0,
        uploadTime: ''
      });
      setUploadStatus('idle');
      setParseProgress(0);
      // 不清空表单内容
    }
  };

  const handleReupload = () => {
    fileInputRef.current?.click();
  };

  // 启动流式输出DSL代码
  const startDSLStreaming = () => {
    // 清理之前的定时器
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    
    setDisplayedDSL('');
    setDslEditable(false);
    let currentIndex = 0;
    
    streamIntervalRef.current = setInterval(() => {
      if (currentIndex < GENERATED_DSL.length) {
        setDisplayedDSL(GENERATED_DSL.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        if (streamIntervalRef.current) {
          clearInterval(streamIntervalRef.current);
          streamIntervalRef.current = null;
        }
        setDslEditable(true);
      }
    }, 10); // 每10毫秒输出一个字符，可以调整速度
  };

  // 流式输出DSL代码
  useEffect(() => {
    if (currentStep === 2 && !dslStreamingRef.current) {
      dslStreamingRef.current = true;
      startDSLStreaming();
    } else if (currentStep !== 2) {
      // 离开第三步时重置
      dslStreamingRef.current = false;
      setDisplayedDSL('');
      setDslEditable(false);
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
      }
    }

    return () => {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
      }
    };
  }, [currentStep]);

  const renderStep1 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-blue-50 p-5 rounded-lg border border-blue-100 text-sm text-blue-800 mb-4 flex gap-3">
        <MessageSquare className="shrink-0 mt-0.5" size={20} />
        <div>
          <p className="font-semibold mb-1">因子开发助手</p>
          <p>请上传您的因子需求文档。我会帮您拆解为"触发"、"计算"、"展示"三段式结构，以确保生成的 DSL 准确无误。</p>
        </div>
      </div>

      {/* 文档上传控件 */}
      <div className="lg:col-span-2">
        <label className="block text-sm font-medium text-slate-700 mb-2">需求文档上传</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.pdf"
          onChange={handleFileInputChange}
          className="hidden"
        />
        
        {uploadStatus === 'idle' || !uploadedFile?.name ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragging 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
            }`}
          >
            <Upload className="mx-auto mb-3 text-slate-400" size={32} />
            <p className="text-sm font-medium text-slate-700 mb-1">
              点击或拖拽文件到此处上传
            </p>
            <p className="text-xs text-slate-500">
              支持格式：.docx, .pdf
            </p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="text-blue-600" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {uploadedFile.name}
                    </span>
                    {uploadStatus === 'parsed' && (
                      <CheckCircle className="text-green-500 shrink-0" size={16} />
                    )}
                    {uploadStatus === 'parsing' && (
                      <RefreshCw className="text-blue-500 shrink-0 animate-spin" size={16} />
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {uploadedFile.uploadTime}
                    </span>
                    {uploadStatus === 'parsing' && (
                      <span className="text-blue-600 font-medium">
                        AI解析中... {parseProgress}%
                      </span>
                    )}
                    {uploadStatus === 'parsed' && (
                      <span className="text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle size={12} />
                        解析完成
                      </span>
                    )}
                  </div>
                  {uploadStatus === 'parsed' && (
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                      <Cpu size={12} />
                      下方表单内容由AI自动解析生成，您可以直接使用或手动编辑
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button
                  onClick={handleReupload}
                  className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  重新上传
                </button>
                <button
                  onClick={handleDeleteFile}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="删除文档"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {uploadStatus === 'parsing' && (
              <div className="mt-3">
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                    style={{ width: `${parseProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {uploadStatus === 'parsed' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">因子名称</label>
            <input
              type="text"
              value={requirement.name}
              onChange={(e) => setRequirement({ ...requirement, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <span className="bg-slate-200 text-slate-600 text-xs px-1.5 py-0.5 rounded mr-2">第一段</span>
              触发条件 (相关性)
            </label>
            <textarea
              value={requirement.trigger}
              onChange={(e) => setRequirement({ ...requirement, trigger: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-28 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <span className="bg-slate-200 text-slate-600 text-xs px-1.5 py-0.5 rounded mr-2">第三段</span>
              下钻/导出定义
            </label>
            <textarea
              value={requirement.drill}
              onChange={(e) => setRequirement({ ...requirement, drill: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-28 text-sm"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <span className="bg-slate-200 text-slate-600 text-xs px-1.5 py-0.5 rounded mr-2">第二段</span>
              计算逻辑 (公式/参数)
            </label>
            <textarea
              value={requirement.logic}
              onChange={(e) => setRequirement({ ...requirement, logic: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-36 text-sm font-mono bg-slate-50"
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => {
    const missingFactors = MOCK_ASSETS.filter(asset => asset.status === 'missing');
    const definedCount = missingFactors.filter(factor => definedFactors[factor.id]).length;
    const allDefined = missingFactors.length > 0 && definedCount === missingFactors.length;

    return (
    <div className="space-y-6 animate-fadeIn">
        <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 text-sm">
        <div className="flex items-center gap-2 mb-2 text-slate-700 font-medium">
            <Database size={18} />
          <span>AI 因子盘点结果</span>
        </div>
        <p className="text-slate-500">
            基于您的需求，我检索了因子知识库。发现了 {MOCK_ASSETS.filter(a => a.status === 'exists').length} 个现有元因子，{missingFactors.length} 个缺失逻辑需要补充定义。
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-600 font-semibold">
            <tr>
                <th className="px-6 py-4">识别实体</th>
                <th className="px-6 py-4">对应 ID</th>
                <th className="px-6 py-4">状态</th>
                <th className="px-6 py-4">说明</th>
                <th className="px-6 py-4 w-20">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
              {MOCK_ASSETS.map((asset, idx) => {
                const isMissing = asset.status === 'missing';
                const isExpanded = expandedFactors[asset.id];
                const isDefined = definedFactors[asset.id];
                
                return (
                  <React.Fragment key={idx}>
                    <tr 
                      className={`${
                        isMissing 
                          ? isDefined 
                            ? 'bg-green-50 hover:bg-green-100' 
                            : 'bg-red-50 hover:bg-red-100 cursor-pointer'
                          : 'hover:bg-slate-50'
                      } transition-colors`}
                      onClick={() => isMissing && !isDefined && toggleFactorExpand(asset.id)}
                    >
                      <td className="px-6 py-4 font-medium text-slate-800">{asset.name}</td>
                      <td className="px-6 py-4 font-mono text-slate-500">{asset.id}</td>
                      <td className="px-6 py-4">
                        {isDefined ? (
                          <Badge type="exists" text="已定义" />
                        ) : (
                  <Badge type={asset.status} text={asset.status === 'exists' ? '已存在' : '缺失'} />
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{asset.description}</td>
                      <td className="px-6 py-4">
                        {isMissing && !isDefined && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFactorExpand(asset.id);
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded p-1 transition-colors"
                            title={isExpanded ? '收起' : '展开定义'}
                          >
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </button>
                        )}
                </td>
              </tr>
                    {isMissing && isExpanded && !isDefined && (
                      <tr>
                        <td colSpan="5" className="px-6 py-5 bg-slate-50 border-t border-slate-200">
                          <Card title={`定义缺失逻辑：${asset.name}`} className="border-blue-200 shadow-md">
          <div className="space-y-4">
            <div className="text-sm text-slate-600">
              AI 建议定义：根据参数值动态判断方向。
            </div>
                              <div className="bg-slate-900 text-green-400 p-3 rounded-lg font-mono text-xs whitespace-pre-wrap">
                                {`// 建议的 DSL 片段\n${asset.suggestedDSL || '// 暂无建议代码'}`}
            </div>
            <div className="flex justify-end gap-3">
                                <button className="px-4 py-2 text-slate-600 text-sm hover:bg-slate-100 rounded">
                                  修改定义
                                </button>
              <button
                                  onClick={() => handleDefineFactor(asset.id)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-2"
              >
                <CheckCircle size={16} /> 确认并采纳
              </button>
            </div>
          </div>
        </Card>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {missingFactors.length > 0 && (
          <div className="bg-blue-50 p-5 rounded-lg border border-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-700">
              <AlertCircle size={18} />
              <span className="text-sm font-medium">
                进度：已定义 {definedCount}/{missingFactors.length} 个缺失因子
              </span>
            </div>
            {allDefined && (
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle size={18} />
                <span className="text-sm font-medium">所有缺失因子已补全，可以继续下一步</span>
          </div>
            )}
        </div>
      )}
    </div>
  );
  };

  const renderStep3 = () => (
    <div className="h-full flex flex-col animate-fadeIn">
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-3">
          <Badge type="info" text="三段式结构" />
          <Badge type="info" text="时序校验通过" />
        </div>
        <button 
          onClick={() => {
            dslStreamingRef.current = false;
            startDSLStreaming();
            dslStreamingRef.current = true;
          }}
          className="text-sm flex items-center gap-2 text-slate-500 hover:text-blue-600 px-3 py-1.5 hover:bg-blue-50 rounded transition-colors"
        >
          <RefreshCw size={16} /> 重新生成
        </button>
      </div>
      <div className="relative flex-1 bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-inner group min-h-[500px]">
        <div className="absolute top-0 left-0 w-full h-10 bg-slate-800 flex items-center px-4 border-b border-slate-700">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="ml-4 text-xs text-slate-400 font-mono">DerivativeMarketValue.dsl</span>
          {dslEditable && <span className="ml-auto text-xs text-green-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block"></span>可编辑</span>}
        </div>
        <textarea
          readOnly={!dslEditable}
          value={displayedDSL}
          onChange={(e) => setDisplayedDSL(e.target.value)}
          className="w-full h-full pt-12 px-6 pb-6 bg-transparent text-slate-300 font-mono text-sm resize-none outline-none leading-relaxed"
        />
        {!dslEditable && (
          <div className="absolute bottom-4 right-4 text-slate-500 text-xs flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>正在生成...</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6 animate-fadeIn">
      {submitted && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 shadow-lg animate-fadeIn">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-md animate-scaleIn">
              <CheckCircle size={32} className="text-white animate-checkmark" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-green-800 mb-1">提交成功！</h3>
              <p className="text-green-700 text-sm">
                您的因子 <span className="font-semibold">"{requirement.name}"</span> 已成功提交并发布到因子开发系统。
              </p>
              <p className="text-green-600 text-xs mt-2">
                系统正在后台处理，预计 1-2 分钟后可在因子库中查看。
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="text-indigo-600" size={22} />
          <h3 className="font-bold text-indigo-900 text-lg">代码-业务翻译官 (Reviewer)</h3>
        </div>
        <div className="prose prose-sm max-w-none text-slate-700">
          {EXPLANATION_TEXT.split('\n').map((line, i) => (
            <p key={i} className="mb-2">{line}</p>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="语法风控报告">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2 text-green-700">
              <CheckCircle size={14} /> 三段式结构完整
            </li>
            <li className="flex items-center gap-2 text-green-700">
              <CheckCircle size={14} /> 时序函数(sum)作用域正确
            </li>
            <li className="flex items-center gap-2 text-green-700">
              <CheckCircle size={14} /> 可变因子(MF#129)位于sum外部
            </li>
          </ul>
        </Card>
        <Card title="仿真测试建议">
          <div className="text-sm text-slate-600 mb-3">建议生成 3 组测试数据覆盖分支：</div>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded border">FUT + 不轧差</span>
            <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded border">OPT + 轧差(多头)</span>
            <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded border">OPT + 轧差(空头)</span>
          </div>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 p-6 flex justify-center font-sans text-slate-800">
      <div className="w-full max-w-7xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="返回首页"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Cpu size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">国智开发智能向导</h1>
              <p className="text-xs text-slate-500">Agent-driven DSL Development Workbench</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* A/B 方案切换 */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <span className="px-3 py-1.5 text-xs font-medium rounded-md bg-white text-blue-600 shadow-sm">
                方案 A
              </span>
              <button onClick={() => navigate('/req-to-dsl-b')}
                className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-700 transition-colors">
                方案 B
              </button>
            </div>
            <div className="w-px h-6 bg-slate-200"></div>
            <button className="px-3 py-1.5 text-slate-600 text-sm hover:bg-slate-100 rounded-lg flex items-center gap-2 transition-colors">
              <Terminal size={16} /> 控制台
            </button>
            <button className="px-3 py-1.5 text-slate-600 text-sm hover:bg-slate-100 rounded-lg flex items-center gap-2 transition-colors">
              <MessageSquare size={16} /> 知识库助手
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col p-8 overflow-y-auto">
            <StepIndicator currentStep={currentStep} steps={steps} />

            <div className="flex-1">
              {currentStep === 0 && renderStep1()}
              {currentStep === 1 && renderStep2()}
              {currentStep === 2 && renderStep3()}
              {currentStep === 3 && renderStep4()}
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center">
              <button
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                className="px-4 py-2 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
              >
                上一步
              </button>

              <div className="flex gap-3">
                {currentStep === 3 ? (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || submitted}
                    className={`px-6 py-2.5 rounded-lg shadow-md flex items-center gap-2 transition-all ${
                      submitted
                        ? 'bg-green-500 text-white cursor-default'
                        : submitting
                        ? 'bg-green-400 text-white cursor-wait'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    } disabled:opacity-100`}
                  >
                    {submitted ? (
                      <>
                        <CheckCircle size={18} className="animate-bounce" /> 提交成功！
                      </>
                    ) : submitting ? (
                      <>
                        <RefreshCw className="animate-spin" size={18} /> 提交中...
                      </>
                    ) : (
                      <>
                    <CheckCircle size={18} /> 提交并发布
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    disabled={(() => {
                      if (loading) return true;
                      if (currentStep === 1) {
                        const missingFactors = MOCK_ASSETS.filter(asset => asset.status === 'missing');
                        const definedCount = missingFactors.filter(factor => definedFactors[factor.id]).length;
                        return missingFactors.length > 0 && definedCount !== missingFactors.length;
                      }
                      return false;
                    })()}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg shadow-md shadow-blue-200 hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="animate-spin" size={18} /> 处理中...
                      </>
                    ) : (
                      <>
                        下一步 <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="w-96 border-l border-slate-200 bg-slate-50 p-6 hidden lg:flex flex-col gap-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Context Awareness</div>

            <Card title="当前上下文" className="text-xs">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">业务域:</span>
                  <span className="font-medium">衍生品/持仓</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">元数据:</span>
                  <span className="font-medium text-green-600">已加载 5 个</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">依赖检查:</span>
                  <span className={`font-medium ${
                    (() => {
                      const missingFactors = MOCK_ASSETS.filter(asset => asset.status === 'missing');
                      const definedCount = missingFactors.filter(factor => definedFactors[factor.id]).length;
                      const allDefined = missingFactors.length === 0 || definedCount === missingFactors.length;
                      return allDefined || currentStep > 1 ? 'text-green-600' : 'text-orange-500';
                    })()
                  }`}>
                    {(() => {
                      const missingFactors = MOCK_ASSETS.filter(asset => asset.status === 'missing');
                      const definedCount = missingFactors.filter(factor => definedFactors[factor.id]).length;
                      const allDefined = missingFactors.length === 0 || definedCount === missingFactors.length;
                      return allDefined || currentStep > 1 ? '通过' : '待处理';
                    })()}
                  </span>
                </div>
              </div>
            </Card>

            <Card title="参考 DSL 函数" className="text-xs flex-1 flex flex-col">
              <div className="relative flex-1 bg-slate-100 rounded border border-slate-200 p-2 overflow-hidden font-mono text-slate-500">
                <div className="absolute top-2 right-2 opacity-20"><Code /></div>
                <p>// 系统推荐参考</p>
                <p>func WeightedAvg(list) {'{'}</p>
                <p>  sum(list) / count(list)</p>
                <p>{'}'}</p>
                <br />
                <p>// 轧差逻辑模板</p>
                <p>switch(PR#Netting...</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
