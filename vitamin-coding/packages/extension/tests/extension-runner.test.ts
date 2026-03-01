// Extension 运行器测试
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createExtensionRunner } from '../src/extension-runner'

import type { ExtensionAPI, ExtensionDescriptor, ToolInterceptEvent } from '../src/types'

// 创建内联 factory 的描述符（不需要文件系统）
function createInlineDescriptor(
  name: string,
  factory: (api: ExtensionAPI) => void | Promise<void>,
): ExtensionDescriptor {
  return {
    name,
    source: 'builtin',
    entryPoint: 'inline',
    factory,
  }
}

describe('ExtensionRunner', () => {
  describe('#given 创建了运行器', () => {
    describe('#when 加载 Extension 注册工具（验收 3.2.1）', () => {
      it('#then 工具出现在注册表中', async () => {
        const runner = createExtensionRunner()

        const descriptor = createInlineDescriptor('tool-ext', (api) => {
          api.registerTool({
            name: 'my_tool',
            description: 'Extension 注册的工具',
            parameters: z.object({ input: z.string() }),
            execute: async () => ({
              content: [{ type: 'text' as const, text: '工具执行完成' }],
            }),
          })
        })

        const results = await runner.loadAll([descriptor])
        expect(results).toHaveLength(1)
        expect(results[0]?.loaded).toBe(true)

        const registry = runner.getRegistry()
        expect(registry.tools.has('my_tool')).toBe(true)
      })
    })

    describe('#when 加载 Extension 注册命令（验收 3.2.2）', () => {
      it('#then 命令出现在注册表中', async () => {
        const runner = createExtensionRunner()

        const descriptor = createInlineDescriptor('cmd-ext', (api) => {
          api.registerCommand({
            name: 'test',
            description: '测试命令',
            execute: async () => {},
          })
        })

        await runner.loadAll([descriptor])

        const registry = runner.getRegistry()
        expect(registry.commands.has('test')).toBe(true)
      })
    })

    describe('#when 拦截工具调用（验收 3.2.3）', () => {
      it('#then preventDefault 阻止工具执行', async () => {
        const runner = createExtensionRunner()

        const descriptor = createInlineDescriptor('guard-ext', (api) => {
          api.on('tool.call', (event: ToolInterceptEvent) => {
            if (event.toolName === 'bash') {
              event.preventDefault = true
              event.replacement = {
                content: [{ type: 'text' as const, text: '已阻止' }],
                isError: true,
              }
            }
          })
        })

        await runner.loadAll([descriptor])

        const toolWrapper = runner.getToolWrapper()
        const result = await toolWrapper.interceptToolCall('bash', 'id-1', { command: 'ls' })
        expect(result.prevented).toBe(true)
        expect(result.replacement?.content[0]).toEqual({
          type: 'text',
          text: '已阻止',
        })
      })
    })

    describe('#when 修改工具结果（验收 3.2.4）', () => {
      it('#then 替换返回值', async () => {
        const runner = createExtensionRunner()

        const descriptor = createInlineDescriptor('modify-ext', (api) => {
          api.on('tool.result', (event) => {
            if (event.toolName === 'read') {
              event.replacement = {
                content: [{ type: 'text' as const, text: '修改后内容' }],
              }
            }
          })
        })

        await runner.loadAll([descriptor])

        const toolWrapper = runner.getToolWrapper()
        const original = { content: [{ type: 'text' as const, text: '原始内容' }] }
        const result = await toolWrapper.interceptToolResult('read', 'id-2', original)
        expect(result.modified).toBe(true)
        expect(result.result.content[0]).toEqual({ type: 'text', text: '修改后内容' })
      })
    })

    describe('#when Extension 工厂抛出异常（验收 3.2.6）', () => {
      it('#then 不影响其他 Extension 加载', async () => {
        const runner = createExtensionRunner()

        const badDescriptor = createInlineDescriptor('bad-ext', () => {
          throw new Error('Extension 初始化失败')
        })

        const goodDescriptor = createInlineDescriptor('good-ext', (api) => {
          api.registerCommand({
            name: 'good',
            description: '正常命令',
            execute: async () => {},
          })
        })

        const results = await runner.loadAll([badDescriptor, goodDescriptor])

        expect(results).toHaveLength(2)
        expect(results[0]?.loaded).toBe(false)
        expect(results[0]?.error).toBeDefined()
        expect(results[1]?.loaded).toBe(true)

        // 正常 Extension 的注册应该生效
        const registry = runner.getRegistry()
        expect(registry.commands.has('good')).toBe(true)
      })
    })

    describe('#when 扩展间事件总线通信（验收 3.2.7）', () => {
      it('#then Ext A 发事件 → Ext B 收到', async () => {
        const runner = createExtensionRunner()
        let received: unknown

        const extA = createInlineDescriptor('ext-a', (api) => {
          // 延迟发送，等 B 注册完
          setTimeout(() => {
            api.emit('ext-a:data', { value: 42 })
          }, 0)
        })

        const extB = createInlineDescriptor('ext-b', (api) => {
          api.onBus('ext-a:data', (data) => {
            received = data
          })
        })

        await runner.loadAll([extA, extB])

        // 等待 setTimeout 执行
        await new Promise((resolve) => setTimeout(resolve, 10))

        expect(received).toEqual({ value: 42 })
      })
    })

    describe('#when 卸载 Extension', () => {
      it('#then 清理注册的资源', async () => {
        const runner = createExtensionRunner()

        const descriptor = createInlineDescriptor('removable', (api) => {
          api.registerTool({
            name: 'removable_tool',
            description: '可移除工具',
            parameters: z.object({}),
            execute: async () => ({
              content: [{ type: 'text' as const, text: '' }],
            }),
          })
        })

        await runner.loadAll([descriptor])
        expect(runner.getRegistry().tools.has('removable_tool')).toBe(true)

        runner.unload('removable')
        expect(runner.getRegistry().tools.has('removable_tool')).toBe(false)
      })

      it('#then unloadAll 清除所有 Extension', async () => {
        const runner = createExtensionRunner()

        const ext1 = createInlineDescriptor('ext-1', (api) => {
          api.registerCommand({ name: 'cmd1', description: '', execute: async () => {} })
        })
        const ext2 = createInlineDescriptor('ext-2', (api) => {
          api.registerCommand({ name: 'cmd2', description: '', execute: async () => {} })
        })

        await runner.loadAll([ext1, ext2])
        expect(runner.getLoadedExtensionNames()).toHaveLength(2)

        runner.unloadAll()
        expect(runner.getLoadedExtensionNames()).toHaveLength(0)
        expect(runner.getRegistry().commands.size).toBe(0)
      })
    })

    describe('#when 获取已加载列表', () => {
      it('#then 返回正确的名称', async () => {
        const runner = createExtensionRunner()

        await runner.loadAll([
          createInlineDescriptor('alpha', () => {}),
          createInlineDescriptor('beta', () => {}),
        ])

        const names = runner.getLoadedExtensionNames()
        expect(names).toContain('alpha')
        expect(names).toContain('beta')
      })
    })
  })
})
