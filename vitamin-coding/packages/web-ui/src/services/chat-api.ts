import { StreamClient } from './stream-client'

export interface SendMessageInput {
  content: string
  agentId?: string
}

export const chatApi = {
  sendMessage(sessionId: string, input: SendMessageInput) {
    return StreamClient.fromSse(`/api/sessions/${sessionId}/messages`, input)
  },
  stopMessage(sessionId: string, messageId: string) {
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
