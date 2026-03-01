import { describe, expect, it } from 'vitest'
import { offsetToPosition, parseConfigPartially } from '../src/parser'

describe('parseConfigPartially', () => {
  describe('#given valid JSONC', () => {
    it('#then parses the full config', () => {
      const raw = `{
        // comment
        "log_level": "debug",
        "model": "claude-sonnet-4-6",
      }`
      const { config, warnings } = parseConfigPartially(raw)
      expect(config.log_level).toBe('debug')
      expect(config.model).toBe('claude-sonnet-4-6')
      expect(warnings).toHaveLength(0)
    })
  })

  describe('#given JSONC with block comments', () => {
    it('#then strips comments and parses', () => {
      const raw = `{
        /* block comment */
        "theme": "dark"
      }`
      const { config } = parseConfigPartially(raw)
      expect(config.theme).toBe('dark')
    })
  })

  describe('#given JSONC with trailing comma', () => {
    it('#then handles trailing commas', () => {
      const raw = `{
        "log_level": "info",
        "model": "gpt-4o",
      }`
      const { config } = parseConfigPartially(raw)
      expect(config.log_level).toBe('info')
    })
  })

  describe('#given a completely invalid JSON string', () => {
    it('#then returns partial result with warnings containing line and column', () => {
      // model 的值无效，log_level 的值可正常恢复
      const raw = `{
        "log_level": "info",
        "model": INVALID
      }`
      const { config, warnings } = parseConfigPartially(raw)

      // log_level 应通过按键恢复被提取
      expect(config.log_level).toBe('info')

      // model 解析失败应产生包含 line 和 column 的警告
      expect(warnings.length).toBeGreaterThan(0)
      const modelWarning = warnings.find((w) => w.key === 'model')
      expect(modelWarning).toBeDefined()
      expect(modelWarning?.line).toBeGreaterThan(0)
      expect(modelWarning?.column).toBeGreaterThan(0)
    })
  })

  describe('#given partial JSONC with one broken key', () => {
    it('#then recovers valid keys and warns on broken ones', () => {
      const raw = `{
  "theme": "dark",
  "log_level": NOT_VALID,
  "model": "gpt-4o"
}`
      const { config, warnings } = parseConfigPartially(raw)
      expect(config.theme).toBe('dark')
      expect(config.model).toBe('gpt-4o')
      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings.some((w) => w.key === 'log_level')).toBe(true)
    })
  })
})

describe('offsetToPosition', () => {
  describe('#given a text and offset', () => {
    it('#then returns correct line and column', () => {
      const text = 'line1\nline2\nline3'
      expect(offsetToPosition(text, 0)).toEqual({ line: 1, column: 1 })
      expect(offsetToPosition(text, 6)).toEqual({ line: 2, column: 1 })
      expect(offsetToPosition(text, 8)).toEqual({ line: 2, column: 3 })
    })
  })
})
