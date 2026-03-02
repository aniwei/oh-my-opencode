// SSE 传输层 — 通过 Server-Sent Events 与 MCP 服务器通信
import { createLogger } from '@vitamin/shared'

import type {
  McpContent,
  McpToolCallParams,
  McpToolCallResult,
  McpToolDefinition,
  McpTransport,
} from '../types'

const logger = createLogger('mcp:transport:sse')

// 待处理的 JSON-RPC 请求
interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

// SSE MCP 传输（流式事件监听 + HTTP POST 请求发送）
export class SseTransport implements McpTransport {
  private connected = false
  private sessionId: string | undefined
  private eventSource: EventSource | null = null
  private requestId = 0
  private readonly pending = new Map<number | string, PendingRequest>()
  private readonly requestTimeout: number

  constructor(
    private readonly url: string,
    private readonly headers: Record<string, string> = {},
    options?: { requestTimeout?: number },
  ) {
    this.requestTimeout = options?.requestTimeout ?? 30_000
  }

  async connect(): Promise<void> {
    // 先发送 initialize 请求
    const result = await this.postRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'vitamin-mcp-sse', version: '0.1.0' },
    }) as { sessionId?: string }

    this.sessionId = result.sessionId

    // 然后建立 SSE 连接监听服务器推送
    await this.connectSse()

    this.connected = true
    logger.info(`MCP SSE 连接成功: ${this.url}`)
  }

  private connectSse(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const sseUrl = new URL(this.url)
      sseUrl.pathname = sseUrl.pathname.replace(/\/?$/, '/sse')
      if (this.sessionId) {
        sseUrl.searchParams.set('sessionId', this.sessionId)
      }

      // 使用 EventSource Web API
      this.eventSource = new EventSource(sseUrl.toString())

      this.eventSource.onopen = () => {
        resolve()
      }

      this.eventSource.onmessage = (event) => {
        this.handleSseMessage(event.data as string)
      }

      this.eventSource.addEventListener('response', (event) => {
        this.handleSseMessage((event as MessageEvent).data as string)
      })

      this.eventSource.addEventListener('notification', (event) => {
        this.handleNotification((event as MessageEvent).data as string)
      })

      this.eventSource.onerror = (_event) => {
        if (!this.connected) {
          reject(new Error('SSE 连接失败'))
        } else {
          logger.warn('SSE 连接断开，将使用 HTTP 回退')
        }
      }

      // 超时处理
      setTimeout(() => {
        if (!this.connected && this.eventSource?.readyState !== EventSource.OPEN) {
          // SSE 未成功，回退到纯 HTTP 模式
          logger.info('SSE 连接超时，使用 HTTP POST 模式')
          resolve()
        }
      }, this.requestTimeout)
    })
  }

  private handleSseMessage(data: string): void {
    try {
      const json = JSON.parse(data) as { id?: number | string; result?: unknown; error?: { message: string } }
      if (json.id !== undefined) {
        const pending = this.pending.get(json.id)
        if (pending) {
          clearTimeout(pending.timer)
          this.pending.delete(json.id)

          if (json.error) {
            pending.reject(new Error(`MCP SSE 错误: ${json.error.message}`))
          } else {
            pending.resolve(json.result)
          }
        }
      }
    } catch {
      logger.debug('无法解析 SSE 消息: %s', data)
    }
  }

  private handleNotification(data: string): void {
    try {
      const notification = JSON.parse(data) as { method: string; params?: unknown }
      logger.debug('MCP SSE 通知: %s', notification.method)
    } catch {
      logger.debug('无法解析 SSE 通知: %s', data)
    }
  }

  async disconnect(): Promise<void> {
    this.eventSource?.close()
    this.eventSource = null
    this.connected = false
    this.sessionId = undefined

    // 清理待处理请求
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error('SSE 连接已断开'))
      this.pending.delete(id)
    }
  }

  async listTools(): Promise<McpToolDefinition[]> {
    const result = await this.postRequest('tools/list', {}) as {
      tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>
    }
    return (result.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }))
  }

  async callTool(params: McpToolCallParams): Promise<McpToolCallResult> {
    const result = await this.postRequest('tools/call', {
      name: params.name,
      arguments: params.arguments,
    }) as { content?: McpContent[]; isError?: boolean }

    return {
      content: result.content ?? [],
      isError: result.isError,
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  private async postRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = ++this.requestId
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params,
    })

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.headers,
    }

    if (this.sessionId) {
      requestHeaders['Mcp-Session-Id'] = this.sessionId
    }

    const response = await fetch(this.url, {
      method: 'POST',
      headers: requestHeaders,
      body,
    })

    if (!response.ok) {
      throw new Error(`MCP SSE 请求失败: ${String(response.status)} ${response.statusText}`)
    }

    const json = await response.json() as { result?: unknown; error?: { message: string } }

    if (json.error) {
      throw new Error(`MCP 错误: ${json.error.message}`)
    }

    return json.result
  }
}

// 工厂函数
export function createSseTransport(
  url: string,
  headers: Record<string, string> = {},
): SseTransport {
  return new SseTransport(url, headers)
}
