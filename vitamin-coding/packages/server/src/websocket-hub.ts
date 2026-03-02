import type { Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { createLogger } from '@vitamin/shared'

const logger = createLogger('server:websocket-hub')

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean
}

export class WebSocketHub {
  private wss: WebSocketServer
  private connections = new Set<ExtendedWebSocket>()
  private heartbeatInterval: NodeJS.Timeout

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server })

    this.wss.on('connection', (ws: ExtendedWebSocket) => {
      ws.isAlive = true
      this.connections.add(ws)

      ws.on('pong', () => {
        ws.isAlive = true
      })

      ws.on('close', () => {
        this.connections.delete(ws)
      })

      ws.on('error', (error) => {
        logger.error({ error }, 'WebSocket Error:')
        this.connections.delete(ws)
      })

      ws.on('message', (data) => {
        // Handle incoming WS messages (e.g. steer commands, debugging requests)
        try {
          const msg = JSON.parse(data.toString())
          logger.debug({ msg }, 'WS message received')
        } catch (e) {
          logger.error({ error: e }, 'Failed to parse WS message')
        }
      })
    })

    // 6.1.3: WebSocket 心跳 30s，断线自动清理
    this.heartbeatInterval = setInterval(() => {
      for (const ws of this.connections) {
        if (ws.isAlive === false) {
          this.connections.delete(ws)
          ws.terminate()
          continue
        }

        ws.isAlive = false
        ws.ping()
      }
    }, 30000)
  }

  public get activeConnections() {
    return this.connections.size
  }

  public broadcast(data: unknown): void {
    const payload = JSON.stringify(data)
    for (const client of this.connections) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload)
      }
    }
  }

  public close(): void {
    clearInterval(this.heartbeatInterval)
    for (const client of this.connections) {
      client.close()
    }
    this.connections.clear()
    this.wss.close()
  }
}
