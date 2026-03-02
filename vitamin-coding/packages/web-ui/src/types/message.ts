export type MessageRole = 'user' | 'assistant' | 'system'

export interface ToolCall {
  id: string
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
  durationMs?: number
  input?: unknown
  output?: unknown
}

export interface Attachment {
  name: string
  type: 'image' | 'file'
  url: string
  size?: number
}

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  createdAt: number
  thinking?: string
  toolCalls?: ToolCall[]
  attachments?: Attachment[]
  error?: string
}
