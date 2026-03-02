// @vitamin/extension 核心类型
import type { AgentMessage, AgentTool, ToolResult } from '@vitamin/agent'
import type { HookRegistration, HookTiming } from '@vitamin/hooks'

// Extension 事件名称（§S9.3: 20+ 事件类型）
export type ExtensionEventName =
  // 会话事件
  | 'session.start'
  | 'session.switch'
  | 'session.fork'
  | 'session.end'
  | 'session.compacting'
  // Agent 事件
  | 'agent.start'
  | 'agent.end'
  | 'agent.turn.start'
  | 'agent.turn.end'
  // 消息事件
  | 'message.start'
  | 'message.update'
  | 'message.end'
  // 工具事件（可拦截）
  | 'tool.call'
  | 'tool.result'
  | 'tool.execute.before'
  | 'tool.execute.after'
  // 变换事件
  | 'context.transform'
  | 'system.transform'
  // 输入事件
  | 'input'
  // 模型事件
  | 'model.select'
  // 资源事件
  | 'resources.discover'

// Extension 事件载荷映射
export interface ExtensionEventPayloads {
  'session.start': { sessionId: string }
  'session.switch': { fromId: string; toId: string }
  'session.fork': { sessionId: string; fromEntryId: string }
  'session.end': { sessionId: string }
  'session.compacting': { sessionId: string; messageCount: number }
  'agent.start': { agentName: string; model: string }
  'agent.end': { agentName: string; turnCount: number }
  'agent.turn.start': { turnIndex: number }
  'agent.turn.end': { turnIndex: number }
  'message.start': { message: AgentMessage }
  'message.update': { delta: string }
  'message.end': { message: AgentMessage }
  'tool.call': ToolInterceptEvent
  'tool.result': ToolResultInterceptEvent
  'tool.execute.before': { toolName: string; args: Record<string, unknown> }
  'tool.execute.after': { toolName: string; result: ToolResult }
  'context.transform': { messages: AgentMessage[] }
  'system.transform': { systemPrompt: string }
  'input': InputInterceptEvent
  'model.select': { category: string; model: string }
  'resources.discover': { resources: string[] }
}

// 工具调用拦截事件
export interface ToolInterceptEvent {
  toolName: string
  toolCallId: string
  args: Record<string, unknown>
  preventDefault: boolean
  replacement?: ToolResult
}

// 工具结果拦截事件
export interface ToolResultInterceptEvent {
  toolName: string
  toolCallId: string
  result: ToolResult
  replacement?: ToolResult
}

// 输入拦截事件
export interface InputInterceptEvent {
  text: string
  cancelled: boolean
}

// Extension 事件处理器
export type ExtensionEventHandler<T extends ExtensionEventName> = (
  event: ExtensionEventPayloads[T],
) => void | Promise<void>

// 斜杠命令定义
export interface SlashCommand {
  name: string
  description: string
  execute: (args: string) => void | Promise<void>
}

// MCP 服务器注册配置
export interface McpRegistration {
  name: string
  transport: 'stdio' | 'http'
  command?: string
  args?: string[]
  url?: string
  headers?: Record<string, string>
}

// Extension UI 上下文 — 提供交互能力
export interface ExtensionUIContext {
  select<T extends string>(options: { title: string; items: Array<{ label: string; value: T }> }): Promise<T | undefined>
  confirm(options: { title: string; message: string }): Promise<boolean>
  input(options: { title: string; placeholder?: string }): Promise<string | undefined>
  notify(options: { message: string; level?: 'info' | 'warn' | 'error' }): void
  setStatus(text: string): void
}

// Extension Config 上下文
export interface ExtensionConfigContext {
  get<T = unknown>(key: string): T | undefined
  set(key: string, value: unknown): Promise<void>
  getAll(): Record<string, unknown>
}

// Extension Agent 上下文
export interface ExtensionAgentContext {
  setModel(modelId: string): void
  getModel(): string
  setThinkingLevel(level: 'none' | 'low' | 'medium' | 'high'): void
  setActiveTools(toolNames: string[]): void
  sendMessage(text: string): Promise<void>
  exec(command: string): Promise<string>
}

// Extension API — 提供给 Extension 的接口
export interface ExtensionAPI {
  // 事件系统
  on<T extends ExtensionEventName>(
    event: T,
    handler: ExtensionEventHandler<T>,
  ): () => void

  // Hook 注册
  registerHook<T extends HookTiming>(hook: HookRegistration<T>): () => void

  // 工具注册
  registerTool(tool: AgentTool): () => void

  // MCP 服务器注册
  registerMcp(config: McpRegistration): () => void

  // 斜杠命令注册
  registerCommand(command: SlashCommand): () => void

  // 快捷键注册
  registerShortcut(key: string, handler: () => void | Promise<void>): () => void

  // 日志
  log: {
    info(message: string): void
    warn(message: string): void
    error(message: string): void
  }

  // 事件总线通信
  emit(event: string, data: unknown): void
  onBus(event: string, handler: (data: unknown) => void): () => void

  // 上下文
  ui: ExtensionUIContext
  config: ExtensionConfigContext
  agent: ExtensionAgentContext
}

// Extension 工厂函数类型
export type ExtensionFactory = (api: ExtensionAPI) => void | Promise<void>

// Extension 描述符
export interface ExtensionDescriptor {
  name: string
  version?: string
  source: ExtensionSource
  entryPoint: string
  factory?: ExtensionFactory
}

// Extension 来源
export type ExtensionSource = 'builtin' | 'npm' | 'local' | 'config' | 'git'

// Extension 加载结果
export interface ExtensionLoadResult {
  name: string
  loaded: boolean
  error?: Error
}

// Extension 运行器配置
export interface ExtensionRunnerConfig {
  // 内置扩展目录
  builtinDir?: string
  // 本地扩展目录
  localDir?: string
  // 配置数组中的扩展路径
  configPaths?: string[]
  // npm 包名前缀
  npmPrefix?: string
}

// 已加载的 Extension 实例
export interface LoadedExtension {
  descriptor: ExtensionDescriptor
  api: ExtensionAPI
  dispose: () => void
}
