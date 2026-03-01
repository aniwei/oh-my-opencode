// RPC 服务器 — JSON-RPC 2.0 over Unix socket / TCP
import { createServer } from 'node:net'

import { createLogger } from '@vitamin/shared'

import type { Server, Socket } from 'node:net'
import type { VitaminAgent, RPCRequest, RPCResponse, RPCServerOptions } from './types'

const logger = createLogger('sdk:rpc-server')

// RPC 方法映射
type RPCMethodHandler = (params: unknown) => Promise<unknown>

// 创建 RPC 服务器
export function createRpcServer(agent: VitaminAgent, options: RPCServerOptions = {}): RPCServerHandle {
  const socketPath = options.socketPath ?? `/tmp/vitamin-agent-${process.pid}.sock`
  const handlers = buildMethodHandlers(agent)
  const clients = new Set<Socket>()

  let server: Server | null = null

  return {
    socketPath,

    async start(): Promise<void> {
      return new Promise((resolve, reject) => {
        server = createServer((socket) => {
          clients.add(socket)
          logger.info('RPC client connected')

          let buffer = ''

          socket.on('data', (data) => {
            buffer += data.toString()

            // 按行分割（每行一个 JSON-RPC 请求）
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed.length === 0) continue

              handleRpcMessage(trimmed, handlers, socket)
            }
          })

          socket.on('close', () => {
            clients.delete(socket)
            logger.info('RPC client disconnected')
          })

          socket.on('error', (err) => {
            logger.error('RPC socket error: %s', err.message)
            clients.delete(socket)
          })
        })

        server.on('error', reject)
        server.listen(socketPath, () => {
          logger.info('RPC server listening on %s', socketPath)
          resolve()
        })
      })
    },

    async stop(): Promise<void> {
      // 关闭所有客户端
      for (const client of clients) {
        client.destroy()
      }
      clients.clear()

      // 关闭服务器
      if (server) {
        return new Promise((resolve) => {
          server!.close(() => {
            logger.info('RPC server stopped')
            resolve()
          })
        })
      }
    },
  }
}

export interface RPCServerHandle {
  socketPath: string
  start(): Promise<void>
  stop(): Promise<void>
}

// 构建 RPC 方法处理器
function buildMethodHandlers(agent: VitaminAgent): Map<string, RPCMethodHandler> {
  const handlers = new Map<string, RPCMethodHandler>()

  handlers.set('prompt', async (params) => {
    const { text } = params as { text: string }
    const stream = agent.prompt(text)
    const result = await stream.result()
    return {
      response: result.response,
      cost: result.cost,
      tokens: result.tokens,
      duration: result.duration,
    }
  })

  handlers.set('abort', async () => {
    agent.abort()
    return { ok: true }
  })

  handlers.set('steer', async (params) => {
    const { message } = params as { message: string }
    agent.steer(message)
    return { ok: true }
  })

  handlers.set('getState', async () => {
    return agent.getState()
  })

  handlers.set('dispose', async () => {
    await agent.dispose()
    return { ok: true }
  })

  return handlers
}

// 处理单个 RPC 消息
async function handleRpcMessage(
  raw: string,
  handlers: Map<string, RPCMethodHandler>,
  socket: Socket,
): Promise<void> {
  let request: RPCRequest
  try {
    request = JSON.parse(raw) as RPCRequest
  } catch {
    sendResponse(socket, {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    })
    return
  }

  if (request.jsonrpc !== '2.0' || !request.method) {
    sendResponse(socket, {
      jsonrpc: '2.0',
      id: request.id ?? null,
      error: { code: -32600, message: 'Invalid Request' },
    })
    return
  }

  const handler = handlers.get(request.method)
  if (!handler) {
    sendResponse(socket, {
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32601, message: `Method not found: ${request.method}` },
    })
    return
  }

  try {
    const result = await handler(request.params)
    sendResponse(socket, {
      jsonrpc: '2.0',
      id: request.id,
      result,
    })
  } catch (error) {
    sendResponse(socket, {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32000,
        message: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

// 发送 RPC 响应
function sendResponse(socket: Socket, response: RPCResponse): void {
  if (socket.writable) {
    socket.write(JSON.stringify(response) + '\n')
  }
}
