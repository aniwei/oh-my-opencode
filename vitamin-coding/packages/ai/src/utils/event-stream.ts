// EventStream — 异步可迭代流式结果
// 同时支持 for-await-of 和 .result() 双模式

// 流完成后的回调类型
type ResolveCallback<R> = (value: R) => void
type RejectCallback = (error: Error) => void

// EventStream: 流式事件迭代器 + 最终结果 Promise
export class EventStream<E, R> implements AsyncIterable<E> {
  private readonly events: E[] = []
  private readonly waiters: Array<{
    resolve: (value: IteratorResult<E>) => void
    reject: RejectCallback
  }> = []
  private done = false
  private cachedResult: R | undefined
  private error: Error | undefined
  private resultResolve: ResolveCallback<R> | undefined
  private resultReject: RejectCallback | undefined
  private readonly resultPromise: Promise<R>
  private abortController: AbortController | undefined

  constructor() {
    this.resultPromise = new Promise<R>((resolve, reject) => {
      this.resultResolve = resolve
      this.resultReject = reject
    })
  }

  // 推送一个事件到流
  push(event: E): void {
    if (this.done) return
    if (this.waiters.length > 0) {
      const waiter = this.waiters.shift()!
      waiter.resolve({ value: event, done: false })
    } else {
      this.events.push(event)
    }
  }

  // 标记流完成，传入最终结果
  complete(result: R): void {
    if (this.done) return
    this.done = true
    this.cachedResult = result
    this.resultResolve?.(result)
    // 唤醒所有等待中的消费者
    for (const waiter of this.waiters) {
      waiter.resolve({ value: undefined as never, done: true })
    }
    this.waiters.length = 0
  }

  // 标记流失败
  fail(error: Error): void {
    if (this.done) return
    this.done = true
    this.error = error
    this.resultReject?.(error)
    for (const waiter of this.waiters) {
      waiter.reject(error)
    }
    this.waiters.length = 0
  }

  // 取消流
  abort(): void {
    this.abortController?.abort()
    this.fail(new Error('EventStream aborted'))
  }

  // 设置外部 AbortController（用于关联 signal）
  setAbortController(controller: AbortController): void {
    this.abortController = controller
  }

  // 等待完整结果
  result(): Promise<R> {
    return this.resultPromise
  }

  // 是否已结束
  get isComplete(): boolean {
    return this.done
  }

  // 同步获取缓存结果（仅在 isComplete 后可用）
  get lastResult(): R | undefined {
    return this.cachedResult
  }

  // AsyncIterable 实现
  [Symbol.asyncIterator](): AsyncIterator<E> {
    let index = 0
    return {
      next: () => {
        // 有缓冲事件，立即返回
        if (index < this.events.length) {
          return Promise.resolve({ value: this.events[index++]!, done: false })
        }
        // 流已结束
        if (this.done) {
          if (this.error) {
            return Promise.reject(this.error)
          }
          return Promise.resolve({ value: undefined as never, done: true })
        }
        // 等待下一个事件
        return new Promise<IteratorResult<E>>((resolve, reject) => {
          this.waiters.push({ resolve, reject })
        })
      },
    }
  }
}

// 创建 EventStream 的工厂函数
export function createEventStream<E, R>(): EventStream<E, R> {
  return new EventStream<E, R>()
}
