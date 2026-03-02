import type { StreamEvent, StreamEventType } from '../types/api'

export interface TextDeltaPayload {
  delta: string
}

export interface ThinkingDeltaPayload {
  delta: string
}

export interface ToolStartPayload {
  toolCallId: string
  name: string
  input: unknown
}

export interface ToolEndPayload {
  toolCallId: string
  status: 'success' | 'error'
  output: unknown
  durationMs: number
}

export interface DonePayload {
  messageId: string
  inputTokens: number
  outputTokens: number
}

export interface ErrorPayload {
  code: string
  message: string
}

export function isTextDelta(event: StreamEvent): event is StreamEvent<TextDeltaPayload> {
  return event.type === 'text_delta'
}

export function isThinkingDelta(event: StreamEvent): event is StreamEvent<ThinkingDeltaPayload> {
  return event.type === 'thinking_delta'
}

export function isToolStart(event: StreamEvent): event is StreamEvent<ToolStartPayload> {
  return event.type === 'tool_start'
}

export function isToolEnd(event: StreamEvent): event is StreamEvent<ToolEndPayload> {
  return event.type === 'tool_end'
}

export function isDone(event: StreamEvent): event is StreamEvent<DonePayload> {
  return event.type === 'done'
}

export function isError(event: StreamEvent): event is StreamEvent<ErrorPayload> {
  return event.type === 'error'
}

export function parseStreamEventType(type: string): StreamEventType | null {
  const valid: StreamEventType[] = ['text_delta', 'thinking_delta', 'tool_start', 'tool_end', 'done', 'error']
  return valid.includes(type as StreamEventType) ? (type as StreamEventType) : null
}
