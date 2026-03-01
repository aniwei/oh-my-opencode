// E2E 测试 — 多 Agent 委派 (TaskDispatcher)
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createTestSubsystems, createTempProjectDir, cleanupTempDir, createStubAgentFactory } from './helpers'

describe('E2E: 多 Agent 委派', () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await createTempProjectDir()
  })

  afterEach(async () => {
    await cleanupTempDir(projectDir)
  })

  describe('#given 多个 Agent 注册到编排引擎', () => {
    it('#then TaskDispatcher 能委派到正确的 subagent', async () => {
      const subsystems = await createTestSubsystems(projectDir)

      subsystems.agentRegistry.register({
        name: 'explore',
        factory: createStubAgentFactory(() => '探索结果: 找到 3 个相关文件'),
        mode: 'subagent',
        metadata: {
          category: 'exploration',
          cost: 'CHEAP',
          triggers: [{ domain: 'codebase', trigger: 'explore' }],
          executionMode: 'sync',
        },
        modelPriority: ['test-model'],
        disableable: true,
        enabled: true,
      })

      const handle = await subsystems.taskDispatcher.dispatch({
        prompt: '搜索认证相关代码',
        subagent: 'explore',
        mode: 'sync',
      })

      const result = await handle.getResult()
      expect(result.output).toContain('探索结果')
      expect(result.usage.inputTokens).toBe(100)
    })
  })

  describe('#given 后台任务支持', () => {
    it('#then 可异步提交并获取结果', async () => {
      const subsystems = await createTestSubsystems(projectDir)

      subsystems.agentRegistry.register({
        name: 'librarian',
        factory: createStubAgentFactory(() => '索引: 找到 42 个符号'),
        mode: 'subagent',
        metadata: {
          category: 'exploration',
          cost: 'CHEAP',
          triggers: [{ domain: 'codebase', trigger: 'index' }],
          executionMode: 'sync',
        },
        modelPriority: ['test-model'],
        disableable: true,
        enabled: true,
      })

      const handle = await subsystems.taskDispatcher.dispatch({
        prompt: '索引项目中所有导出符号',
        subagent: 'librarian',
        mode: 'sync',
      })

      const result = await handle.getResult()
      expect(result.output).toContain('索引')
      expect(result.usage.outputTokens).toBe(50)
    })
  })
})
