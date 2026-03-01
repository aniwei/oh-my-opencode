import { describe, expect, it } from 'vitest'

import { resolveApiKey } from '../src/api-key-resolver'

describe('resolveApiKey', () => {
  describe('#given explicit key', () => {
    describe('#when resolve is called', () => {
      it('#then returns explicit key first', async () => {
        const key = await resolveApiKey(
          'openai',
          {
            getApiKey: async () => 'dynamic-key',
            keys: { openai: 'static-key' },
          },
          'explicit-key',
        )

        expect(key).toBe('explicit-key')
      })
    })
  })

  describe('#given dynamic getter', () => {
    describe('#when explicit key is absent', () => {
      it('#then returns key from getter', async () => {
        const key = await resolveApiKey('openai', {
          getApiKey: async () => 'dynamic-key',
          keys: { openai: 'static-key' },
        })

        expect(key).toBe('dynamic-key')
      })
    })
  })

  describe('#given static key map only', () => {
    describe('#when getter returns undefined', () => {
      it('#then falls back to static map', async () => {
        const key = await resolveApiKey('openai', {
          getApiKey: async () => undefined,
          keys: { openai: 'static-key' },
        })

        expect(key).toBe('static-key')
      })
    })
  })

  describe('#given environment variable', () => {
    describe('#when no explicit/getter/static key exists', () => {
      it('#then uses environment variable', async () => {
        const prev = process.env.OPENAI_API_KEY
        process.env.OPENAI_API_KEY = 'env-key'

        try {
          const key = await resolveApiKey('openai')
          expect(key).toBe('env-key')
        } finally {
          if (prev === undefined) {
            process.env.OPENAI_API_KEY = undefined
          } else {
            process.env.OPENAI_API_KEY = prev
          }
        }
      })
    })
  })

  describe('#given ollama provider', () => {
    describe('#when no key source exists', () => {
      it('#then returns empty key', async () => {
        const key = await resolveApiKey('ollama')
        expect(key).toBe('')
      })
    })
  })

  describe('#given non-ollama provider without any key', () => {
    describe('#when resolve is called', () => {
      it('#then throws key missing error', async () => {
        const prev = process.env.OPENAI_API_KEY
        delete process.env.OPENAI_API_KEY

        try {
          await expect(resolveApiKey('openai')).rejects.toThrow('API key not found')
        } finally {
          if (prev !== undefined) process.env.OPENAI_API_KEY = prev
        }
      })
    })
  })
})
