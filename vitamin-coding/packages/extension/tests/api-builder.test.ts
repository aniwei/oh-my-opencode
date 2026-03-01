// Extension API 构建器测试
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { buildExtensionApi, createExtensionRegistry } from '../src/api-builder'
import { createExtensionEventBus } from '../src/event-bus'

import type { ExtensionDescriptor } from '../src/types'

function createTestDescriptor(name = 'test-ext'): ExtensionDescriptor {
  return {
    name,
    source: 'local',
    entryPoint: '/fake/path.ts',
  }
}

describe('buildExtensionApi', () => {
  describe('#given 构建了 Extension API', () => {
    describe('#when 注册工具', () => {
      it('#then 工具出现在 registry 中（验收 3.2.1）', () => {
        const eventBus = createExtensionEventBus()
        const registry = createExtensionRegistry()
        const descriptor = createTestDescriptor()

        const { api } = buildExtensionApi(descriptor, { eventBus, registry })

        const tool = {
          name: 'my_tool',
          description: '测试工具',
          parameters: z.object({ input: z.string() }),
          execute: async () => ({ content: [{ type: 'text' as const, text: 'ok' }] }),
        }

        api.registerTool(tool)
        expect(registry.tools.has('my_tool')).toBe(true)
        expect(registry.tools.get('my_tool')?.name).toBe('my_tool')
      })

      it('#then 取消注册后工具被移除', () => {
        const eventBus = createExtensionEventBus()
        const registry = createExtensionRegistry()
        const { api } = buildExtensionApi(createTestDescriptor(), { eventBus, registry })

        const dispose = api.registerTool({
          name: 'temp_tool',
          description: '临时工具',
          parameters: z.object({}),
          execute: async () => ({ content: [{ type: 'text' as const, text: '' }] }),
        })

        expect(registry.tools.has('temp_tool')).toBe(true)
        dispose()
        expect(registry.tools.has('temp_tool')).toBe(false)
      })
    })

    describe('#when 注册命令（验收 3.2.2）', () => {
      it('#then 命令出现在 registry 中', () => {
        const eventBus = createExtensionEventBus()
        const registry = createExtensionRegistry()
        const { api } = buildExtensionApi(createTestDescriptor(), { eventBus, registry })

        api.registerCommand({
          name: 'test',
          description: '测试命令',
          execute: async () => {},
        })

        expect(registry.commands.has('test')).toBe(true)
        expect(registry.commands.get('test')?.description).toBe('测试命令')
      })
    })

    describe('#when 注册 Hook', () => {
      it('#then Hook 出现在 registry 中且名称带前缀', () => {
        const eventBus = createExtensionEventBus()
        const registry = createExtensionRegistry()
        const { api } = buildExtensionApi(createTestDescriptor('my-ext'), {
          eventBus,
          registry,
        })

        api.registerHook({
          name: 'custom-hook',
          timing: 'chat.message.before',
          priority: 100,
          handler: () => {},
          enabled: true,
        })

        expect(registry.hooks).toHaveLength(1)
        expect(registry.hooks[0]?.name).toBe('ext:my-ext:custom-hook')
      })
    })

    describe('#when 使用事件总线通信（验收 3.2.7）', () => {
      it('#then 扩展 A 可以向扩展 B 发送事件', () => {
        const eventBus = createExtensionEventBus()
        const registry = createExtensionRegistry()

        const { api: apiA } = buildExtensionApi(
          createTestDescriptor('ext-a'),
          { eventBus, registry },
        )
        const { api: apiB } = buildExtensionApi(
          createTestDescriptor('ext-b'),
          { eventBus, registry },
        )

        let received: unknown
        apiB.onBus('ext-a:notify', (data) => {
          received = data
        })

        apiA.emit('ext-a:notify', { message: '来自 A' })
        expect(received).toEqual({ message: '来自 A' })
      })
    })

    describe('#when 使用日志', () => {
      it('#then 不抛异常', () => {
        const eventBus = createExtensionEventBus()
        const registry = createExtensionRegistry()
        const { api } = buildExtensionApi(createTestDescriptor(), { eventBus, registry })

        // 只验证不抛异常
        expect(() => api.log.info('info msg')).not.toThrow()
        expect(() => api.log.warn('warn msg')).not.toThrow()
        expect(() => api.log.error('error msg')).not.toThrow()
      })
    })

    describe('#when 调用 dispose', () => {
      it('#then 清除该 Extension 注册的所有资源', () => {
        const eventBus = createExtensionEventBus()
        const registry = createExtensionRegistry()
        const { api, dispose } = buildExtensionApi(createTestDescriptor(), {
          eventBus,
          registry,
        })

        api.registerTool({
          name: 'tool-1',
          description: 't1',
          parameters: z.object({}),
          execute: async () => ({ content: [{ type: 'text' as const, text: '' }] }),
        })
        api.registerCommand({
          name: 'cmd-1',
          description: 'c1',
          execute: async () => {},
        })
        api.registerHook({
          name: 'hook-1',
          timing: 'session.created',
          priority: 100,
          handler: () => {},
          enabled: true,
        })

        expect(registry.tools.size).toBe(1)
        expect(registry.commands.size).toBe(1)
        expect(registry.hooks).toHaveLength(1)

        dispose()

        expect(registry.tools.size).toBe(0)
        expect(registry.commands.size).toBe(0)
        expect(registry.hooks).toHaveLength(0)
      })
    })
  })
})
