import { createServer } from 'node:net'

import { createLogger } from '@vitamin/shared'

import type { Server, Socket } from 'node:net'
import type {
  RpcAgent,
  RpcRequest,
  RpcResponse,
  RpcServerHandle,
  RpcServerOptions,
} from './rpc-types'

const logger = createLogger('coding-agent:rpc-server')

type RpcMethodHandler = (params: unknown) => Promise<unknown>

export function createRpcServer(agent: RpcAgent, options: RpcServerOptions = {}): RpcServerHandle {
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

          socket.on('error', (error) => {
            logger.error('RPC socket error: %s', error.message)
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
      for (const client of clients) {
        client.destroy()
      }
      clients.clear()

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

function buildMethodHandlers(agent: RpcAgent): Map<string, RpcMethodHandler> {
  const handlers = new Map<string, RpcMethodHandler>()

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

async function handleRpcMessage(
  raw: string,
  handlers: Map<string, RpcMethodHandler>,
  socket: Socket,
): Promise<void> {
  let request: RpcRequest
  try {
    request = JSON.parse(raw) as RpcRequest
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

function sendResponse(socket: Socket, response: RpcResponse): void {
  if (socket.writable) {
    socket.write(JSON.stringify(response) + '\n')
  }
}
