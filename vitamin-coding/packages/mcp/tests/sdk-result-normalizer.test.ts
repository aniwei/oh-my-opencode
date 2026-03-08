import { describe, expect, it } from 'vitest'

import { normalizeCallToolResult, normalizeToolsResult } from '../src/transports/sdk-result-normalizer'

describe('sdk-result-normalizer', () => {
  describe('normalizeToolsResult', () => {
    it('#then filters invalid tools and normalizes fields', () => {
      const result = normalizeToolsResult({
        tools: [
          { name: 'search', description: 'desc', inputSchema: { type: 'object' } },
          { name: 1, description: 'bad' },
          { description: 'missing name' },
        ],
      })

      expect(result).toEqual([
        { name: 'search', description: 'desc', inputSchema: { type: 'object' } },
      ])
    })

    it('#then returns empty for invalid payload', () => {
      expect(normalizeToolsResult(null)).toEqual([])
      expect(normalizeToolsResult({})).toEqual([])
    })
  })

  describe('normalizeCallToolResult', () => {
    it('#then normalizes text/image/resource/audio parts', () => {
      const result = normalizeCallToolResult({
        content: [
          { type: 'text', text: 'ok' },
          { type: 'image', data: 'abc', mimeType: 'image/png' },
          { type: 'resource', resource: { text: 'r1', mimeType: 'text/plain' } },
          { type: 'resource', resource: { foo: 'bar' } },
          { type: 'audio', mimeType: 'audio/wav' },
        ],
        isError: true,
      })

      expect(result).toEqual({
        content: [
          { type: 'text', text: 'ok' },
          { type: 'image', data: 'abc', mimeType: 'image/png' },
          { type: 'resource', text: 'r1', mimeType: 'text/plain' },
          { type: 'resource', text: '{"foo":"bar"}', mimeType: undefined },
          { type: 'resource', text: '[audio content]', mimeType: 'audio/wav' },
        ],
        isError: true,
      })
    })

    it('#then falls back to stringified text for unknown parts', () => {
      const result = normalizeCallToolResult({
        content: [{ type: 'custom', v: 1 }, 'skip-me'],
      })

      expect(result).toEqual({
        content: [{ type: 'text', text: '{"type":"custom","v":1}' }],
        isError: undefined,
      })
    })

    it('#then returns empty content for non-record result', () => {
      expect(normalizeCallToolResult(undefined)).toEqual({ content: [] })
    })
  })
})
