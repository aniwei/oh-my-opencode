import { Router } from 'express'

interface ModelResponseItem {
  id: string
  provider: string
  displayName: string
  supportsVision: boolean
}

interface ModelRegistryLike {
  listModels?: () => Promise<ModelResponseItem[]>
  getAll?: () => Array<{
    id: string
    provider?: string
    name?: string
    input?: string[]
  }>
}

const DEFAULT_MODELS: ModelResponseItem[] = [
  {
    id: 'claude-sonnet-4',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4',
    supportsVision: true,
  },
]

function resolveModelRegistry(input: unknown): ModelRegistryLike | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const registry = input as Partial<ModelRegistryLike>
  if (typeof registry.listModels !== 'function' && typeof registry.getAll !== 'function') {
    return null
  }

  return registry as ModelRegistryLike
}

function toModelResponseItem(model: {
  id: string
  provider?: string
  name?: string
  input?: string[]
}): ModelResponseItem {
  return {
    id: model.id,
    provider: model.provider ?? 'custom',
    displayName: model.name ?? model.id,
    supportsVision: Array.isArray(model.input) && model.input.includes('image'),
  }
}

export function createModelsRouter(modelRegistry?: unknown): Router {
  const router = Router()
  const registry = resolveModelRegistry(modelRegistry)

  router.get('/', async (_req, res) => {
    try {
      if (!registry) {
        res.json({ models: DEFAULT_MODELS, source: 'fallback' as const })
        return
      }

      if (typeof registry.listModels === 'function') {
        const models = await registry.listModels()
        res.json({ models, source: 'registry' as const })
        return
      }

      if (typeof registry.getAll === 'function') {
        const models = registry.getAll().map(toModelResponseItem)
        res.json({ models, source: 'registry' as const })
        return
      }

      res.json({ models: DEFAULT_MODELS, source: 'fallback' as const })
    } catch {
      res.json({ models: DEFAULT_MODELS, source: 'fallback' as const })
    }
  })

  return router
}
