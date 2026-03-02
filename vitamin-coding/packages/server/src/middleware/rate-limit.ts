import type { NextFunction, Request, Response } from 'express'

// A simple sliding window rate limiter
const requests = new Map<string, number[]>()

export function rateLimit(windowMs: number, maxRequests: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    const now = Date.now()

    if (!requests.has(ip)) {
      requests.set(ip, [])
    }

    // Evict old timestamps
    const timestamps = requests.get(ip) || []
    const windowStart = now - windowMs
    const recent = timestamps.filter((ts) => ts > windowStart)

    if (recent.length >= maxRequests) {
      res.status(429).json({ error: 'Too many requests' })
      return
    }

    recent.push(now)
    requests.set(ip, recent)

    next()
  }
}
