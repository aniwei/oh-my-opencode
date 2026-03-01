// E2E 测试 — Plan Pipeline (Metis → Prometheus → Momus)
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createPlanStorage, executePlanPipeline } from '@vitamin/orchestrator'

import { createTestSubsystems, createTempProjectDir, cleanupTempDir, createStubAgentFactory } from './helpers'

describe('E2E: Plan Pipeline', () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await createTempProjectDir()
  })

  afterEach(async () => {
    await cleanupTempDir(projectDir)
  })

  describe('#given Plan Pipeline 完整流程', () => {
    it('#then 三阶段管线生成并通过审批', async () => {
      const subsystems = await createTestSubsystems(projectDir)

      // Metis
      subsystems.agentRegistry.register({
        name: 'metis',
        factory: createStubAgentFactory(() => '预分析: 这是一个中等复杂度的重构任务'),
        mode: 'subagent',
        metadata: { category: 'advisor', cost: 'CHEAP', triggers: [], executionMode: 'sync' },
        modelPriority: ['test-model'],
        disableable: true,
        enabled: true,
      })

      // Prometheus
      subsystems.agentRegistry.register({
        name: 'prometheus',
        factory: createStubAgentFactory(() =>
          '# 重构计划\n\n## Steps\n\n- [ ] Step 1: 分析现有代码\n- [ ] Step 2: 编写测试\n- [ ] Step 3: 重构实现',
        ),
        mode: 'subagent',
        metadata: { category: 'advisor', cost: 'EXPENSIVE', triggers: [], executionMode: 'sync' },
        modelPriority: ['test-model'],
        disableable: true,
        enabled: true,
      })

      // Momus
      subsystems.agentRegistry.register({
        name: 'momus',
        factory: createStubAgentFactory(() => '[OKAY] 计划合理，可以执行'),
        mode: 'subagent',
        metadata: { category: 'advisor', cost: 'CHEAP', triggers: [], executionMode: 'sync' },
        modelPriority: ['test-model'],
        disableable: true,
        enabled: true,
      })

      const storage = createPlanStorage(projectDir)

      const result = await executePlanPipeline('重构认证系统', {
        dispatcher: subsystems.taskDispatcher,
        storage,
        maxRevisions: 2,
      })

      expect(result.success).toBe(true)
      expect(result.plan).toBeDefined()
      expect(result.planPath).toBeDefined()
      expect(result.phases).toContain('metis')
      expect(result.phases).toContain('prometheus')
      expect(result.phases).toContain('momus')
      expect(result.phases).toContain('completed')

      // 计划已保存到磁盘
      const plans = await storage.list()
      expect(plans.length).toBeGreaterThanOrEqual(1)
    })
  })
})
