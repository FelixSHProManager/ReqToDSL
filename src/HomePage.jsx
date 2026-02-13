import { useEffect, useState, createContext, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot,
  ChevronDown,
  X,
  Edit3,
  Bold,
  Italic,
  Underline,
  MoreHorizontal,
  Type,
  AlignLeft,
  AlignRight,
  List,
  Image as ImageIcon,
  Link as LinkIcon,
  Code,
  Undo,
  Redo,
  Maximize,
  Grid,
  Save,
  Play,
  Settings,
  Database,
  Layers,
  Cpu,
  Maximize2,
  Info,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Plus,
  Languages,
  ChevronRight,
  Table as TableIcon,
  Search,
  Eye,
  Trash2,
  Bell,
  User,
  RefreshCw,
  Download,
  FileText,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Clock,
  Paperclip,
  Send,
  MessageSquare,
  Power,
  BarChart3,
  Briefcase,
  Clipboard,
  Calendar,
  Scale,
  DollarSign,
  Folder,
  Upload,
  Activity,
  Gavel,
  BookOpen,
  Package,
  Server,
  TrendingUp,
  ArrowRight,
  Minus,
  CheckCircle,
  Home,
} from 'lucide-react'

// AI-Readability: 统一的结构化错误日志（供 AI 从 Console 稳定提取上下文）
// NOTE: 仅在 catch 中调用，不改变原有正常流程逻辑
const logAiDebugEvent = ({
  error_code,
  action,
  context = {},
  error,
}) => {
  try {
    console.error(
      '[AI_DEBUG_EVENT]',
      JSON.stringify({
        error_code,
        action,
        ...context,
        stack: error?.stack,
      }),
    )
  } catch (e) {
    // 避免序列化失败导致二次异常
    console.error('[AI_DEBUG_EVENT]', '{"error_code":"ai_debug_event_serialize_failed","action":"log"}')
  }
}

// 环境上下文
const EnvironmentContext = createContext()

