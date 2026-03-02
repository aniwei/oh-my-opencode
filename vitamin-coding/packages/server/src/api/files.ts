import { Router } from 'express'

interface FileStoreLike {
  listSessionFiles: (sessionId: string) => Promise<Array<{ path: string; size: number; updatedAt: number }>>
  readSessionFile: (sessionId: string, filePath: string) => Promise<{ content: string; diff?: string }>
}

function resolveFileStore(input: unknown): FileStoreLike | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const store = input as Partial<FileStoreLike>
  if (typeof store.listSessionFiles !== 'function' || typeof store.readSessionFile !== 'function') {
    return null
  }

  return store as FileStoreLike
}

export function createFilesRouter(fileStore?: unknown): Router {
  const router = Router()
  const store = resolveFileStore(fileStore)

  router.get('/:sessionId', async (req, res) => {
    if (!store) {
      res.json({ files: [] })
      return
    }

    const files = await store.listSessionFiles(req.params.sessionId)
    res.json({ files })
  })

  router.get('/:sessionId/*', async (req, res) => {
    const filePath = (req.params as Record<string, string | undefined>)['0']
    if (!filePath) {
      res.status(400).json({ error: 'filePath is required' })
      return
    }

    if (!store) {
      res.json({ path: filePath, content: '', diff: '' })
      return
    }

    const result = await store.readSessionFile(req.params.sessionId, filePath)
    res.json({ path: filePath, ...result })
  })

  return router
}
