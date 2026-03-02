import { Router } from 'express'

interface SessionManagerLike {
  list: () => Promise<unknown[]>
  create: (title?: string) => Promise<unknown>
  getTree: (sessionId: string) => Promise<{ getActiveMessages: () => unknown[] }>
  remove: (sessionId: string) => Promise<void>
  fork: (sessionId: string, fromEntryId?: string) => Promise<unknown>
}

function resolveSessionManager(input: unknown): SessionManagerLike | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const manager = input as Partial<SessionManagerLike>
  if (
    typeof manager.list !== 'function'
    || typeof manager.create !== 'function'
    || typeof manager.getTree !== 'function'
    || typeof manager.remove !== 'function'
    || typeof manager.fork !== 'function'
  ) {
    return null
  }

  return manager as SessionManagerLike
}

export function createSessionsRouter(sessionManager?: unknown): Router {
  const router = Router()
  const manager = resolveSessionManager(sessionManager)

  router.post('/', async (req, res) => {
    if (!manager) {
      res.status(501).json({ error: 'session manager not configured' })
      return
    }

    const title = typeof req.body?.title === 'string' ? req.body.title : undefined
    const created = await manager.create(title)
    res.status(201).json(created)
  })

  router.get('/', async (_req, res) => {
    if (!manager) {
      res.json([{ id: 'demo-session', title: 'Demo Session', status: 'active' }])
      return
    }

    const sessions = await manager.list()
    res.json(sessions)
  })

  router.get('/:id', async (req, res) => {
    if (!manager) {
      res.json({ id: req.params.id, status: 'active', messages: [] })
      return
    }

    const tree = await manager.getTree(req.params.id)
    res.json({ id: req.params.id, messages: tree.getActiveMessages() })
  })

  router.patch('/:id', async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title : undefined
    const archived = typeof req.body?.archived === 'boolean' ? req.body.archived : undefined

    res.json({
      id: req.params.id,
      title,
      archived,
      updatedAt: Date.now(),
    })
  })

  router.delete('/:id', async (req, res) => {
    if (!manager) {
      res.status(501).json({ error: 'session manager not configured' })
      return
    }

    await manager.remove(req.params.id)
    res.json({ removed: true })
  })

  router.post('/:id/fork', async (req, res) => {
    if (!manager) {
      res.status(501).json({ error: 'session manager not configured' })
      return
    }

    const fromMessageId = typeof req.body?.fromMessageId === 'string'
      ? req.body.fromMessageId
      : undefined
    const result = await manager.fork(req.params.id, fromMessageId)
    res.status(201).json({
      sessionId: req.params.id,
      fork: result,
    })
  })

  return router
}
