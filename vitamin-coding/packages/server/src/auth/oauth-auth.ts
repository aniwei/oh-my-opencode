import type { NextFunction, Request, RequestHandler, Response } from 'express'

export interface OAuthUser {
  id: string
  provider: 'github' | 'google'
}

type OAuthRequest = Request & { oauthUser?: OAuthUser }

export function createOAuthAuthMiddleware(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const provider = req.headers['x-oauth-provider']
    const userId = req.headers['x-oauth-user-id']

    if (
      (provider === 'github' || provider === 'google')
      && typeof userId === 'string'
      && userId.length > 0
    ) {
      ;(req as OAuthRequest).oauthUser = {
        id: userId,
        provider,
      }
    }

    next()
  }
}
