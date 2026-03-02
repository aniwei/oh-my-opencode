import { Router } from 'express'

interface ModelRegistryLike {
  listModels: () => Promise<Array<{
    id: string
    provider: string
    displayName: string
    supportsVision: boolean
  }>>
}

function resolveModelRegistry(input: unknown): ModelRegistryLike | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const registry = input as Partial<ModelRegistryLike>
  if (typeof registry.listModels !== 'function') {
    return null
  }

  return registry as ModelRegistryLike
}

export function createModelsRouter(modelRegistry?: unknown): Router {
  const router = Router()
  const registry = resolveModelRegistry(modelRegistry)

  router.get('/', async (_req, res) => {
    if (!registry) {
      res.json({
        models: [
          {
            id: 'claude-sonnet-4',
            provider: 'anthropic',
            displayName: 'Claude Sonnet 4',
            supportsVision: true,
          },
        ],
      })
      return
    }

    const models = await registry.listModels()
    res.json({ models })
  })

  return router
}
