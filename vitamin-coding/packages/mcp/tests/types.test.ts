// MCP 类型工具函数测试
import { describe, expect, it } from 'vitest'

import { formatMcpToolName, mcpResultToToolResult, parseMcpToolName } from '../src/types'

describe('MCP \u7c7b\u578b\u5de5\u5177', () => {
  describe('#given formatMcpToolName', () => {
    describe('#when \u683c\u5f0f\u5316\u5de5\u5177\u540d', () => {
      it('#then \u8fd4\u56de mcp__{mcpName}__{toolName} \u683c\u5f0f', () => {
        expect(formatMcpToolName('websearch', 'webSearch')).toBe('mcp__websearch__webSearch')
        expect(formatMcpToolName('context7', 'query')).toBe('mcp__context7__query')
      })
    })
  })

  describe('#given parseMcpToolName', () => {
    describe('#when \u89e3\u6790\u6709\u6548\u547d\u540d\u7a7a\u95f4\u540d', () => {
      it('#then \u63d0\u53d6 mcpName \u548c toolName', () => {
        const result = parseMcpToolName('mcp__websearch__webSearch')
        expect(result).toEqual({ mcpName: 'websearch', toolName: 'webSearch' })
      })
    })

    describe('#when \u89e3\u6790\u65e0\u6548\u540d\u79f0', () => {
      it('#then \u8fd4\u56de undefined', () => {
        expect(parseMcpToolName('not_mcp_tool')).toBeUndefined()
        expect(parseMcpToolName('mcp__only_one')).toBeUndefined()
      })
    })
  })

  describe('#given mcpResultToToolResult', () => {
    describe('#when \u8f6c\u6362\u6587\u672c\u5185\u5bb9', () => {
      it('#then \u8fd4\u56de TextContent', () => {
        const result = mcpResultToToolResult({
          content: [{ type: 'text', text: 'hello' }],
        })
        expect(result.content).toEqual([{ type: 'text', text: 'hello' }])
        expect(result.isError).toBeUndefined()
      })
    })

    describe('#when \u8f6c\u6362\u56fe\u7247\u5185\u5bb9', () => {
      it('#then \u8fd4\u56de ImageContent', () => {
        const result = mcpResultToToolResult({
          content: [{ type: 'image', data: 'base64data', mimeType: 'image/png' }],
        })
        expect(result.content[0]).toEqual({
          type: 'image',
          source: { type: 'base64', mediaType: 'image/png', data: 'base64data' },
        })
      })
    })

    describe('#when \u8f6c\u6362\u9519\u8bef\u7ed3\u679c', () => {
      it('#then isError \u6807\u8bb0\u4e3a true', () => {
        const result = mcpResultToToolResult({
          content: [{ type: 'text', text: 'error' }],
          isError: true,
        })
        expect(result.isError).toBe(true)
      })
    })
  })
})
