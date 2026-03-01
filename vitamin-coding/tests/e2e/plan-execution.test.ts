// E2E 测试 — Plan 执行 (Atlas DAG)
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createPlanStorage, executePlan } from '@vitamin/orchestrator'

import { createTestSubsystems, createTempProjectDir, cleanupTempDir, createStubAgentFactory } from './helpers'

describe('E2E: Plan 执行引擎', () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await createTempProjectDir()
  })

  afterEach(async () => {
    await cleanupTempDir(projectDir)
  })

  describe('#given Plan 执行引擎', () => {
    it('#then DAG 按拓扑顺序并行执行步骤', async () => {
      const subsystems = await createTestSubsystems(projectDir)

      // 注册用于执行步骤的 agent
      subsystems.agentRegistry.register({
        name: 'sisyphus-junior',
        factory: createStubAgentFactory((prompt) => `完成: ${prompt.slice(0, 50)}`),
        mode: 'subagent',
        metadata: { category: 'specialist', cost: 'MODERATE', triggers: [], executionMode: 'sync' },
        modelPriority: ['test-model'],
        disableable: true,
        enabled: true,
      })

      const storage = createPlanStorage(projectDir)
      const plan = {
        name: 'test-plan',
        title: '测试计划',
        description: '用于 E2E 测试的计划',
        steps: [
          { id: 'step-1', title: '分析代码', description: '分析现有代码结构', dependencies: [], estimatedMinutes: 5, status: 'pending' as const },
          { id: 'step-2', title: '编写测试', description: '编写单元测试', dependencies: ['step-1'], estimatedMinutes: 10, status: 'pending' as const },
          { id: 'step-3', title: '重构实现', description: '执行代码重构', dependencies: ['step-1'], estimatedMinutes: 15, status: 'pending' as const },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      }

      await storage.save(plan)

      const events: string[] = []
      const result = await executePlan(plan, {
        dispatcher: subsystems.taskDispatcher,
        storage,
        maxConcurrency: 2,
        onProgress: (event) => {
          events.push(`${event.type}:${event.stepId}`)
        },
      })

      // 所有步骤完成
      expect(result.dagResult.completed.length).toBe(3)
      expect(result.dagResult.failed.length).toBe(0)
      expect(result.dagResult.allSuccessful).toBe(true)
      expect(result.totalTime).toBeGreaterThanOrEqual(0)

      // 进度事件已触发
      expect(events.some(e => e.startsWith('step-start'))).toBe(true)
      expect(events.some(e => e.startsWith('step-complete'))).toBe(true)
    })
  })
})
