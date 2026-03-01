// HTTP/SSE 传输层 — 通过 HTTP 请求与 MCP 服务器通信
import { createLogger } from '@vitamin/shared'

import type {
  McpContent,
  McpToolCallParams,
  McpToolCallResult,
  McpToolDefinition,
  McpTransport,
} from '../types'

const logger = createLogger('mcp:transport:http')

// HTTP MCP 传输
export class HttpTransport implements McpTransport {
  private connected = false
  private sessionId: string | undefined

  constructor(
    private readonly url: string,
    private readonly headers: Record<string, string> = {},
  ) {}

  async connect(): Promise<void> {
    // 发送 initialize 请求
    const result = await this.postRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'vitamin-mcp', version: '0.1.0' },
    }) as { sessionId?: string }

    this.sessionId = result.sessionId
    this.connected = true
    logger.info(`MCP HTTP 连接成功: ${this.url}`)
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.sessionId = undefined
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
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
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
      throw new Error(`MCP HTTP 请求失败: ${String(response.status)} ${response.statusText}`)
    }

    const json = await response.json() as { result?: unknown; error?: { message: string } }

    if (json.error) {
      throw new Error(`MCP 错误: ${json.error.message}`)
    }

    return json.result
  }
}

// 工厂函数
export function createHttpTransport(
  url: string,
  headers: Record<string, string> = {},
): HttpTransport {
  return new HttpTransport(url, headers)
}
