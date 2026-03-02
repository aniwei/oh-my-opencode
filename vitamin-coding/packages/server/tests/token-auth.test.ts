import { createTokenAuthMiddleware } from '../src/auth/token-auth'

import type { NextFunction, Request, Response } from 'express'

function createMockResponse() {
  let statusCode = 200
  let body: unknown

  const response = {
    status(code: number) {
      statusCode = code
      return response
    },
    json(payload: unknown) {
      body = payload
      return response
    },
  } as unknown as Response

  return {
    response,
    getStatus: () => statusCode,
    getBody: () => body,
  }
}

describe('createTokenAuthMiddleware', () => {
  describe('#given 配置 token=secret', () => {
    describe('#when 请求未携带 Authorization', () => {
      it('#then 返回 401 Unauthorized', () => {
        const middleware = createTokenAuthMiddleware({ token: 'secret' })
        const req = { headers: {} } as Request
        const { response, getStatus, getBody } = createMockResponse()
        let called = false

        middleware(req, response, (() => {
          called = true
        }) as NextFunction)

        expect(called).toBe(false)
        expect(getStatus()).toBe(401)
        expect(getBody()).toEqual({ error: 'Unauthorized' })
      })
    })

    describe('#when 携带错误 Bearer token', () => {
      it('#then 返回 401 Unauthorized', () => {
        const middleware = createTokenAuthMiddleware({ token: 'secret' })
        const req = {
          headers: { authorization: 'Bearer bad-token' },
        } as Request
        const { response, getStatus } = createMockResponse()
        let called = false

        middleware(req, response, (() => {
          called = true
        }) as NextFunction)

        expect(called).toBe(false)
        expect(getStatus()).toBe(401)
      })
    })

    describe('#when 携带正确 Bearer token', () => {
      it('#then 放行到 next', () => {
        const middleware = createTokenAuthMiddleware({ token: 'secret' })
        const req = {
          headers: { authorization: 'Bearer secret' },
        } as Request
        const { response, getStatus } = createMockResponse()
        let called = false

        middleware(req, response, (() => {
          called = true
        }) as NextFunction)

        expect(called).toBe(true)
        expect(getStatus()).toBe(200)
      })
    })
  })

  describe('#given enabled=false', () => {
    describe('#when 未携带 token', () => {
      it('#then 直接放行', () => {
        const middleware = createTokenAuthMiddleware({ enabled: false, token: 'secret' })
        const req = { headers: {} } as Request
        const { response } = createMockResponse()
        let called = false

        middleware(req, response, (() => {
          called = true
        }) as NextFunction)

        expect(called).toBe(true)
      })
    })
  })
})
