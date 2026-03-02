import { apiClient } from './api-client'
import type { ClientConfig } from '../types/api'

export const configClient = {
  get: () => apiClient.get<ClientConfig>('/api/config'),
}
