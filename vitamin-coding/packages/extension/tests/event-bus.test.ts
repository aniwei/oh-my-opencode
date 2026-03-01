// Extension 事件总线测试
import { describe, expect, it } from 'vitest'

import { createExtensionEventBus } from '../src/event-bus'

describe('ExtensionEventBus', () => {
  describe('#given 创建了事件总线', () => {
    describe('#when 订阅类型化事件', () => {
      it('#then 触发时应调用处理器', async () => {
        const bus = createExtensionEventBus()
        let received: { sessionId: string } | undefined

        bus.on('session.start', (event) => {
          received = event
        })

        await bus.emit('session.start', { sessionId: 'test-1' })
        expect(received).toEqual({ sessionId: 'test-1' })
      })

      it('#then 取消订阅后不再调用', async () => {
        const bus = createExtensionEventBus()
        let callCount = 0

        const unsubscribe = bus.on('session.start', () => {
          callCount++
        })

        await bus.emit('session.start', { sessionId: 'a' })
        expect(callCount).toBe(1)

        unsubscribe()
        await bus.emit('session.start', { sessionId: 'b' })
        expect(callCount).toBe(1)
      })

      it('#then 多个处理器依次触发', async () => {
        const bus = createExtensionEventBus()
        const order: number[] = []

        bus.on('agent.start', () => {
          order.push(1)
        })
        bus.on('agent.start', () => {
          order.push(2)
        })

        await bus.emit('agent.start', { agentName: 'test', model: 'gpt-4' })
        expect(order).toEqual([1, 2])
      })
    })

    describe('#when 事件处理器抛出异常', () => {
      it('#then 不影响其他处理器', async () => {
        const bus = createExtensionEventBus()
        let secondCalled = false

        bus.on('session.end', () => {
          throw new Error('handler error')
        })
        bus.on('session.end', () => {
          secondCalled = true
        })

        // 不抛出，继续执行
        await bus.emit('session.end', { sessionId: 'x' })
        expect(secondCalled).toBe(true)
      })
    })

    describe('#when 无订阅者时触发事件', () => {
      it('#then 静默忽略', async () => {
        const bus = createExtensionEventBus()
        // 不应抛出
        await bus.emit('session.start', { sessionId: 'none' })
      })
    })
  })

  describe('#given 使用自定义总线事件', () => {
    describe('#when 扩展间发送/接收', () => {
      it('#then 应正确传递数据', () => {
        const bus = createExtensionEventBus()
        let received: unknown

        bus.onBus('custom:greet', (data) => {
          received = data
        })

        bus.emitBus('custom:greet', { msg: 'hello' })
        expect(received).toEqual({ msg: 'hello' })
      })

      it('#then 取消订阅后不再接收', () => {
        const bus = createExtensionEventBus()
        let callCount = 0

        const unsubscribe = bus.onBus('custom:count', () => {
          callCount++
        })

        bus.emitBus('custom:count', null)
        expect(callCount).toBe(1)

        unsubscribe()
        bus.emitBus('custom:count', null)
        expect(callCount).toBe(1)
      })
    })

    describe('#when 总线处理器抛出异常', () => {
      it('#then 不影响其他处理器', () => {
        const bus = createExtensionEventBus()
        let secondCalled = false

        bus.onBus('custom:error', () => {
          throw new Error('bus error')
        })
        bus.onBus('custom:error', () => {
          secondCalled = true
        })

        bus.emitBus('custom:error', null)
        expect(secondCalled).toBe(true)
      })
    })
  })

  describe('#given 调用 clear', () => {
    describe('#when 清除后触发事件', () => {
      it('#then 所有订阅者被移除', async () => {
        const bus = createExtensionEventBus()
        let called = false

        bus.on('session.start', () => {
          called = true
        })
        bus.onBus('custom:x', () => {
          called = true
        })

        bus.clear()

        await bus.emit('session.start', { sessionId: 'z' })
        bus.emitBus('custom:x', null)
        expect(called).toBe(false)
      })
    })
  })
})
