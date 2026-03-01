// OpenAI Chat Completions API 适配器
// 支持 GPT 系列、DeepSeek、xAI 等兼容 API
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

const log = createLogger('ai:openai-completions')

// 转换消息格式为 OpenAI 格式
function convertMessages(context: StreamContext): unknown[] {
  const result: unknown[] = []

  // system prompt 作为第一条消息
  if (context.systemPrompt) {
    result.push({ role: 'system', content: context.systemPrompt })
  }

  for (const msg of context.messages) {
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        result.push({ role: 'user', content: msg.content })
      } else {
        result.push({
          role: 'user',
          content: msg.content.map((part) => {
            if (part.type === 'text') return { type: 'text', text: part.text }
            if (part.type === 'image') {
              return {
                type: 'image_url',
                image_url: {
                  url:
                    part.source.type === 'base64'
                      ? `data:${part.source.mediaType};base64,${part.source.data}`
                      : part.source.data,
                },
              }
            }
            return { type: 'text', text: '[unsupported]' }
          }),
        })
      }
    } else if (msg.role === 'assistant') {
      const toolCalls = msg.content
        .filter((c): c is ToolCall => c.type === 'tool_call')
        .map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        }))

      const textParts = msg.content
        .filter((c): c is TextContent => c.type === 'text')
        .map((c) => c.text)
        .join('')

      result.push({
        role: 'assistant',
        content: textParts || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      })
    } else if (msg.role === 'tool_result') {
      result.push({
        role: 'tool',
        tool_call_id: msg.toolCallId,
        content: msg.content.map((c) => (c.type === 'text' ? c.text : '')).join(''),
      })
    }
  }

  return result
}

// 构建请求 body
function buildRequestBody(model: Model, context: StreamContext): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: model.id.split('/')[1],
    messages: convertMessages(context),
    max_tokens: context.maxTokens ?? model.maxOutputTokens,
    stream: true,
    stream_options: { include_usage: true },
  }

  // GPT reasoning 模型不设置 temperature
  if (context.temperature !== undefined && !model.reasoning) {
    body.temperature = context.temperature
  }

  // reasoning 模型使用 reasoning_effort
  if (model.reasoning && context.thinkingLevel) {
    body.reasoning_effort = mapThinkingLevel(context.thinkingLevel)
  }

  // 工具定义
  if (context.tools && context.tools.length > 0) {
    body.tools = context.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: toToolJsonSchema(tool.parameters),
      },
    }))
  }

  return body
}

function mapThinkingLevel(level: string): string {
  switch (level) {
    case 'minimal':
      return 'low'
    case 'low':
      return 'low'
    case 'medium':
      return 'medium'
    case 'high':
      return 'high'
    case 'xhigh':
      return 'high'
    default:
      return 'medium'
  }
}

// 流状态
interface CompletionsStreamState {
  model: string
  textContent: string
  thinkingText: string
  toolCalls: Map<number, { id: string; name: string; argumentsJson: string }>
  inputTokens: number
  outputTokens: number
  stopReason: 'end_turn' | 'max_tokens' | 'tool_use' | 'stop_sequence'
}

function createStreamState(model: string): CompletionsStreamState {
  return {
    model,
    textContent: '',
    thinkingText: '',
    toolCalls: new Map(),
    inputTokens: 0,
    outputTokens: 0,
    stopReason: 'end_turn',
  }
}

function buildFinalMessage(state: CompletionsStreamState): AssistantMessage {
  const content: (TextContent | ThinkingContent | ToolCall)[] = []

  if (state.thinkingText) {
    content.push({ type: 'thinking', text: state.thinkingText })
  }
  if (state.textContent) {
    content.push({ type: 'text', text: state.textContent })
  }

  for (const [, tc] of state.toolCalls) {
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(tc.argumentsJson) as Record<string, unknown>
    } catch {
      log.warn('无法解析工具调用参数 JSON')
    }
    content.push({
      type: 'tool_call',
      id: tc.id,
      name: tc.name,
      arguments: args,
    })
  }

  return {
    role: 'assistant',
    content,
    usage: {
      inputTokens: state.inputTokens,
      outputTokens: state.outputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    stopReason: state.stopReason,
    model: state.model,
  }
}

