import { apiClient } from './api-client'
import { mockBackend } from './mock-backend'
import { isMockApiEnabled } from './mock-mode'
import type { SessionSummary } from '../types/api'

export interface SessionDetail extends SessionSummary {
  messages: unknown[]
}

export const sessionApi = {
  list: () => isMockApiEnabled()
    ? mockBackend.listSessions()
    : apiClient.get<SessionSummary[]>('/api/sessions'),
  create: (title?: string) => isMockApiEnabled()
    ? mockBackend.createSession(title)
    : apiClient.post<SessionSummary>('/api/sessions', { title }),
  get: (sessionId: string) => isMockApiEnabled()
    ? mockBackend.getSession(sessionId)
    : apiClient.get<SessionDetail>(`/api/sessions/${sessionId}`),
  remove: (sessionId: string) => isMockApiEnabled()
    ? mockBackend.removeSession(sessionId)
    : apiClient.delete<{ removed: true }>(`/api/sessions/${sessionId}`),
}
