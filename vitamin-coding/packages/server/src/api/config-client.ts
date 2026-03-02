import { Router } from 'express'

interface ClientConfigProvider {
  getClientConfig: () => Promise<{
    theme: 'dark' | 'light'
    features: string[]
    limits: {
      maxFileSizeMb: number
      maxAttachments: number
    }
  }>
}

function resolveProvider(input: unknown): ClientConfigProvider | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const provider = input as Partial<ClientConfigProvider>
  if (typeof provider.getClientConfig !== 'function') {
    return null
  }

  return provider as ClientConfigProvider
}

export function createClientConfigRouter(configProvider?: unknown): Router {
  const router = Router()
  const provider = resolveProvider(configProvider)

  router.get('/', async (_req, res) => {
    if (!provider) {
      res.json({
        theme: 'dark',
        features: ['chat', 'sessions', 'files', 'agent_panel'],
        limits: {
          maxFileSizeMb: 20,
          maxAttachments: 10,
        },
      })
      return
    }

    const config = await provider.getClientConfig()
    res.json(config)
  })

  return router
}
