export interface SessionSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

export interface ModelInfo {
  id: string
  provider: string
  displayName: string
  supportsVision: boolean
}

export interface ClientConfig {
  theme: 'light' | 'dark'
  features: string[]
  limits: {
    maxFileSizeMb: number
    maxAttachments: number
  }
}

export type StreamEventType =
  | 'text_delta'
  | 'thinking_delta'
  | 'tool_start'
  | 'tool_end'
  | 'done'
  | 'error'

export interface StreamEvent<T = unknown> {
  type: StreamEventType
  data: T
}
