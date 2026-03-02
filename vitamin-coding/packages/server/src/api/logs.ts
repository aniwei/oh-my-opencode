import type { Request, Response } from 'express'
import { createLogger } from '@vitamin/shared'
import type { LogBroadcastHub, LogEvent, LogFilter } from '../log-broadcast-hub'

const logger = createLogger('server:api:logs')

export function createLogReplayRoute(hub: LogBroadcastHub) {
  return (req: Request, res: Response) => {
    const sessionId = req.query.session as string | undefined
    const since = req.query.since ? Number.parseInt(req.query.since as string, 10) : undefined
    const filter: LogFilter = {}
    if (sessionId) filter.sessionId = sessionId

    // Additional filters if needed
    if (req.query.level) filter.minLevel = req.query.level as LogFilter['minLevel']
    if (req.query.sources) {
      filter.sources = (req.query.sources as string).split(',') as LogEvent['source'][]
    }

    // Using matchesFilter which will be exported from log-broadcast-hub.ts
    const logs = hub.getRecentLogs(filter, Number.isNaN(since) ? undefined : since)
    res.json(logs)
  }
}

export function createLogStreamRoute(hub: LogBroadcastHub) {
  return async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string | undefined
    const userId = (req as unknown as { user?: { id: string } }).user?.id // Mock
    const minLevel = (req.query.level as string) ?? 'info'
    const sources = req.query.sources
      ? ((req.query.sources as string).split(',') as LogEvent['source'][])
      : undefined

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    const subscription = hub.subscribe({
      sessionId,
      userId,
      minLevel: minLevel as LogFilter['minLevel'],
      sources,
    })

    res.on('close', () => {
      subscription.close()
    })

    try {
      for await (const event of subscription) {
        res.write(`event: log\ndata: ${JSON.stringify(event)}\n\n`)
      }
    } catch (err) {
      logger.error({ err }, 'SSE stream error')
      res.end()
    }
  }
}
