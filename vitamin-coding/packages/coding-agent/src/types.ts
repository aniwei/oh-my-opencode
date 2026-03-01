// @vitamin/coding-agent 类型定义
import type { VitaminConfig } from '@vitamin/config'
import type { HookEngine } from '@vitamin/hooks'
import type { ToolRegistry } from '@vitamin/tools'
import type { AgentRegistry, TaskDispatcher, BackgroundManager } from '@vitamin/orchestrator'
import type { SessionManager } from '@vitamin/session'
import type { ExtensionRunner } from '@vitamin/extension'
import type { McpRegistry } from '@vitamin/mcp'


// 运行模式
export type RunMode = 'interactive' | 'print' | 'json' | 'rpc'

// CLI 解析结果
export interface CLIOptions {
  prompt?: string
  model?: string
  mode: RunMode
  configPath?: string
  projectDir: string
  verbose: boolean
  maxTokens?: number
  continueSession?: string
}

// 子系统集合
export interface Subsystems {
  config: VitaminConfig
  toolRegistry: ToolRegistry
  hookEngine: HookEngine
  agentRegistry: AgentRegistry
  sessionManager: SessionManager
  mcpRegistry: McpRegistry
  extensionRunner: ExtensionRunner
  taskDispatcher: TaskDispatcher
  backgroundManager: BackgroundManager
}

// AgentSession — 核心会话控制器
export interface AgentSession {
  id: string
  subsystems: Subsystems
  state: AgentSessionState
  prompt: (input: string) => Promise<AgentSessionResult>
  abort: () => void
  getSystemPrompt: () => string
  switchModel: (modelId: string) => void
  compact: () => Promise<void>
  dispose: () => Promise<void>
}

// 会话状态
export interface AgentSessionState {
  currentModel: string
  totalCost: number
  totalTokens: { input: number; output: number }
  messageCount: number
  isRunning: boolean
}

// 会话结果
export interface AgentSessionResult {
  response: string
  cost: number
  tokens: { input: number; output: number }
  toolCalls: ToolCallRecord[]
  duration: number
}

// 工具调用记录
export interface ToolCallRecord {
  name: string
  args: Record<string, unknown>
  result: string
  duration: number
}

// 系统 Prompt 层级（§S12.2）
export interface SystemPromptLayers {
  identity: string
  delegationTable: string
  toolList: string
  projectContext: string
  activeSkills: string
  categoryInfo: string
}

// 资源加载结果
export interface ProjectResources {
  agentsMd: string | null
  rules: string[]
  plans: string[]
  extensions: string[]
}

// 斜杠命令
export interface SlashCommandDef {
  name: string
  description: string
  usage?: string
  handler: (args: string, session: AgentSession) => Promise<string>
}

// 模式接口
export interface ModeRunner {
  run: (session: AgentSession, options: CLIOptions) => Promise<void>
}

// 流式输出事件
export type OutputEvent =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: string }
  | { type: 'done'; summary: AgentSessionResult }
  | { type: 'error'; error: string }

// JSON 模式输出
export interface JsonOutput {
  messages: Array<{ role: string; content: string }>
  cost: number
  tokens: { input: number; output: number }
  model: string
  duration: number
}
