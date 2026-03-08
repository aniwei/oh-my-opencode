// MCP 网络传输基类 — 复用 HTTP/SSE 共同逻辑
import { createLogger } from '@vitamin/shared'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'

import { normalizeCallToolResult, normalizeToolsResult } from './sdk-result-normalizer'

import type {
  McpToolCallParams,
  McpToolCallResult,
  McpToolDefinition,
  McpTransport,
} from '../types'

interface ClosableTransport {
  close(): Promise<void>
}

type ClienT = Parameters<Client['connect']>[0]

export abstract class BaseTransport<T extends ClienT & ClosableTransport> implements McpTransport {
  private client: Client | null = null
  private transport: T | null = null
  private connected = false

  constructor(
    protected readonly url: string,
    protected readonly headers: Record<string, string> = {},
  ) {}

  protected abstract readonly transportType: string

  protected abstract createTransport(requestInit: RequestInit): T

  protected createClient(): Client {
    return new Client({ name: `vitamin-mcp-${this.transportType}`, version: '0.1.0' })
  }

  async connect(): Promise<void> {
    const requestInit: RequestInit = {
      headers: this.headers,
    }

    this.transport = this.createTransport(requestInit)
    this.client = this.createClient()
    await this.client.connect(this.transport)

    this.connected = true
    createLogger(`mcp:transport:${this.transportType}`).info(
      `MCP ${this.transportType.toUpperCase()} 连接成功: ${this.url}`,
    )
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
