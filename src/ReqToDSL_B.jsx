import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, CheckCircle, AlertCircle, FileText, Code,
  ArrowRight, ArrowLeft, Search, Database, MessageSquare,
  ChevronRight, ChevronDown, RefreshCw, Terminal,
  Cpu, ShieldCheck, Zap, Upload, X, Clock, Trash2, Home,
  GitBranch, Eye
} from 'lucide-react';

// ─────────────────────────────── 共享常量（与 A 方案一致）───────────────────────────────

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
1. **触发条件**：系统将过滤所有消息，仅当证券类型为"期货"或"期权"，且持仓/成交数量不为0时，触发计算。
2. **核心计算**：
   - 系统根据参数 **PR#10007 (轧差方式)** 进行分支处理。
   - **分支A (不轧差)**：对同一证券内码的持仓数量进行直接累加，最后乘以合约乘数和最新价。
   - **分支B (轧差)**：识别持仓方向，若为卖方(空头)，则数量取负值进行抵消，最后乘以合约乘数和最新价。
   - **注意**：最新价(MF#129)被放置在 sum(GROUP(...)) 外部，符合时序计算规范。
3. **展示输出**：在详情页中，将额外展示"业务类型"列，以及每笔交易的"持仓数量"明细。
`;

// ─────────────────────────────── B 方案新增：预置测试用例 ───────────────────────────────

const PRESET_TEST_CASES = [
  {
    name: 'FUT + 不轧差',
    desc: '期货持仓，直接累加模式',
    data: {
      secType: 'FUT', msgType: 6,
      holdQty: 100, buyQty: 0, sellQty: 0,
      multiplier: 10, latestPrice: 50.5,
      direction: 1, nettingMode: 2,
    },
    expected: 50500,
  },
  {
    name: 'OPT + 轧差(多头)',
    desc: '期权持仓，轧差模式，多头方向',
    data: {
      secType: 'OPT', msgType: 6,
      holdQty: 200, buyQty: 0, sellQty: 0,
      multiplier: 100, latestPrice: 3.2,
      direction: 1, nettingMode: 3,
    },
    expected: 64000,
  },
  {
    name: 'OPT + 轧差(空头)',
    desc: '期权成交，轧差模式，空头方向',
    data: {
      secType: 'OPT', msgType: 4,
      holdQty: 0, buyQty: 150, sellQty: 80,
      multiplier: 100, latestPrice: 3.2,
      direction: 2, nettingMode: 3,
    },
    expected: -22400,
  },
];

// ─────────────────────────────── B 方案新增：Mock 计算引擎 ───────────────────────────────

function mockCalculate(d) {
  const steps = [];
  const { secType, msgType, holdQty, buyQty, sellQty, multiplier, latestPrice, direction, nettingMode } = d;

  // Step 1: 证券类型检查
  const validType = ['FUT', 'OPT'].includes(secType);
  steps.push({
    name: '相关性判断 — 证券类型',
    expr: `MF#63 = "${secType}" → ${validType ? '属于 {FUT, OPT}，符合条件' : '不属于 {FUT, OPT}，跳过计算'}`,
    pass: validType,
  });
  if (!validType) return { steps, result: null, error: '证券类型不符合条件，计算跳过', path: 'skip-type' };

  // Step 2: 数量检查
  let qtyOk;
  if (msgType === 6) {
    qtyOk = holdQty !== 0;
    steps.push({
      name: '相关性判断 — 数量检查',
      expr: `消息类型 = 持仓(6)，MF#7 = ${holdQty} ${qtyOk ? '≠ 0 → 触发计算' : '= 0 → 跳过'}`,
      pass: qtyOk,
    });
  } else {
    qtyOk = buyQty !== 0 || sellQty !== 0;
    steps.push({
      name: '相关性判断 — 数量检查',
      expr: `消息类型 = 成交(4)，MF#5=${buyQty}，MF#6=${sellQty} ${qtyOk ? '≠ 0 → 触发计算' : '均为0 → 跳过'}`,
      pass: qtyOk,
    });
  }
  if (!qtyOk) return { steps, result: null, error: '数量为0，计算跳过', path: 'skip-qty' };

  // Step 3: 轧差方式
  const isNetting = nettingMode === 3;
  steps.push({
    name: '确定轧差方式',
    expr: `PR#10007 = ${nettingMode} → ${isNetting ? '轧差模式' : '不轧差模式'}`,
    pass: true,
  });

  // Step 4: 计算数量
  let qty;
  const isShort = [2, 3].includes(direction);
  if (!isNetting) {
    // 不轧差
    if (msgType === 6) {
      qty = holdQty;
      steps.push({ name: '计算持仓量（不轧差）', expr: `消息类型 = 持仓 → 数量 = MF#7 = ${holdQty}`, pass: true });
    } else {
      qty = buyQty - sellQty;
      steps.push({ name: '计算成交量（不轧差）', expr: `消息类型 = 成交 → 数量 = MF#5 − MF#6 = ${buyQty} − ${sellQty} = ${qty}`, pass: true });
    }
  } else {
    // 轧差
    if (msgType === 6) {
      qty = isShort ? -holdQty : holdQty;
      steps.push({ name: '计算持仓量（轧差 + 方向）', expr: `方向 = ${isShort ? '空头 → −MF#7' : '多头 → MF#7'} = ${qty}`, pass: true });
    } else {
      qty = isShort ? (sellQty - buyQty) : (buyQty - sellQty);
      steps.push({
        name: '计算成交量（轧差 + 方向）',
        expr: `方向 = ${isShort ? '空头' : '多头'} → ${isShort ? `MF#6−MF#5 = ${sellQty}−${buyQty}` : `MF#5−MF#6 = ${buyQty}−${sellQty}`} = ${qty}`,
        pass: true,
      });
    }
  }

  // Step 5: × 合约乘数
  const afterMul = qty * multiplier;
  steps.push({ name: '乘以合约乘数', expr: `${qty} × MF#131(${multiplier}) = ${afterMul}`, pass: true, value: afterMul });

  // Step 6: SUM
  steps.push({ name: 'GROUP → SUM 汇总', expr: `SUM = ${afterMul}（单条数据演示）`, pass: true, value: afterMul });

  // Step 7: × 最新价
  const final = afterMul * latestPrice;
  steps.push({ name: '乘以最新价', expr: `${afterMul} × MF#129(${latestPrice}) = ${final}`, pass: true, value: final });

  return { steps, result: final, path: isNetting ? 'netting' : 'no-netting' };
}

