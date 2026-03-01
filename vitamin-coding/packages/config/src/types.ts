// 配置系统类型

// 配置加载/解析过程中产生的警告
export interface ConfigWarning {
  key: string
  message: string
  line?: number
  column?: number
}

// loadConfig() 的选项
export interface LoadConfigOptions {
  // 当前工作目录，用于项目配置解析
  cwd?: string
  // CLI 级别的覆盖项（最高优先级）
  overrides?: Partial<VitaminConfig>
  // 扩展提供的默认值
  extensionDefaults?: Partial<VitaminConfig>
}

// loadConfig() 的返回结果
export interface LoadConfigResult {
  config: VitaminConfig
  warnings: ConfigWarning[]
  // 项目配置文件路径（如果存在）
  projectConfigPath?: string
  // 用户配置文件路径（如果存在）
  userConfigPath?: string
}

// 根配置类型 —— 随模块实现逐步扩展
export interface VitaminConfig {
  // JSON Schema 声明
  $schema?: string
  // 配置版本，用于迁移
  config_version?: string
  // 全局日志级别
  log_level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  // 默认模型
  model?: string
  // UI 主题
  theme?: string
  // 工具预设
  tool_preset?: 'minimal' | 'standard' | 'full'
  // 扩展配置
  extensions?: Record<string, unknown>
  // MCP 配置
  mcp?: Record<string, unknown>
  // 会话配置
  session?: Record<string, unknown>
  // TUI 配置
  tui?: Record<string, unknown>
  // Skill 配置
  skills?: Record<string, unknown>
  // 压缩配置
  compaction?: Record<string, unknown>
  // 后台任务配置
  background_task?: Record<string, unknown>
  // 实验特性配置
  experimental?: Record<string, unknown>
  // 按 Agent 名称键控的覆盖配置
  agents?: Record<string, AgentConfig>
  // 分类覆盖配置
  categories?: Record<string, CategoryConfig>
  // 禁用的 Agent 名称
  disabled_agents?: string[]
  // 禁用的 Hook 名称
  disabled_hooks?: string[]
  // 禁用的 MCP 名称
  disabled_mcps?: string[]
  // 禁用的 Skill 名称
  disabled_skills?: string[]
  // 禁用的 Tool 名称
  disabled_tools?: string[]
  // 内部迁移日志 —— 不可用户编辑
  _migrations?: string[]
}

// 单个 Agent 的配置覆盖
export interface AgentConfig {
  model?: string
  temperature?: number
  max_tokens?: number
  thinking_budget?: number
  disabled?: boolean
}

// 单个分类的配置覆盖
export interface CategoryConfig {
  preferred_models?: string[]
  default_model?: string
}
