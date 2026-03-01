// E2E 测试 — MCP 工具注册与转换
import { describe, it, expect } from 'vitest'

import { createMcpRegistry } from '@vitamin/mcp'
import type { McpToolDefinition } from '@vitamin/mcp'

describe('E2E: MCP 集成', () => {
  describe('#given MCP Registry 集成', () => {
    it('#then MCP 工具正确转换为 AgentTool 格式', () => {
      const mcpRegistry = createMcpRegistry()

      // 模拟预加载的 MCP 工具
      const mockTools: McpToolDefinition[] = [
        {
          name: 'web_search',
          description: '搜索互联网',
          inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
        },
        {
          name: 'code_search',
          description: '搜索代码库',
          inputSchema: { type: 'object', properties: { pattern: { type: 'string' } } },
        },
      ]

      // 使用 mock client
      const mockClient = {
        connect: async () => {},
        disconnect: async () => {},
        listTools: async () => mockTools,
        callTool: async () => ({ content: [{ type: 'text' as const, text: '搜索结果' }] }),
        isConnected: () => true,
        getConfig: () => ({ name: 'test-mcp', transport: 'http' as const, url: 'http://test' }),
        getName: () => 'test-mcp',
      }

      mcpRegistry.registerWithTools('test-mcp', 'builtin', mockClient as never, mockTools)

      const agentTools = mcpRegistry.getAgentTools()
      expect(agentTools.length).toBe(2)
      expect(agentTools[0]?.name).toContain('web_search')
      expect(agentTools[0]?.description).toContain('搜索互联网')
    })
  })

  describe('#given 多个 MCP 来源', () => {
    it('#then 不同优先级的工具正确注册', () => {
      const mcpRegistry = createMcpRegistry()

      const builtinTools: McpToolDefinition[] = [
        { name: 'builtin_tool', description: '内建工具', inputSchema: { type: 'object', properties: {} } },
      ]

      const userTools: McpToolDefinition[] = [
        { name: 'user_tool', description: '用户自定义工具', inputSchema: { type: 'object', properties: {} } },
      ]

      const mockClient1 = {
        connect: async () => {},
        disconnect: async () => {},
        listTools: async () => builtinTools,
        callTool: async () => ({ content: [{ type: 'text' as const, text: '' }] }),
        isConnected: () => true,
        getConfig: () => ({ name: 'builtin-mcp', transport: 'http' as const, url: 'http://test1' }),
        getName: () => 'builtin-mcp',
      }

      const mockClient2 = {
        connect: async () => {},
        disconnect: async () => {},
        listTools: async () => userTools,
        callTool: async () => ({ content: [{ type: 'text' as const, text: '' }] }),
        isConnected: () => true,
        getConfig: () => ({ name: 'user-mcp', transport: 'http' as const, url: 'http://test2' }),
        getName: () => 'user-mcp',
      }

      mcpRegistry.registerWithTools('builtin-mcp', 'builtin', mockClient1 as never, builtinTools)
      mcpRegistry.registerWithTools('user-mcp', 'user', mockClient2 as never, userTools)

      const agentTools = mcpRegistry.getAgentTools()
      expect(agentTools.length).toBe(2)
      const names = agentTools.map(t => t.name)
      expect(names.some(n => n.includes('builtin_tool'))).toBe(true)
      expect(names.some(n => n.includes('user_tool'))).toBe(true)
    })
  })
})
