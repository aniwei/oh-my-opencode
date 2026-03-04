import { apiClient } from './api-client'
import { mockBackend } from './mock-backend'
import { isMockApiEnabled } from './mock-mode'
import type { ModelsResponse } from '../types/api'

export const modelsApi = {
  list: () => isMockApiEnabled()
    ? mockBackend.listModels()
    : apiClient.get<ModelsResponse>('/api/models'),
}
