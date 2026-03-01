// MCP 客户端 — 统一 tool/list 和 tool/call 接口
import { createLogger, McpError } from '@vitamin/shared'

import type {
  McpServerConfig,
  McpToolCallParams,
  McpToolCallResult,
  McpToolDefinition,
  McpTransport,
} from './types'

const logger = createLogger('mcp:client')

// 根据配置创建传输
async function createTransportForConfig(config: McpServerConfig): Promise<McpTransport> {
  if (config.transport === 'stdio') {
    if (!config.command) {
      throw new McpError(`MCP ${config.name}: stdio 传输需要 command 参数`, { code: 'MCP_MISSING_COMMAND' })
    }
    const { createStdioTransport } = await import('./transports/stdio')
    return createStdioTransport(config.command, config.args, config.env)
  }

  if (config.transport === 'http') {
    if (!config.url) {
      throw new McpError(`MCP ${config.name}: http 传输需要 url 参数`, { code: 'MCP_MISSING_URL' })
    }
    const { createHttpTransport } = await import('./transports/http')
    return createHttpTransport(config.url, config.headers)
  }

  throw new McpError(`MCP ${config.name}: 不支持的传输类型 ${config.transport}`, { code: 'MCP_UNSUPPORTED_TRANSPORT' })
}

// MCP 客户端
export class McpClient {
  private transport: McpTransport | null = null

  constructor(
    private readonly config: McpServerConfig,
  ) {}

  // 连接到 MCP 服务器
  async connect(): Promise<void> {
    this.transport = await createTransportForConfig(this.config)
    await this.transport.connect()
    logger.info(`MCP 客户端连接成功: ${this.config.name}`)
  }

  // 断开连接
  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.disconnect()
      this.transport = null
    }
  }

  // 获取可用工具列表
  async listTools(): Promise<McpToolDefinition[]> {
    if (!this.transport) {
      throw new McpError(`MCP ${this.config.name}: 未连接`, { code: 'MCP_NOT_CONNECTED' })
    }
    return this.transport.listTools()
  }

  // 调用工具
  async callTool(params: McpToolCallParams): Promise<McpToolCallResult> {
    if (!this.transport) {
      throw new McpError(`MCP ${this.config.name}: 未连接`, { code: 'MCP_NOT_CONNECTED' })
    }
    return this.transport.callTool(params)
  }

  // 检查连接状态
  isConnected(): boolean {
    return this.transport?.isConnected() ?? false
  }

  // 获取配置
  getConfig(): McpServerConfig {
    return this.config
  }

  // 获取名称
  getName(): string {
    return this.config.name
  }
}

// 工厂函数
export function createMcpClient(config: McpServerConfig): McpClient {
  return new McpClient(config)
}
