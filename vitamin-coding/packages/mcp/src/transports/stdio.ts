// stdio 传输层 — 启动子进程通过 stdin/stdout 通信
import { createLogger } from '@vitamin/shared'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { normalizeCallToolResult, normalizeToolsResult } from './sdk-result-normalizer'

import type {
  McpToolCallParams,
  McpToolCallResult,
  McpToolDefinition,
  McpTransport,
} from '../types'

const logger = createLogger('mcp:transport:stdio')

// stdio MCP 传输
export class StdioTransport implements McpTransport {
  private client: Client | null = null
  private transport: StdioClientTransport | null = null
  private connected = false

  constructor(
    private readonly command: string,
    private readonly args: string[] = [],
    private readonly env: Record<string, string> = {},
  ) {}

  async connect(): Promise<void> {
    this.transport = new StdioClientTransport({
      command: this.command,
      args: this.args,
      env: { ...process.env, ...this.env } as Record<string, string>,
    })

    this.client = new Client({ name: 'vitamin-mcp', version: '0.1.0' })
    await this.client.connect(this.transport)

    this.connected = true
    logger.info(`MCP stdio 连接成功: ${this.command}`)
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
    }
    this.transport = null
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
export function createStdioTransport(
  command: string,
  args: string[] = [],
  env: Record<string, string> = {},
): StdioTransport {
  return new StdioTransport(command, args, env)
}
