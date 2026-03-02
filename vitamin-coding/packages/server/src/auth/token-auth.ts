import type { NextFunction, Request, RequestHandler, Response } from 'express'

export interface TokenAuthOptions {
  enabled?: boolean
  token?: string
}

function resolveExpectedToken(options: TokenAuthOptions): string | undefined {
  if (options.token) {
    return options.token
  }

  return process.env.VITAMIN_WEB_UI_TOKEN
}

function parseBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null
  }

  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}

export function createTokenAuthMiddleware(options: TokenAuthOptions = {}): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (options.enabled === false) {
      next()
      return
    }

    const expectedToken = resolveExpectedToken(options)
    if (!expectedToken) {
      next()
      return
    }

    const actualToken = parseBearerToken(req.headers.authorization)
    if (!actualToken || actualToken !== expectedToken) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    next()
  }
}
