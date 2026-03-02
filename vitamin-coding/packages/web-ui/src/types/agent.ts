export type AgentState = 'idle' | 'running' | 'error' | 'stopped'

export interface AgentInfo {
  id: string
  name: string
  description: string
  capabilities: string[]
  modelId?: string
}

export interface AgentStatus {
  id: string
  state: AgentState
  lastUpdatedAt: number
  currentToolName?: string
  toolCalls: number
  inputTokens: number
  outputTokens: number
  startedAt?: number
  durationMs?: number
}

export interface AgentProgressEvent {
  agentId: string
  type: 'state_change' | 'tool_call' | 'progress'
  payload: unknown
}
