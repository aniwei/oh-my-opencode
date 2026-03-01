// Anthropic Messages API 适配器
// 支持 Claude 全系列模型的流式调用 + thinking 块
import { createLogger } from '@vitamin/shared'

import { httpStreamRequest } from '../utils/http-client'
import { toToolJsonSchema } from '../utils/tool-schema'

import type {
  AssistantMessage,
  Model,
  StreamContext,
  StreamEvent,
  StreamOptions,
  TextContent,
  ThinkingContent,
  ToolCall,
} from '../types'
import type { ProviderAdapter } from './types'

const log = createLogger('ai:anthropic')

// Anthropic 消息格式转换
function convertMessages(context: StreamContext): unknown[] {
  return context.messages.map((msg) => {
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        return { role: 'user', content: msg.content }
      }
      return {
        role: 'user',
        content: msg.content.map((part) => {
          if (part.type === 'text') return { type: 'text', text: part.text }
          if (part.type === 'image') {
            return {
              type: 'image',
              source: {
                type: part.source.type,
                media_type: part.source.mediaType,
                data: part.source.data,
              },
            }
          }
          return { type: 'text', text: '[unsupported content]' }
        }),
      }
    }
    if (msg.role === 'assistant') {
      return {
        role: 'assistant',
        content: msg.content.map((part) => {
          if (part.type === 'text') return { type: 'text', text: part.text }
          if (part.type === 'thinking') {
            return { type: 'thinking', thinking: part.text, signature: part.signature }
          }
          if (part.type === 'tool_call') {
            return {
              type: 'tool_use',
              id: part.id,
              name: part.name,
              input: part.arguments,
            }
          }
          return { type: 'text', text: '' }
        }),
      }
    }
    if (msg.role === 'tool_result') {
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: msg.toolCallId,
            is_error: msg.isError,
            content: msg.content.map((part) => {
              if (part.type === 'text') return { type: 'text', text: part.text }
              return { type: 'text', text: '' }
            }),
          },
        ],
      }
    }
    return { role: 'user', content: '[unknown message type]' }
  })
}

// 构建请求 body
function buildRequestBody(model: Model, context: StreamContext): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: model.id.split('/')[1],
    messages: convertMessages(context),
    max_tokens: context.maxTokens ?? model.maxOutputTokens,
    stream: true,
  }

  if (context.systemPrompt) {
    body.system = context.systemPrompt
  }

  if (context.temperature !== undefined) {
    body.temperature = context.temperature
  }

  // thinking 配置
  if (context.thinkingLevel && model.reasoning) {
    body.thinking = {
      type: 'enabled',
      budget_tokens: thinkingBudget(context.thinkingLevel),
    }
    // thinking 模式下不支持 temperature
    body.temperature = undefined
  }

  // 工具定义
  if (context.tools && context.tools.length > 0) {
    body.tools = context.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: toToolJsonSchema(tool.parameters),
    }))
  }

  return body
}

// thinking 级别到 budget 的映射
function thinkingBudget(level: string): number {
  switch (level) {
    case 'minimal':
      return 4000
    case 'low':
      return 8000
    case 'medium':
      return 16000
    case 'high':
      return 32000
    case 'xhigh':
      return 64000
    default:
      return 32000
  }
}

// Anthropic 流式事件解析
function parseAnthropicEvent(
  eventType: string,
  data: unknown,
  state: StreamState,
): StreamEvent | undefined {
  const obj = data as Record<string, unknown>

  switch (eventType) {
    case 'message_start': {
      const message = obj.message as Record<string, unknown>
      const usage = message.usage as Record<string, number>
      state.inputTokens = usage?.input_tokens ?? 0
      state.cacheReadTokens = usage?.cache_read_input_tokens ?? 0
      state.cacheWriteTokens = usage?.cache_creation_input_tokens ?? 0
      return {
        type: 'start',
        partial: buildPartialMessage(state),
      }
    }
    case 'content_block_start': {
      const block = obj.content_block as Record<string, unknown>
      const index = obj.index as number
      state.currentBlockIndex = index
      if (block.type === 'thinking') {
        state.currentBlockType = 'thinking'
        return {
          type: 'thinking_delta',
          index,
          delta: '',
        }
      }
      if (block.type === 'tool_use') {
        const toolCall: ToolCall = {
          type: 'tool_call',
          id: block.id as string,
          name: block.name as string,
          arguments: {},
        }
        state.toolCalls.push(toolCall)
        state.currentToolCallId = toolCall.id
        state.currentToolCallJson = ''
        return { type: 'tool_call_start', toolCall }
      }
      state.currentBlockType = 'text'
      return undefined
    }
    case 'content_block_delta': {
      const delta = obj.delta as Record<string, unknown>
      if (delta.type === 'thinking_delta') {
        const text = delta.thinking as string
        state.thinkingText += text
        return {
          type: 'thinking_delta',
          index: state.currentBlockIndex,
          delta: text,
        }
      }
      if (delta.type === 'input_json_delta') {
        const json = delta.partial_json as string
        state.currentToolCallJson += json
        return {
          type: 'tool_call_delta',
          id: state.currentToolCallId,
          delta: json,
        }
      }
      if (delta.type === 'text_delta') {
        const text = delta.text as string
        state.textContent += text
        return {
          type: 'text_delta',
          index: state.currentBlockIndex,
          delta: text,
        }
      }
      return undefined
    }
    case 'content_block_stop': {
      if (state.currentBlockType === 'tool_use' || state.currentToolCallId) {
        // 解析工具调用参数
        const tc = state.toolCalls.find((t) => t.id === state.currentToolCallId)
        if (tc && state.currentToolCallJson) {
          try {
            tc.arguments = JSON.parse(state.currentToolCallJson) as Record<string, unknown>
          } catch {
            log.warn('无法解析工具调用参数 JSON')
          }
        }
        const result = tc ? { type: 'tool_call_end' as const, id: tc.id, toolCall: tc } : undefined
        state.currentToolCallId = ''
        state.currentToolCallJson = ''
        return result
      }
      return undefined
    }
    case 'message_delta': {
      const delta = obj.delta as Record<string, unknown>
      const usage = obj.usage as Record<string, number>
      state.outputTokens = usage?.output_tokens ?? 0
      state.stopReason = mapStopReason(delta.stop_reason as string)
      return undefined
    }
    case 'message_stop': {
      return {
        type: 'done',
        message: buildFinalMessage(state),
      }
    }
    default:
      return undefined
  }
}

