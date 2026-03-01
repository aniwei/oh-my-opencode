// 工具拦截包装器测试
import { describe, expect, it } from 'vitest'

import { createExtensionEventBus } from '../src/event-bus'
import { createToolWrapper } from '../src/tool-wrapper'

import type { ToolResult } from '@vitamin/agent'
import type { ToolInterceptEvent, ToolResultInterceptEvent } from '../src/types'

describe('ToolWrapper', () => {
  describe('#given 创建了工具包装器', () => {
    describe('#when 拦截工具调用（验收 3.2.3）', () => {
      it('#then 无拦截器时正常通过', async () => {
        const bus = createExtensionEventBus()
        const wrapper = createToolWrapper(bus)

        const result = await wrapper.interceptToolCall('bash', 'call-1', { command: 'ls' })
        expect(result.prevented).toBe(false)
      })

      it('#then 拦截器设置 preventDefault 阻止调用', async () => {
        const bus = createExtensionEventBus()
        const wrapper = createToolWrapper(bus)

        const replacement: ToolResult = {
          content: [{ type: 'text', text: '操作被阻止' }],
          isError: true,
        }

        bus.on('tool.call', (event: ToolInterceptEvent) => {
          if (event.toolName === 'bash') {
            event.preventDefault = true
            event.replacement = replacement
          }
        })

        const result = await wrapper.interceptToolCall('bash', 'call-2', { command: 'rm -rf /' })
        expect(result.prevented).toBe(true)
        expect(result.replacement).toEqual(replacement)
      })

      it('#then 未匹配的工具不被拦截', async () => {
        const bus = createExtensionEventBus()
        const wrapper = createToolWrapper(bus)

        bus.on('tool.call', (event: ToolInterceptEvent) => {
          if (event.toolName === 'bash') {
            event.preventDefault = true
          }
        })

        const result = await wrapper.interceptToolCall('read', 'call-3', { path: '/a.txt' })
        expect(result.prevented).toBe(false)
      })
    })

    describe('#when 拦截工具结果（验收 3.2.4）', () => {
      it('#then 无拦截器时返回原始结果', async () => {
        const bus = createExtensionEventBus()
        const wrapper = createToolWrapper(bus)

        const original: ToolResult = {
          content: [{ type: 'text', text: '原始输出' }],
        }

        const result = await wrapper.interceptToolResult('read', 'call-4', original)
        expect(result.modified).toBe(false)
        expect(result.result).toBe(original)
      })

      it('#then 拦截器可修改返回结果', async () => {
        const bus = createExtensionEventBus()
        const wrapper = createToolWrapper(bus)

        const modified: ToolResult = {
          content: [{ type: 'text', text: '修改后的输出' }],
        }

        bus.on('tool.result', (event: ToolResultInterceptEvent) => {
          if (event.toolName === 'read') {
            event.replacement = modified
          }
        })

        const original: ToolResult = {
          content: [{ type: 'text', text: '原始输出' }],
        }

        const result = await wrapper.interceptToolResult('read', 'call-5', original)
        expect(result.modified).toBe(true)
        expect(result.result).toEqual(modified)
      })
    })

    describe('#when 拦截器抛出异常（验收 3.2.6）', () => {
      it('#then 工具调用拦截异常不影响执行', async () => {
        const bus = createExtensionEventBus()
        const wrapper = createToolWrapper(bus)

        bus.on('tool.call', () => {
          throw new Error('拦截器崩溃')
        })

        // 不抛出，fallthrough 到正常执行
        const result = await wrapper.interceptToolCall('bash', 'call-6', {})
        expect(result.prevented).toBe(false)
      })

      it('#then 工具结果拦截异常使用原始结果', async () => {
        const bus = createExtensionEventBus()
        const wrapper = createToolWrapper(bus)

        bus.on('tool.result', () => {
          throw new Error('结果拦截器崩溃')
        })

        const original: ToolResult = {
          content: [{ type: 'text', text: 'ok' }],
        }

        const result = await wrapper.interceptToolResult('read', 'call-7', original)
        expect(result.modified).toBe(false)
        expect(result.result).toBe(original)
      })
    })
  })
})
