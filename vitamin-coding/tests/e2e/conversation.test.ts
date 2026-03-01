// E2E 测试 — SDK 对话全链路
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createAgentSession } from '@vitamin/coding-agent'

import { createTestSubsystems, createTempProjectDir, cleanupTempDir, createStubAgentFactory } from './helpers'

describe('E2E: SDK 对话全链路', () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await createTempProjectDir()
  })

  afterEach(async () => {
    await cleanupTempDir(projectDir)
  })

  describe('#given SDK 创建 Agent 实例', () => {
    it('#then 完整对话流程可运行', async () => {
      const subsystems = await createTestSubsystems(projectDir)

      subsystems.agentRegistry.register({
        name: 'sisyphus',
        factory: createStubAgentFactory(() => '这是一个测试回复'),
        mode: 'primary',
        metadata: {
          category: 'orchestrator',
          cost: 'MODERATE',
          triggers: [],
          executionMode: 'sync',
        },
        modelPriority: ['test-model'],
        disableable: false,
        enabled: true,
      })

      const session = await createAgentSession(subsystems, {
        mode: 'print',
        projectDir,
        verbose: false,
      })

      const result = await session.prompt('你好')

      expect(result.response).toBe('这是一个测试回复')
      expect(result.tokens.input).toBe(100)
      expect(result.tokens.output).toBe(50)
      expect(result.duration).toBeGreaterThanOrEqual(0)
      expect(session.state.messageCount).toBe(2)

      await session.dispose()
    })
  })

  describe('#given 多次连续对话', () => {
    it('#then 状态正确累积', async () => {
      const subsystems = await createTestSubsystems(projectDir)

      subsystems.agentRegistry.register({
        name: 'sisyphus',
        factory: createStubAgentFactory((msg) => `回复: ${msg}`),
        mode: 'primary',
        metadata: { category: 'orchestrator', cost: 'MODERATE', triggers: [], executionMode: 'sync' },
        modelPriority: ['test-model'],
        disableable: false,
        enabled: true,
      })

      const session = await createAgentSession(subsystems, {
        mode: 'print',
        projectDir,
        verbose: false,
      })

      await session.prompt('第一条')
      await session.prompt('第二条')
      await session.prompt('第三条')

      expect(session.state.messageCount).toBe(6)
      expect(session.state.totalTokens.input).toBe(300)
      expect(session.state.totalTokens.output).toBe(150)

      await session.dispose()
    })
  })
})
