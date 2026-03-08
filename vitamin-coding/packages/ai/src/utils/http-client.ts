// HTTP 客户端封装 — 代理支持 + 超时 + 重试
import { ProviderError } from '@vitamin/shared'
import { createParser } from 'eventsource-parser'

// HTTP 请求选项
export interface HttpRequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: string | Record<string, unknown>
  timeout?: number
  signal?: AbortSignal
  proxy?: string
}

// HTTP 响应
export interface HttpResponse {
  status: number
  headers: Headers
  body: string
  ok: boolean
}

// SSE 事件
export interface SseEvent {
  event?: string
  data: string
  id?: string
}

// 执行 HTTP 请求
export async function httpRequest(options: HttpRequestOptions): Promise<HttpResponse> {
  const { url, method = 'POST', headers = {}, body, timeout = 60000, signal } = options

  const controller = new AbortController()
  const combinedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal

  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      signal: combinedSignal,
    }

    if (body) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
    }

    const response = await fetch(url, fetchOptions)

    const responseBody = await response.text()
    return {
      status: response.status,
      headers: response.headers,
      body: responseBody,
      ok: response.ok,
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ProviderError('HTTP request aborted or timed out', {
        code: 'PROVIDER_TIMEOUT',
        cause: error,
      })
    }
    throw new ProviderError('HTTP request failed', {
      code: 'PROVIDER_NETWORK_ERROR',
      cause: error instanceof Error ? error : new Error(String(error)),
    })
  } finally {
    clearTimeout(timer)
  }
}

// 执行流式 HTTP 请求，返回 SSE 事件异步迭代器
export async function* httpStreamRequest(options: HttpRequestOptions): AsyncIterable<SseEvent> {
  const { url, method = 'POST', headers = {}, body, timeout = 300000, signal } = options

  const controller = new AbortController()
  const combinedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal

  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        ...headers,
      },
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      signal: combinedSignal,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new ProviderError(`Provider returned ${response.status}: ${errorBody}`, {
        code:
          response.status === 429
            ? 'PROVIDER_RATE_LIMIT'
            : response.status === 529
              ? 'PROVIDER_OVERLOADED'
              : response.status >= 500
                ? 'PROVIDER_SERVER_ERROR'
                : 'PROVIDER_REQUEST_ERROR',
      })
    }

    if (!response.body) {
      throw new ProviderError('Response body is empty', {
        code: 'PROVIDER_EMPTY_RESPONSE',
      })
    }

    // 使用成熟 SSE 解析器处理 chunk 边界与多行 data
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const queue: SseEvent[] = []
    const parser = createParser({
      onEvent(message) {
        queue.push({
          event: message.event || undefined,
          data: message.data,
          id: message.id || undefined,
        })
      },
    })

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      parser.feed(decoder.decode(value, { stream: true }))

      while (queue.length > 0) {
        const event = queue.shift()
        if (event) yield event
      }
    }

    // flush 解码器缓冲
    parser.feed(decoder.decode())
    while (queue.length > 0) {
      const event = queue.shift()
      if (event) yield event
    }
  } catch (error) {
    if (error instanceof ProviderError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ProviderError('Stream aborted or timed out', {
        code: 'PROVIDER_TIMEOUT',
        cause: error,
      })
    }
    throw new ProviderError('Stream request failed', {
      code: 'PROVIDER_NETWORK_ERROR',
      cause: error instanceof Error ? error : new Error(String(error)),
    })
  } finally {
    clearTimeout(timer)
  }
}
