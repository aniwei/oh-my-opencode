// MCP 注册表测试
import { describe, expect, it } from 'vitest'

import { createMcpClient } from '../src/mcp-client'
import { createMcpRegistry } from '../src/mcp-registry'

import type { McpTransport, McpToolDefinition } from '../src/types'

// 内存 MCP 传输 stub（不使用 vi.mock）
function createMemoryTransport(tools: McpToolDefinition[]): McpTransport {
  let connected = false
  return {
    async connect() {
      connected = true
    },
    async disconnect() {
      connected = false
    },
    async listTools() {
      return tools
    },
    async callTool(params) {
      return {
        content: [{ type: 'text', text: `called ${params.name}` }],
      }
    },
    isConnected() {
      return connected
    },
  }
}

describe('McpRegistry', () => {
  describe('#given 创建了注册表', () => {
    describe('#when 通过 registerWithTools 注册（验收 3.3.4 三层优先级）', () => {
      it('#then 按优先级排序返回工具', () => {
        const registry = createMcpRegistry()

        const skillTools: McpToolDefinition[] = [
          { name: 'skill_search', description: 'skill 搜索', inputSchema: {} },
        ]
        const builtinTools: McpToolDefinition[] = [
          { name: 'webSearch', description: '网页搜索', inputSchema: {} },
        ]
        const userTools: McpToolDefinition[] = [
          { name: 'custom', description: '用户自定义', inputSchema: {} },
        ]

        // 注册顺序: skill → builtin → user（乱序）
        const skillClient = createMcpClient({ name: 'skill-mcp', transport: 'http', url: 'http://fake' })
        const builtinClient = createMcpClient({ name: 'websearch', transport: 'http', url: 'http://fake' })
        const userClient = createMcpClient({ name: 'user-mcp', transport: 'http', url: 'http://fake' })

        registry.registerWithTools('skill-mcp', 'skill', skillClient, skillTools)
        registry.registerWithTools('websearch', 'builtin', builtinClient, builtinTools)
        registry.registerWithTools('user-mcp', 'user', userClient, userTools)

        const agentTools = registry.getAgentTools()

        // builtin 应该在最前面
        expect(agentTools[0]?.name).toBe('mcp__websearch__webSearch')
        // user 其次
        expect(agentTools[1]?.name).toBe('mcp__user-mcp__custom')
        // skill 最后
        expect(agentTools[2]?.name).toBe('mcp__skill-mcp__skill_search')
      })
    })

    describe('#when 获取 Agent 工具（验收 3.3.5）', () => {
      it('#then 工具名包含 mcp__ 前缀', () => {
        const registry = createMcpRegistry()
        const client = createMcpClient({ name: 'search', transport: 'http', url: 'http://fake' })

        registry.registerWithTools('search', 'builtin', client, [
          { name: 'webSearch', description: '搜索', inputSchema: {} },
        ])

        const tools = registry.getAgentTools()
        expect(tools).toHaveLength(1)
        expect(tools[0]?.name).toBe('mcp__search__webSearch')
        expect(tools[0]?.description).toContain('[MCP:search]')
      })
    })

    describe('#when 注销 MCP', () => {
      it('#then 从注册表中移除', async () => {
        const registry = createMcpRegistry()
        const client = createMcpClient({ name: 'test', transport: 'http', url: 'http://fake' })

        registry.registerWithTools('test', 'user', client, [])
        expect(registry.size).toBe(1)

        await registry.unregister('test')
        expect(registry.size).toBe(0)
      })
    })

    describe('#when 获取已注册的名称', () => {
      it('#then 返回正确列表', () => {
        const registry = createMcpRegistry()
        const c1 = createMcpClient({ name: 'a', transport: 'http', url: 'http://fake' })
        const c2 = createMcpClient({ name: 'b', transport: 'http', url: 'http://fake' })

        registry.registerWithTools('a', 'builtin', c1, [])
        registry.registerWithTools('b', 'user', c2, [])

        expect(registry.getRegisteredNames()).toEqual(['a', 'b'])
      })
    })
  })
})
