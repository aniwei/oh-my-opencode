export type SessionStatus = 'active' | 'archived' | 'deleted'

export interface SessionMetadata {
  agentId?: string
  tags?: string[]
  pinned?: boolean
}

export interface Session {
  id: string
  title: string
  status: SessionStatus
  createdAt: number
  updatedAt: number
  messageCount: number
  metadata?: SessionMetadata
  preview?: string
}

export interface SessionCreateInput {
  title?: string
  agentId?: string
}

export interface SessionUpdateInput {
  title?: string
  status?: SessionStatus
  metadata?: Partial<SessionMetadata>
}

export interface SessionForkInput {
  fromMessageId: string
}

export interface SessionForkResult {
  sessionId: string
}
