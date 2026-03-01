// Google Generative AI 适配器
// 支持 Gemini 系列模型
import { createLogger } from '@vitamin/shared'

import { httpStreamRequest } from '../utils/http-client'
import { toGeminiToolJsonSchema } from '../utils/tool-schema'

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

const log = createLogger('ai:google')

// 转换消息为 Google 格式
function convertContents(context: StreamContext): unknown[] {
  return context.messages
    .filter((msg) => msg.role !== 'tool_result')
    .map((msg) => {
      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          return { role: 'user', parts: [{ text: msg.content }] }
        }
        return {
          role: 'user',
          parts: msg.content.map((part) => {
            if (part.type === 'text') return { text: part.text }
            if (part.type === 'image') {
              return {
                inline_data: {
                  mime_type: part.source.mediaType,
                  data: part.source.data,
                },
              }
            }
            return { text: '' }
          }),
        }
      }
      if (msg.role === 'assistant') {
        return {
          role: 'model',
          parts: msg.content.map((part) => {
            if (part.type === 'text') return { text: part.text }
            if (part.type === 'tool_call') {
              return {
                function_call: {
                  name: part.name,
                  args: part.arguments,
                },
              }
            }
            return { text: '' }
          }),
        }
      }
      return { role: 'user', parts: [{ text: '' }] }
    })
}

// 构建请求体
function buildRequestBody(model: Model, context: StreamContext): Record<string, unknown> {
  const body: Record<string, unknown> = {
    contents: convertContents(context),
    generationConfig: {
      maxOutputTokens: context.maxTokens ?? model.maxOutputTokens,
    },
  }

  // 系统指令
  if (context.systemPrompt) {
    body.systemInstruction = { parts: [{ text: context.systemPrompt }] }
  }

  // 温度
  const genConfig = body.generationConfig as Record<string, unknown>
  if (context.temperature !== undefined) {
    genConfig.temperature = context.temperature
  }

  // thinking 模式
  if (context.thinkingLevel && model.reasoning) {
    genConfig.thinkingConfig = { thinkingBudget: thinkingBudget(context.thinkingLevel) }
  }

  // 工具定义
  if (context.tools && context.tools.length > 0) {
    body.tools = [
      {
        functionDeclarations: context.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: toGeminiToolJsonSchema(tool.parameters),
        })),
      },
    ]
  }

  // 工具结果（如果最后一条消息是 tool_result）
  const lastMsg = context.messages[context.messages.length - 1]
  if (lastMsg && lastMsg.role === 'tool_result') {
    const contents = body.contents as unknown[]
    contents.push({
      role: 'user',
      parts: [
        {
          function_response: {
            name: 'tool',
            response: {
              result: lastMsg.content.map((c) => (c.type === 'text' ? c.text : '')).join(''),
            },
          },
        },
      ],
    })
  }

  return body
}

function thinkingBudget(level: string): number {
  switch (level) {
    case 'minimal':
      return 2048
    case 'low':
      return 4096
    case 'medium':
      return 8192
    case 'high':
      return 16384
    case 'xhigh':
      return 32768
    default:
      return 8192
  }
}

// 流状态
interface GoogleStreamState {
  model: string
  textContent: string
  thinkingText: string
  toolCalls: ToolCall[]
  inputTokens: number
  outputTokens: number
}

function createStreamState(model: string): GoogleStreamState {
  return {
    model,
    textContent: '',
    thinkingText: '',
    toolCalls: [],
    inputTokens: 0,
    outputTokens: 0,
  }
}

function buildFinalMessage(state: GoogleStreamState): AssistantMessage {
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
    stopReason: state.toolCalls.length > 0 ? 'tool_use' : 'end_turn',
    model: state.model,
  }
}

// Google Generative AI Provider 适配器
export function createGoogleProvider(): ProviderAdapter {
  return {
    id: 'google-generative-ai',
    displayName: 'Google',

    async *stream(
      model: Model,
      context: StreamContext,
      options: StreamOptions,
      signal: AbortSignal,
    ): AsyncIterable<StreamEvent> {
      const apiKey = options.apiKey ?? ''
      const baseUrl = model.baseUrl || 'https://generativelanguage.googleapis.com'
      const modelId = model.id.split('/')[1]
      const url = `${baseUrl}/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`
      const body = buildRequestBody(model, context)

      log.debug({ model: model.id }, 'Google GenAI 流式请求')

      const state = createStreamState(model.id)
      let started = false

      for await (const sseEvent of httpStreamRequest({
        url,
        body,
        headers: {},
        signal,
        timeout: options.timeout ?? 300000,
      })) {
        try {
          const data = JSON.parse(sseEvent.data) as Record<string, unknown>

          if (!started) {
            started = true
            yield { type: 'start', partial: buildFinalMessage(state) }
          }

          // 处理候选结果
          const candidates = data.candidates as Array<Record<string, unknown>> | undefined
          if (candidates && candidates.length > 0) {
            const candidate = candidates[0]!
            const content = candidate.content as Record<string, unknown> | undefined
            const parts = content?.parts as Array<Record<string, unknown>> | undefined

            if (parts) {
              for (const part of parts) {
                if (part.text !== undefined) {
                  const text = part.text as string
                  state.textContent += text
                  yield { type: 'text_delta', index: 0, delta: text }
                }
                if (part.thought !== undefined) {
                  const thought = part.thought as string
                  state.thinkingText += thought
                  yield { type: 'thinking_delta', index: 0, delta: thought }
                }
                if (part.functionCall) {
                  const fc = part.functionCall as Record<string, unknown>
                  const tc: ToolCall = {
                    type: 'tool_call',
                    id: `call_${state.toolCalls.length}`,
                    name: fc.name as string,
                    arguments: (fc.args as Record<string, unknown>) ?? {},
                  }
                  state.toolCalls.push(tc)
                  yield { type: 'tool_call_start', toolCall: tc }
                  yield { type: 'tool_call_end', id: tc.id, toolCall: tc }
                }
              }
            }
          }

          // 使用量
          const usageMetadata = data.usageMetadata as Record<string, number> | undefined
          if (usageMetadata) {
            state.inputTokens = usageMetadata.promptTokenCount ?? 0
            state.outputTokens = usageMetadata.candidatesTokenCount ?? 0
          }
        } catch (error) {
          log.warn({ error }, '解析 Google SSE 事件失败')
        }
      }

      yield { type: 'done', message: buildFinalMessage(state) }
    },
  }
}
