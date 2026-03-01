// 内置 MCP 配置测试
import { describe, expect, it } from 'vitest'

import { getBuiltinMcpConfigs } from '../src/builtin/websearch'

describe('内置 MCP 配置', () => {
  describe('#given getBuiltinMcpConfigs', () => {
    describe('#when 获取内置配置', () => {
      it('#then 返回 3 个内置 MCP', () => {
        const configs = getBuiltinMcpConfigs()
        expect(configs).toHaveLength(3)
      })

      it('#then 包含 websearch MCP', () => {
        const configs = getBuiltinMcpConfigs()
        const ws = configs.find((c) => c.name === 'websearch')
        expect(ws).toBeDefined()
        expect(ws?.transport).toBe('http')
        expect(ws?.url).toBeDefined()
      })

      it('#then 包含 context7 MCP', () => {
        const configs = getBuiltinMcpConfigs()
        const c7 = configs.find((c) => c.name === 'context7')
        expect(c7).toBeDefined()
        expect(c7?.transport).toBe('http')
      })

      it('#then 包含 grep_app MCP', () => {
        const configs = getBuiltinMcpConfigs()
        const grep = configs.find((c) => c.name === 'grep_app')
        expect(grep).toBeDefined()
        expect(grep?.transport).toBe('http')
      })
    })
  })
})
