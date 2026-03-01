// AWS Bedrock Converse API 适配器
// 使用 Bedrock 的 ConverseStream API
import { ProviderError, createLogger } from '@vitamin/shared'

import { toToolJsonSchema } from '../utils/tool-schema'

import type {
  Model,
  StreamContext,
  StreamEvent,
  StreamOptions,
  TextContent,
  ThinkingContent,
  ToolCall,
} from '../types'
import type { ProviderAdapter } from './types'

const log = createLogger('ai:bedrock')

// Bedrock Converse 消息格式
function convertMessages(context: StreamContext): unknown[] {
  return context.messages.map((msg) => {
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        return { role: 'user', content: [{ text: msg.content }] }
      }
      return {
        role: 'user',
        content: msg.content.map((part) => {
          if (part.type === 'text') return { text: part.text }
          if (part.type === 'image') {
            return {
              image: {
                format: part.source.mediaType.split('/')[1] ?? 'jpeg',
                source: { bytes: part.source.data },
              },
            }
          }
          return { text: '' }
        }),
      }
    }
    if (msg.role === 'assistant') {
      return {
        role: 'assistant',
        content: msg.content.map((part) => {
          if (part.type === 'text') return { text: part.text }
          if (part.type === 'tool_call') {
            return {
              toolUse: {
                toolUseId: part.id,
                name: part.name,
                input: part.arguments,
              },
            }
          }
          return { text: '' }
        }),
      }
    }
    if (msg.role === 'tool_result') {
      return {
        role: 'user',
        content: [
          {
            toolResult: {
              toolUseId: msg.toolCallId,
              content: msg.content.map((c) =>
                c.type === 'text' ? { text: c.text } : { text: '' },
              ),
              status: msg.isError ? 'error' : 'success',
            },
          },
        ],
      }
    }
    return { role: 'user', content: [{ text: '' }] }
  })
}

// Bedrock 请求体
function buildRequestBody(model: Model, context: StreamContext): Record<string, unknown> {
  const body: Record<string, unknown> = {
    messages: convertMessages(context),
    inferenceConfig: {
      maxTokens: context.maxTokens ?? model.maxOutputTokens,
    },
  }

  if (context.systemPrompt) {
    body.system = [{ text: context.systemPrompt }]
  }

  const inferenceConfig = body.inferenceConfig as Record<string, unknown>
  if (context.temperature !== undefined) {
    inferenceConfig.temperature = context.temperature
  }

  // 工具定义
  if (context.tools && context.tools.length > 0) {
    body.toolConfig = {
      tools: context.tools.map((tool) => ({
        toolSpec: {
          name: tool.name,
          description: tool.description,
          inputSchema: { json: toToolJsonSchema(tool.parameters) },
        },
      })),
    }
  }

  return body
}

// Bedrock Provider 适配器
// 注意: Bedrock 使用 AWS Signature V4 签名，这里只实现消息格式转换
// 实际的签名逻辑需要 AWS SDK 或手动实现
export function createBedrockProvider(): ProviderAdapter {
  return {
    id: 'bedrock-converse',
    displayName: 'AWS Bedrock',

    async *stream(
      model: Model,
      context: StreamContext,
      _options: StreamOptions,
      signal: AbortSignal,
    ): AsyncIterable<StreamEvent> {
      const baseUrl = model.baseUrl || 'https://bedrock-runtime.us-east-1.amazonaws.com'
      const modelId = model.id.split('/')[1]
      const url = `${baseUrl}/model/${modelId}/converse-stream`
      const body = buildRequestBody(model, context)

      log.debug({ model: model.id }, 'Bedrock Converse 流式请求')

      // Bedrock 需要 AWS Signature V4 签名
      // 此处使用简化实现，实际使用需要 @aws-sdk/client-bedrock-runtime
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // AWS 签名头需要在实际使用时添加
        },
        body: JSON.stringify(body),
        signal,
      })

      if (!response.ok) {
        throw new ProviderError(`Bedrock 请求失败 (${response.status})`, {
          code: 'PROVIDER_REQUEST_ERROR',
        })
      }

      if (!response.body) {
        throw new ProviderError('Bedrock 响应体为空', {
          code: 'PROVIDER_EMPTY_RESPONSE',
        })
      }

      let textContent = ''
      const thinkingText = ''
      const toolCalls: ToolCall[] = []
      let inputTokens = 0
      let outputTokens = 0
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      yield {
        type: 'start',
        partial: {
          role: 'assistant',
          content: [],
          usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
          stopReason: 'end_turn',
          model: model.id,
        },
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line) as Record<string, unknown>

            // 内容块增量
            if (event.contentBlockDelta) {
              const delta = event.contentBlockDelta as Record<string, unknown>
              const d = delta.delta as Record<string, unknown>
              if (d?.text) {
                const text = d.text as string
                textContent += text
                yield { type: 'text_delta', index: 0, delta: text }
              }
              if (d?.toolUse) {
                const tu = d.toolUse as Record<string, unknown>
                const input = tu.input as string
                const currentTc = toolCalls[toolCalls.length - 1]
                if (currentTc) {
                  yield { type: 'tool_call_delta', id: currentTc.id, delta: input }
                }
              }
            }

            // 内容块开始
            if (event.contentBlockStart) {
              const start = event.contentBlockStart as Record<string, unknown>
              const s = start.start as Record<string, unknown>
              if (s?.toolUse) {
                const tu = s.toolUse as Record<string, unknown>
                const tc: ToolCall = {
                  type: 'tool_call',
                  id: tu.toolUseId as string,
                  name: tu.name as string,
                  arguments: {},
                }
                toolCalls.push(tc)
                yield { type: 'tool_call_start', toolCall: tc }
              }
            }

            // 使用量
            if (event.metadata) {
              const metadata = event.metadata as Record<string, unknown>
              const usage = metadata.usage as Record<string, number> | undefined
              if (usage) {
                inputTokens = usage.inputTokens ?? 0
                outputTokens = usage.outputTokens ?? 0
              }
            }
          } catch (error) {
            log.warn({ error }, '解析 Bedrock 事件失败')
          }
        }
      }

      // 构建最终消息
      const content: (TextContent | ThinkingContent | ToolCall)[] = []
      if (thinkingText) content.push({ type: 'thinking', text: thinkingText })
      if (textContent) content.push({ type: 'text', text: textContent })
      for (const tc of toolCalls) content.push(tc)

      yield {
        type: 'done',
        message: {
          role: 'assistant',
          content,
          usage: { inputTokens, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 },
          stopReason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
          model: model.id,
        },
      }
    },
  }
}
