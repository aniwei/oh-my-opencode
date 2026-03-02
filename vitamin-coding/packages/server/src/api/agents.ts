import { Router } from 'express'

export function createAgentsRouter(agentRegistry?: unknown): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    if (agentRegistry && typeof (agentRegistry as any).getAll === 'function') {
      const agents = (agentRegistry as { getAll(): unknown[] }).getAll()
      res.json(agents)
    } else {
      res.json([{ id: 'demo-agent', type: 'primary' }])
    }
  })

  router.get('/:id', (req, res) => {
    res.json({ id: req.params.id, type: 'primary', state: 'idle' })
  })

  // 独立的 status 端点 — 实时 Agent 运行状态
  router.get('/:id/status', (req, res) => {
    const agentId = req.params.id

    // 尝试从注册表获取实时状态
    if (agentRegistry && typeof (agentRegistry as any).getStatus === 'function') {
      const status = (agentRegistry as { getStatus(id: string): unknown }).getStatus(agentId)
      if (status) {
        res.json(status)
        return
      }
    }

    // 默认返回 idle 状态
    res.json({
      state: 'idle',
      toolCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      recentToolCalls: [],
      lastUpdatedAt: Date.now(),
    })
  })

  return router
}
