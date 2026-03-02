import { apiClient } from './api-client'
import type { ModelInfo } from '../types/api'

export const modelsApi = {
  list: () => apiClient.get<{ models: ModelInfo[] }>('/api/models'),
}