// 流状态
interface StreamState {
  model: string
  textContent: string
  thinkingText: string
  thinkingSignature?: string
  toolCalls: ToolCall[]
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  stopReason: 'end_turn' | 'max_tokens' | 'tool_use' | 'stop_sequence'
  currentBlockIndex: number
  currentBlockType: string
  currentToolCallId: string
  currentToolCallJson: string
}

function createStreamState(model: string): StreamState {
  return {
    model,
    textContent: '',
    thinkingText: '',
    toolCalls: [],
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    stopReason: 'end_turn',
    currentBlockIndex: 0,
    currentBlockType: 'text',
    currentToolCallId: '',
    currentToolCallJson: '',
  }
}

function buildPartialMessage(state: StreamState): AssistantMessage {
  return buildFinalMessage(state)
}

function buildFinalMessage(state: StreamState): AssistantMessage {
  const content: (TextContent | ThinkingContent | ToolCall)[] = []

  if (state.thinkingText) {
    content.push({
      type: 'thinking',
      text: state.thinkingText,
      signature: state.thinkingSignature,
    })
  }
  if (state.textContent) {
    content.push({ type: 'text', text: state.textContent })
  }
  for (const tc of state.toolCalls) {
    content.push(tc)
  }

  return {
    role: 'assistant',
    content,
    usage: {
      inputTokens: state.inputTokens,
      outputTokens: state.outputTokens,
      cacheReadTokens: state.cacheReadTokens,
      cacheWriteTokens: state.cacheWriteTokens,
    },
    stopReason: state.stopReason,
    model: state.model,
  }
}

function mapStopReason(reason: string): 'end_turn' | 'max_tokens' | 'tool_use' | 'stop_sequence' {
  switch (reason) {
    case 'end_turn':
      return 'end_turn'
    case 'max_tokens':
      return 'max_tokens'
    case 'tool_use':
      return 'tool_use'
    case 'stop_sequence':
      return 'stop_sequence'
    default:
      return 'end_turn'
  }
}

// Anthropic Provider 适配器
export function createAnthropicProvider(): ProviderAdapter {
  return {
    id: 'anthropic-messages',
    displayName: 'Anthropic',

    async *stream(
      model: Model,
      context: StreamContext,
      options: StreamOptions,
      signal: AbortSignal,
    ): AsyncIterable<StreamEvent> {
      const apiKey = options.apiKey ?? ''
      const baseUrl = model.baseUrl || 'https://api.anthropic.com'
      const url = `${baseUrl}/v1/messages`
      const body = buildRequestBody(model, context)

      log.debug({ model: model.id, url }, 'Anthropic 流式请求')

      const state = createStreamState(model.id)

      for await (const sseEvent of httpStreamRequest({
        url,
        body,
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
        },
        signal,
        timeout: options.timeout ?? 300000,
      })) {
        if (sseEvent.data === '[DONE]') break

        try {
          const data = JSON.parse(sseEvent.data) as Record<string, unknown>
          const eventType = (data.type as string) ?? sseEvent.event ?? ''
          const event = parseAnthropicEvent(eventType, data, state)
          if (event) yield event
        } catch (error) {
          log.warn({ error }, '解析 Anthropic SSE 事件失败')
        }
      }
    },
  }
}
