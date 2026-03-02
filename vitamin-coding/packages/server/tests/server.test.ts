import { afterAll, describe, expect, it } from 'vitest'
import { InspectorServer } from '../src/http-server'
import { LogBroadcastHub } from '../src/log-broadcast-hub'

describe('InspectorServer', () => {
  let server: InspectorServer

  afterAll(async () => {
    if (server) {
      await server.close()
    }
  })

  it('should start and stop correctly', async () => {
    const hub = new LogBroadcastHub()
    server = new InspectorServer({ port: 9239, logHub: hub })
    await server.start()

    const response = await fetch('http://127.0.0.1:9239/api/health')
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.status).toBe('ok')
  })

  it('should stream logs via SSE', async () => {
    const hub = new LogBroadcastHub()
    const testServer = new InspectorServer({ port: 9240, logHub: hub })
    await testServer.start()

    // The fetch request to an SSE endpoint will wait forever for the server to close the stream.
    // Instead we will abort the fetch after checking the headers.
    const controller = new AbortController()

    try {
      const response = await fetch('http://127.0.0.1:9240/api/logs/stream', {
        signal: controller.signal,
      })
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/event-stream')
      controller.abort() // Close the stream
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') throw e
    }

    // Cleanup
    await testServer.close()
  })
})
