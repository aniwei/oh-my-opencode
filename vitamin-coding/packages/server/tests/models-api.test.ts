import { describe, expect, it } from 'vitest'
import express from 'express'
import { createModelsRouter } from '../src/api/models'

describe('createModelsRouter', () => {
  it('returns default models when no registry provided', async () => {
    const app = express()
    app.use('/api/models', createModelsRouter())

    const server = app.listen(0)
    const address = server.address()

    try {
      if (!address || typeof address === 'string') {
        throw new Error('Unexpected server address')
      }

      const res = await fetch(`http://127.0.0.1:${address.port}/api/models`)
      expect(res.status).toBe(200)
      const data = await res.json() as {
        models: Array<{ id: string }>
        source?: 'registry' | 'fallback'
      }
      expect(data.models.length).toBeGreaterThan(0)
      expect(data.models[0]?.id).toBe('claude-sonnet-4')
      expect(data.source).toBe('fallback')
    } finally {
      server.close()
    }
  })

  it('maps getAll registry shape to web-ui shape', async () => {
    const app = express()
    app.use('/api/models', createModelsRouter({
      getAll: () => [
        {
          id: 'openai/gpt-4.1',
          provider: 'openai',
          name: 'GPT-4.1',
          input: ['text', 'image'],
        },
      ],
    }))

    const server = app.listen(0)
    const address = server.address()

    try {
      if (!address || typeof address === 'string') {
        throw new Error('Unexpected server address')
      }

      const res = await fetch(`http://127.0.0.1:${address.port}/api/models`)
      expect(res.status).toBe(200)
      const data = await res.json() as {
        models: Array<{
          id: string
          provider: string
          displayName: string
          supportsVision: boolean
        }>
        source?: 'registry' | 'fallback'
      }
      expect(data.models).toEqual([
        {
          id: 'openai/gpt-4.1',
          provider: 'openai',
          displayName: 'GPT-4.1',
          supportsVision: true,
        },
      ])
      expect(data.source).toBe('registry')
    } finally {
      server.close()
    }
  })

  it('falls back to default models when listModels throws', async () => {
    const app = express()
    app.use('/api/models', createModelsRouter({
      listModels: async () => {
        throw new Error('registry failure')
      },
    }))

    const server = app.listen(0)
    const address = server.address()

    try {
      if (!address || typeof address === 'string') {
        throw new Error('Unexpected server address')
      }

      const res = await fetch(`http://127.0.0.1:${address.port}/api/models`)
      expect(res.status).toBe(200)
      const data = await res.json() as {
        models: Array<{ id: string }>
        source?: 'registry' | 'fallback'
      }
      expect(data.models[0]?.id).toBe('claude-sonnet-4')
      expect(data.source).toBe('fallback')
    } finally {
      server.close()
    }
  })
})
