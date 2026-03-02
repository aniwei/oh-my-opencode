import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

type ActiveStream = {
  controller: AbortController
  sessionId: string
  messageId: string
}

type WebUiContext = {
  activeStreams?: Map<string, ActiveStream>
}

const globalStreams = new Map<string, ActiveStream>()

function toStreamKey(sessionId: string, messageId: string): string {
  return `${sessionId}:${messageId}`
}

function getStreamStore(ctx: WebUiContext): Map<string, ActiveStream> {
  return ctx.activeStreams ?? globalStreams
}

export function createMessageEndpoint(ctx: WebUiContext): RequestHandler {
  return async (req, res) => {
    const sessionId = req.params.id
    if (!sessionId) {
      res.status(400).json({ error: 'session id is required' })
      return
    }

    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : ''

    if (!content) {
      res.status(400).json({ error: 'content is required' })
      return
    }

    const messageId = randomUUID()
    const streamKey = toStreamKey(sessionId, messageId)
    const controller = new AbortController()
    const store = getStreamStore(ctx)

    store.set(streamKey, { controller, sessionId, messageId })

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.setHeader('X-Message-Id', messageId)
    res.flushHeaders()

    const text = `已收到：${content}`
    const chunks = text.split('')
    let offset = 0

    const timer = setInterval(() => {
      const stream = store.get(streamKey)
      if (!stream || stream.controller.signal.aborted) {
        res.write(`event: error\ndata: ${JSON.stringify({ messageId, stopped: true })}\n\n`)
        res.write(`event: done\ndata: ${JSON.stringify({ messageId, stopped: true })}\n\n`)
        clearInterval(timer)
        store.delete(streamKey)
        res.end()
        return
      }

      const next = chunks[offset]
      if (!next) {
        res.write(`event: done\ndata: ${JSON.stringify({ messageId, stopped: false })}\n\n`)
        clearInterval(timer)
        store.delete(streamKey)
        res.end()
        return
      }

      res.write(`event: text_delta\ndata: ${JSON.stringify({ messageId, delta: next })}\n\n`)
      offset += 1
    }, 16)

    req.on('close', () => {
      clearInterval(timer)
      store.delete(streamKey)
    })
  }
}

export function createStopEndpoint(ctx: WebUiContext): RequestHandler {
  return (req, res) => {
    const sessionId = req.params.id
    const messageId = req.params.mid
    if (!sessionId || !messageId) {
      res.status(400).json({ stopped: false, error: 'session id and message id are required' })
      return
    }

    const streamKey = toStreamKey(sessionId, messageId)
    const stream = getStreamStore(ctx).get(streamKey)

    if (!stream) {
      res.status(404).json({ stopped: false, error: 'message stream not found' })
      return
    }

    stream.controller.abort()
    res.json({ stopped: true })
  }
}

export function createForkEndpoint(): RequestHandler {
  return (req, res) => {
    const fromMessageId = typeof req.body?.fromMessageId === 'string'
      ? req.body.fromMessageId
      : null

    if (!fromMessageId) {
      res.status(400).json({ error: 'fromMessageId is required' })
      return
    }

    res.status(201).json({
      sessionId: req.params.id,
      fromMessageId,
      createdAt: Date.now(),
    })
  }
}
