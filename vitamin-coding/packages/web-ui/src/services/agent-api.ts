import { apiClient } from './api-client'

export interface AgentInfo {
  id: string
  name: string
  description: string
  capabilities: string[]
  state?: 'idle' | 'running' | 'error'
}

export interface AgentStatusDetail {
  state: 'idle' | 'running' | 'error'
  toolCalls: number
  inputTokens: number
  outputTokens: number
  recentToolCalls: Array<{
    id: string
    name: string
    status: string
    durationMs?: number
  }>
}

export const agentApi = {
  list: () => apiClient.get<{ agents: AgentInfo[] }>('/api/agents'),
  getStatus: (agentId: string) => apiClient.get<AgentStatusDetail>(`/api/agents/${agentId}/status`),
}
