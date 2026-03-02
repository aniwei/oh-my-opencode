import { describe, expect, it } from 'vitest'
import { LogBroadcastHub } from '../src/log-broadcast-hub'

describe('LogBroadcastHub', () => {
  it('should be zero-overhead when no subscribers', () => {
    const hub = new LogBroadcastHub()
    expect(hub.activeSubscribers).toBe(0)

    // Should return immediately without doing any work
    hub.publish({
      level: 'info',
      source: 'system',
      timestamp: new Date().toISOString(),
      payload: 'test',
    })

    expect(hub.activeSubscribers).toBe(0)
  })
})
