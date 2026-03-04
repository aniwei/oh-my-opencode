import { StreamClient } from './stream-client'
import { mockBackend } from './mock-backend'
import { isMockApiEnabled } from './mock-mode'

export interface SendMessageInput {
  content: string
  agentId?: string
}

export const chatApi = {
  sendMessage(sessionId: string, input: SendMessageInput) {
    if (isMockApiEnabled()) {
      return mockBackend.sendMessage(sessionId, input)
    }

    return StreamClient.fromSse(`/api/sessions/${sessionId}/messages`, input)
  },
  stopMessage(sessionId: string, messageId: string) {
    if (isMockApiEnabled()) {
      return mockBackend.stopMessage(sessionId, messageId)
    }

    return fetch(`/api/sessions/${sessionId}/messages/${messageId}/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`Stop message failed: ${response.status}`)
      }
      return response.json() as Promise<{ stopped: boolean }>
    })
  },
}
