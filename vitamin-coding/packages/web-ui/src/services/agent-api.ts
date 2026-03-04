import { apiClient } from './api-client'
import { mockBackend } from './mock-backend'
import { isMockApiEnabled } from './mock-mode'

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
  list: () => isMockApiEnabled()
    ? mockBackend.listAgents()
    : apiClient.get<{ agents: AgentInfo[] }>('/api/agents'),
  getStatus: (agentId: string) => isMockApiEnabled()
    ? mockBackend.getAgentStatus(agentId)
    : apiClient.get<AgentStatusDetail>(`/api/agents/${agentId}/status`),
}
