import { describe, expect, it } from 'vitest'
import { LogBroadcastHub } from '../src/log-broadcast-hub'

describe('LogBroadcastHub Benchmark', () => {
  it('should handle > 10K events/s', async () => {
    const hub = new LogBroadcastHub()
    let receivedCount = 0

    const sub = hub.subscribe({ sessionId: 'perf-test' })

    // Start consuming
    const consume = async () => {
      for await (const _event of sub) {
        receivedCount++
        if (receivedCount >= 10000) {
          sub.close()
          break
        }
      }
    }

    const consumerPromise = consume()

    // Start publishing
    const start = performance.now()
    for (let i = 0; i < 10000; i++) {
      hub.publish({
        level: 'info',
        source: 'system',
        timestamp: new Date().toISOString(),
        payload: `event ${i}`,
        sessionId: 'perf-test',
      })
    }

    await consumerPromise
    const end = performance.now()

    const durationMs = end - start
    const throughput = (10000 / durationMs) * 1000

    console.log(`Throughput: ${Math.round(throughput)} events/s`)

    // Check if we hit > 10K/s
    expect(throughput).toBeGreaterThan(10000)
  })
})
