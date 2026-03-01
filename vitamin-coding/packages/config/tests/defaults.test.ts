import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/defaults'

describe('DEFAULT_CONFIG', () => {
  describe('#given the default config', () => {
    it('#then has expected default values', () => {
      expect(DEFAULT_CONFIG.config_version).toBe('1.0.0')
      expect(DEFAULT_CONFIG.log_level).toBe('info')
      expect(DEFAULT_CONFIG.theme).toBe('auto')
      expect(DEFAULT_CONFIG.model).toBeUndefined()
    })

    it('#then has empty disabled arrays', () => {
      expect(DEFAULT_CONFIG.disabled_agents).toEqual([])
      expect(DEFAULT_CONFIG.disabled_hooks).toEqual([])
      expect(DEFAULT_CONFIG.disabled_mcps).toEqual([])
      expect(DEFAULT_CONFIG.disabled_skills).toEqual([])
      expect(DEFAULT_CONFIG.disabled_tools).toEqual([])
    })

    it('#then has empty agent and category objects', () => {
      expect(DEFAULT_CONFIG.agents).toEqual({})
      expect(DEFAULT_CONFIG.categories).toEqual({})
    })
  })
})
