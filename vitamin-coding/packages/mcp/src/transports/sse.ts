// SSE 传输层 — 通过 Server-Sent Events 与 MCP 服务器通信
import { createLogger } from '@vitamin/shared'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { normalizeCallToolResult, normalizeToolsResult } from './sdk-result-normalizer'

import type {
  McpToolCallParams,
  McpToolCallResult,
  McpToolDefinition,
  McpTransport,
} from '../types'

const logger = createLogger('mcp:transport:sse')

// SSE MCP 传输（流式事件监听 + HTTP POST 请求发送）
export class SseTransport implements McpTransport {
  private client: Client | null = null
  private transport: SSEClientTransport | null = null
  private connected = false

  constructor(
    private readonly url: string,
    private readonly headers: Record<string, string> = {},
  ) {}

  async connect(): Promise<void> {
    const requestInit: RequestInit = {
      headers: this.headers,
    }
    this.transport = new SSEClientTransport(new URL(this.url), {
      requestInit,
    })

    this.client = new Client({ name: 'vitamin-mcp-sse', version: '0.1.0' })
    await this.client.connect(this.transport)

    this.connected = true
    logger.info(`MCP SSE 连接成功: ${this.url}`)
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close()
      this.transport = null
    }
    if (this.client) {
      await this.client.close()
      this.client = null
    }
    this.connected = false
  }

  async listTools(): Promise<McpToolDefinition[]> {
    if (!this.client) throw new Error('MCP 客户端未连接')
    const result = await this.client.listTools()
    return normalizeToolsResult(result)
  }

  async callTool(params: McpToolCallParams): Promise<McpToolCallResult> {
    if (!this.client) throw new Error('MCP 客户端未连接')
    const result = await this.client.callTool({
      name: params.name,
      arguments: params.arguments as Record<string, unknown>,
    })
    return normalizeCallToolResult(result)
  }

  isConnected(): boolean {
    return this.connected
  }
}

// 工厂函数
export function createSseTransport(
  url: string,
  headers: Record<string, string> = {},
): SseTransport {
  return new SseTransport(url, headers)
}
