import type { AgentSessionResult } from '../../types'

export interface RpcRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: unknown
}

export interface RpcError {
  code: number
  message: string
  data?: unknown
}

export interface RpcResponse {
  jsonrpc: '2.0'
  id: number | string | null
  result?: unknown
  error?: RpcError
}

export interface RpcServerOptions {
  socketPath?: string
}

export interface RpcServerHandle {
  socketPath: string
  start(): Promise<void>
  stop(): Promise<void>
}

export interface RpcAgentState {
  model: string
  isRunning: boolean
  messageCount: number
  totalTokens: { input: number; output: number }
}

export interface RpcAgentStream {
  result(): Promise<AgentSessionResult>
}

export interface RpcAgent {
  prompt(text: string): RpcAgentStream
  abort(): void
  steer(message: string): void
  getState(): RpcAgentState
  dispose(): Promise<void>
}
