// stdio 传输层 — 启动子进程通过 stdin/stdout 通信
import { createLogger } from '@vitamin/shared'

import type {
  McpContent,
  McpToolCallParams,
  McpToolCallResult,
  McpToolDefinition,
  McpTransport,
} from '../types'

const logger = createLogger('mcp:transport:stdio')

// JSON-RPC 消息结构
interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: { code: number; message: string }
}

// stdio MCP 传输
export class StdioTransport implements McpTransport {
  private process: ReturnType<typeof import('node:child_process').spawn> | null = null
  private requestId = 0
  private readonly pendingRequests = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer?: ReturnType<typeof setTimeout> }
  >()
  private buffer = ''
  private connected = false
  // 请求超时（毫秒），默认 30 秒
  private readonly requestTimeoutMs: number

  constructor(
    private readonly command: string,
    private readonly args: string[] = [],
    private readonly env: Record<string, string> = {},
    requestTimeoutMs?: number,
  ) {
    this.requestTimeoutMs = requestTimeoutMs ?? 30_000
  }

  async connect(): Promise<void> {
    const { spawn } = await import('node:child_process')

    this.process = spawn(this.command, this.args, {
      env: { ...process.env, ...this.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    if (!this.process.stdout || !this.process.stdin) {
      throw new Error('子进程 stdio 不可用')
    }

    this.process.stdout.on('data', (data: Buffer) => {
      this.buffer += data.toString()
      this.processBuffer()
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      logger.warn(`MCP stderr: ${data.toString().trim()}`)
    })

    this.process.on('error', (error: Error) => {
      logger.error(`MCP 进程错误: ${error.message}`)
      this.connected = false
    })

    this.process.on('close', (code: number | null) => {
      logger.info(`MCP 进程退出: code=${String(code)}`)
      this.connected = false
      // 拒绝所有待处理请求并清理定时器
      for (const [, pending] of this.pendingRequests) {
        if (pending.timer) clearTimeout(pending.timer)
        pending.reject(new Error('MCP 进程已退出'))
      }
      this.pendingRequests.clear()
    })

    // 初始化协议
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'vitamin-mcp', version: '0.1.0' },
    })

    this.connected = true
    logger.info(`MCP stdio 连接成功: ${this.command}`)
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    this.connected = false
    this.pendingRequests.clear()
  }

  async listTools(): Promise<McpToolDefinition[]> {
    const result = await this.sendRequest('tools/list', {}) as {
      tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>
    }
    return (result.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }))
  }

  async callTool(params: McpToolCallParams): Promise<McpToolCallResult> {
    const result = await this.sendRequest('tools/call', {
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

  private async sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.process?.stdin) {
      throw new Error('MCP 进程未启动')
    }

    const id = ++this.requestId
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    }

    return new Promise<unknown>((resolve, reject) => {
      // 设置请求超时
      const timer = setTimeout(() => {
        const pending = this.pendingRequests.get(id)
        if (pending) {
          this.pendingRequests.delete(id)
          pending.reject(new Error(`MCP 请求超时 (${this.requestTimeoutMs}ms): ${method}`))
        }
      }, this.requestTimeoutMs)

      this.pendingRequests.set(id, { resolve, reject, timer })
      const json = JSON.stringify(request)
      this.process?.stdin?.write(`${json}\n`)
    })
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n')
    // 保留最后一行（可能不完整）
    this.buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const response = JSON.parse(trimmed) as JsonRpcResponse
        if (response.id !== undefined) {
          const pending = this.pendingRequests.get(response.id)
          if (pending) {
            if (pending.timer) clearTimeout(pending.timer)
            this.pendingRequests.delete(response.id)
            if (response.error) {
              pending.reject(new Error(response.error.message))
            } else {
              pending.resolve(response.result)
            }
          }
        }
      } catch {
        logger.warn(`无法解析 MCP 响应: ${trimmed.slice(0, 100)}`)
      }
    }
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
