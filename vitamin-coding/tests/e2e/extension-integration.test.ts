// E2E 测试 — Extension 系统集成 + 事件总线
import { describe, it, expect } from 'vitest'

import { createExtensionRunner, createExtensionEventBus } from '@vitamin/extension'
import type { ExtensionFactory, ExtensionAPI } from '@vitamin/extension'
import type { AgentTool } from '@vitamin/agent'
import { z } from 'zod'

describe('E2E: Extension 系统', () => {
  describe('#given Extension 加载与工具注册', () => {
    it('#then Extension 可注册工具和监听事件', async () => {
      const runner = createExtensionRunner()
      const registeredTools: string[] = []

      const testExtension: ExtensionFactory = (api: ExtensionAPI) => {
        registeredTools.push('custom-tool')
        api.registerTool({
          name: 'custom-tool',
          description: '自定义测试工具',
          parameters: z.object({ input: z.string() }),
          execute: async () => ({
            content: [{ type: 'text' as const, text: '工具执行结果' }],
          }),
        } as AgentTool)
      }

      await runner.loadOne({
        name: 'test-extension',
        source: 'local' as const,
        entryPoint: '',
        factory: testExtension as never,
      })

      expect(registeredTools).toContain('custom-tool')
    })
  })

  describe('#given Extension 事件总线', () => {
    it('#then 扩展间通过 bus 事件通信', () => {
      const eventBus = createExtensionEventBus()
      const received: unknown[] = []

      // 扩展 A 监听
      eventBus.onBus('skill:list:response', (data) => {
        received.push(data)
      })

      // 扩展 B 发送
      eventBus.emitBus('skill:list:response', { skills: ['code-review', 'testing'] })

      expect(received.length).toBe(1)
      expect(received[0]).toEqual({ skills: ['code-review', 'testing'] })

      eventBus.clear()
    })

    it('#then 多事件类型独立分发', () => {
      const eventBus = createExtensionEventBus()
      const aEvents: unknown[] = []
      const bEvents: unknown[] = []

      eventBus.onBus('event-a', (data) => aEvents.push(data))
      eventBus.onBus('event-b', (data) => bEvents.push(data))

      eventBus.emitBus('event-a', { value: 1 })
      eventBus.emitBus('event-b', { value: 2 })
      eventBus.emitBus('event-a', { value: 3 })

      expect(aEvents.length).toBe(2)
      expect(bEvents.length).toBe(1)

      eventBus.clear()
    })
  })
})
