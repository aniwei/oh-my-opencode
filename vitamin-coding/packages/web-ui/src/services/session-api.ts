import { apiClient } from './api-client'
import type { SessionSummary } from '../types/api'

export interface SessionDetail extends SessionSummary {
  messages: unknown[]
}

export const sessionApi = {
  list: () => apiClient.get<SessionSummary[]>('/api/sessions'),
  create: (title?: string) => apiClient.post<SessionSummary>('/api/sessions', { title }),
  get: (sessionId: string) => apiClient.get<SessionDetail>(`/api/sessions/${sessionId}`),
  remove: (sessionId: string) => apiClient.delete<{ removed: true }>(`/api/sessions/${sessionId}`),
}
