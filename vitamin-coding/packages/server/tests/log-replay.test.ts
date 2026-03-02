import { describe, expect, it } from 'vitest'
import { LogBroadcastHub } from '../src/log-broadcast-hub'

describe('Log Replay', () => {
  it('should return incremented logs based on since id', () => {
    const hub = new LogBroadcastHub(100, 1000, true)
    for (let i = 0; i < 100; i++) {
      hub.publish({
        level: 'info',
        source: 'system',
        timestamp: Date.now().toString(),
        payload: `msg-${i}`,
      })
    }

    const logs = hub.getRecentLogs({}, 50)
    expect(logs.length).toBe(50)
    expect(logs[0].payload).toBe('msg-50')
    expect(logs[49].payload).toBe('msg-99')
  })
})