// ─────────────────────────────── 共享子组件 ───────────────────────────────

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

const Card = ({ title, icon, children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
    {title && (
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        {icon && icon}
        {!icon && <div className="w-1 h-4 bg-blue-500 rounded-full"></div>}
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
    )}
    <div className="p-5">{children}</div>
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

// ─────────────────────────────── B 方案新增：决策流程图 ───────────────────────────────

const PATH_NODES = {
  'skip-type': ['start', 'checkType', 'skipType'],
  'skip-qty':  ['start', 'checkType', 'checkQty', 'skipQty'],
  'no-netting': ['start', 'checkType', 'checkQty', 'branch', 'noNet1', 'noNet2', 'noNet3', 'output'],
  'netting':    ['start', 'checkType', 'checkQty', 'branch', 'net1', 'net2', 'net3', 'output'],
};

const PATH_EDGES = {
  'skip-type': ['e1', 'e-skip1'],
  'skip-qty':  ['e1', 'e2', 'e-skip2'],
  'no-netting': ['e1', 'e2', 'e3', 'e-bl', 'e-l1', 'e-l2', 'e-ml'],
  'netting':    ['e1', 'e2', 'e3', 'e-br', 'e-r1', 'e-r2', 'e-mr'],
};

const ANIM_SEQUENCES = {
  'no-netting': ['start','e1','checkType','e2','checkQty','e3','branch','e-bl','noNet1','e-l1','noNet2','e-l2','noNet3','e-ml','output'],
  'netting':    ['start','e1','checkType','e2','checkQty','e3','branch','e-br','net1','e-r1','net2','e-r2','net3','e-mr','output'],
  'skip-type':  ['start','e1','checkType','e-skip1','skipType'],
  'skip-qty':   ['start','e1','checkType','e2','checkQty','e-skip2','skipQty'],
};

const FlowDiagram = ({ activeItems = new Set(), currentItem = null }) => {
  const hasPath = activeItems.size > 0;
  const isOn = (id) => activeItems.has(id);
  const isCur = (id) => id === currentItem;
  const isSkip = (id) => id === 'skipType' || id === 'skipQty';
  const isSkipEdge = (id) => id === 'e-skip1' || id === 'e-skip2';

  const nFill = (id) => {
    if (!hasPath) return '#FFFFFF';
    if (isCur(id)) return isSkip(id) ? '#FEE2E2' : '#DBEAFE';
    return isOn(id) ? '#EFF6FF' : '#F8FAFC';
  };
  const nStroke = (id) => {
    if (!hasPath) return '#CBD5E1';
    if (isSkip(id)) return isOn(id) ? '#F87171' : '#E2E8F0';
    if (isCur(id)) return '#2563EB';
    return isOn(id) ? '#3B82F6' : '#E2E8F0';
  };
  const nText = (id) => {
    if (!hasPath) return '#334155';
    if (isSkip(id)) return isOn(id) ? '#DC2626' : '#94A3B8';
    return isOn(id) ? '#1E40AF' : '#94A3B8';
  };
  const eStroke = (id) => {
    if (!hasPath) return '#94A3B8';
    if (isSkipEdge(id)) return isOn(id) ? '#F87171' : '#E2E8F0';
    if (isCur(id)) return '#2563EB';
    return isOn(id) ? '#3B82F6' : '#E2E8F0';
  };
  const marker = (id) => {
    if (!hasPath) return 'url(#ag)';
    if (isSkipEdge(id) && isOn(id)) return 'url(#ar)';
    return isOn(id) ? 'url(#ab)' : 'url(#af)';
  };

  const Node = ({ id, cx, cy, w, h, label, dashed }) => (
    <g filter={isCur(id) ? (isSkip(id) ? 'url(#glow-red)' : 'url(#glow-blue)') : 'none'}>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={6}
        fill={nFill(id)} stroke={nStroke(id)}
        strokeWidth={isCur(id) ? 2.5 : (hasPath && isOn(id)) ? 2 : 1.5}
        strokeDasharray={dashed ? '4 2' : 'none'}
        style={{ transition: 'fill 0.2s, stroke 0.2s, stroke-width 0.15s' }} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fill={nText(id)} fontSize={11} fontWeight={isCur(id) ? 700 : 500}
        fontFamily="Inter, system-ui, sans-serif"
        style={{ transition: 'fill 0.2s' }}>
        {label}
      </text>
    </g>
  );

  const Edge = ({ id, x1, y1, x2, y2 }) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={eStroke(id)}
      strokeWidth={isCur(id) ? 2.5 : (hasPath && isOn(id)) ? 2 : 1.2}
      markerEnd={marker(id)}
      style={{ transition: 'stroke 0.15s, stroke-width 0.15s' }} />
  );

  const Label = ({ x, y, text, color }) => (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="middle"
      fill={color || '#64748B'} fontSize={10} fontWeight={600} fontFamily="Inter, system-ui, sans-serif">
      {text}
    </text>
  );

  return (
    <svg viewBox="0 0 680 430" className="w-full" style={{ maxHeight: '420px' }}>
      <defs>
        <marker id="ag" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="7" markerHeight="6" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#94A3B8"/></marker>
        <marker id="ab" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="7" markerHeight="6" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#3B82F6"/></marker>
        <marker id="ar" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="7" markerHeight="6" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#F87171"/></marker>
        <marker id="af" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="7" markerHeight="6" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#E2E8F0"/></marker>
        <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="blur"/>
          <feFlood floodColor="#3B82F6" floodOpacity="0.45" result="color"/>
          <feComposite in="color" in2="blur" operator="in" result="shadow"/>
          <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="blur"/>
          <feFlood floodColor="#EF4444" floodOpacity="0.45" result="color"/>
          <feComposite in="color" in2="blur" operator="in" result="shadow"/>
          <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* ── 连线 ── */}
      <Edge id="e1"      x1={340} y1={38}  x2={340} y2={58}  />
      <Edge id="e2"      x1={340} y1={86}  x2={340} y2={108} />
      <Edge id="e3"      x1={340} y1={136} x2={340} y2={158} />
      <Edge id="e-bl"    x1={300} y1={186} x2={180} y2={218} />
      <Edge id="e-br"    x1={380} y1={186} x2={500} y2={218} />
      <Edge id="e-l1"    x1={175} y1={246} x2={175} y2={268} />
      <Edge id="e-r1"    x1={505} y1={246} x2={505} y2={268} />
      <Edge id="e-l2"    x1={175} y1={296} x2={175} y2={318} />
      <Edge id="e-r2"    x1={505} y1={296} x2={505} y2={318} />
      <Edge id="e-ml"    x1={210} y1={346} x2={310} y2={378} />
      <Edge id="e-mr"    x1={470} y1={346} x2={370} y2={378} />
      <Edge id="e-skip1" x1={440} y1={72}  x2={548} y2={72}  />
      <Edge id="e-skip2" x1={440} y1={122} x2={548} y2={122} />

      {/* ── 标签 ── */}
      <Label x={352} y={99}  text="是" />
      <Label x={352} y={149} text="是" />
      <Label x={490} y={64}  text="否" />
      <Label x={490} y={114} text="否" />
      <Label x={228} y={198} text="不轧差(2)" />
      <Label x={452} y={198} text="轧差(3)" />

      {/* ── 节点 ── */}
      <Node id="start"     cx={340} cy={24}  w={120} h={28} label="收到消息" />
      <Node id="checkType"  cx={340} cy={72}  w={200} h={28} label="证券类型 ∈ {FUT, OPT} ?" />
      <Node id="checkQty"   cx={340} cy={122} w={200} h={28} label="持仓/成交数量 ≠ 0 ?" />
      <Node id="branch"     cx={340} cy={172} w={200} h={28} label="PR#10007 轧差方式" />
      <Node id="skipType"   cx={580} cy={72}  w={52}  h={24} label="忽略" dashed />
      <Node id="skipQty"    cx={580} cy={122} w={52}  h={24} label="忽略" dashed />
      <Node id="noNet1"     cx={175} cy={232} w={150} h={28} label="直接累加持仓量" />
      <Node id="net1"       cx={505} cy={232} w={168} h={28} label="方向判断 · 空头取负" />
      <Node id="noNet2"     cx={175} cy={282} w={130} h={28} label="× 合约乘数" />
      <Node id="net2"       cx={505} cy={282} w={130} h={28} label="× 合约乘数" />
      <Node id="noNet3"     cx={175} cy={332} w={140} h={28} label="GROUP → SUM" />
      <Node id="net3"       cx={505} cy={332} w={140} h={28} label="GROUP → SUM" />
      <Node id="output"     cx={340} cy={392} w={190} h={30} label="× 最新价 → 输出市值" />
    </svg>
  );
};