// OpenAI Chat Completions Provider 适配器
export function createOpenAICompletionsProvider(): ProviderAdapter {
  return {
    id: 'openai-completions',
    displayName: 'OpenAI (Completions)',

    async *stream(
      model: Model,
      context: StreamContext,
      options: StreamOptions,
      signal: AbortSignal,
    ): AsyncIterable<StreamEvent> {
      const apiKey = options.apiKey ?? ''
      const baseUrl = model.baseUrl || 'https://api.openai.com'
      const url = `${baseUrl}/v1/chat/completions`
      const body = buildRequestBody(model, context)

      log.debug({ model: model.id }, 'OpenAI Completions 流式请求')

      const state = createStreamState(model.id)
      let started = false

      for await (const sseEvent of httpStreamRequest({
        url,
        body,
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
        signal,
        timeout: options.timeout ?? 300000,
      })) {
        if (sseEvent.data === '[DONE]') break

        try {
          const data = JSON.parse(sseEvent.data) as Record<string, unknown>

          // 处理 usage
          if (data.usage) {
            const usage = data.usage as Record<string, number>
            state.inputTokens = usage.prompt_tokens ?? 0
            state.outputTokens = usage.completion_tokens ?? 0
          }

          const choices = data.choices as Array<Record<string, unknown>> | undefined
          if (!choices || choices.length === 0) continue

          const choice = choices[0]!
          const delta = choice.delta as Record<string, unknown> | undefined
          if (!delta) continue

          // 发送 start 事件
          if (!started) {
            started = true
            yield { type: 'start', partial: buildFinalMessage(state) }
          }

          // finish_reason
          if (choice.finish_reason) {
            const reason = choice.finish_reason as string
            state.stopReason =
              reason === 'stop'
                ? 'end_turn'
                : reason === 'length'
                  ? 'max_tokens'
                  : reason === 'tool_calls'
                    ? 'tool_use'
                    : 'end_turn'
          }

          // 文本 delta
          if (delta.content) {
            const text = delta.content as string
            state.textContent += text
            yield { type: 'text_delta', index: 0, delta: text }
          }

          // reasoning delta（OpenAI reasoning 模型）
          if (delta.reasoning) {
            const text = delta.reasoning as string
            state.thinkingText += text
            yield { type: 'thinking_delta', index: 0, delta: text }
          }

          // 工具调用 delta
          if (delta.tool_calls) {
            const toolCallDeltas = delta.tool_calls as Array<Record<string, unknown>>
            for (const tcd of toolCallDeltas) {
              const idx = tcd.index as number
              const fn = tcd.function as Record<string, unknown> | undefined

              if (!state.toolCalls.has(idx)) {
                // 新工具调用
                const id = (tcd.id as string) ?? `call_${idx}`
                const name = (fn?.name as string) ?? ''
                state.toolCalls.set(idx, { id, name, argumentsJson: '' })
                yield {
                  type: 'tool_call_start',
                  toolCall: { type: 'tool_call', id, name, arguments: {} },
                }
              }

              // 参数增量
              const tc = state.toolCalls.get(idx)!
              if (fn?.arguments) {
                const argDelta = fn.arguments as string
                tc.argumentsJson += argDelta
                yield { type: 'tool_call_delta', id: tc.id, delta: argDelta }
              }
            }
          }
        } catch (error) {
          log.warn({ error }, '解析 OpenAI SSE 事件失败')
        }
      }

      // 发送工具调用结束事件
      for (const [, tc] of state.toolCalls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(tc.argumentsJson) as Record<string, unknown>
        } catch {
          log.warn('无法解析工具调用参数')
        }
        yield {
          type: 'tool_call_end',
          id: tc.id,
          toolCall: { type: 'tool_call', id: tc.id, name: tc.name, arguments: args },
        }
      }

      // 发送完成事件
      yield { type: 'done', message: buildFinalMessage(state) }
    },
  }
}
