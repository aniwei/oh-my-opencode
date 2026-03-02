import { createTokenAuthMiddleware, type TokenAuthOptions } from '../auth/token-auth'
import type { RequestHandler } from 'express'

export { createTokenAuthMiddleware }
export type { TokenAuthOptions }

export const requireAuth: RequestHandler = createTokenAuthMiddleware()
