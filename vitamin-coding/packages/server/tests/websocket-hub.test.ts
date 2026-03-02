import { type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { WebSocketHub } from '../src/websocket-hub'

describe('WebSocketHub', () => {
  let server: Server
  let hub: WebSocketHub
  let port: number

  beforeEach(async () => {
    server = createServer()
    hub = new WebSocketHub(server)
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo
        port = address.port
        resolve()
      })
    })
  })

  afterEach(async () => {
    hub.close()
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  })

  it('should accept connections and track them', async () => {
    expect(hub.activeConnections).toBe(0)

    const ws1 = new WebSocket(`ws://127.0.0.1:${port}`)
    await new Promise((resolve) => ws1.on('open', resolve))

    expect(hub.activeConnections).toBe(1)

    ws1.close()
    await new Promise((resolve) => ws1.on('close', resolve))

    // Give it a tiny bit of time to process the close event on server side
    await new Promise((r) => setTimeout(r, 10))

    expect(hub.activeConnections).toBe(0)
  })
})
