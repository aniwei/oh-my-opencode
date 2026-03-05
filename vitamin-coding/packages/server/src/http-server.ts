import * as path from 'node:path'
import { existsSync } from 'node:fs'
import { type Server, createServer } from 'node:http'
import express from 'express'
import { createAgentsRouter } from './api/agents'
import { createClientConfigRouter } from './api/config-client'
import { createFilesRouter } from './api/files'
import { createLogReplayRoute, createLogStreamRoute } from './api/logs'
import { createModelsRouter } from './api/models'
import { createSessionsRouter } from './api/sessions'
import { createForkEndpoint, createMessageEndpoint, createStopEndpoint } from './api/web-ui'
import type { LogBroadcastHub } from './log-broadcast-hub'
import { createTokenAuthMiddleware, type TokenAuthOptions } from './middleware/auth'
import { rateLimit } from './middleware/rate-limit'
import { WebSocketHub } from './websocket-hub'

export interface InspectorServerOptions {
  sessionManager?: any
  agentRegistry?: any
  modelRegistry?: unknown
  fileStore?: unknown
  configProvider?: unknown
  auth?: TokenAuthOptions
  port?: number
  host?: string
  logHub: LogBroadcastHub
}

export class InspectorServer {
  private app = express()
  private httpServer: Server
  public wsHub: WebSocketHub
  public port: number

  constructor(private options: InspectorServerOptions) {
    this.port = options.port ?? 9229
    this.httpServer = createServer(this.app)
    this.wsHub = new WebSocketHub(this.httpServer)

    this.setupMiddleware()
    this.setupRoutes()
  }

  private setupMiddleware() {
    this.app.use(express.json())
    this.app.use(rateLimit(60000, 1000)) // 1000 requests per minute
    this.app.use(createTokenAuthMiddleware(this.options.auth))

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      if (req.method === 'OPTIONS') {
        res.sendStatus(200)
      } else {
        next()
      }
    })
  }

  private setupRoutes() {
    // Inspector Web UI 静态资源（内置于 dist/inspector）
    this.app.use('/', express.static(new URL('../dist/inspector', import.meta.url).pathname))
    // 健康检查接口
    this.app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok' })
    })

    // 日志回放接口
    this.app.get('/api/logs', createLogReplayRoute(this.options.logHub))

    // 日志实时流接口
    this.app.get('/api/logs/stream', createLogStreamRoute(this.options.logHub))

    // 会话和代理接口
    this.app.use('/api/sessions', createSessionsRouter(this.options.sessionManager))
    this.app.post('/api/sessions/:id/messages', createMessageEndpoint({}))
    this.app.post('/api/sessions/:id/messages/:mid/stop', createStopEndpoint({}))
    this.app.post('/api/sessions/:id/fork', createForkEndpoint())

    this.app.use('/api/agents', createAgentsRouter(this.options.agentRegistry))
    this.app.use('/api/files', createFilesRouter(this.options.fileStore))
    this.app.use('/api/models', createModelsRouter(this.options.modelRegistry))
    this.app.use('/api/config', createClientConfigRouter(this.options.configProvider))

    // Web UI 静态文件托管（检测 dist/web-ui 存在时挂载 /app）
    const webUiDistPath = path.resolve(new URL('../dist/web-ui', import.meta.url).pathname)
    if (existsSync(webUiDistPath)) {
      this.app.use('/app', express.static(webUiDistPath))
      // SPA fallback — 所有 /app 子路径回退到 index.html
      this.app.get('/app/*', (_req, res) => {
        res.sendFile(path.join(webUiDistPath, 'index.html'))
      })
    }
  }

  public async start(): Promise<void> {
    const host = this.options.host ?? '127.0.0.1'
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, host, () => resolve())
    })
  }

  public async close(): Promise<void> {
    this.wsHub.close()
    return new Promise((resolve, reject) => {
      this.httpServer.close((err) => err ? reject(err) : resolve())
    })
  }
}
