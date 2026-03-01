import { describe, expect, it } from 'vitest'
import { mergeConfigLayers, mergeConfigs } from '../src/merger'

describe('mergeConfigs', () => {
  describe('#given scalar fields', () => {
    it('#then higher priority wins', () => {
      const lower = { log_level: 'info' as const, model: 'old-model' }
      const higher = { model: 'new-model' }
      const result = mergeConfigs(lower, higher)
      expect(result.model).toBe('new-model')
      expect(result.log_level).toBe('info')
    })
  })

  describe('#given disabled_* arrays', () => {
    it('#then merges as set union', () => {
      const lower = { disabled_agents: ['a', 'b'] }
      const higher = { disabled_agents: ['b', 'c'] }
      const result = mergeConfigs(lower, higher)
      expect(result.disabled_agents).toEqual(expect.arrayContaining(['a', 'b', 'c']))
      expect(result.disabled_agents).toHaveLength(3)
    })
  })

  describe('#given object fields (agents)', () => {
    it('#then deep merges', () => {
      const lower = {
        agents: {
          sisyphus: { model: 'claude-sonnet-4-6', temperature: 0.2 },
          oracle: { model: 'gpt-4o' },
        },
      }
      const higher = {
        agents: {
          sisyphus: { temperature: 0.5 },
        },
      }
      const result = mergeConfigs(lower, higher)
      expect(result.agents?.sisyphus?.model).toBe('claude-sonnet-4-6')
      expect(result.agents?.sisyphus?.temperature).toBe(0.5)
      expect(result.agents?.oracle?.model).toBe('gpt-4o')
    })
  })

  describe('#given undefined values in higher', () => {
    it('#then skips undefined entries', () => {
      const lower = { model: 'keep-this' }
      const higher = { model: undefined }
      const result = mergeConfigs(lower, higher)
      expect(result.model).toBe('keep-this')
    })
  })
})

describe('mergeConfigLayers', () => {
  describe('#given multiple layers', () => {
    it('#then merges from lowest to highest priority', () => {
      const result = mergeConfigLayers(
        { log_level: 'info', model: 'default' },
        { model: 'user-model' },
        { model: 'cli-model' },
      )
      expect(result.model).toBe('cli-model')
      expect(result.log_level).toBe('info')
    })
  })
})
