// AgentStream — 异步迭代流（for await...of + result()）
import type { AgentSessionResult } from '@vitamin/coding-agent'
import type { StreamEvent } from './types'

// 创建 AgentStream
export function createAgentStream(
  executor: (push: (event: StreamEvent) => void, done: () => void, signal: AbortSignal) => Promise<AgentSessionResult>,
): AgentStream {
  return new AgentStream(executor)
}

export class AgentStream {
  private events: StreamEvent[] = []
  private pendingResolvers: Array<(value: IteratorResult<StreamEvent>) => void> = []
  private finished = false
  private resultPromise: Promise<AgentSessionResult>
  private resultResolve!: (result: AgentSessionResult) => void
  private resultReject!: (error: Error) => void
  private abortController = new AbortController()

  constructor(
    executor: (push: (event: StreamEvent) => void, done: () => void, signal: AbortSignal) => Promise<AgentSessionResult>,
  ) {
    this.resultPromise = new Promise<AgentSessionResult>((resolve, reject) => {
      this.resultResolve = resolve
      this.resultReject = reject
    })

    // 防止在 result() 被调用前产生 unhandled rejection
    this.resultPromise.catch(() => {})

    // 启动异步执行器
    this.run(executor)
  }

  private async run(
    executor: (push: (event: StreamEvent) => void, done: () => void, signal: AbortSignal) => Promise<AgentSessionResult>,
  ): Promise<void> {
    try {
      const result = await executor(
        // push
        (event) => {
          if (this.finished) return
          const resolver = this.pendingResolvers.shift()
          if (resolver) {
            resolver({ value: event, done: false })
          } else {
            this.events.push(event)
          }
        },
        // done
        () => {
          this.finish()
        },
        // signal — 传递给 executor 以支持下游取消
        this.abortController.signal,
      )
      this.resultResolve(result)
      this.finish()
    } catch (error) {
      const errorEvent: StreamEvent = {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      }
      const resolver = this.pendingResolvers.shift()
      if (resolver) {
        resolver({ value: errorEvent, done: false })
      } else {
        this.events.push(errorEvent)
      }
      this.resultReject(error instanceof Error ? error : new Error(String(error)))
      this.finish()
    }
  }

  private finish(): void {
    if (this.finished) return
    this.finished = true

    // 通知所有等待的消费者
    for (const resolver of this.pendingResolvers) {
      resolver({ value: undefined, done: true } as IteratorResult<StreamEvent>)
    }
    this.pendingResolvers = []
  }

  // AsyncIterable 接口
  [Symbol.asyncIterator](): AsyncIterator<StreamEvent> {
    return {
      next: async (): Promise<IteratorResult<StreamEvent>> => {
        // 先取缓冲区
        const buffered = this.events.shift()
        if (buffered) {
          return { value: buffered, done: false }
        }

        // 已结束
        if (this.finished) {
          return { value: undefined, done: true } as IteratorResult<StreamEvent>
        }

        // 等待新事件
        return new Promise<IteratorResult<StreamEvent>>((resolve) => {
          this.pendingResolvers.push(resolve)
        })
      },
    }
  }

  // 获取最终结果
  result(): Promise<AgentSessionResult> {
    return this.resultPromise
  }

  // 中止流
  abort(): void {
    this.abortController.abort()
    this.finish()
  }

  get signal(): AbortSignal {
    return this.abortController.signal
  }
}
