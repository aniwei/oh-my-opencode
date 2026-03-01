// OpenAI Responses API 适配器
// 对应 OpenAI 的新 Responses API（替代 Chat Completions）
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

const log = createLogger('ai:openai-responses')

// 构建 Responses API 请求体
function buildRequestBody(model: Model, context: StreamContext): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: model.id.split('/')[1],
    stream: true,
  }

  // 指令（系统提示）
  if (context.systemPrompt) {
    body.instructions = context.systemPrompt
  }

  // 消息输入
  body.input = context.messages.map((msg) => {
    if (msg.role === 'user') {
      return {
        role: 'user',
        content:
          typeof msg.content === 'string'
            ? msg.content
            : msg.content.map((p) => {
                if (p.type === 'text') return { type: 'input_text', text: p.text }
                if (p.type === 'image') {
                  return {
                    type: 'input_image',
                    image_url:
                      p.source.type === 'base64'
                        ? `data:${p.source.mediaType};base64,${p.source.data}`
                        : p.source.data,
                  }
                }
                return { type: 'input_text', text: '' }
              }),
      }
    }
    if (msg.role === 'assistant') {
      return {
        role: 'assistant',
        content: msg.content
          .filter((c) => c.type === 'text')
          .map((c) => (c as TextContent).text)
          .join(''),
      }
    }
    if (msg.role === 'tool_result') {
      return {
        type: 'function_call_output',
        call_id: msg.toolCallId,
        output: msg.content.map((c) => (c.type === 'text' ? c.text : '')).join(''),
      }
    }
    return { role: 'user', content: '' }
  })

  if (context.maxTokens) {
    body.max_output_tokens = context.maxTokens
  }

  // reasoning 配置
  if (model.reasoning && context.thinkingLevel) {
    body.reasoning = {
      effort: context.thinkingLevel === 'xhigh' ? 'high' : context.thinkingLevel,
    }
  }

  // 温度（reasoning 模型不设置）
  if (context.temperature !== undefined && !model.reasoning) {
    body.temperature = context.temperature
  }

  // 工具定义
  if (context.tools && context.tools.length > 0) {
    body.tools = context.tools.map((tool) => ({
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: toToolJsonSchema(tool.parameters),
    }))
  }

  return body
}

// 流状态
interface ResponsesStreamState {
  model: string
  textContent: string
  thinkingText: string
  toolCalls: ToolCall[]
  currentToolJson: string
  inputTokens: number
  outputTokens: number
  stopReason: 'end_turn' | 'max_tokens' | 'tool_use' | 'stop_sequence'
}

function createStreamState(model: string): ResponsesStreamState {
  return {
    model,
    textContent: '',
    thinkingText: '',
    toolCalls: [],
    currentToolJson: '',
    inputTokens: 0,
    outputTokens: 0,
    stopReason: 'end_turn',
  }
}

function buildFinalMessage(state: ResponsesStreamState): AssistantMessage {
  const content: (TextContent | ThinkingContent | ToolCall)[] = []

  if (state.thinkingText) {
    content.push({ type: 'thinking', text: state.thinkingText })
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
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    stopReason: state.stopReason,
    model: state.model,
  }
}

// OpenAI Responses API Provider 适配器
export function createOpenAIResponsesProvider(): ProviderAdapter {
  return {
    id: 'openai-responses',
    displayName: 'OpenAI (Responses)',

    async *stream(
      model: Model,
      context: StreamContext,
      options: StreamOptions,
      signal: AbortSignal,
    ): AsyncIterable<StreamEvent> {
      const apiKey = options.apiKey ?? ''
      const baseUrl = model.baseUrl || 'https://api.openai.com'
      const url = `${baseUrl}/v1/responses`
      const body = buildRequestBody(model, context)

      log.debug({ model: model.id }, 'OpenAI Responses 流式请求')

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
          const type = (sseEvent.event ?? data.type) as string

          if (!started && type) {
            started = true
            yield { type: 'start', partial: buildFinalMessage(state) }
          }

          // 文本增量
          if (type === 'response.output_text.delta') {
            const delta = data.delta as string
            state.textContent += delta
            yield { type: 'text_delta', index: 0, delta }
          }

          // reasoning 增量
          if (type === 'response.reasoning.delta') {
            const delta = data.delta as string
            state.thinkingText += delta
            yield { type: 'thinking_delta', index: 0, delta }
          }

          // 函数调用开始
          if (type === 'response.function_call_arguments.start') {
            const tc: ToolCall = {
              type: 'tool_call',
              id: (data.call_id as string) ?? `call_${state.toolCalls.length}`,
              name: (data.name as string) ?? '',
              arguments: {},
            }
            state.toolCalls.push(tc)
            state.currentToolJson = ''
            yield { type: 'tool_call_start', toolCall: tc }
          }

          // 函数调用参数增量
          if (type === 'response.function_call_arguments.delta') {
            const delta = data.delta as string
            state.currentToolJson += delta
            const currentTc = state.toolCalls[state.toolCalls.length - 1]
            if (currentTc) {
              yield { type: 'tool_call_delta', id: currentTc.id, delta }
            }
          }

          // 函数调用完成
          if (type === 'response.function_call_arguments.done') {
            const currentTc = state.toolCalls[state.toolCalls.length - 1]
            if (currentTc) {
              try {
                currentTc.arguments = JSON.parse(state.currentToolJson) as Record<string, unknown>
              } catch {
                log.warn('无法解析函数调用参数')
              }
              yield { type: 'tool_call_end', id: currentTc.id, toolCall: currentTc }
            }
            state.currentToolJson = ''
          }

          // 完成
          if (type === 'response.completed') {
            const response = data.response as Record<string, unknown> | undefined
            if (response?.usage) {
              const usage = response.usage as Record<string, number>
              state.inputTokens = usage.input_tokens ?? 0
              state.outputTokens = usage.output_tokens ?? 0
            }
            const status = response?.status as string | undefined
            if (status === 'incomplete') {
              state.stopReason = 'max_tokens'
            } else if (state.toolCalls.length > 0) {
              state.stopReason = 'tool_use'
            }
          }
        } catch (error) {
          log.warn({ error }, '解析 OpenAI Responses SSE 事件失败')
        }
      }

      yield { type: 'done', message: buildFinalMessage(state) }
    },
  }
}
