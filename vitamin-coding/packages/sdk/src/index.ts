// @vitamin/sdk — 嵌入式 SDK

// 主入口
export { createVitaminAgent } from './create-agent'

// AgentStream
export { createAgentStream, AgentStream } from './agent-stream'

// RPC
export { createRpcServer } from './rpc-server'
export type { RPCServerHandle } from './rpc-server'
export { createRpcClient } from './rpc-client'
export type { RPCClientHandle } from './rpc-client'

// 类型
export type {
  VitaminAgent,
  VitaminAgentOptions,
  VitaminAgentState,
  ConversationHandle,
  StreamEvent,
  RPCRequest,
  RPCResponse,
  RPCError,
  RPCServerOptions,
  RPCClientOptions,
  ExternalToolDefinition,
  AgentEventName,
  AgentEventHandler,
  AgentEventPayloadMap,
} from './types'