// ═══════════════════════════════ 主组件 ═══════════════════════════════

export default function ReqToDSL_B() {
  const navigate = useNavigate();

  // ── 共享状态（与 A 方案一致）──
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [requirement, setRequirement] = useState(DEMO_REQUIREMENT);
  const [analyzed, setAnalyzed] = useState(false);
  const [displayedDSL, setDisplayedDSL] = useState('');
  const [expandedFactors, setExpandedFactors] = useState({});
  const [definedFactors, setDefinedFactors] = useState({});
  const dslStreamingRef = useRef(false);
  const streamIntervalRef = useRef(null);
  const [dslEditable, setDslEditable] = useState(false);
  const [codeModified, setCodeModified] = useState(false);
  const [translatorLoading, setTranslatorLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploadedFile, setUploadedFile] = useState({
    name: '《衍生品持仓市值因子需求说明书.docx》',
    size: 0,
    uploadTime: new Date().toLocaleString('zh-CN')
  });
  const [uploadStatus, setUploadStatus] = useState('parsed');
  const [parseProgress, setParseProgress] = useState(100);
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // ── B 方案新增状态 ──
  const [animItems, setAnimItems] = useState(new Set());
  const [currentAnimItem, setCurrentAnimItem] = useState(null);
  const animTimerRef = useRef(null);
  const [testData, setTestData] = useState({ ...PRESET_TEST_CASES[0].data });
  const [expectedValue, setExpectedValue] = useState(String(PRESET_TEST_CASES[0].expected));
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [activePreset, setActivePreset] = useState(0);

  // ── B 方案：步骤名称调整 ──
  const steps = [
    { title: "需求输入", icon: FileText },
    { title: "完整性检查", icon: Database },
    { title: "开发 & 审阅", icon: Code },
    { title: "仿真测试", icon: Play }
  ];

  // ── 共享事件处理 ──

  const handleNext = () => {
    if (currentStep === 1) {
      const missingFactors = MOCK_ASSETS.filter(a => a.status === 'missing');
      const definedCount = missingFactors.filter(f => definedFactors[f.id]).length;
      if (missingFactors.length > 0 && definedCount !== missingFactors.length) return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setCurrentStep(prev => prev + 1);
      if (currentStep === 0) setAnalyzed(true);
    }, 1000);
  };

  const toggleFactorExpand = (id) => setExpandedFactors(p => ({ ...p, [id]: !p[id] }));
  const handleDefineFactor = (id) => {
    setDefinedFactors(p => ({ ...p, [id]: true }));
    setExpandedFactors(p => ({ ...p, [id]: false }));
  };

  const handleSubmit = () => {
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setSubmitted(true); }, 1500);
  };

  // 文件上传（与 A 方案一致）
  const handleFileSelect = (file) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!['.docx', '.pdf'].includes(ext)) { alert('仅支持 .docx 和 .pdf 格式'); return; }
    setUploadStatus('uploading');
    setUploadedFile({ name: file.name, size: file.size, uploadTime: new Date().toLocaleString('zh-CN') });
    setTimeout(() => {
      setUploadStatus('parsing');
      setParseProgress(0);
      const iv = setInterval(() => {
        setParseProgress(p => { if (p >= 100) { clearInterval(iv); setUploadStatus('parsed'); return 100; } return p + 10; });
      }, 200);
    }, 1000);
  };
  const handleFileInputChange = (e) => { if (e.target.files[0]) handleFileSelect(e.target.files[0]); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]); };
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDeleteFile = () => {
    if (window.confirm('确定要删除已上传的文档吗？')) {
      setUploadedFile({ name: '', size: 0, uploadTime: '' });
      setUploadStatus('idle');
      setParseProgress(0);
    }
  };
  const handleReupload = () => fileInputRef.current?.click();

  // DSL 流式输出
  const startDSLStreaming = () => {
    if (streamIntervalRef.current) { clearInterval(streamIntervalRef.current); streamIntervalRef.current = null; }
    setDisplayedDSL('');
    setDslEditable(false);
    setCodeModified(false);
    let idx = 0;
    streamIntervalRef.current = setInterval(() => {
      if (idx < GENERATED_DSL.length) { setDisplayedDSL(GENERATED_DSL.substring(0, idx + 1)); idx++; }
      else { clearInterval(streamIntervalRef.current); streamIntervalRef.current = null; setDslEditable(true); }
    }, 10);
  };

  useEffect(() => {
    if (currentStep === 2 && !dslStreamingRef.current) { dslStreamingRef.current = true; startDSLStreaming(); }
    else if (currentStep !== 2) {
      dslStreamingRef.current = false; setDisplayedDSL('');
      setDslEditable(false); setCodeModified(false);
      if (streamIntervalRef.current) { clearInterval(streamIntervalRef.current); streamIntervalRef.current = null; }
    }
    return () => {
      if (streamIntervalRef.current) { clearInterval(streamIntervalRef.current); streamIntervalRef.current = null; }
      if (animTimerRef.current) { clearInterval(animTimerRef.current); animTimerRef.current = null; }
    };
  }, [currentStep]);

  // ── B 方案：测试执行 ──
  const clearAnim = () => {
    if (animTimerRef.current) { clearInterval(animTimerRef.current); animTimerRef.current = null; }
    setAnimItems(new Set());
    setCurrentAnimItem(null);
  };

  const loadPreset = (i) => {
    clearAnim();
    const p = PRESET_TEST_CASES[i];
    setTestData({ ...p.data });
    setExpectedValue(String(p.expected));
    setActivePreset(i);
    setTestResult(null);
  };

  const executeTest = () => {
    setTesting(true);
    setTestResult(null);
    clearAnim();
    setTimeout(() => {
      const res = mockCalculate(testData);
      setTestResult(res);
      setTesting(false);
      // 启动流程图逐步动画
      if (res.path && ANIM_SEQUENCES[res.path]) {
        const seq = ANIM_SEQUENCES[res.path];
        let step = 0;
        const items = new Set();
        animTimerRef.current = setInterval(() => {
          if (step < seq.length) {
            items.add(seq[step]);
            setAnimItems(new Set(items));
            setCurrentAnimItem(seq[step]);
            step++;
          } else {
            clearInterval(animTimerRef.current);
            animTimerRef.current = null;
            setCurrentAnimItem(null); // 动画结束，移除聚光效果
          }
        }, 220);
      }
    }, 800);
  };

  const updateField = (key, value) => {
    clearAnim();
    setTestData(prev => ({ ...prev, [key]: value }));
    setActivePreset(null);
    setTestResult(null);
  };

  const regenerateTranslation = () => {
    setTranslatorLoading(true);
    setTimeout(() => { setTranslatorLoading(false); setCodeModified(false); }, 1500);
  };

  // ═══════════════════════════════ 渲染各步骤 ═══════════════════════════════

  // ── Step 1: 需求输入（与 A 方案一致）──
  const renderStep1 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-blue-50 p-5 rounded-lg border border-blue-100 text-sm text-blue-800 mb-4 flex gap-3">
        <MessageSquare className="shrink-0 mt-0.5" size={20} />
        <div>
          <p className="font-semibold mb-1">因子开发助手</p>
          <p>请上传您的因子需求文档。我会帮您拆解为"触发"、"计算"、"展示"三段式结构，以确保生成的 DSL 准确无误。</p>
        </div>
      </div>

      <div className="lg:col-span-2">
        <label className="block text-sm font-medium text-slate-700 mb-2">需求文档上传</label>
        <input ref={fileInputRef} type="file" accept=".docx,.pdf" onChange={handleFileInputChange} className="hidden" />
        {uploadStatus === 'idle' || !uploadedFile?.name ? (
          <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}>
            <Upload className="mx-auto mb-3 text-slate-400" size={32} />
            <p className="text-sm font-medium text-slate-700 mb-1">点击或拖拽文件到此处上传</p>
            <p className="text-xs text-slate-500">支持格式：.docx, .pdf</p>
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
                    <span className="text-sm font-medium text-slate-800 truncate">{uploadedFile.name}</span>
                    {uploadStatus === 'parsed' && <CheckCircle className="text-green-500 shrink-0" size={16} />}
                    {uploadStatus === 'parsing' && <RefreshCw className="text-blue-500 shrink-0 animate-spin" size={16} />}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Clock size={12} />{uploadedFile.uploadTime}</span>
                    {uploadStatus === 'parsing' && <span className="text-blue-600 font-medium">AI解析中... {parseProgress}%</span>}
                    {uploadStatus === 'parsed' && <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle size={12} />解析完成</span>}
                  </div>
                  {uploadStatus === 'parsed' && (
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1"><Cpu size={12} />下方表单内容由AI自动解析生成，您可以直接使用或手动编辑</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button onClick={handleReupload} className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors">重新上传</button>
                <button onClick={handleDeleteFile} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="删除文档"><Trash2 size={16} /></button>
              </div>
            </div>
            {uploadStatus === 'parsing' && (
              <div className="mt-3"><div className="w-full bg-slate-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full transition-all duration-200" style={{ width: `${parseProgress}%` }} /></div></div>
            )}
          </div>
        )}
      </div>

      {uploadStatus === 'parsed' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">因子名称</label>
            <input type="text" value={requirement.name} onChange={(e) => setRequirement({ ...requirement, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <span className="bg-slate-200 text-slate-600 text-xs px-1.5 py-0.5 rounded mr-2">第一段</span>触发条件 (相关性)
            </label>
            <textarea value={requirement.trigger} onChange={(e) => setRequirement({ ...requirement, trigger: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-28 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <span className="bg-slate-200 text-slate-600 text-xs px-1.5 py-0.5 rounded mr-2">第三段</span>下钻/导出定义
            </label>
            <textarea value={requirement.drill} onChange={(e) => setRequirement({ ...requirement, drill: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-28 text-sm" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <span className="bg-slate-200 text-slate-600 text-xs px-1.5 py-0.5 rounded mr-2">第二段</span>计算逻辑 (公式/参数)
            </label>
            <textarea value={requirement.logic} onChange={(e) => setRequirement({ ...requirement, logic: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-36 text-sm font-mono bg-slate-50" />
          </div>
        </div>
      )}
    </div>
  );

  // ── Step 2: 完整性检查（与 A 方案一致）──
  const renderStep2 = () => {
    const missingFactors = MOCK_ASSETS.filter(a => a.status === 'missing');
    const definedCount = missingFactors.filter(f => definedFactors[f.id]).length;
    const allDefined = missingFactors.length > 0 && definedCount === missingFactors.length;
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 text-sm">
          <div className="flex items-center gap-2 mb-2 text-slate-700 font-medium"><Database size={18} /><span>AI 因子盘点结果</span></div>
          <p className="text-slate-500">基于您的需求，我检索了因子知识库。发现了 {MOCK_ASSETS.filter(a => a.status === 'exists').length} 个现有元因子，{missingFactors.length} 个缺失逻辑需要补充定义。</p>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold">
              <tr><th className="px-6 py-4">识别实体</th><th className="px-6 py-4">对应 ID</th><th className="px-6 py-4">状态</th><th className="px-6 py-4">说明</th><th className="px-6 py-4 w-20">操作</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MOCK_ASSETS.map((asset, idx) => {
                const isMissing = asset.status === 'missing';
                const isExpanded = expandedFactors[asset.id];
                const isDefined = definedFactors[asset.id];
                return (
                  <React.Fragment key={idx}>
                    <tr className={`${isMissing ? isDefined ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100 cursor-pointer' : 'hover:bg-slate-50'} transition-colors`}
                      onClick={() => isMissing && !isDefined && toggleFactorExpand(asset.id)}>
                      <td className="px-6 py-4 font-medium text-slate-800">{asset.name}</td>
                      <td className="px-6 py-4 font-mono text-slate-500">{asset.id}</td>
                      <td className="px-6 py-4">{isDefined ? <Badge type="exists" text="已定义" /> : <Badge type={asset.status} text={asset.status === 'exists' ? '已存在' : '缺失'} />}</td>
                      <td className="px-6 py-4 text-slate-500">{asset.description}</td>
                      <td className="px-6 py-4">
                        {isMissing && !isDefined && (
                          <button onClick={(e) => { e.stopPropagation(); toggleFactorExpand(asset.id); }}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded p-1 transition-colors" title={isExpanded ? '收起' : '展开定义'}>
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isMissing && isExpanded && !isDefined && (
                      <tr><td colSpan="5" className="px-6 py-5 bg-slate-50 border-t border-slate-200">
                        <Card title={`定义缺失逻辑：${asset.name}`} className="border-blue-200 shadow-md">
                          <div className="space-y-4">
                            <div className="text-sm text-slate-600">AI 建议定义：根据参数值动态判断方向。</div>
                            <div className="bg-slate-900 text-green-400 p-3 rounded-lg font-mono text-xs whitespace-pre-wrap">{`// 建议的 DSL 片段\n${asset.suggestedDSL || '// 暂无建议代码'}`}</div>
                            <div className="flex justify-end gap-3">
                              <button className="px-4 py-2 text-slate-600 text-sm hover:bg-slate-100 rounded">修改定义</button>
                              <button onClick={() => handleDefineFactor(asset.id)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-2"><CheckCircle size={16} /> 确认并采纳</button>
                            </div>
                          </div>
                        </Card>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {missingFactors.length > 0 && (
          <div className="bg-blue-50 p-5 rounded-lg border border-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-700"><AlertCircle size={18} /><span className="text-sm font-medium">进度：已定义 {definedCount}/{missingFactors.length} 个缺失因子</span></div>
            {allDefined && <div className="flex items-center gap-2 text-green-700"><CheckCircle size={18} /><span className="text-sm font-medium">所有缺失因子已补全，可以继续下一步</span></div>}
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════ B 方案改造：Step 3 = 开发 & 审阅 ══════════════════════

  const dslComplete = dslEditable;

  const renderStep3 = () => (
    <div className="space-y-6 animate-fadeIn">
      {/* DSL 代码编辑器 */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <div className="flex gap-3">
            <Badge type="info" text="三段式结构" />
            <Badge type="info" text="时序校验通过" />
          </div>
          <button onClick={() => { dslStreamingRef.current = false; startDSLStreaming(); dslStreamingRef.current = true; }}
            className="text-sm flex items-center gap-2 text-slate-500 hover:text-blue-600 px-3 py-1.5 hover:bg-blue-50 rounded transition-colors">
            <RefreshCw size={16} /> 重新生成
          </button>
        </div>
        <div className="relative bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-inner min-h-[380px]">
          <div className="absolute top-0 left-0 w-full h-10 bg-slate-800 flex items-center px-4 border-b border-slate-700">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="ml-4 text-xs text-slate-400 font-mono">DerivativeMarketValue.dsl</span>
            {dslEditable && <span className="ml-auto text-xs text-green-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block"></span>可编辑</span>}
          </div>
          <textarea readOnly={!dslEditable} value={displayedDSL}
            onChange={(e) => { setDisplayedDSL(e.target.value); if (dslEditable) setCodeModified(true); }}
            className="w-full h-full pt-12 px-6 pb-6 bg-transparent text-slate-300 font-mono text-sm resize-none outline-none leading-relaxed min-h-[380px]" />
          {!dslComplete && (
            <div className="absolute bottom-4 right-4 text-slate-500 text-xs flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>正在生成...</span>
            </div>
          )}
        </div>
      </div>

      {/* 代码审阅区（DSL 生成完毕后渐入）*/}
      {dslComplete && (
        <div className="space-y-4 animate-fadeIn">
          {/* 业务翻译官 */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="text-indigo-600" size={20} />
                <h3 className="font-bold text-indigo-900 text-base">代码-业务翻译官 (Reviewer)</h3>
              </div>
              {codeModified && !translatorLoading && (
                <button onClick={regenerateTranslation}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 transition-colors shadow-sm">
                  <RefreshCw size={12} /> 重新生成翻译
                </button>
              )}
            </div>
            {codeModified && !translatorLoading && (
              <div className="bg-amber-100 border border-amber-200 rounded-lg px-4 py-2.5 mb-4 flex items-center gap-2 text-sm text-amber-800">
                <AlertCircle size={16} className="shrink-0" />
                <span>DSL 代码已修改，当前翻译可能与最新代码不同步</span>
              </div>
            )}
            {translatorLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <RefreshCw className="animate-spin text-indigo-500 mb-3" size={24} />
                <p className="text-sm text-indigo-600 font-medium">正在重新分析代码...</p>
              </div>
            ) : (
              <div className={`prose prose-sm max-w-none text-slate-700 transition-opacity ${codeModified ? 'opacity-40' : ''}`}>
                {EXPLANATION_TEXT.split('\n').map((line, i) => (
                  <p key={i} className="mb-2">{line}</p>
                ))}
              </div>
            )}
          </div>

          {/* 语法风控报告 */}
          <div className={`flex flex-wrap gap-6 bg-green-50 border border-green-100 rounded-xl px-6 py-4 transition-opacity ${codeModified || translatorLoading ? 'opacity-40' : ''}`}>
            <div className="flex items-center gap-2 text-green-700 text-sm font-semibold"><ShieldCheck size={18} /> 语法风控报告</div>
            <div className="flex flex-wrap gap-4 text-sm text-green-700">
              <span className="flex items-center gap-1.5"><CheckCircle size={14} /> 三段式结构完整</span>
              <span className="flex items-center gap-1.5"><CheckCircle size={14} /> 时序函数作用域正确</span>
              <span className="flex items-center gap-1.5"><CheckCircle size={14} /> 可变因子(MF#129)位于 sum 外部</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ══════════════════════ B 方案改造：Step 4 = 仿真测试 ══════════════════════

  const selectCls = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white";
  const inputCls  = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono";

  const renderStep4 = () => (
    <div className="space-y-6 animate-fadeIn">
      {/* 提交成功横幅 */}
      {submitted && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 shadow-lg animate-fadeIn">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-md animate-scaleIn">
              <CheckCircle size={32} className="text-white animate-checkmark" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-green-800 mb-1">提交成功！</h3>
              <p className="text-green-700 text-sm">您的因子 <span className="font-semibold">"{requirement.name}"</span> 已成功提交并发布到因子开发系统。</p>
              <p className="text-green-600 text-xs mt-2">系统正在后台处理，预计 1-2 分钟后可在因子库中查看。</p>
            </div>
          </div>
        </div>
      )}

      {/* 测试数据输入 */}
      <Card title="仿真沙箱" icon={<Play size={16} className="text-blue-600" />}>
        {/* 预置场景 */}
        <div className="mb-5">
          <div className="text-xs font-medium text-slate-500 mb-2">快速加载测试场景</div>
          <div className="flex flex-wrap gap-2">
            {PRESET_TEST_CASES.map((tc, i) => (
              <button key={i} onClick={() => loadPreset(i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  activePreset === i
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                }`}>
                {tc.name}
              </button>
            ))}
          </div>
        </div>

        {/* 输入表单 */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3 mb-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">证券类型 (MF#63)</label>
            <select value={testData.secType} onChange={e => updateField('secType', e.target.value)} className={selectCls}>
              <option value="FUT">FUT（期货）</option>
              <option value="OPT">OPT（期权）</option>
              <option value="STK">STK（股票）</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">消息类型 (MF#0)</label>
            <select value={testData.msgType} onChange={e => updateField('msgType', Number(e.target.value))} className={selectCls}>
              <option value={6}>6 — 持仓</option>
              <option value={4}>4 — 成交</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">持仓方向 (MF#23)</label>
            <select value={testData.direction} onChange={e => updateField('direction', Number(e.target.value))} className={selectCls}>
              <option value={1}>1 — 多头</option>
              <option value={2}>2 — 空头</option>
              <option value={3}>3 — 空头(备兑)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">持仓数量 (MF#7)</label>
            <input type="number" value={testData.holdQty} onChange={e => updateField('holdQty', Number(e.target.value))}
              className={inputCls} disabled={testData.msgType === 4} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">买入数量 (MF#5)</label>
            <input type="number" value={testData.buyQty} onChange={e => updateField('buyQty', Number(e.target.value))}
              className={inputCls} disabled={testData.msgType === 6} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">卖出数量 (MF#6)</label>
            <input type="number" value={testData.sellQty} onChange={e => updateField('sellQty', Number(e.target.value))}
              className={inputCls} disabled={testData.msgType === 6} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">合约乘数 (MF#131)</label>
            <input type="number" value={testData.multiplier} onChange={e => updateField('multiplier', Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">最新价 (MF#129)</label>
            <input type="number" step="0.01" value={testData.latestPrice} onChange={e => updateField('latestPrice', Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">轧差方式 (PR#10007)</label>
            <select value={testData.nettingMode} onChange={e => updateField('nettingMode', Number(e.target.value))} className={selectCls}>
              <option value={2}>2 — 不轧差</option>
              <option value={3}>3 — 轧差</option>
            </select>
          </div>
        </div>

        {/* 预期值 & 执行按钮 */}
        <div className="flex items-end gap-4 pt-2 border-t border-slate-100">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs font-medium text-slate-500 mb-1">预期结果（可选，用于对比）</label>
            <input type="number" step="any" value={expectedValue} onChange={e => setExpectedValue(e.target.value)}
              placeholder="输入你期望的计算结果" className={inputCls} />
          </div>
          <button onClick={executeTest} disabled={testing}
            className={`px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-sm ${
              testing ? 'bg-blue-400 text-white cursor-wait' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}>
            {testing ? <><RefreshCw className="animate-spin" size={16} />计算中...</> : <><Play size={16} />执行仿真</>}
          </button>
        </div>
      </Card>

      {/* 决策流程图（始终可见，执行后高亮路径）*/}
      <Card title="决策流程图" icon={<GitBranch size={16} className="text-blue-600" />}>
        <FlowDiagram activeItems={animItems} currentItem={currentAnimItem} />
        {animItems.size === 0 && !testResult && (
          <p className="text-center text-xs text-slate-400 mt-3">执行仿真后，实际路径将逐步高亮显示</p>
        )}
      </Card>

      {/* 测试结果（执行后显示）*/}
      {testResult && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
          {/* 计算追踪 */}
          <Card title="计算追踪" icon={<Eye size={16} className="text-blue-600" />}>
            <div className="space-y-3">
              {testResult.steps.map((s, i) => (
                <div key={i} className={`flex items-start gap-3 ${s.pass === false ? 'opacity-60' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    s.pass === false ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'
                  }`}>{i + 1}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700">{s.name}</div>
                    <div className="text-xs font-mono text-slate-500 mt-0.5 break-all">{s.expr}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 测试结果 */}
          <Card title="测试结果">
            {testResult.error ? (
              <div className="rounded-lg border-2 border-orange-200 bg-orange-50 p-5 text-center">
                <AlertCircle className="mx-auto text-orange-500 mb-2" size={28} />
                <div className="text-orange-800 font-semibold text-sm">{testResult.error}</div>
                <p className="text-orange-600 text-xs mt-1">该条件组合不会触发因子计算</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`rounded-lg border-2 p-5 text-center ${
                  expectedValue && Number(expectedValue) === testResult.result
                    ? 'border-green-300 bg-green-50'
                    : expectedValue && Number(expectedValue) !== testResult.result
                    ? 'border-red-300 bg-red-50'
                    : 'border-blue-200 bg-blue-50'
                }`}>
                  <div className="text-xs text-slate-500 mb-1">计算输出</div>
                  <div className="text-3xl font-bold text-slate-800">{testResult.result.toLocaleString()}</div>
                </div>

                {expectedValue && (
                  <div className={`flex items-center justify-center gap-2 text-sm font-medium ${
                    Number(expectedValue) === testResult.result ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {Number(expectedValue) === testResult.result
                      ? <><CheckCircle size={16} /> 与预期值一致 ({Number(expectedValue).toLocaleString()})</>
                      : <><AlertCircle size={16} /> 与预期值不符（预期 {Number(expectedValue).toLocaleString()}，差异 {(testResult.result - Number(expectedValue)).toLocaleString()}）</>}
                  </div>
                )}

                {!expectedValue && (
                  <p className="text-xs text-slate-400 text-center">输入预期结果可自动对比</p>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════ 主 JSX ═══════════════════════════════

  return (
    <div className="min-h-screen bg-slate-100 p-6 flex justify-center font-sans text-slate-800">
      <div className="w-full max-w-7xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')}
              className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="返回首页">
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
              <button onClick={() => navigate('/req-to-dsl')}
                className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-700 transition-colors">
                方案 A
              </button>
              <span className="px-3 py-1.5 text-xs font-medium rounded-md bg-white text-blue-600 shadow-sm">
                方案 B
              </span>
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
          {/* 主内容区 */}
          <div className="flex-1 flex flex-col p-8 overflow-y-auto">
            <StepIndicator currentStep={currentStep} steps={steps} />
            <div className="flex-1">
              {currentStep === 0 && renderStep1()}
              {currentStep === 1 && renderStep2()}
              {currentStep === 2 && renderStep3()}
              {currentStep === 3 && renderStep4()}
            </div>

            {/* 底部按钮 */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center">
              <button onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}
                className="px-4 py-2 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors">
                上一步
              </button>
              <div className="flex gap-3">
                {currentStep === 3 ? (
                  <button onClick={handleSubmit} disabled={submitting || submitted}
                    className={`px-6 py-2.5 rounded-lg shadow-md flex items-center gap-2 transition-all ${
                      submitted ? 'bg-green-500 text-white cursor-default'
                        : submitting ? 'bg-green-400 text-white cursor-wait'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    } disabled:opacity-100`}>
                    {submitted ? <><CheckCircle size={18} className="animate-bounce" /> 提交成功！</>
                      : submitting ? <><RefreshCw className="animate-spin" size={18} /> 提交中...</>
                      : <><CheckCircle size={18} /> 提交并发布</>}
                  </button>
                ) : (
                  <button onClick={handleNext}
                    disabled={(() => {
                      if (loading) return true;
                      if (currentStep === 1) {
                        const mf = MOCK_ASSETS.filter(a => a.status === 'missing');
                        const dc = mf.filter(f => definedFactors[f.id]).length;
                        return mf.length > 0 && dc !== mf.length;
                      }
                      return false;
                    })()}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg shadow-md shadow-blue-200 hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                    {loading ? <><RefreshCw className="animate-spin" size={18} /> 处理中...</> : <>下一步 <ArrowRight size={18} /></>}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 右侧边栏 */}
          <div className="w-96 border-l border-slate-200 bg-slate-50 p-6 hidden lg:flex flex-col gap-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Context Awareness</div>
            <Card title="当前上下文" className="text-xs">
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-slate-500">业务域:</span><span className="font-medium">衍生品/持仓</span></div>
                <div className="flex justify-between"><span className="text-slate-500">元数据:</span><span className="font-medium text-green-600">已加载 5 个</span></div>
                <div className="flex justify-between">
                  <span className="text-slate-500">依赖检查:</span>
                  <span className={`font-medium ${(() => {
                    const mf = MOCK_ASSETS.filter(a => a.status === 'missing');
                    const dc = mf.filter(f => definedFactors[f.id]).length;
                    return (mf.length === 0 || dc === mf.length || currentStep > 1) ? 'text-green-600' : 'text-orange-500';
                  })()}`}>
                    {(() => {
                      const mf = MOCK_ASSETS.filter(a => a.status === 'missing');
                      const dc = mf.filter(f => definedFactors[f.id]).length;
                      return (mf.length === 0 || dc === mf.length || currentStep > 1) ? '通过' : '待处理';
                    })()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">方案:</span>
                  <span className="font-medium text-blue-600">B（开发+审阅 / 仿真测试）</span>
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
