// Extension 事件总线 — 支持扩展间通信
import { createLogger } from '@vitamin/shared'

import type { ExtensionEventHandler, ExtensionEventName, ExtensionEventPayloads } from './types'

const logger = createLogger('extension:event-bus')

// Extension 事件总线，管理事件订阅、触发、以及扩展间广播
export class ExtensionEventBus {
  // 类型化事件处理器 (ExtensionEventName → handler[])
  private readonly handlers = new Map<
    ExtensionEventName,
    Set<ExtensionEventHandler<ExtensionEventName>>
  >()

  // 自定义事件总线 (扩展间通信，任意字符串 key)
  private readonly busHandlers = new Map<string, Set<(data: unknown) => void>>()

  // 订阅类型化事件
  on<T extends ExtensionEventName>(
    event: T,
    handler: ExtensionEventHandler<T>,
  ): () => void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler as ExtensionEventHandler<ExtensionEventName>)
    return () => {
      set.delete(handler as ExtensionEventHandler<ExtensionEventName>)
    }
  }

  // 触发类型化事件，异常隔离
  async emit<T extends ExtensionEventName>(
    event: T,
    payload: ExtensionEventPayloads[T],
  ): Promise<void> {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of set) {
      try {
        await handler(payload)
      } catch (error) {
        logger.error(`Extension event handler failed for ${event}: ${String(error)}`)
      }
    }
  }

  // 订阅自定义总线事件（扩展间通信）
  onBus(event: string, handler: (data: unknown) => void): () => void {
    let set = this.busHandlers.get(event)
    if (!set) {
      set = new Set()
      this.busHandlers.set(event, set)
    }
    set.add(handler)
    return () => {
      set.delete(handler)
    }
  }

  // 触发自定义总线事件
  emitBus(event: string, data: unknown): void {
    const set = this.busHandlers.get(event)
    if (!set) return
    for (const handler of set) {
      try {
        handler(data)
      } catch (error) {
        logger.error(`Extension bus handler failed for ${event}: ${String(error)}`)
      }
    }
  }

  // 清除所有处理器
  clear(): void {
    this.handlers.clear()
    this.busHandlers.clear()
  }
}

// 工厂函数
export function createExtensionEventBus(): ExtensionEventBus {
  return new ExtensionEventBus()
}
