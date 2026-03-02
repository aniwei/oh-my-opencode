import { EventEmitter } from 'node:events'
import { RingBuffer } from './ring-buffer'

export interface LogEvent {
  id?: number
  level: 'debug' | 'info' | 'warn' | 'error'
  source: 'agent' | 'system' | 'tool' | 'api'
  timestamp: string
  payload: unknown
  sessionId?: string
  userId?: string
  agentId?: string
}

export interface LogFilter {
  sessionId?: string
  userId?: string
  minLevel?: 'debug' | 'info' | 'warn' | 'error'
  sources?: LogEvent['source'][]
}

export interface LogSubscription {
  [Symbol.asyncIterator](): AsyncIterator<LogEvent, void, unknown>
  close(): void
}

const LEVEL_WEIGHT = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

export function matchesFilter(event: LogEvent, filter: LogFilter): boolean {
  if (filter.sessionId && event.sessionId !== filter.sessionId) return false
  if (filter.userId && event.userId !== filter.userId) return false
  if (filter.minLevel && LEVEL_WEIGHT[event.level] < LEVEL_WEIGHT[filter.minLevel]) return false
  if (filter.sources && !filter.sources.includes(event.source)) return false
  return true
}

export class LogBroadcastHub {
  private emitter = new EventEmitter()
  private subscriberCount = 0
  private logsBuffer: RingBuffer<LogEvent>
  private nextEventId = 1
  private alwaysBuffer: boolean

  constructor(maxListeners = 1000, bufferSize = 10000, alwaysBuffer = false) {
    this.emitter.setMaxListeners(maxListeners)
    this.logsBuffer = new RingBuffer<LogEvent>(bufferSize)
    this.alwaysBuffer = alwaysBuffer
  }

  public get activeSubscribers() {
    return this.subscriberCount
  }

  public getRecentLogs(filter?: LogFilter, sinceId?: number): LogEvent[] {
    let logs = this.logsBuffer.toArray()
    if (sinceId !== undefined) {
      logs = logs.filter((l) => l.id !== undefined && l.id > sinceId)
    }
    if (filter) {
      logs = logs.filter((l) => matchesFilter(l, filter))
    }
    return logs
  }

  public publish(event: LogEvent): void {
    if (this.subscriberCount === 0 && !this.alwaysBuffer) {
      // 零生产开销：如果没有订阅者，且未强制缓存，直接返回不做任何处理
      return
    }

    event.id = this.nextEventId++
    this.logsBuffer.push(event)

    // Global channel
    this.emitter.emit('log:*', event)

    // Session specific channel
    if (event.sessionId) {
      this.emitter.emit(`log:session:${event.sessionId}`, event)
    }

    // User specific channel
    if (event.userId) {
      this.emitter.emit(`log:user:${event.userId}`, event)
    }
  }

  public subscribe(filter: LogFilter): LogSubscription {
    const channel = filter.sessionId
      ? `log:session:${filter.sessionId}`
      : filter.userId
        ? `log:user:${filter.userId}`
        : 'log:*'

    this.subscriberCount++
    let subscriberActive = true

    const emitter = this.emitter
    const decrementSubscribers = () => {
      if (!subscriberActive) return
      subscriberActive = false
      this.subscriberCount--
    }

    const listeners: ((event: LogEvent) => void)[] = []

    return {
      async *[Symbol.asyncIterator]() {
        const queue: LogEvent[] = []
        let resolve: (() => void) | null = null

        const handler = (event: LogEvent) => {
          if (matchesFilter(event, filter)) {
            queue.push(event)
            resolve?.()
          }
        }

        emitter.on(channel, handler)
        listeners.push(handler)

        try {
          while (subscriberActive) {
            if (queue.length > 0) {
              const event = queue.shift()
              if (event) yield event
            } else {
              await new Promise<void>((r) => {
                resolve = r
              })
            }
          }
        } finally {
          emitter.off(channel, handler)
          decrementSubscribers()
          const index = listeners.indexOf(handler)
          if (index > -1) {
            listeners.splice(index, 1)
          }
        }
      },
      close() {
        if (!subscriberActive) return
        decrementSubscribers()
        for (const handler of listeners) {
          emitter.off(channel, handler)
        }
      },
    }
  }
}
