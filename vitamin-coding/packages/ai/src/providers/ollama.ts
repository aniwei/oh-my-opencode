// Ollama 本地模型适配器
// 使用 Ollama 的 /api/chat 接口
import { createLogger } from '@vitamin/shared'

import { toToolJsonSchema } from '../utils/tool-schema'

import type {
  Model,
  StreamContext,
  StreamEvent,
  StreamOptions,
  TextContent,
  ToolCall,
} from '../types'
import type { ProviderAdapter } from './types'

const log = createLogger('ai:ollama')

// 转换消息格式
function convertMessages(context: StreamContext): unknown[] {
  const result: unknown[] = []

  if (context.systemPrompt) {
    result.push({ role: 'system', content: context.systemPrompt })
  }

  for (const msg of context.messages) {
    if (msg.role === 'user') {
      const content =
        typeof msg.content === 'string'
          ? msg.content
          : msg.content.map((p) => (p.type === 'text' ? p.text : '')).join('')
      result.push({ role: 'user', content })
    } else if (msg.role === 'assistant') {
      const text = msg.content
        .filter((c): c is TextContent => c.type === 'text')
        .map((c) => c.text)
        .join('')
      result.push({ role: 'assistant', content: text })
    } else if (msg.role === 'tool_result') {
      result.push({
        role: 'tool',
        content: msg.content.map((c) => (c.type === 'text' ? c.text : '')).join(''),
      })
    }
  }

  return result
}

// 构建请求体
function buildRequestBody(model: Model, context: StreamContext): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: model.id.split('/')[1],
    messages: convertMessages(context),
    stream: true,
    options: {
      num_predict: context.maxTokens ?? model.maxOutputTokens,
    },
  }

  if (context.temperature !== undefined) {
    ;(body.options as Record<string, unknown>).temperature = context.temperature
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

// Ollama Provider 适配器
export function createOllamaProvider(): ProviderAdapter {
  return {
    id: 'ollama',
    displayName: 'Ollama',

    async *stream(
      model: Model,
      context: StreamContext,
      _options: StreamOptions,
      signal: AbortSignal,
    ): AsyncIterable<StreamEvent> {
      const baseUrl = model.baseUrl || 'http://localhost:11434'
      const url = `${baseUrl}/api/chat`
      const body = buildRequestBody(model, context)

      log.debug({ model: model.id }, 'Ollama 流式请求')

      // Ollama 使用 NDJSON 而非 SSE
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Ollama 请求失败 (${response.status}): ${errorText}`)
      }

      if (!response.body) {
        throw new Error('Ollama 响应体为空')
      }

      let textContent = ''
      const toolCalls: ToolCall[] = []
      let inputTokens = 0
      let outputTokens = 0
      let started = false
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // 按换行分割 NDJSON
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const data = JSON.parse(line) as Record<string, unknown>

            if (!started) {
              started = true
              yield {
                type: 'start',
                partial: {
                  role: 'assistant',
                  content: [],
                  usage: {
                    inputTokens: 0,
                    outputTokens: 0,
                    cacheReadTokens: 0,
                    cacheWriteTokens: 0,
                  },
                  stopReason: 'end_turn',
                  model: model.id,
                },
              }
            }

            // 消息内容
            const msg = data.message as Record<string, unknown> | undefined
            if (msg?.content) {
              const text = msg.content as string
              textContent += text
              yield { type: 'text_delta', index: 0, delta: text }
            }

            // 工具调用
            if (msg?.tool_calls) {
              const tcs = msg.tool_calls as Array<Record<string, unknown>>
              for (const tc of tcs) {
                const fn = tc.function as Record<string, unknown>
                const toolCall: ToolCall = {
                  type: 'tool_call',
                  id: `call_${toolCalls.length}`,
                  name: fn.name as string,
                  arguments: (fn.arguments as Record<string, unknown>) ?? {},
                }
                toolCalls.push(toolCall)
                yield { type: 'tool_call_start', toolCall }
                yield { type: 'tool_call_end', id: toolCall.id, toolCall }
              }
            }

            // 完成标记
            if (data.done === true) {
              inputTokens = (data.prompt_eval_count as number) ?? 0
              outputTokens = (data.eval_count as number) ?? 0
            }
          } catch (error) {
            log.warn({ error }, '解析 Ollama NDJSON 行失败')
          }
        }
      }

      // 构建最终消息
      const content: (TextContent | ToolCall)[] = []
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

    async healthCheck(): Promise<boolean> {
      try {
        const response = await fetch('http://localhost:11434/api/tags', { method: 'GET' })
        return response.ok
      } catch {
        return false
      }
    },
  }
}
