// @vitamin/sdk 类型定义
import type { AgentSessionResult } from '@vitamin/coding-agent'

// SDK 创建选项
export interface VitaminAgentOptions {
  projectDir: string
  model?: string
  config?: Record<string, unknown>
  extensions?: Array<(api: unknown) => void | Promise<void>>
}

// 多轮对话句柄
export interface ConversationHandle {
  send(text: string): AgentStream
  getHistory(): AgentSessionResult[]
  readonly turnCount: number
  end(): void
}

// SDK Agent 实例
export interface VitaminAgent {
  prompt(text: string): AgentStream
  conversation(): ConversationHandle
  steer(message: string): void
  abort(): void
  getState(): VitaminAgentState
  dispose(): Promise<void>
  // 外部工具注册
  registerTool(tool: ExternalToolDefinition): () => void
  // 事件订阅
  on<E extends AgentEventName>(event: E, handler: AgentEventHandler<E>): () => void
}

// 外部工具定义（SDK 消费者用）
export interface ExternalToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (args: Record<string, unknown>) => Promise<string>
}

// Agent 事件类型
export type AgentEventName =
  | 'status_change'
  | 'stream_start'
  | 'stream_end'
  | 'tool_call'
  | 'tool_result'
  | 'error'
  | 'done'

// 事件载荷映射
export interface AgentEventPayloadMap {
  status_change: { from: string; to: string }
  stream_start: { model: string }
  stream_end: { tokenUsage: { input: number; output: number } }
  tool_call: { name: string; args: Record<string, unknown> }
  tool_result: { name: string; result: string; isError: boolean }
  error: { message: string; code?: string }
  done: { messageCount: number }
}

// 事件处理器类型
export type AgentEventHandler<E extends AgentEventName> = (
  payload: AgentEventPayloadMap[E],
) => void

// Agent 状态
export interface VitaminAgentState {
  model: string
  isRunning: boolean
  messageCount: number
  totalTokens: { input: number; output: number }
}

// 流式事件
export type StreamEvent =
  | { type: 'start' }
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: string }
  | { type: 'done'; result: AgentSessionResult }
  | { type: 'error'; error: string }

// AgentStream — 支持 for await...of 消费
export interface AgentStream extends AsyncIterable<StreamEvent> {
  result(): Promise<AgentSessionResult>
  abort(): void
}

// RPC 请求/响应
export interface RPCRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: unknown
}

export interface RPCResponse {
  jsonrpc: '2.0'
  id: number | string | null
  result?: unknown
  error?: RPCError
}

export interface RPCError {
  code: number
  message: string
  data?: unknown
}

// RPC 服务器选项
export interface RPCServerOptions {
  socketPath?: string
  port?: number
}

// RPC 客户端选项
export interface RPCClientOptions {
  socketPath?: string
  host?: string
  port?: number
}
