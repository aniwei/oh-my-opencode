import { useCallback, useEffect, useMemo, useState } from 'react'
import { chatApi } from '../services/chat-api'
import { sessionApi } from '../services/session-api'
import type { ChatMessage, ToolCall } from '../types/message'
import {
  isTextDelta, isThinkingDelta, isToolStart, isToolEnd, isDone, isError,
  type TextDeltaPayload, type ThinkingDeltaPayload, type ToolStartPayload,
  type ToolEndPayload, type ErrorPayload,
} from '../utils/stream-parser'

function fromUnknownMessage(input: unknown): ChatMessage | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const row = input as Record<string, unknown>
  const id = typeof row.id === 'string' ? row.id : `msg-${Math.random().toString(16).slice(2)}`
  const role = row.role === 'assistant' || row.role === 'system' ? row.role : 'user'
  const content = typeof row.content === 'string'
    ? row.content
    : JSON.stringify(row.content ?? '')
  const createdAt = typeof row.timestamp === 'number' ? row.timestamp : Date.now()

  return { id, role, content, createdAt }
}

function updateMessage(messages: ChatMessage[], targetId: string, updater: (msg: ChatMessage) => ChatMessage): ChatMessage[] {
  return messages.map((msg) => msg.id === targetId ? updater(msg) : msg)
}

export function useChat(sessionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const detail = await sessionApi.get(sessionId)
    const mapped = detail.messages
      .map((item) => fromUnknownMessage(item))
      .filter((item): item is ChatMessage => Boolean(item))
    setMessages(mapped)
  }, [sessionId])

  useEffect(() => {
    void reload()
  }, [reload])

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      content,
      createdAt: Date.now(),
    }

    const assistantId = `local-assistant-${Date.now()}`
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      toolCalls: [],
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setStreaming(true)
    setStreamingMessageId(assistantId)

    const stream = chatApi.sendMessage(sessionId, { content })

    for await (const event of stream) {
      if (isTextDelta(event)) {
        const payload = event.data as TextDeltaPayload
        setMessages((prev) => updateMessage(prev, assistantId, (msg) => ({
          ...msg,
          content: msg.content + (payload.delta ?? ''),
        })))
      }

      if (isThinkingDelta(event)) {
        const payload = event.data as ThinkingDeltaPayload
        setMessages((prev) => updateMessage(prev, assistantId, (msg) => ({
          ...msg,
          thinking: (msg.thinking ?? '') + (payload.delta ?? ''),
        })))
      }

      if (isToolStart(event)) {
        const payload = event.data as ToolStartPayload
        const newTool: ToolCall = {
          id: payload.toolCallId,
          name: payload.name,
          status: 'running',
          input: payload.input,
        }
        setMessages((prev) => updateMessage(prev, assistantId, (msg) => ({
          ...msg,
          toolCalls: [...(msg.toolCalls ?? []), newTool],
        })))
      }

      if (isToolEnd(event)) {
        const payload = event.data as ToolEndPayload
        setMessages((prev) => updateMessage(prev, assistantId, (msg) => ({
          ...msg,
          toolCalls: (msg.toolCalls ?? []).map((tc) =>
            tc.id === payload.toolCallId
              ? { ...tc, status: payload.status, output: payload.output, durationMs: payload.durationMs }
              : tc,
          ),
        })))
      }

      if (isDone(event) || isError(event)) {
        if (isError(event)) {
          const payload = event.data as ErrorPayload
          setMessages((prev) => updateMessage(prev, assistantId, (msg) => ({
            ...msg,
            error: payload.message,
          })))
        }
        setStreaming(false)
        setStreamingMessageId(null)
      }
    }
  }, [sessionId])

  const stop = useCallback(async () => {
    if (!streamingMessageId) {
      return
    }

    await chatApi.stopMessage(sessionId, streamingMessageId)
    setStreaming(false)
    setStreamingMessageId(null)
  }, [sessionId, streamingMessageId])

  return useMemo(() => ({
    messages,
    streaming,
    sendMessage,
    stop,
    reload,
  }), [messages, streaming, sendMessage, stop, reload])
}