export const EnvironmentProvider = ({ children }) => {
  // 从 localStorage 读取保存的环境选择
  // ACTION(Init): 启动时从 localStorage 恢复上次选择的环境（产品/版本），用于跨刷新保持状态
  const getStoredEnvironment = () => {
    const stored = localStorage.getItem('environment')
    if (stored) {
      return JSON.parse(stored)
    }
    return { product: '创智-估值', version: 'v1.0.0' }
  }

  const [environment, setEnvironment] = useState(getStoredEnvironment())
  const [isLoading, setIsLoading] = useState(false)

  // 环境数据
  const environments = [
    {
      product: '创智-估值',
      versions: [
        { id: 'v1.0.0', name: 'v1.0.0', type: '生产' },
        { id: 'v1.0.0-dev', name: 'v1.0.0', type: '开发' },
        { id: 'v1.0.0-pre', name: 'v1.0.0', type: '准生产' },
      ],
    },
    {
      product: '创智-风控',
      versions: [
        { id: 'v1.0.0', name: 'v1.0.0', type: '生产' },
        { id: 'v1.0.0-dev', name: 'v1.0.0', type: '开发' },
        { id: 'v1.0.0-pre', name: 'v1.0.0', type: '准生产' },
      ],
    },
    {
      product: '创智-全局',
      versions: [
        { id: 'v1.0.0', name: 'v1.0.0', type: '生产' },
        { id: 'v1.0.0-dev', name: 'v1.0.0', type: '开发' },
        { id: 'v1.0.0-pre', name: 'v1.0.0', type: '准生产' },
      ],
    },
  ]

  // 切换环境
  // ACTION(Switch): 用户在环境切换器中选择“产品/版本”后触发
  // EFFECT: 写入 localStorage；模拟加载；更新环境状态；广播 environmentChanged 事件供其它模块订阅
  const switchEnvironment = (product, version) => {
    try {
      setIsLoading(true)
      // 保存到 localStorage
      const newEnv = { product, version }
      localStorage.setItem('environment', JSON.stringify(newEnv))
      
      // 模拟数据加载延迟
      setTimeout(() => {
        try {
          setEnvironment(newEnv)
          setIsLoading(false)
          // 触发页面刷新（可以通过事件或状态更新）
          window.dispatchEvent(new CustomEvent('environmentChanged', { detail: newEnv }))
        } catch (error) {
          logAiDebugEvent({
            error_code: 'env_switch_apply_failed',
            action: 'switch_environment_apply',
            context: { env_snapshot: newEnv },
            error,
          })
          // 保持原逻辑：不抛出到上层
        }
      }, 300)
    } catch (error) {
      logAiDebugEvent({
        error_code: 'env_switch_failed',
        action: 'switch_environment',
        context: { env_snapshot: { product, version } },
        error,
      })
      // 保持原逻辑：不抛出到上层
    }
  }

  // 获取当前版本信息
  // INTENT(Read): 根据当前环境（product/version）查找版本展示信息（name/type），用于 UI 展示
  const getCurrentVersionInfo = () => {
    const productData = environments.find(env => env.product === environment.product)
    if (productData) {
      const versionInfo = productData.versions.find(v => v.id === environment.version)
      return versionInfo || { name: environment.version, type: '开发' }
    }
    return { name: environment.version, type: '开发' }
  }

  return (
    <EnvironmentContext.Provider
      value={{
        environment,
        environments,
        switchEnvironment,
        isLoading,
        getCurrentVersionInfo,
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  )
}

export const useEnvironment = () => {
  const context = useContext(EnvironmentContext)
  if (!context) {
    throw new Error('useEnvironment must be used within EnvironmentProvider')
  }
  return context
}

// 环境切换器组件
const EnvironmentSwitcher = () => {
  const { environment, environments, switchEnvironment, isLoading, getCurrentVersionInfo } = useEnvironment()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(environment.product)

  const versionInfo = getCurrentVersionInfo()

  // ACTION(Click): 用户在下拉中切换“产品”时触发（仅更新下拉选中态，不真正切环境）
  const handleProductSelect = (product) => {
    setSelectedProduct(product)
  }

  // ACTION(Click): 用户在下拉中点击“版本”时触发（真正切环境）
  // EFFECT: 调用 switchEnvironment；关闭下拉；把 selectedProduct 复位回当前环境产品（避免残留）
  const handleVersionSelect = (version) => {
    switchEnvironment(selectedProduct, version)
    setIsOpen(false)
    setSelectedProduct(environment.product)
  }

  const currentProductData = environments.find(env => env.product === selectedProduct)

  return (
    <div className="relative">
      <button
        // ACTION(Click): 打开/关闭环境选择下拉面板
        onClick={() => setIsOpen(!isOpen)}
        data-testid="env-switcher-toggle-btn"
        aria-label="打开或关闭环境切换下拉面板"
        className="flex items-center space-x-2 px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#333] rounded text-sm transition-colors border border-[#404040]"
        disabled={isLoading}
      >
        <span className="text-white">{environment.product}</span>
        <span className="text-gray-400">&gt;</span>
        <span className="text-[#1E6FF2]">{versionInfo.name}({versionInfo.type})</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            // ACTION(Click): 点击遮罩关闭下拉面板
            onClick={() => setIsOpen(false)}
            data-testid="env-switcher-mask-clickable"
            aria-label="关闭环境切换下拉面板"
          />
          <div className="absolute top-full right-0 mt-2 w-64 bg-[#2a2a2a] border border-[#404040] rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              {environments.map((env) => (
                <div key={env.product} className="border-b border-[#404040] last:border-b-0">
                  <div
                    className={`px-4 py-2 cursor-pointer hover:bg-[#333] transition-colors ${
                      selectedProduct === env.product ? 'bg-[#333]' : ''
                    }`}
                    // ACTION(Click): 选择某个产品，展开其版本列表
                    onClick={() => handleProductSelect(env.product)}
                    data-testid={`env-${env.product}-product-clickable`}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm font-medium">{env.product}</span>
                      <ChevronRight size={14} className="text-gray-400" />
                    </div>
                  </div>
                  {selectedProduct === env.product && (
                    <div className="bg-[#1e1e1e]">
                      {env.versions.map((version) => (
                        <div
                          key={version.id}
                          className={`px-6 py-2 cursor-pointer hover:bg-[#2a2a2a] transition-colors ${
                            environment.product === env.product && environment.version === version.id
                              ? 'bg-[#1E6FF2] bg-opacity-20 border-l-2 border-[#1E6FF2]'
                              : ''
                          }`}
                          // ACTION(Click): 选择某个版本并切换环境
                          onClick={() => handleVersionSelect(version.id)}
                          data-testid={`env-${env.product}-${version.id}-version-clickable`}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-white text-sm">{env.product}</span>
                            <span className="text-gray-400">&gt;</span>
                            <span className="text-[#1E6FF2] text-sm">{version.name}({version.type})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {isLoading && (
        <div className="absolute top-full right-0 mt-2 px-3 py-2 bg-[#2a2a2a] border border-[#404040] rounded text-xs text-gray-400">
          切换中...
        </div>
      )}
    </div>
  )
}

// 面包屑导航组件
const Breadcrumb = ({ items = [] }) => {
  const { environment, getCurrentVersionInfo } = useEnvironment()
  const versionInfo = getCurrentVersionInfo()

  // 构建完整路径
  // INTENT(Build): 组合“平台/环境/版本/页面路径”的面包屑数据结构，用于导航展示（当前实现不做真正路由跳转）
  const buildBreadcrumb = () => {
    const basePath = [
      { label: '创智平台', path: '/', icon: Home },
    ]

    // 添加环境和版本信息
    basePath.push({
      label: environment.product,
      path: null,
    })
    basePath.push({
      label: `${versionInfo.name}(${versionInfo.type})`,
      path: null,
    })

    // 添加页面路径
    if (items && items.length > 0) {
      basePath.push(...items)
    }

    return basePath
  }

  const breadcrumbItems = buildBreadcrumb()

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1
        const IconComponent = item.icon

        return (
          <div key={index} className="flex items-center space-x-2">
            {index > 0 && <span className="text-gray-400">/</span>}
            {item.path && !isLast ? (
              <a
                href={item.path}
                // ACTION(Navigate): 仅当 item.path 存在且非最后一项时可点击跳转（当前 demo 主要用于样式展示）
                className="hover:text-[#1E6FF2] transition-colors flex items-center space-x-1"
              >
                {IconComponent && <IconComponent size={14} />}
                <span>{item.label}</span>
              </a>
            ) : (
              <span
                className={`flex items-center space-x-1 ${
                  isLast ? 'text-gray-800 font-semibold' : 'text-gray-600'
                }`}
              >
                {IconComponent && <IconComponent size={14} />}
                <span>{item.label}</span>
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}

const SECTIONS = [
  { id: 'basic', label: '基础信息' },
  { id: 'calc', label: '计算信息' },
  { id: 'other', label: '其他配置' },
  { id: 'assoc', label: '关联因子参数' },
  { id: 'summary', label: '汇总因子算法' },
]

const FACTOR_CATEGORY_OPTIONS = [
  {
    label: '交易类',
    value: 'trade',
    children: [
      { label: '交易价格类', value: 'trade-price' },
      { label: '交易数量类', value: 'trade-quantity' },
      { label: '交易金额类', value: 'trade-amount' },
      { label: '异常交易类', value: 'trade-exception' },
    ],
  },
  {
    label: '持仓类',
    value: 'position',
    children: [
      { label: '个数类', value: 'position-count' },
      { label: '市值类', value: 'position-market-value' },
      { label: '成本类', value: 'position-cost' },
      { label: '数量类', value: 'position-quantity' },
      { label: '金额类', value: 'position-amount' },
    ],
  },
  {
    label: '基础信息类',
    value: 'basic-info',
    children: [
      { label: '组合类', value: 'basic-portfolio' },
      { label: '证券类', value: 'basic-security' },
      { label: '主体类', value: 'basic-entity' },
      { label: '行情类', value: 'basic-market' },
    ],
  },
  {
    label: '期限类',
    value: 'tenor',
    children: [
      { label: '久期类', value: 'tenor-duration' },
      { label: '到期日类', value: 'tenor-maturity-date' },
      { label: '剩余期限类', value: 'tenor-remaining' },
    ],
  },
  {
    label: '限额类',
    value: 'limit',
    children: [{ label: '限额类', value: 'limit-default' }],
  },
  {
    label: '估值类',
    value: 'valuation',
    children: [{ label: '资产类', value: 'valuation-asset' }],
  },
]

const VALUE_TYPE_OPTIONS = [
  { label: '字符串', value: 'string' },
  { label: '整数', value: 'integer' },
  { label: '日期', value: 'date' },
  { label: '长整型', value: 'long' },
  { label: '时间', value: 'time' },
  { label: '小数', value: 'decimal' },
  { label: '文本', value: 'text' },
]

const UNIT_OPTIONS = [
  { label: '无', value: 'none' },
  { label: '元', value: 'cny' },
  { label: '字节', value: 'byte' },
  { label: '毫秒', value: 'millisecond' },
  { label: '万元', value: 'ten-thousand-cny' },
  { label: '股', value: 'share' },
  { label: '万（股/张/份）', value: 'ten-thousand-share' },
  { label: '天', value: 'day' },
  { label: '%', value: 'percent' },
  { label: '月', value: 'month' },
  { label: '年', value: 'year' },
]

const DECIMAL_PLACES_OPTIONS = [
  { label: '0', value: '0' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '4', value: '4' },
  { label: '5', value: '5' },
  { label: '6', value: '6' },
  { label: '7', value: '7' },
  { label: '8', value: '8' },
  { label: '9', value: '9' },
  { label: '10', value: '10' },
]

const VALUE_RANGE_OPTIONS = [
  { label: '[0,+∞)', value: '[0,+∞)' },
  { label: '(0,+∞)', value: '(0,+∞)' },
  { label: '(-∞,+∞)', value: '(-∞,+∞)' },
  { label: '[0,1]', value: '[0,1]' },
  { label: '日期格式(19000101,99991231)', value: 'date-format' },
  { label: '0或1', value: '0-or-1' },
  { label: '(-∞,0) U (0,+∞)', value: '(-∞,0) U (0,+∞)' },
  { label: '(-∞,0)', value: '(-∞,0)' },
]

const FACTOR_CALC_TYPE_OPTIONS = [
  { label: '价格类', value: 'price' },
  { label: '数量类', value: 'quantity' },
  { label: '金额类', value: 'amount' },
  { label: '天数类', value: 'days' },
  { label: '日期类', value: 'date' },
  { label: '个数类', value: 'count' },
  { label: '行为类', value: 'behavior' },
]

const REFERENCED_FACTOR_OPTIONS = [
  { label: '持仓数量', value: 'holding-quantity' },
  { label: '转融通出借数量', value: 'securities-lending-quantity' },
  { label: '质押券数量', value: 'pledged-securities-quantity' },
  { label: '现货持仓市值', value: 'spot-holding-market-value' },
  { label: '衍生品持仓市值', value: 'derivative-holding-market-value' },
  { label: '存款余额', value: 'deposit-balance' },
  { label: '转融通市值', value: 'securities-lending-market-value' },
  { label: '持仓成本', value: 'holding-cost' },
  { label: '持仓个数', value: 'number-of-holdings' },
  { label: '总股本', value: 'total-share-capital' },
  { label: '总股本 (指定日期)', value: 'total-share-capital-specified-date' },
]

const MONITORING_MODE_OPTIONS = [
  { label: '事前-指令', value: 'pre-event-instruction' },
  { label: '事前-委托', value: 'pre-event-entrustment' },
  { label: '事前-询价', value: 'pre-event-inquiry' },
  { label: '事中', value: 'in-event' },
  { label: '事后', value: 'post-event' },
]

const CALCULATION_DIMENSION_OPTIONS = [
  {
    label: '对象维度',
    value: 'object-dimension',
    children: [
      { label: '1-产品', value: '1-product' },
      { label: '2-资产单元', value: '2-asset-unit' },
      { label: '3-组合', value: '3-portfolio' },
    ],
  },
  {
    label: '标的维度',
    value: 'target-dimension',
    children: [
      {
        label: '证券',
        value: 'securities',
        children: [
          { label: '10-证券四级分类', value: '10-securities-four-level' },
          { label: '11-月份', value: '11-month' },
          { label: '13-债项评级', value: '13-debt-rating' },
          { label: '16-标的', value: '16-target' },
          { label: '17-月份和标的', value: '17-month-and-target' },
          { label: '23-证券池', value: '23-securities-pool' },
          { label: '30-单笔', value: '30-single-transaction' },
          { label: '4-证券', value: '4-securities' },
          { label: '7-证券一级分类', value: '7-securities-first-level' },
        ],
      },
      {
        label: '对手',
        value: 'counterparty',
        children: [
          { label: '5-交易对手', value: '5-trading-counterparty' },
        ],
      },
      {
        label: '主体',
        value: 'subject',
        children: [
          { label: '12-发行人', value: '12-issuer' },
          { label: '14-发行人 (ABS作为...)', value: '14-issuer-abs' },
          { label: '15-原始权益人', value: '15-original-beneficiary' },
          { label: '22-发行人发行或担保', value: '22-issuer-issued-guaranteed' },
          { label: '25-发行人发行或担保...', value: '25-issuer-issued-guaranteed-2' },
          { label: '26-发行人发行或担保...', value: '26-issuer-issued-guaranteed-3' },
          { label: '27-同一发行人(ABS...', value: '27-same-issuer-abs' },
          { label: '28-省份', value: '28-province' },
          { label: '29-同一发行人及其关...', value: '29-same-issuer-related' },
        ],
      },
      {
        label: '行业',
        value: 'industry',
        children: [
          { label: '18-行业 (按申万一级)', value: '18-industry-shenwan-1' },
          { label: '19-行业 (按申万二级)', value: '19-industry-shenwan-2' },
          { label: '20-行业 (按GICS财汇...)', value: '20-industry-gics-1' },
          { label: '21-行业 (按GICS财汇...)', value: '21-industry-gics-2' },
          { label: '31-同一行业', value: '31-same-industry' },
        ],
      },
    ],
  },
]

const Header = ({ onBotClick }) => {
  const [logoError, setLogoError] = useState(false)
  
  return (
    <header className="h-12 bg-[#1e1e1e] text-white flex items-center justify-between px-4 text-sm font-sans shrink-0 z-50 relative">
      <div className="flex items-center space-x-6">
        <div className="flex items-center font-bold text-base tracking-wide">
          {logoError ? (
            <span className="text-[#1E6FF2] mr-1">●</span>
          ) : (
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="h-6 w-6 mr-2 object-contain"
              // ACTION(Error): Logo 加载失败时改为用圆点占位（避免破图影响 UI）
              onError={() => setLogoError(true)}
            />
          )}
          国智创智超级开发平台
        </div>
      </div>
      <nav className="flex items-center space-x-6 text-gray-300">
        <a href="#" className="hover:text-white transition-colors">
          消息录入
        </a>
        <a href="#" className="hover:text-white transition-colors">
          元数据开发
        </a>
        <a href="#" className="hover:text-white transition-colors">
          离线数据开发
        </a>
        <a href="#" className="hover:text-white transition-colors">
          实时数据开发
        </a>
        <a
          href="#"
          className="flex items-center text-white font-medium transition-colors"
        >
          因子开发 <ChevronDown size={14} className="ml-1" />
        </a>
      </nav>
      <div className="flex items-center space-x-4">
        <EnvironmentSwitcher />
        <Bot 
          size={20} 
          className="text-blue-200 cursor-pointer hover:text-blue-300 transition-colors" 
          // ACTION(Click): 打开 AI 助手侧边栏（由父组件传入 onBotClick 控制）
          onClick={onBotClick}
          data-testid="header-ai-open-btn"
          aria-label="打开AI助手"
        />
        <div className="w-6 h-6 bg-[#1E6FF2] rounded-full flex items-center justify-center text-xs font-bold">
          超
        </div>
        <div className="text-xs text-gray-400 font-mono">
          系统时间: 2025-12-12 15:37:45
        </div>
      </div>
    </header>
  )
}

const TabBar = ({ activeTab, onTabChange, onCloseTab, openTabs = [] }) => {
  // ACTION(Click): 点击标签切换当前工作区
  const handleTabClick = (tabId) => {
    onTabChange(tabId)
  }

  // ACTION(Click): 点击标签上的 X 关闭该标签（阻止冒泡避免触发切换）
  const handleCloseTab = (e, tabId) => {
    e.stopPropagation()
    if (onCloseTab) {
      onCloseTab(tabId)
    }
  }

  // INTENT(Map): TabId → 展示名称映射（用于标签栏显示）
  const getTabLabel = (tabId) => {
    const labels = {
      'home': '首页',
      'factor': '业务因子开发',
      'metaFactor': '元因子开发',
      'realtime': '实时数据开发',
      'offline': '离线数据开发',
      'metadata': '元数据开发',
      'message': '消息定义',
      'system': '系统管理',
      'quality': '数据质量',
    }
    return labels[tabId] || tabId
  }

  return (
    <div className="h-10 bg-[#f5f7fa] border-b border-gray-200 flex items-center px-2 shadow-sm shrink-0">
      <div className="flex items-center space-x-1">
        <div
          onClick={() => handleTabClick('home')}
          // ACTION(Click): 切换到首页标签
          data-testid="tabbar-home-tab-clickable"
          role="button"
          tabIndex={0}
          className={`px-4 py-2 text-xs bg-white border border-transparent cursor-pointer rounded-t-sm transition-colors ${
            activeTab === 'home'
              ? 'text-[#1E6FF2] border-t-2 border-t-[#1E6FF2] border-l border-r border-gray-200 font-medium shadow-sm z-10 relative top-[1px]'
              : 'text-gray-600 hover:border-gray-200'
          }`}
        >
          首页
        </div>
        {openTabs.filter(tab => tab !== 'home').map((tabId) => (
          <div
            key={tabId}
            onClick={() => handleTabClick(tabId)}
            // ACTION(Click): 切换到某个已打开的功能标签
            data-testid={`tabbar-${tabId}-tab-clickable`}
            role="button"
            tabIndex={0}
            className={`px-4 py-2 text-xs bg-white border border-transparent cursor-pointer rounded-t-sm flex items-center transition-colors ${
              activeTab === tabId
                ? 'text-[#1E6FF2] border-t-2 border-t-[#1E6FF2] border-l border-r border-gray-200 font-medium shadow-sm z-10 relative top-[1px]'
                : 'text-gray-600 hover:border-gray-200'
            }`}
          >
            {activeTab === tabId && <span className="w-1.5 h-1.5 rounded-full bg-[#1E6FF2] mr-2"></span>}
            {getTabLabel(tabId)}
            <X
              size={12}
              className="ml-2 text-gray-400 hover:text-gray-600"
              // ACTION(Click): 关闭标签（不触发 tab 切换）
              onClick={(e) => handleCloseTab(e, tabId)}
              data-testid={`tabbar-${tabId}-close-btn`}
              aria-label={`关闭标签：${getTabLabel(tabId)}`}
              role="button"
              tabIndex={0}
            />
          </div>
        ))}
      </div>
      <div className="ml-auto">
        <div className="w-6 h-6 bg-white border border-gray-300 rounded flex items-center justify-center cursor-pointer hover:bg-gray-50">
          <ChevronDown size={14} className="text-gray-500" />
        </div>
      </div>
    </div>
  )
}

const SubHeader = ({ currentPage, onPageChange }) => (
  <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 space-x-3 shrink-0">
    <button 
      onClick={() => onPageChange('list')}
      data-testid="subheader-factorList-btn"
      className={`px-3 py-1.5 border text-xs rounded transition-colors ${
        currentPage === 'list'
          ? 'border-[#1E6FF2] text-[#1E6FF2] bg-[#EEF7FF] font-medium'
          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {currentPage === 'list' && <span className="w-1.5 h-1.5 rounded-full bg-[#1E6FF2] mr-2 inline-block"></span>}
      业务因子列表
    </button>
    <button
      onClick={() => onPageChange('new')}
      data-testid="subheader-newFactor-btn"
      className={`px-3 py-1.5 border text-xs rounded flex items-center transition-colors ${
        currentPage === 'new'
          ? 'border-[#1E6FF2] text-[#1E6FF2] bg-[#EEF7FF] font-medium'
          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {currentPage === 'new' && <span className="w-1.5 h-1.5 rounded-full bg-[#1E6FF2] mr-2"></span>}
      新增业务因子
      {currentPage === 'new' && (
        <X
          size={12}
          className="ml-2 cursor-pointer hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation()
            onPageChange('list')
          }}
          data-testid="subheader-newFactor-close-btn"
          aria-label="关闭新增业务因子页并返回列表"
          role="button"
          tabIndex={0}
        />
      )}
    </button>
    {currentPage === 'detail' && (
      <div className="px-3 py-1.5 border border-[#1E6FF2] text-[#1E6FF2] text-xs rounded bg-[#EEF7FF] flex items-center font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1E6FF2] mr-2"></span>
        因子详情
      </div>
    )}
  </div>
)

// 饼图组件
const PieChart = ({ data, size = 120 }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  let currentAngle = -90 // 从顶部开始
  
  const paths = data.map((item, index) => {
    const percentage = item.value / total
    const angle = percentage * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle
    
    const radius = size / 2
    const centerX = size / 2
    const centerY = size / 2
    
    const startX = centerX + radius * Math.cos((startAngle * Math.PI) / 180)
    const startY = centerY + radius * Math.sin((startAngle * Math.PI) / 180)
    const endX = centerX + radius * Math.cos((endAngle * Math.PI) / 180)
    const endY = centerY + radius * Math.sin((endAngle * Math.PI) / 180)
    
    const largeArcFlag = angle > 180 ? 1 : 0
    
    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${startX} ${startY}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
      'Z'
    ].join(' ')
    
    return (
      <path
        key={index}
        d={pathData}
        fill={item.color}
        stroke="#fff"
        strokeWidth="2"
      />
    )
  })
  
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths}
    </svg>
  )
}

// 工作台组件
const Workspace = ({ onCardClick }) => {
  const [dataDevTab, setDataDevTab] = useState('offline') // 'offline' | 'realtime'
  
  // 数据开发总览数据
  const dataDevOverview = [
    { name: '品种', value: 89, percentage: 69, color: '#10B981' },
    { name: '账户', value: 10, percentage: 8, color: '#3B82F6' },
    { name: '主体', value: 16, percentage: 12, color: '#F59E0B' },
    { name: '资产', value: 14, percentage: 11, color: '#8B5CF6' },
    { name: '交易', value: 0, percentage: 0, color: '#6B7280' },
  ]

  // 常用功能入口
  const commonFunctions = [
    { id: 'factor', title: '业务因子开发', icon: Cpu },
    { id: 'metaFactor', title: '元因子开发', icon: Layers },
    { id: 'realtime', title: '实时数据开发', icon: Database },
    { id: 'offline', title: '离线数据开发', icon: Upload },
    { id: 'metadata', title: '元数据开发', icon: FileText },
    { id: 'message', title: '消息定义', icon: MessageSquare },
    { id: 'system', title: '系统管理', icon: Settings },
    { id: 'quality', title: '数据质量', icon: CheckCircle },
  ]

  // 关键运营指标
  const keyMetrics = [
    { id: 'factor', label: '业务因子总数', value: '122', icon: Cpu },
    { id: 'metadata', label: '元数据总数', value: '4,221', icon: FileText },
    { id: 'job', label: '数据作业总数', value: '129', icon: Activity },
    { id: 'message', label: '消息总数', value: '2,049,120', icon: MessageSquare },
    { id: 'model', label: '数据模型总数', value: '1,202', icon: Package },
  ]

  // 整体流程数据
  const processData = [
    {
      category: "元数据开发",
      steps: ["数据源管理", "词根与元数据", "数据字典", "数据模型"]
    },
    {
      category: "离线数据开发",
      steps: ["连接器、函数管理", "离线数据作业", "离线作业调度配置"]
    },
    {
      category: "实时数据开发",
      steps: ["消息定义", "实时数据开发"]
    },
    {
      category: "因子开发",
      steps: ["维度管理", "元因子开发", "业务因子开发"]
    },
    {
      category: "指标配置",
      steps: ["指标配置", "指标监控"]
    },
    {
      category: "数据质量与血缘关系",
      steps: ["血缘关系", "质量检查"]
    }
  ]

  // 因子概览
  const factorOverview = [
    { label: '维度总数', value: '28', icon: BarChart3 },
    { label: '业务事件总数', value: '51', icon: Gavel },
    { label: '元因子总数', value: '441', icon: Layers },
    { label: '业务因子总数', value: '122', icon: Cpu },
  ]

  // 元数据概览
  const metadataOverview = [
    { label: '词根总数', value: '2,558', icon: BookOpen },
    { label: '元数据总数', value: '4,221', icon: FileText },
    { label: '数据字典总数', value: '895', icon: BookOpen },
    { label: '数据模型总数', value: '1,202', icon: Package },
    { label: '数据源总数', value: '6', icon: Server },
  ]

  // 消息总览数据
  const messageOverview = [
    { category: '品种', protocol: 12, total: 450892 },
    { category: '账户', protocol: 8, total: 320892 },
    { category: '主体', protocol: 15, total: 280892 },
    { category: '资产', protocol: 10, total: 250892 },
    { category: '交易', protocol: 14, total: 2048892 },
    { category: '估值', protocol: 6, total: 180892 },
    { category: '风控', protocol: 5, total: 150892 },
    { category: '公共', protocol: 4, total: 120892 },
  ]
  const messageTotal = messageOverview.reduce((sum, item) => sum + item.total, 0)
  const protocolTotal = messageOverview.reduce((sum, item) => sum + item.protocol, 0)

  // 数据模型TOP10
  const top10Models = [
    { name: '实时行情表', volume: 102048892, category: '品种' },
    { name: '成交流水表', volume: 22048892, category: '交易' },
    { name: '产品净值数据(实时)', volume: 12048892, category: '账户' },
    { name: '持仓明细表', volume: 8048892, category: '资产' },
    { name: '交易对手表', volume: 6048892, category: '主体' },
    { name: '估值数据表', volume: 5048892, category: '估值' },
    { name: '风控指标表', volume: 4048892, category: '风控' },
    { name: '公共参数表', volume: 3048892, category: '公共' },
    { name: '证券基础信息表', volume: 2048892, category: '品种' },
    { name: '账户基础信息表', volume: 1048892, category: '账户' },
  ]
  const maxVolume = Math.max(...top10Models.map(m => m.volume))

  return (
    <div className="flex-1 overflow-auto bg-[#f0f2f5]">
      <div className="max-w-[2400px] mx-auto px-4 py-10">
        {/* 第一层：常用功能入口 + 关键运营指标 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 常用功能入口 */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">常用功能</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {commonFunctions.map((func) => {
                const IconComponent = func.icon
                return (
                  <div
                    key={func.id}
                    // ACTION(Click): 点击常用功能入口卡片，跳转/打开对应标签
                    onClick={() => onCardClick(func.id)}
                    data-testid={`workspace-${func.id}-entry-clickable`}
                    role="button"
                    tabIndex={0}
                    className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-lg cursor-pointer transition-all hover:shadow-lg hover:border-[#1E6FF2] group"
                  >
                    <div className="w-16 h-16 bg-[#EEF7FF] rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                      <IconComponent size={32} className="text-[#1E6FF2]" />
                    </div>
                    <span className="text-sm font-medium text-gray-800 text-center">{func.title}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 关键运营指标 */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">关键运营指标</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {keyMetrics.map((metric) => {
                const IconComponent = metric.icon
                return (
                  <div
                    key={metric.id}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:bg-[#EEF7FF] transition-all cursor-pointer"
                    // ACTION(Click): 点击关键指标卡片，跳转到对应业务页面（当前映射：job→离线，model→元数据）
                    onClick={() => onCardClick(metric.id)}
                    data-testid={`workspace-metric-${metric.id}-clickable`}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-[#EEF7FF] rounded-lg flex items-center justify-center">
                        <IconComponent size={20} className="text-[#1E6FF2]" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">{metric.label}</p>
                        <p className="text-2xl font-bold text-gray-800">{metric.value}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 第二层：整体流程 + 数据开发总览 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 整体流程 */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">整体流程</h2>
            <div className="space-y-4">
              {processData.map((process, idx) => (
                <div key={idx} className="flex items-center">
                  {/* 左侧：类别名称 */}
                  <div className="w-32 flex-shrink-0 text-sm font-medium text-gray-700">
                    {process.category}
                  </div>
                  {/* 右侧：箭头步骤条 */}
                  <div className="flex-1 flex items-center">
                    {process.steps.map((step, stepIdx) => {
                      return (
                        <div key={stepIdx} className="flex items-center flex-1">
                          <div
                            className="relative px-4 py-2 bg-[#1E6FF2] text-white text-sm font-medium w-full text-center"
                            style={{
                              clipPath: 'polygon(0% 0%, calc(100% - 12px) 0%, 100% 50%, calc(100% - 12px) 100%, 0% 100%)',
                              marginRight: stepIdx < process.steps.length - 1 ? '-12px' : '0',
                              zIndex: process.steps.length - stepIdx
                            }}
                          >
                            {step}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 数据开发总览 */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">数据开发总览</h2>
              <div className="flex space-x-2">
                <button
                  // ACTION(Click): 切换“数据开发总览”视图到离线数据开发
                  onClick={() => setDataDevTab('offline')}
                  data-testid="workspace-datadev-offline-btn"
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    dataDevTab === 'offline'
                      ? 'bg-[#1E6FF2] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  离线数据开发
                </button>
                <button
                  // ACTION(Click): 切换“数据开发总览”视图到实时数据开发
                  onClick={() => setDataDevTab('realtime')}
                  data-testid="workspace-datadev-realtime-btn"
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    dataDevTab === 'realtime'
                      ? 'bg-[#1E6FF2] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  实时数据开发
                </button>
              </div>
            </div>
            <div className="flex items-start space-x-8">
              {/* 左侧：饼图 */}
              <div className="flex-shrink-0 flex items-center justify-center">
                <PieChart data={dataDevOverview} size={220} />
              </div>
              
              {/* 右侧：总数和图例 */}
              <div className="flex-1 min-w-0">
                <div className="mb-6">
                  <p className="text-base text-gray-600 mb-2">数据作业总数</p>
                  <p className="text-4xl font-bold text-gray-800">
                    {dataDevOverview.reduce((sum, item) => sum + item.value, 0)}
                  </p>
                </div>
                <div className="space-y-3">
                  {dataDevOverview.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-5 h-5 rounded flex-shrink-0" 
                          style={{ backgroundColor: item.color }}
                        ></div>
                        <span className="text-base font-medium text-gray-700">{item.name}</span>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className="text-base font-semibold text-gray-800">{item.value}</span>
                        <span className="text-base text-gray-500">({item.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 第三层：因子概览 + 元数据概览 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 因子概览 */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">因子概览</h2>
            <div className="grid grid-cols-2 gap-4">
              {factorOverview.map((item, idx) => {
                const IconComponent = item.icon
                return (
                  <div key={idx} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-[#EEF7FF] rounded-lg flex items-center justify-center">
                      <IconComponent size={16} className="text-[#1E6FF2]" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">{item.label}</p>
                      <p className="text-lg font-bold text-gray-800">{item.value}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 元数据概览 */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">元数据概览</h2>
            <div className="grid grid-cols-2 gap-4">
              {metadataOverview.map((item, idx) => {
                const IconComponent = item.icon
                return (
                  <div key={idx} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-[#EEF7FF] rounded-lg flex items-center justify-center">
                      <IconComponent size={16} className="text-[#1E6FF2]" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">{item.label}</p>
                      <p className="text-lg font-bold text-gray-800">{item.value}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 第三层：消息总览表格 */}
        <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">消息总览</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">消息分类</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">内部协议总数</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">消息总数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {messageOverview.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800">{item.category}</td>
                    <td className="px-4 py-3 text-gray-600">{item.protocol}</td>
                    <td className="px-4 py-3 text-gray-600">{item.total.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-3 text-gray-800">合计</td>
                  <td className="px-4 py-3 text-gray-800">{protocolTotal}</td>
                  <td className="px-4 py-3 text-gray-800">{messageTotal.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 第三层：数据模型数据量TOP10 */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">数据模型数据量 TOP10</h2>
            <div className="flex space-x-1">
              {['全部', '品种', '主体', '账户', '资产', '交易', '风控'].map((tab) => (
                <button
                  key={tab}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    tab === '全部'
                      ? 'bg-[#1E6FF2] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {top10Models.map((model, idx) => (
              <div key={idx} className="flex items-center space-x-4">
                <div className="w-8 text-center text-sm font-bold text-gray-600">{idx + 1}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800">{model.name}</span>
                    <span className="text-sm text-gray-600">{model.volume.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[#1E6FF2] h-2 rounded-full transition-all"
                      style={{ width: `${(model.volume / maxVolume) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const FormLabel = ({ label, required }) => (
  <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center">
    {required && <span className="text-red-500 mr-1">*</span>}
    {label}:
  </label>
)

const Input = ({ placeholder, value, readOnly, testId }) => (
  <input
    type="text"
    data-testid={testId}
    className="w-full h-8 px-3 text-xs border border-gray-300 rounded hover:border-[#1E6FF2] focus:border-[#1E6FF2] focus:ring-1 focus:ring-[#1E6FF2] outline-none transition-all placeholder-gray-300 bg-white"
    placeholder={placeholder}
    value={value || ''}
    readOnly={readOnly}
  />
)

const Select = ({ placeholder, options, value, readOnly, testId }) => {
  const hasOptions = Array.isArray(options) && options.length > 0

  // INTENT(Render): 将“二/三层级”options 转成 HTML select 的 option/optgroup 结构
  const renderOptions = (items) => {
    const result = []
    items.forEach((item) => {
      if (item.children && item.children.length) {
        // Check if children have nested children (three-level structure)
        const hasNestedChildren = item.children.some(
          (child) => child.children && child.children.length,
        )

        if (hasNestedChildren) {
          // Three-level structure: flatten to two levels
          item.children.forEach((child) => {
            if (child.children && child.children.length) {
              result.push(
                <optgroup key={`${item.value}-${child.value}`} label={`${item.label} > ${child.label}`}>
                  {child.children.map((grandchild) => (
                    <option key={grandchild.value} value={grandchild.value}>
                      {grandchild.label}
                    </option>
                  ))}
                </optgroup>
              )
            } else {
              result.push(
                <optgroup key={`${item.value}-${child.value}`} label={`${item.label} > ${child.label}`}>
                  <option key={child.value} value={child.value}>
                    {child.label}
                  </option>
                </optgroup>
              )
            }
          })
        } else {
          // Two-level structure
          result.push(
            <optgroup key={item.value} label={item.label}>
              {item.children.map((child) => (
                <option key={child.value} value={child.value}>
                  {child.label}
                </option>
              ))}
            </optgroup>
          )
        }
      } else {
        result.push(
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        )
      }
    })
    return result
  }

  return (
    <div className="relative w-full">
      <select
        className="w-full h-8 px-3 text-xs border border-gray-300 rounded hover:border-[#1E6FF2] focus:border-[#1E6FF2] outline-none appearance-none bg-white text-gray-700 cursor-pointer"
        value={value || ''}
        disabled={readOnly}
        data-testid={testId}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {hasOptions
          ? renderOptions(options)
          : [
              <option key="default-1" value="1">
                选项一
              </option>,
              <option key="default-2" value="2">
                选项二
              </option>,
            ]}
      </select>
      <ChevronDown size={14} className="absolute right-2 top-2 text-gray-400 pointer-events-none" />
    </div>
  )
}

const ToggleButton = ({ active }) => (
  <div className="flex border border-gray-300 rounded overflow-hidden h-7 w-fit">
    <button className={`px-4 text-xs ${!active ? 'bg-white text-gray-600' : 'bg-gray-100 text-gray-400'}`}>
      否
    </button>
    <button className={`px-4 text-xs ${active ? 'bg-[#1E6FF2] text-white' : 'bg-white text-gray-600'}`}>
      是
    </button>
  </div>
)

const BasicInfo = ({ id, factorData, readOnly = false }) => {
  const data = factorData || {}
  return (
    <div id={id} className="bg-[#fcfdff] p-4 rounded-sm mb-6 border-t-4 border-t-[#f0f2f5] scroll-mt-36">
      <div className="bg-[#f0f2f5] px-4 py-2 mb-6 rounded-sm text-sm font-bold text-gray-800">基础信息</div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-5 px-2">
        <div>
          <FormLabel label="业务因子分类" required />
          <Select placeholder="请选择" options={FACTOR_CATEGORY_OPTIONS} value={data.category} readOnly={readOnly} testId="req-factorCategory-select" />
        </div>

        <div>
          <FormLabel label="业务因子编码" required />
          <Input placeholder="请输入" value={data.code} readOnly={readOnly} testId="req-factorCode-input" />
        </div>
        <div>
          <FormLabel label="业务因子中文全称" required />
          <Input placeholder="请输入" value={data.nameCn} readOnly={readOnly} testId="req-factorNameCn-input" />
        </div>
        <div>
          <FormLabel label="业务因子英文简称" />
          <Input placeholder="请输入" value={data.nameEn} readOnly={readOnly} testId="req-factorNameEn-input" />
        </div>

        <div>
          <FormLabel label="数值类型" required />
          <Select placeholder="请选择" options={VALUE_TYPE_OPTIONS} value={data.valueType} readOnly={readOnly} testId="req-valueType-select" />
        </div>
        <div>
          <FormLabel label="单位" required />
          <Select placeholder="请选择" options={UNIT_OPTIONS} value={data.unit} readOnly={readOnly} testId="req-unit-select" />
        </div>
        <div>
          <FormLabel label="保留小数位数" required />
          <Select placeholder="请选择" options={DECIMAL_PLACES_OPTIONS} value={data.decimalPlaces} readOnly={readOnly} testId="req-decimalPlaces-select" />
        </div>

        <div>
          <FormLabel label="值域范围" required />
          <Select placeholder="请选择" options={VALUE_RANGE_OPTIONS} value={data.valueRange} readOnly={readOnly} testId="req-valueRange-select" />
        </div>
        <div>
          <FormLabel label="因子计算类型" />
          <Select placeholder="请选择" options={FACTOR_CALC_TYPE_OPTIONS} value={data.calcType} readOnly={readOnly} testId="req-calcType-select" />
        </div>
        <div>
          <FormLabel label="引用的业务因子" />
          <Select placeholder="请选择" options={REFERENCED_FACTOR_OPTIONS} value={data.referencedFactor} readOnly={readOnly} testId="req-referencedFactor-select" />
        </div>

        <div className="col-span-full">
          <FormLabel label="业务因子说明" />
          <div className="relative">
            <textarea
              className="w-full h-24 px-3 py-2 text-xs border border-gray-300 rounded hover:border-[#1E6FF2] focus:border-[#1E6FF2] outline-none resize-none placeholder-gray-300 bg-white"
              placeholder="请输入"
              value={data.description || ''}
              readOnly={readOnly}
              data-testid="req-factorDesc-textarea"
            ></textarea>
            <span className="absolute bottom-2 right-2 text-gray-400 text-xs">{(data.description || '').length}/500</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const CalculationInfo = ({ id, factorData, readOnly = false }) => {
  const data = factorData || {}
  // 将监控模式数组转换为显示文本
  const monitoringModeText = Array.isArray(data.monitoringMode) 
    ? data.monitoringMode.join('、') 
    : (data.monitoringMode || '')
  
  return (
    <div id={id} className="bg-[#fcfdff] p-4 rounded-sm mb-6 border-t-4 border-t-[#f0f2f5] scroll-mt-36">
      <div className="bg-[#f0f2f5] px-4 py-2 mb-6 rounded-sm text-sm font-bold text-gray-800">计算信息</div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-5 px-2">
        <div>
          <FormLabel label="支持监控模式" required />
          <Input placeholder="请选择" value={monitoringModeText} readOnly={readOnly} testId="req-monitoringMode-input" />
        </div>
        <div>
          <FormLabel label="计算维度" />
          <Input placeholder="请输入" value={data.calcDimension} readOnly={readOnly} testId="req-calcDimension-input" />
        </div>
        <div>
          <FormLabel label="指定范围计算维度" />
          <Input placeholder="请输入" value={data.scopeFilter} readOnly={readOnly} testId="req-scopeFilter-input" />
        </div>
      </div>
    </div>
  )
}

const OtherConfig = ({ id, factorData, readOnly = false }) => {
  const data = factorData || {}
  return (
    <div id={id} className="bg-[#fcfdff] p-4 rounded-sm mb-6 border-t-4 border-t-[#f0f2f5] scroll-mt-36">
      <div className="bg-[#f0f2f5] px-4 py-2 mb-6 rounded-sm text-sm font-bold text-gray-800">其他配置</div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-5 px-2">
        <div>
          <FormLabel label="明细输出类型" required />
          <Input placeholder="请选择" value={data.detailOutputType} readOnly={readOnly} testId="req-detailOutputType-input" />
        </div>
        <div className="flex items-end">
          <span className="text-xs font-medium text-gray-500 mr-3 flex">
            <span className="text-red-500 mr-1">*</span>是否支持上卷下钻:
          </span>
          <ToggleButton active={data.allowDrillDown !== false} />
        </div>
      </div>
    </div>
  )
}

const AssociatedFactors = ({ id, factorData, readOnly = false }) => {
  const data = factorData || {}
  const associatedFactors = data.associatedFactors || []
  
  return (
    <div id={id} className="bg-[#fcfdff] p-4 rounded-sm mb-6 border-t-4 border-t-[#f0f2f5] scroll-mt-36">
      <div className="bg-[#f0f2f5] px-4 py-2 mb-6 rounded-sm text-sm font-bold text-gray-800">关联因子参数</div>

      <div className="border border-gray-200 rounded-sm overflow-hidden mb-4">
        <div className="grid grid-cols-11 bg-[#fbfbf6] text-xs font-bold text-gray-700 py-2.5 px-4 border-b border-gray-200">
          <div className="text-center">排序</div>
          <div>因子参数中文全称</div>
          <div>因子参数编码</div>
          <div>因子参数英文简称</div>
          <div>数据字典</div>
          <div>参数值域类型</div>
          <div>参数值域</div>
          <div>默认值类型</div>
          <div>默认值</div>
          <div>参数类型</div>
          <div className="text-center">支持监控模式</div>
        </div>
        {associatedFactors.length > 0 ? (
          <div className="bg-white">
            {associatedFactors.map((factor, index) => (
              <div key={index} className="grid grid-cols-11 text-xs text-gray-700 py-3 px-4 border-b border-gray-100 hover:bg-gray-50">
                <div className="text-center">{factor.order || index + 1}</div>
                <div>{factor.nameCn}</div>
                <div>{factor.code}</div>
                <div>{factor.nameEn}</div>
                <div>{factor.dataDict || '-'}</div>
                <div>{factor.valueRangeType || '-'}</div>
                <div>{factor.valueRange || '-'}</div>
                <div>{factor.defaultValueType || '-'}</div>
                <div>{factor.defaultValue || '-'}</div>
                <div>{factor.paramType || '-'}</div>
                <div className="text-center">{factor.monitoringMode || '-'}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center justify-center bg-[#fffcf5] min-h-[80px]">
            <span className="text-gray-400 text-xs">暂无数据</span>
          </div>
        )}
      </div>

      {!readOnly && (
        <button className="w-full border border-dashed border-[#1E6FF2] text-[#1E6FF2] bg-white py-2 rounded-sm flex items-center justify-center hover:bg-[#EEF7FF] transition-colors text-lg font-bold">
          +
        </button>
      )}
    </div>
  )
}


// AI助手侧边栏组件
// 结果卡片组件
const ResultCard = ({ result, onCardClick }) => {
  const getEntityTypeLabel = (type) => {
    const labels = {
      factor: '业务因子',
      metaFactor: '元因子',
      metadata: '元数据',
      messageField: '消息定义字段',
      messageTransform: '消息转换字段'
    }
    return labels[type] || type
  }

  return (
    <div
      onClick={() => onCardClick(result)}
      data-testid={`ai-result-${result.entityType}-${result.id}-card-clickable`}
      role="button"
      tabIndex={0}
      className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer transition-all mb-3"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
              {getEntityTypeLabel(result.entityType)}
            </span>
            <span className="text-xs text-gray-400 font-mono">{result.code}</span>
          </div>
          <h3 className="text-base font-bold text-gray-800 mb-1">
            {result.nameCn}
            {result.nameEn && <span className="text-sm font-normal text-gray-500 ml-2">({result.nameEn})</span>}
          </h3>
          {result.category && (
            <p className="text-sm text-gray-600 mb-2">分类：{result.category}</p>
          )}
        </div>
      </div>
      
      <div className="space-y-1 text-sm text-gray-600">
        {result.entityType === 'factor' && (
          <>
            {result.monitoringMode && result.monitoringMode.length > 0 && (
              <div>支持监控模式：{result.monitoringMode.join('、')}</div>
            )}
            {result.metaFactorCount !== undefined && (
              <div>关联元因子数量：{result.metaFactorCount}</div>
            )}
            {result.messageCount !== undefined && (
              <div>关联消息数量：{result.messageCount}</div>
            )}
          </>
        )}
        {result.entityType === 'metaFactor' && result.relatedFactorCount !== undefined && (
          <div>关联业务因子数量：{result.relatedFactorCount}</div>
        )}
        {result.entityType === 'metadata' && result.dataType && (
          <div>数据类型：{result.dataType}</div>
        )}
        {result.entityType === 'messageField' && (
          <>
            {result.messageName && <div>所属消息：{result.messageName}</div>}
            {result.dataType && <div>数据类型：{result.dataType}</div>}
          </>
        )}
        {result.entityType === 'messageTransform' && (
          <>
            {result.transformName && <div>所属转换定义：{result.transformName}</div>}
            {result.transformType && <div>转换类型：{result.transformType}</div>}
          </>
        )}
      </div>
    </div>
  )
}

// 模拟数据
const mockFactors = [
  {
    id: '1',
    entityType: 'factor',
    code: '2101032',
    category: '持仓类/市值类',
    nameCn: '持仓市值占净值比',
    nameEn: 'Position Market Value Ratio',
    monitoringMode: ['事前-指令', '事中', '事后'],
    metaFactorCount: 3,
    messageCount: 2
  },
  {
    id: '2',
    entityType: 'factor',
    code: '2101033',
    category: '持仓类/数量类',
    nameCn: '现货持仓数量',
    nameEn: 'Spot Position Quantity',
    monitoringMode: ['事前-指令', '事中'],
    metaFactorCount: 2,
    messageCount: 1
  },
  {
    id: '3',
    entityType: 'metaFactor',
    code: 'MF001',
    category: '行情类',
    nameCn: '最新价',
    nameEn: 'Last Price',
    relatedFactorCount: 15
  }
]

// 模拟AI意图识别和查询
const simulateQuery = (query) => {
  // 简单的关键词匹配来模拟意图识别
  const lowerQuery = query.toLowerCase()
  
  // 判断实体类型
  let entityType = 'factor'
  if (lowerQuery.includes('元因子') || lowerQuery.includes('基础因子')) {
    entityType = 'metaFactor'
  } else if (lowerQuery.includes('消息') && lowerQuery.includes('字段')) {
    entityType = 'messageField'
  } else if (lowerQuery.includes('转换') || lowerQuery.includes('映射')) {
    entityType = 'messageTransform'
  } else if (lowerQuery.includes('元数据')) {
    entityType = 'metadata'
  }
  
  // 模拟查询结果（返回1-3个）
  const results = mockFactors
    .filter(f => f.entityType === entityType)
    .slice(0, Math.min(3, Math.floor(Math.random() * 3) + 1))
  
  return {
    entityType,
    results: results.length > 0 ? results : mockFactors.slice(0, 2)
  }
}

const AIAssistantSidebar = ({ isOpen, onClose, onNavigateToDetail }) => {
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      type: 'assistant', 
      content: '你好!我是创智助手,请向我提问吧~',
      timestamp: new Date()
    },
    {
      id: 2,
      type: 'assistant',
      content: '我可以帮你：',
      timestamp: new Date(),
      isFunctionIntro: true
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [selectedModel, setSelectedModel] = useState('deepseek')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [queryResults, setQueryResults] = useState(null)

  // ACTION(Click): 快捷按钮“查询因子、消息”——向对话流中插入引导文案
  const handleQueryFactorClick = () => {
    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      content: '我要查询因子、消息',
      timestamp: new Date()
    }
    const assistantMessage = {
      id: messages.length + 2,
      type: 'assistant',
      content: '请描述你想要查询的因子或消息。',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage, assistantMessage])
  }

  // ACTION(Click): 快捷按钮“解释DSL代码”——向对话流中插入引导文案
  const handleExplainDSLClick = () => {
    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      content: '我要解释DSL代码',
      timestamp: new Date()
    }
    const assistantMessage = {
      id: messages.length + 2,
      type: 'assistant',
      content: '请提供需要解释的DSL代码。',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage, assistantMessage])
  }

  // ACTION(Send): 发送用户输入（Enter 或点击发送按钮）
  // FLOW: 追加 user 消息 → 清空输入 → 模拟意图识别/查询 → 追加 assistant 结果消息（含卡片）
  const handleSend = () => {
    try {
      if (!inputValue.trim() || isLoading) return
      
      const userMessage = {
        id: messages.length + 1,
        type: 'user',
        content: inputValue,
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, userMessage])
      setQueryResults(null)
      setIsLoading(true)
      const queryText = inputValue
      setInputValue('')
      
      // EFFECT(Mock): 模拟AI意图识别和查询（异步延迟，真实项目中这里应替换为后端接口调用）
      setTimeout(() => {
        try {
          const queryResult = simulateQuery(queryText)
          setQueryResults(queryResult)
          setIsLoading(false)
          
          // 添加查询结果到消息列表
          const resultMessage = {
            id: messages.length + 2,
            type: 'assistant',
            content: `已找到 ${queryResult.results.length} 个相关结果：`,
            timestamp: new Date(),
            results: queryResult.results
          }
          setMessages(prev => [...prev, resultMessage])
        } catch (error) {
          logAiDebugEvent({
            error_code: 'ai_query_simulate_failed',
            action: 'ai_query_simulate',
            context: { form_snapshot: { queryText } },
            error,
          })
          setIsLoading(false)
        }
      }, 1000)
    } catch (error) {
      logAiDebugEvent({
        error_code: 'ai_send_failed',
        action: 'ai_send',
        context: { form_snapshot: { inputValue } },
        error,
      })
      setIsLoading(false)
    }
  }

  // ACTION(Click): 开启新对话——重置消息、结果与输入框状态
  const handleNewConversation = () => {
    setMessages([
      { 
        id: 1, 
        type: 'assistant', 
        content: '你好!我是创智助手,请向我提问吧~',
        timestamp: new Date()
      },
      {
        id: 2,
        type: 'assistant',
        content: '我可以帮你：',
        timestamp: new Date(),
        isFunctionIntro: true
      }
    ])
    setQueryResults(null)
    setInputValue('')
  }

  // ACTION(Click): 点击查询结果卡片——通知父组件进行页面跳转/打开详情
  const handleCardClick = (result) => {
    if (onNavigateToDetail) {
      onNavigateToDetail(result)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-30 z-40 transition-opacity"
        // ACTION(Click): 点击遮罩关闭 AI 侧边栏
        onClick={onClose}
        data-testid="ai-sidebar-mask-clickable"
        aria-label="关闭AI助手侧边栏"
      />
      
      {/* 侧边栏 */}
      <div className="fixed right-0 top-0 h-full w-[600px] bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out">
        {/* 头部 */}
        <div className="h-14 border-b border-gray-200 flex items-center justify-between px-4 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <Bot size={18} className="text-white" />
            </div>
            <span className="font-medium text-gray-800">创智助手</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              // ACTION(Click): 开启新对话
              onClick={handleNewConversation}
              data-testid="ai-new-conversation-btn"
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="开启新对话"
            >
              <MessageSquare size={18} className="text-gray-600" />
            </button>
            <button
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="历史记录"
              data-testid="ai-history-btn"
              aria-label="打开历史记录"
            >
              <Clock size={18} className="text-gray-600" />
            </button>
            <button
              // ACTION(Click): 打开/关闭设置面板
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              data-testid="ai-settings-toggle-btn"
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="设置"
            >
              <Settings size={18} className="text-gray-600" />
            </button>
            <button
              // ACTION(Click): 关闭 AI 侧边栏
              onClick={onClose}
              data-testid="ai-close-btn"
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="关闭"
            >
              <X size={18} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* 设置面板 */}
        {isSettingsOpen && (
          <div className="border-b border-gray-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-800">设置</h3>
              <button
                // ACTION(Click): 关闭设置面板
                onClick={() => setIsSettingsOpen(false)}
                data-testid="ai-settings-close-btn"
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X size={14} className="text-gray-500" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">选择模型</label>
              <div className="flex gap-2">
                <button
                  // ACTION(Click): 选择模型（DeepSeek）——仅更新本地状态用于 UI 展示
                  onClick={() => setSelectedModel('deepseek')}
                  data-testid="ai-model-deepseek-btn"
                  className={`px-4 py-2 text-xs rounded transition-colors ${
                    selectedModel === 'deepseek'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  DeepSeek
                </button>
                <button
                  // ACTION(Click): 选择模型（Qwen）——仅更新本地状态用于 UI 展示
                  onClick={() => setSelectedModel('qwen')}
                  data-testid="ai-model-qwen-btn"
                  className={`px-4 py-2 text-xs rounded transition-colors ${
                    selectedModel === 'qwen'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Qwen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 对话区域 */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-3 max-w-[90%] ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {message.type === 'assistant' && (
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                      <Bot size={18} className="text-white" />
                    </div>
                  )}
                  <div className={`rounded-lg px-4 py-2 ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}>
                    {message.isFunctionIntro ? (
                      <div className="space-y-2">
                        <p className="text-sm">{message.content}</p>
                        <div className="flex flex-col gap-2 mt-2">
                          <button
                            onClick={handleQueryFactorClick}
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer bg-transparent border-0 p-0 text-left"
                            data-testid="ai-quick-queryFactor-btn"
                          >
                            查询因子、消息
                          </button>
                          <button
                            onClick={handleExplainDSLClick}
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer bg-transparent border-0 p-0 text-left"
                            data-testid="ai-quick-explainDsl-btn"
                          >
                            解释DSL代码
                          </button>
                        </div>
                        <span className="text-xs mt-1 block text-gray-400">
                          {message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        
                        {/* 显示查询结果卡片 */}
                        {message.results && message.results.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {message.results.map((result) => (
                              <ResultCard
                                key={result.id}
                                result={result}
                                onCardClick={handleCardClick}
                              />
                            ))}
                          </div>
                        )}
                        
                        <span className={`text-xs mt-1 block ${
                          message.type === 'user' ? 'text-blue-100' : 'text-gray-400'
                        }`}>
                          {message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {/* 加载状态 */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[90%]">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                    <Bot size={18} className="text-white" />
                  </div>
                  <div className="bg-white text-gray-800 border border-gray-200 rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm">正在查询中...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 输入区域 */}
        <div className="border-t border-gray-200 bg-white p-4">
          {/* 输入框和按钮 */}
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                value={inputValue}
                // ACTION(Input): 用户输入查询内容（受控组件）
                onChange={(e) => setInputValue(e.target.value)}
                // ACTION(KeyDown): Enter 发送；Shift+Enter 换行
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="请输入查询内容，例如：查询持仓数量相关的因子"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500 resize-none"
                data-testid="ai-input-textarea"
              />
            </div>
            <div className="flex flex-col gap-2">
              <button
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="附件"
                data-testid="ai-attach-btn"
                aria-label="添加附件"
              >
                <Paperclip size={18} className="text-gray-600" />
              </button>
              <button
                // ACTION(Click): 点击发送按钮
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="发送"
                data-testid="ai-send-btn"
                aria-label="发送消息"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// 业务因子列表组件
const FactorList = ({ onNewClick }) => {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedRows, setSelectedRows] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [queryForm, setQueryForm] = useState({
    nameCn: '',
    category: ''
  })

  // 模拟数据
  const mockData = Array.from({ length: 166 }, (_, i) => ({
    id: i + 1,
    code: `2101${String(i + 1).padStart(3, '0')}`,
    nameEn: `Factor_${i + 1}`,
    nameCn: `业务因子${i + 1}`,
    category: ['交易类/交易价格类', '持仓类/市值类', '基础信息类/证券类', '期限类/久期类'][i % 4],
    calcType: ['金额类', '数量类', '价格类', '天数类'][i % 4],
    calcDimension: ['1-产品', '4-证券', '1-产品,4-证券'][i % 3],
    businessRestriction: i % 2 === 0 ? '是' : '否',
    monitoringMode: ['事前-指令', '事前-委托', '事中', '事后'][i % 4],
    factorParams: i % 3 === 0 ? '3' : '0',
    metaFactors: i % 4 === 0 ? '2' : '0',
    messages: i % 5 === 0 ? '1' : '0',
    dslFunction: i % 6 === 0 ? '1' : '0',
    generalFunction: i % 7 === 0 ? '1' : '0',
    hasCalcValue: i % 2 === 0 ? '是' : '否',
    decimalPlaces: [2, 4, 6, 8][i % 4]
  }))

  const totalPages = Math.ceil(mockData.length / pageSize)
  const currentData = mockData.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // ACTION(Select): 表格“全选/取消全选”当前页
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRows(currentData.map(item => item.id))
    } else {
      setSelectedRows([])
    }
  }

  // ACTION(Select): 表格单行勾选/取消勾选
  const handleSelectRow = (id) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    )
  }

  // 图标映射
  const getCategoryIcon = (value) => {
    const iconMap = {
      'all': Folder,
      'trade': BarChart3,
      'position': Briefcase,
      'basic-info': Clipboard,
      'tenor': Calendar,
      'limit': Scale,
      'valuation': DollarSign,
    }
    const IconComponent = iconMap[value] || Folder
    return IconComponent
  }

  const categoryTree = [
    { label: '所有业务因子', value: 'all' },
    { label: '交易类', value: 'trade', children: [
      { label: '交易价格类', value: 'trade-price' },
      { label: '交易数量类', value: 'trade-quantity' },
      { label: '交易金额类', value: 'trade-amount' },
      { label: '异常交易类', value: 'trade-exception' }
    ]},
    { label: '持仓类', value: 'position', children: [
      { label: '个数类', value: 'position-count' },
      { label: '市值类', value: 'position-market-value' },
      { label: '成本类', value: 'position-cost' },
      { label: '数量类', value: 'position-quantity' },
      { label: '金额类', value: 'position-amount' }
    ]},
    { label: '基础信息类', value: 'basic-info', children: [
      { label: '组合类', value: 'basic-portfolio' },
      { label: '证券类', value: 'basic-security' },
      { label: '主体类', value: 'basic-entity' },
      { label: '行情类', value: 'basic-market' }
    ]},
    { label: '期限类', value: 'tenor', children: [
      { label: '久期类', value: 'tenor-duration' },
      { label: '到期日类', value: 'tenor-maturity-date' },
      { label: '剩余期限类', value: 'tenor-remaining' }
    ]},
    { label: '限额类', value: 'limit' },
    { label: '估值类', value: 'valuation' }
  ]

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* 左侧树状结构 */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-800 mb-3">业务因子列表</h3>
          <div className="relative">
            <input
              type="text"
              value={searchKeyword}
              // ACTION(Input): 左侧树搜索关键词（当前仅保存状态，未做过滤）
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="输入关键字查询"
              className="w-full h-8 px-3 pr-8 text-xs border border-gray-300 rounded focus:outline-none focus:border-[#1E6FF2]"
              data-testid="list-tree-search-input"
            />
            <Search size={14} className="absolute right-2 top-2 text-gray-400" />
            <RefreshCw size={14} className="absolute right-8 top-2 text-gray-400 cursor-pointer hover:text-[#1E6FF2]" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {categoryTree.map((item) => {
            const IconComponent = getCategoryIcon(item.value)
            const isSelected = selectedCategory === item.value
            return (
            <div key={item.value} className="mb-1">
              <div
                // ACTION(Click): 点击左侧树节点切换分类（当前仅保存状态，未做过滤）
                onClick={() => setSelectedCategory(item.value)}
                data-testid={`list-tree-${item.value}-clickable`}
                className={`group flex items-center px-2 py-1.5 text-xs cursor-pointer rounded hover:bg-[#EEF7FF] transition-colors ${
                  isSelected ? 'bg-[#EEF7FF] text-[#1E6FF2]' : 'text-gray-700 hover:text-[#1E6FF2]'
                }`}
              >
                <IconComponent 
                  size={16} 
                  className={`mr-2 transition-colors ${isSelected ? 'text-[#1E6FF2]' : 'text-gray-600 group-hover:text-[#1E6FF2]'}`}
                  strokeWidth={2}
                />
                <span className="flex-1">{item.label}</span>
                {item.children && <ChevronDown size={12} className="text-gray-400" />}
              </div>
              {item.children && selectedCategory === item.value && (
                <div className="ml-4 mt-1">
                  {item.children.map((child) => (
                    <div
                      key={child.value}
                      // ACTION(Click): 点击子分类节点（当前仅保存状态，未做过滤）
                      onClick={() => setSelectedCategory(child.value)}
                      data-testid={`list-tree-${child.value}-clickable`}
                      className={`px-2 py-1 text-xs cursor-pointer rounded hover:bg-gray-50 ${
                        selectedCategory === child.value ? 'bg-[#EEF7FF] text-[#1E6FF2]' : 'text-gray-600'
                      }`}
                    >
                      {child.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
            )
          })}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#f0f2f5]">
        {/* 标题栏 */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="text-base font-bold text-gray-800">因子参数管理</h1>
          <div className="flex items-center space-x-2">
            <button 
              // ACTION(Click): 点击“新增”进入新建业务因子页
              onClick={onNewClick}
              data-testid="list-new-btn"
              className="px-4 py-1.5 bg-[#1E6FF2] text-white text-xs rounded hover:bg-[#1E6FF2] transition-colors flex items-center gap-1"
            >
              <Plus size={14} /> 新增
            </button>
            <button className="px-4 py-1.5 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50 transition-colors">
              全选
            </button>
            <button className="px-4 py-1.5 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50 transition-colors">
              删除
            </button>
            <button className="px-4 py-1.5 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50 transition-colors">
              批量修改
            </button>
          </div>
        </div>

        {/* 查询条件 */}
        <div className="bg-white px-6 py-4 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">业务因子中文全称</label>
              <input
                type="text"
                value={queryForm.nameCn}
                onChange={(e) => setQueryForm({...queryForm, nameCn: e.target.value})}
                placeholder="请输入"
                className="w-full h-8 px-3 text-xs border border-gray-300 rounded focus:outline-none focus:border-[#1E6FF2]"
                data-testid="list-query-nameCn-input"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">业务因子分类</label>
              <Select placeholder="请选择" options={FACTOR_CATEGORY_OPTIONS} testId="list-query-category-select" />
            </div>
            <div className="flex items-end gap-2">
              <button data-testid="list-query-submit-btn" className="px-4 py-1.5 bg-[#1E6FF2] text-white text-xs rounded hover:bg-[#1E6FF2] transition-colors">
                查询
              </button>
              <button data-testid="list-query-reset-btn" className="px-4 py-1.5 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50 transition-colors">
                重置
              </button>
            </div>
            <div className="flex items-end gap-2">
              <button data-testid="list-query-more-btn" className="px-4 py-1.5 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50 transition-colors">
                更多&gt;
              </button>
            </div>
            <div className="flex items-end gap-2">
              <button data-testid="list-export-factor-btn" className="px-4 py-1.5 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50 transition-colors flex items-center gap-1">
                <Download size={14} /> 导出因子清单
              </button>
            </div>
            <div className="flex items-end">
              <button data-testid="list-export-doc-btn" className="px-4 py-1.5 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50 transition-colors flex items-center gap-1">
                <FileText size={14} /> 导出设计文档
              </button>
            </div>
          </div>
        </div>

        {/* 数据表格 */}
        <div className="flex-1 overflow-auto bg-white mx-6 my-4 rounded border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#fbfbf6] border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-center w-12">
                    <input
                      type="checkbox"
                      checked={selectedRows.length === currentData.length && currentData.length > 0}
                      // ACTION(Select): 勾选表头复选框，全选/取消全选当前页
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded"
                      data-testid="list-table-selectAll-checkbox"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">序号</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">业务因子编码</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">业务因子英文简称</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">业务因子中文全称</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">所属分类</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">因子计算类型</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">计算维度</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">业务限定</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">支持监控模式</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">因子参数</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">关联元因子</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">关联消息</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">关联DSL函数</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">关联通用函数</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">是否存在计算值</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">保留小数位</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentData.map((row, index) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(row.id)}
                        // ACTION(Select): 勾选单行复选框
                        onChange={() => handleSelectRow(row.id)}
                        className="rounded"
                      data-testid={`list-item-${index}-select-checkbox`}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{(currentPage - 1) * pageSize + index + 1}</td>
                    <td className="px-4 py-3 text-gray-700 font-mono">{row.code}</td>
                    <td className="px-4 py-3 text-gray-700">{row.nameEn}</td>
                    <td className="px-4 py-3 text-gray-700">{row.nameCn}</td>
                    <td className="px-4 py-3 text-gray-600">{row.category}</td>
                    <td className="px-4 py-3 text-gray-600">{row.calcType}</td>
                    <td className="px-4 py-3 text-gray-600">{row.calcDimension}</td>
                    <td className="px-4 py-3 text-gray-600">{row.businessRestriction}</td>
                    <td className="px-4 py-3 text-gray-600">{row.monitoringMode}</td>
                    <td className="px-4 py-3 text-gray-600">{row.factorParams}</td>
                    <td className="px-4 py-3 text-gray-600">{row.metaFactors}</td>
                    <td className="px-4 py-3 text-gray-600">{row.messages}</td>
                    <td className="px-4 py-3 text-gray-600">{row.dslFunction}</td>
                    <td className="px-4 py-3 text-gray-600">{row.generalFunction}</td>
                    <td className="px-4 py-3 text-gray-600">{row.hasCalcValue}</td>
                    <td className="px-4 py-3 text-gray-600">{row.decimalPlaces}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button className="text-blue-600 hover:text-blue-800" title="编辑">
                          <Edit3 size={14} aria-label="编辑该行" data-testid={`list-item-${index}-edit-btn`} />
                        </button>
                        <button className="text-green-600 hover:text-green-800" title="查看">
                          <Eye size={14} aria-label="查看该行" data-testid={`list-item-${index}-view-btn`} />
                        </button>
                        <button className="text-red-600 hover:text-red-800" title="删除">
                          <Trash2 size={14} aria-label="删除该行" data-testid={`list-item-${index}-delete-btn`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 分页 */}
        <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-600">共{mockData.length}条</span>
            <select
              value={pageSize}
              // ACTION(Change): 切换每页条数，并重置到第一页
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="h-7 px-2 text-xs border border-gray-300 rounded focus:outline-none"
              data-testid="list-pagination-pageSize-select"
            >
              <option value="20">20条/页</option>
              <option value="50">50条/页</option>
              <option value="100">100条/页</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              // ACTION(Click): 上一页
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 border border-gray-300 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              data-testid="list-pagination-prev-btn"
              aria-label="上一页"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(9, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 9) {
                pageNum = i + 1;
              } else if (currentPage <= 5) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 4) {
                pageNum = totalPages - 8 + i;
              } else {
                pageNum = currentPage - 4 + i;
              }
              return (
                <button
                  key={pageNum}
                  // ACTION(Click): 跳转到指定页码
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 border rounded text-xs ${
                    currentPage === pageNum
                      ? 'bg-[#1E6FF2] text-white border-[#1E6FF2]'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                  data-testid={`list-pagination-page-${pageNum}-btn`}
                  aria-label={`跳转到第${pageNum}页`}
                >
                  {pageNum}
                </button>
              );
            })}
            {totalPages > 9 && currentPage < totalPages - 4 && (
              <span className="px-2 text-xs text-gray-500">...</span>
            )}
            {totalPages > 9 && (
              <button
                // ACTION(Click): 跳转到最后一页
                onClick={() => setCurrentPage(totalPages)}
                className={`px-3 py-1 border rounded text-xs ${
                  currentPage === totalPages
                    ? 'bg-[#1E6FF2] text-white border-[#1E6FF2]'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                data-testid="list-pagination-last-btn"
                aria-label="跳转到最后一页"
              >
                {totalPages}
              </button>
            )}
            <button
              // ACTION(Click): 下一页
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 border border-gray-300 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              data-testid="list-pagination-next-btn"
              aria-label="下一页"
            >
              <ChevronRightIcon size={14} />
            </button>
            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs text-gray-600">前往</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                value={currentPage}
                // ACTION(Input): 输入页码跳转（合法范围内才生效）
                onChange={(e) => {
                  const page = Number(e.target.value);
                  if (page >= 1 && page <= totalPages) {
                    setCurrentPage(page);
                  }
                }}
                className="w-12 h-7 px-2 text-xs border border-gray-300 rounded focus:outline-none"
                data-testid="list-pagination-goto-input"
              />
              <span className="text-xs text-gray-600">页</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 获取默认因子详情数据（根据图片信息）
const getDefaultFactorDetail = (factorName) => {
  // 根据因子名称返回对应的数据，如果没有匹配则返回图片中的持仓市值数据
  if (factorName === '现货持仓数量' || factorName?.includes('持仓数量')) {
    return {
      category: 'position-quantity',
      code: '2101033',
      nameCn: '现货持仓数量',
      nameEn: 'SPOT_HLD_QTY',
      valueType: 'decimal',
      unit: 'share',
      decimalPlaces: '4',
      valueRange: '[0,+∞)',
      calcType: 'quantity',
      referencedFactor: 'holding-quantity',
      description: '',
      monitoringMode: ['事前-指令', '事中', '事后'],
      calcDimension: '4-证券; 7-证券一级分类; 8-证券二级分类; 10-证券四级分类; 11-月份; 12-发行人; 13-债项评级; 16-标的; 17-月份和标的; 18-行业 (按申万一级); 19-行业 (按申万二级); 20-行业 (按GICS财汇一级); 21-行业 (按GICS财汇二级); 23-证券池; 30-单笔; 31-同一行业',
      scopeFilter: '',
      detailOutputType: '全部明细数据',
      allowDrillDown: true,
      associatedFactors: []
    }
  }
  // 默认返回持仓市值数据（图片中的信息）
  return {
    category: 'position-market-value',
    code: '2101032',
    nameCn: '持仓市值',
    nameEn: 'ACTL_HLDP_MVAL_2',
    valueType: 'decimal',
    unit: 'cny',
    decimalPlaces: '4',
    valueRange: '[0,+∞)',
    calcType: 'amount',
    referencedFactor: 'holding-quantity',
    description: '',
    monitoringMode: ['事前-指令', '事中', '事后'],
    calcDimension: '4-证券; 7-证券一级分类; 8-证券二级分类; 10-证券四级分类; 11-月份; 12-发行人; 13-债项评级; 16-标的; 17-月份和标的; 18-行业 (按申万一级); 19-行业 (按申万二级); 20-行业 (按GICS财汇一级); 21-行业 (按GICS财汇二级); 23-证券池; 30-单笔; 31-同一行业',
    scopeFilter: '',
    detailOutputType: '全部明细数据',
    allowDrillDown: true,
    associatedFactors: [
      {
        order: 1,
        nameCn: '流通类型',
        code: 'PARAM001',
        nameEn: 'CIRC_TYPE',
        dataDict: '',
        valueRangeType: '枚举',
        valueRange: '0-非流通、1-流通',
        defaultValueType: '',
        defaultValue: '',
        paramType: '',
        monitoringMode: '事前-指令 | 事中 | 事后'
      },
      {
        order: 2,
        nameCn: '投资类型',
        code: 'PARAM002',
        nameEn: 'INV_TYPE',
        dataDict: '',
        valueRangeType: '枚举',
        valueRange: '',
        defaultValueType: '',
        defaultValue: '',
        paramType: '',
        monitoringMode: '事前-指令 | 事中 | 事后'
      },
      {
        order: 3,
        nameCn: '受限类型',
        code: 'PARAM003',
        nameEn: 'RESTR_TYPE',
        dataDict: '',
        valueRangeType: '枚举',
        valueRange: '',
        defaultValueType: '',
        defaultValue: '',
        paramType: '',
        monitoringMode: '事前-指令 | 事中 | 事后'
      },
      {
        order: 4,
        nameCn: '预估中签率处理方式',
        code: 'PARAM004',
        nameEn: 'EST_ALLOT_RATE_PROC',
        dataDict: '',
        valueRangeType: '枚举',
        valueRange: '',
        defaultValueType: '',
        defaultValue: '',
        paramType: '',
        monitoringMode: '事前-指令 | 事中 | 事后'
      }
    ]
  }
}

const SummaryAlgorithm = ({ id }) => (
  <div id={id} className="bg-[#fcfdff] p-4 rounded-sm mb-12 border-t-4 border-t-[#f0f2f5] scroll-mt-36">
    <div className="bg-[#f0f2f5] px-4 py-2 mb-6 rounded-sm text-sm font-bold text-gray-800">汇总因子算法</div>

    <div className="px-2">
      <div className="flex space-x-2 mb-6">
        <button className="px-5 py-1.5 bg-[#1E6FF2] text-white text-xs rounded hover:opacity-90">通用</button>
        <button className="px-5 py-1.5 bg-[#EEF7FF] text-[#1E6FF2] text-xs rounded hover:bg-[#D6EBFF]">
          分业务环节
        </button>
      </div>

      <div className="mb-6">
        <div className="flex items-center mb-2">
          <div className="w-1 h-3 bg-[#1E6FF2] mr-2"></div>
          <span className="text-sm font-bold text-gray-700">因子数学公式</span>
          <Edit3 size={14} className="ml-2 text-[#1E6FF2] cursor-pointer" />
          <ChevronDown size={14} className="ml-1 text-gray-500 cursor-pointer" />
        </div>
        <div className="bg-[#f9fafb] border border-gray-200 h-10 rounded"></div>
      </div>

      <div>
        <div className="flex items-center mb-2">
          <div className="w-1 h-3 bg-[#1E6FF2] mr-2"></div>
          <span className="text-sm font-bold text-gray-700">业务因子计算说明</span>
          <ChevronDown size={14} className="ml-1 text-gray-500 cursor-pointer" />
        </div>

        <div className="border border-gray-300 rounded overflow-hidden">
          <div className="bg-[#f8f9fa] border-b border-gray-200 p-2 flex flex-wrap items-center gap-2 select-none">
            <div className="flex items-center space-x-1 border-r border-gray-300 pr-2 mr-1">
              <div className="text-xs text-gray-500 cursor-pointer hover:bg-gray-200 px-1 rounded flex items-center">
                正文 <ChevronDown size={10} className="ml-1" />
              </div>
              <span className="text-gray-400 font-serif text-lg px-1">“</span>
            </div>

            <div className="flex items-center space-x-1 border-r border-gray-300 pr-2 mr-1 text-gray-600">
              <Bold size={16} className="cursor-pointer p-0.5 hover:bg-gray-200 rounded" />
              <Underline size={16} className="cursor-pointer p-0.5 hover:bg-gray-200 rounded" />
              <Italic size={16} className="cursor-pointer p-0.5 hover:bg-gray-200 rounded" />
              <MoreHorizontal size={16} className="cursor-pointer p-0.5 hover:bg-gray-200 rounded" />
            </div>

            <div className="flex items-center space-x-1 border-r border-gray-300 pr-2 mr-1 text-gray-600">
              <div className="flex items-center text-xs cursor-pointer hover:bg-gray-200 px-1 rounded">
                <Type size={14} className="mr-0.5" /> <ChevronDown size={10} />
              </div>
              <div className="flex items-center text-xs cursor-pointer hover:bg-gray-200 px-1 rounded bg-gray-200 text-gray-800">
                A <ChevronDown size={10} className="ml-0.5" />
              </div>
            </div>

            <div className="flex items-center space-x-1 border-r border-gray-300 pr-2 mr-1 text-gray-600">
              <List size={16} className="cursor-pointer p-0.5 hover:bg-gray-200 rounded" />
              <AlignLeft size={16} className="cursor-pointer p-0.5 hover:bg-gray-200 rounded" />
            </div>

            <div className="flex items-center space-x-2 text-xs text-gray-500 border-r border-gray-300 pr-2 mr-1">
              <span className="cursor-pointer hover:text-gray-800">默认字号</span>
              <span className="cursor-pointer hover:text-gray-800">默认字体</span>
              <span className="cursor-pointer hover:text-gray-800">默认行高</span>
            </div>

            <div className="flex items-center space-x-1 border-r border-gray-300 pr-2 mr-1 text-gray-600">
              <List size={16} className="cursor-pointer p-0.5 hover:bg-gray-200 rounded" />
              <AlignLeft size={16} className="cursor-pointer p-0.5 hover:bg-gray-200 rounded" />
            </div>

            <div className="flex items-center space-x-2 text-gray-500 w-full mt-1 pt-1 border-t border-gray-100">
              <div className="flex items-center space-x-3 mr-4">
                <div className="w-4 h-4 border border-gray-400 rounded-sm flex items-center justify-center">
                  <div className="w-2 h-2 bg-gray-400"></div>
                </div>
                <AlignLeft size={16} />
                <AlignRight size={16} />
              </div>

              <div className="flex items-center space-x-3 mr-4 border-r border-gray-300 pr-2">
                <div className="w-5 h-5 rounded-full border border-gray-400 flex items-center justify-center text-[10px]">
                  ☺
                </div>
                <LinkIcon size={16} />
                <ImageIcon size={16} />
                <div className="w-4 h-3 bg-gray-400 rounded-sm"></div>
                <Grid size={16} />
              </div>

              <div className="flex items-center space-x-3 mr-4 border-r border-gray-300 pr-2">
                <Code size={16} />
                <List size={16} />
              </div>

              <div className="flex items-center space-x-3">
                <Undo size={16} />
                <Redo size={16} />
                <Maximize size={16} />
              </div>
            </div>
          </div>

          <textarea
            className="w-full h-48 px-4 py-3 text-sm outline-none resize-none placeholder-gray-300 text-gray-700"
            placeholder="请输入内容..."
          ></textarea>
        </div>
      </div>
    </div>
  </div>
)

// 占位页面组件
const PlaceholderPage = ({ title, description }) => (
  <div className="flex-1 flex items-center justify-center bg-[#f0f2f5]">
    <div className="text-center">
      <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
        <Info size={48} className="text-gray-400" />
      </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">{title}</h2>
      <p className="text-gray-600 max-w-md mx-auto">{description}</p>
    </div>
  </div>
)

export default function HomePage() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('basic')
  const [currentPage, setCurrentPage] = useState('list') // 'list' 或 'new' 或 'detail'
  const [isAISidebarOpen, setIsAISidebarOpen] = useState(false)
  const [detailFactor, setDetailFactor] = useState(null) // 详情页因子数据
  const [activeTab, setActiveTab] = useState('home') // 'home' 或 'factor' 或其他
  const [openTabs, setOpenTabs] = useState(['home']) // 已打开的标签列表

  // ACTION(ScrollListen): 当处于“新建因子页”时，监听滚动位置并高亮右侧导航（activeSection）
  // CLEANUP: 离开新建页或组件卸载时移除监听
  useEffect(() => {
    if (currentPage === 'new') {
      const handleScroll = () => {
        const scrollPosition = window.scrollY + 200

        for (const section of SECTIONS) {
          const element = document.getElementById(section.id)
          if (element) {
            const { offsetTop, offsetHeight } = element
            if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
              setActiveSection(section.id)
            }
          }
        }
      }

      window.addEventListener('scroll', handleScroll)
      return () => window.removeEventListener('scroll', handleScroll)
    }
  }, [currentPage])

  // ACTION(ScrollTo): 点击右侧目录时，滚动到对应区块，并更新 activeSection
  const scrollToSection = (id) => {
    const element = document.getElementById(id)
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 160
      window.scrollTo({ top: y, behavior: 'smooth' })
      setActiveSection(id)
    }
  }

  // ACTION(TabChange): 切换顶层标签（TabBar）
  // NOTE: 当前逻辑对 factor/home 做了额外页面状态重置
  const handleTabChange = (tabId) => {
    // 业务因子开发跳转到独立的 ReqToDSL 页面
    if (tabId === 'factor') {
      navigate('/req-to-dsl')
      return
    }
    setActiveTab(tabId)
    if (tabId === 'home') {
      // 切换到首页时，重置页面状态
      setCurrentPage('list')
    }
  }

  // ACTION(TabClose): 关闭某个标签；如关闭的是当前标签则回到首页
  const handleCloseTab = (tabId) => {
    if (tabId === 'factor' || tabId === 'realtime' || tabId === 'offline' || tabId === 'metadata' || tabId === 'message' || tabId === 'system') {
      // 关闭标签时，如果当前标签是关闭的标签，则切换到首页
      if (activeTab === tabId) {
        setActiveTab('home')
        setCurrentPage('list')
      }
      // 从已打开标签列表中移除
      setOpenTabs(prev => prev.filter(tab => tab !== tabId))
    }
  }

  // ACTION(Navigate): 首页工作台卡片点击后的路由/标签打开逻辑（纯前端状态机）
  const handleWorkspaceCardClick = (cardId) => {
    // 处理常用功能入口 - 业务因子开发跳转到独立的 ReqToDSL 页面
    if (cardId === 'factor') {
      navigate('/req-to-dsl')
      return
    } else if (cardId === 'metaFactor') {
      setActiveTab('metaFactor')
      if (!openTabs.includes('metaFactor')) {
        setOpenTabs(prev => [...prev, 'metaFactor'])
      }
    } else if (cardId === 'realtime') {
      setActiveTab('realtime')
      if (!openTabs.includes('realtime')) {
        setOpenTabs(prev => [...prev, 'realtime'])
      }
    } else if (cardId === 'offline') {
      setActiveTab('offline')
      if (!openTabs.includes('offline')) {
        setOpenTabs(prev => [...prev, 'offline'])
      }
    } else if (cardId === 'metadata') {
      setActiveTab('metadata')
      if (!openTabs.includes('metadata')) {
        setOpenTabs(prev => [...prev, 'metadata'])
      }
    } else if (cardId === 'message') {
      setActiveTab('message')
      if (!openTabs.includes('message')) {
        setOpenTabs(prev => [...prev, 'message'])
      }
    } else if (cardId === 'system') {
      setActiveTab('system')
      if (!openTabs.includes('system')) {
        setOpenTabs(prev => [...prev, 'system'])
      }
    } else if (cardId === 'quality') {
      setActiveTab('quality')
      if (!openTabs.includes('quality')) {
        setOpenTabs(prev => [...prev, 'quality'])
      }
    } else if (cardId === 'job' || cardId === 'model') {
      // 关键指标点击，跳转到对应功能
      if (cardId === 'job') {
        setActiveTab('offline')
        if (!openTabs.includes('offline')) {
          setOpenTabs(prev => [...prev, 'offline'])
        }
      } else if (cardId === 'model') {
        setActiveTab('metadata')
        if (!openTabs.includes('metadata')) {
          setOpenTabs(prev => [...prev, 'metadata'])
        }
      }
    }
  }

  return (
    <EnvironmentProvider>
      <div className="min-h-screen bg-[#f0f2f5] font-sans text-gray-800 flex flex-col">
        <Header onBotClick={() => setIsAISidebarOpen(true)} />
        <TabBar 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          onCloseTab={handleCloseTab}
          openTabs={openTabs}
        />
      
      {/* AI助手侧边栏 */}
      <AIAssistantSidebar 
        isOpen={isAISidebarOpen} 
        onClose={() => setIsAISidebarOpen(false)}
        // ACTION(NavigateFromAI): 在 AI 结果卡片中点“查看详情”后触发：打开因子详情页并切到 factor 标签
        onNavigateToDetail={(result) => {
          setDetailFactor(result)
          setCurrentPage('detail')
          setActiveTab('factor')
          setIsAISidebarOpen(false)
        }}
      />

      {activeTab === 'home' ? (
        <Workspace onCardClick={handleWorkspaceCardClick} />
      ) : activeTab === 'realtime' ? (
        <PlaceholderPage 
          title="实时数据开发" 
          description="功能开发中，敬请期待..." 
        />
      ) : activeTab === 'offline' ? (
        <PlaceholderPage 
          title="离线数据开发" 
          description="功能开发中，敬请期待..." 
        />
      ) : activeTab === 'metadata' ? (
        <PlaceholderPage 
          title="元数据开发" 
          description="功能开发中，敬请期待..." 
        />
      ) : activeTab === 'message' ? (
        <PlaceholderPage 
          title="消息定义" 
          description="功能开发中，敬请期待..." 
        />
      ) : activeTab === 'system' ? (
        <PlaceholderPage 
          title="系统管理" 
          description="功能开发中，敬请期待..." 
        />
      ) : activeTab === 'metaFactor' ? (
        <PlaceholderPage 
          title="元因子开发" 
          description="功能开发中，敬请期待..." 
        />
      ) : activeTab === 'quality' ? (
        <PlaceholderPage 
          title="数据质量" 
          description="功能开发中，敬请期待..." 
        />
      ) : (
        <div className="flex-1 flex flex-col max-w-full overflow-x-hidden">
          <div className="sticky top-0 z-40 bg-[#f0f2f5]">
            <div className="max-w-[2400px] mx-auto px-4 py-4">
              <Breadcrumb 
                items={[
                  { label: '业务因子开发' },
                  ...(currentPage === 'detail' ? [{ label: detailFactor?.name || '因子详情' }] : []),
                  ...(currentPage === 'new' ? [{ label: '新建因子' }] : []),
                ]} 
              />
            </div>
            <SubHeader currentPage={currentPage} onPageChange={setCurrentPage} />

            {currentPage === 'new' && (
              <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center shadow-sm">
                <h1 className="text-base font-bold text-gray-800">新增业务因子</h1>
                <div className="flex items-center space-x-3">
                  <button className="px-6 py-1.5 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50 transition-colors">
                    取消
                  </button>
                  <button className="px-6 py-1.5 bg-[#1E6FF2] text-white text-sm rounded hover:bg-[#1E6FF2] transition-colors shadow-sm">
                    保存
                  </button>
                </div>
              </div>
            )}
            {currentPage === 'detail' && (
              <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center shadow-sm">
                <h1 className="text-base font-bold text-gray-800">
                  {detailFactor?.nameCn || '因子详情'}（只读模式）
                </h1>
                <div className="flex items-center space-x-3">
                  <button 
                    // ACTION(Click): 详情页返回列表（清空详情对象）
                    onClick={() => {
                      setCurrentPage('list')
                      setDetailFactor(null)
                    }}
                    className="px-6 py-1.5 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50 transition-colors"
                    data-testid="detail-backToList-btn"
                  >
                    返回列表
                  </button>
                </div>
              </div>
            )}
          </div>

          {currentPage === 'list' ? (
            <FactorList onNewClick={() => setCurrentPage('new')} />
          ) : currentPage === 'detail' ? (
          <div className="flex-1 flex justify-center py-4 px-6 gap-6">
            <div className="w-full max-w-[1600px] bg-white rounded shadow-sm min-h-[500px] flex flex-col">
              <div className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h1 className="text-lg font-bold text-gray-800">
                    {detailFactor?.nameCn || '因子详情'}
                  </h1>
                  <button
                    // ACTION(Click): 详情页返回列表（清空详情对象）
                    onClick={() => {
                      setCurrentPage('list')
                      setDetailFactor(null)
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50 transition-colors"
                    data-testid="detail-backToList-2-btn"
                  >
                    返回列表
                  </button>
                </div>
                <BasicInfo id="basic" factorData={getDefaultFactorDetail(detailFactor?.nameCn)} readOnly={true} />
                <CalculationInfo id="calc" factorData={getDefaultFactorDetail(detailFactor?.nameCn)} readOnly={true} />
                <OtherConfig id="other" factorData={getDefaultFactorDetail(detailFactor?.nameCn)} readOnly={true} />
                <AssociatedFactors id="assoc" factorData={getDefaultFactorDetail(detailFactor?.nameCn)} readOnly={true} />
                <SummaryAlgorithm id="summary" />
              </div>
            </div>

            <div className="w-48 hidden xl:block shrink-0 relative">
              <div className="sticky top-48">
                <div className="relative border-l-2 border-gray-200 pl-4 py-2 space-y-6">
                  {SECTIONS.map((section) => (
                    <div
                      key={section.id}
                      // ACTION(Click): 右侧目录导航跳转到对应区块
                      onClick={() => scrollToSection(section.id)}
                      data-testid={`detail-section-${section.id}-nav-clickable`}
                      role="button"
                      tabIndex={0}
                      className={`text-xs cursor-pointer transition-all duration-200 flex items-center ${
                        activeSection === section.id
                          ? 'text-[#1E6FF2] font-bold transform translate-x-1'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {activeSection === section.id && (
                        <div className="absolute left-[-5px] w-2 h-2 rounded-full bg-white border-2 border-[#1E6FF2]"></div>
                      )}
                      {section.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* 左侧文件上传区域 - 20% */}
            <div className="w-[20%] bg-white border-r border-gray-200 flex flex-col">
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">需求文档上传</h3>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#1E6FF2] transition-colors">
                  <Upload size={32} className="mx-auto text-gray-400 mb-3" />
                  <p className="text-xs text-gray-600 mb-2">点击或拖拽文件到此处上传</p>
                  <p className="text-xs text-gray-400">支持 Word格式</p>
                  <input
                    type="file"
                    className="hidden"
                    id="file-upload"
                    accept=".xlsx,.xls,.csv"
                    // ACTION(Upload): 选择文件后触发（当前仅打印文件名；真实项目在此做解析/上传/入库）
                    onChange={(e) => {
                      try {
                        const file = e.target.files?.[0]
                        if (file) {
                          console.log('上传文件:', file.name)
                          // TODO: 处理文件上传逻辑
                        }
                      } catch (error) {
                        logAiDebugEvent({
                          error_code: 'upload_file_failed',
                          action: 'upload_file_change',
                          context: { form_snapshot: { fileName: e.target.files?.[0]?.name } },
                          error,
                        })
                      }
                    }}
                    data-testid="upload-file-input"
                  />
                  <label
                    htmlFor="file-upload"
                    className="mt-4 inline-block px-4 py-2 bg-[#1E6FF2] text-white text-xs rounded hover:bg-[#1a5dd9] transition-colors cursor-pointer"
                    data-testid="upload-file-select-btn"
                  >
                    选择文件
                  </label>
                </div>
                
                {/* 已上传文件列表 */}
                <div className="mt-6">
                  <h4 className="text-xs font-medium text-gray-700 mb-3">已上传文件</h4>
                  <div className="space-y-2">
                    {/* 示例：暂无文件 */}
                    <div className="text-xs text-gray-400 text-center py-4">
                      暂无文件
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 右侧表单区域 - 80% */}
            <div className="w-[80%] flex overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-[1600px] mx-auto bg-white min-h-full">
                  <div className="p-6">
                    <BasicInfo id="basic" factorData={null} readOnly={false} />
                    <CalculationInfo id="calc" factorData={null} readOnly={false} />
                    <OtherConfig id="other" factorData={null} readOnly={false} />
                    <AssociatedFactors id="assoc" factorData={null} readOnly={false} />
                    <SummaryAlgorithm id="summary" />
                  </div>
                </div>
              </div>

              {/* 右侧导航栏 */}
              <div className="w-48 hidden xl:block shrink-0 relative">
                <div className="sticky top-48">
                  <div className="relative border-l-2 border-gray-200 pl-4 py-2 space-y-6">
                    {SECTIONS.map((section) => (
                      <div
                        key={section.id}
                        // ACTION(Click): 右侧目录导航跳转到对应区块
                        onClick={() => scrollToSection(section.id)}
                        data-testid={`form-section-${section.id}-nav-clickable`}
                        role="button"
                        tabIndex={0}
                        className={`text-xs cursor-pointer transition-all duration-200 flex items-center ${
                          activeSection === section.id
                            ? 'text-[#1E6FF2] font-bold transform translate-x-1'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {activeSection === section.id && (
                          <div className="absolute left-[-5px] w-2 h-2 rounded-full bg-white border-2 border-[#1E6FF2]"></div>
                        )}
                        {section.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      )}
      </div>
    </EnvironmentProvider>
  )
}
