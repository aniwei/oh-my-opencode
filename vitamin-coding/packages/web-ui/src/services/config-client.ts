import { apiClient } from './api-client'
import { mockBackend } from './mock-backend'
import { isMockApiEnabled } from './mock-mode'
import type { ClientConfig } from '../types/api'

export const configClient = {
  get: () => isMockApiEnabled()
    ? mockBackend.getConfig()
    : apiClient.get<ClientConfig>('/api/config'),
}
