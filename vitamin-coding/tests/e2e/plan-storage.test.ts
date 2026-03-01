// E2E 测试 — PlanStorage CRUD + DAG 引擎 + Markdown 序列化
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  createPlanStorage,
  buildDag,
  getReadyNodes,
  isDagFinished,
  getDagProgress,
  collectDagResult,
  planToMarkdown,
  markdownToPlan,
} from '@vitamin/orchestrator'

import { createTempProjectDir, cleanupTempDir } from './helpers'

describe('E2E: Plan 存储与 DAG', () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await createTempProjectDir()
  })

  afterEach(async () => {
    await cleanupTempDir(projectDir)
  })

  // ─── PlanStorage CRUD ───
  describe('#given PlanStorage 存储系统', () => {
    it('#then 计划的创建、读取、列出、删除全流程', async () => {
      const storage = createPlanStorage(projectDir)

      const plan = {
        name: 'auth-refactor',
        title: '认证重构',
        description: '重构认证系统',
        steps: [
          { id: 's1', title: '分析', description: '分析现有代码', dependencies: [], estimatedMinutes: 5, status: 'pending' as const },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      }

      // 保存
      const planPath = await storage.save(plan)
      expect(planPath).toContain('auth-refactor')

      // 读取
      const loaded = await storage.load('auth-refactor')
      expect(loaded).toBeDefined()
      expect(loaded?.name).toBe('auth-refactor')

      // 列出
      const list = await storage.list()
      expect(list).toContain('auth-refactor')

      // 更新
      plan.steps[0]!.status = 'completed' as never
      await storage.update(plan)
      const updated = await storage.load('auth-refactor')
      expect(updated).toBeDefined()

      // 删除
      const removed = await storage.remove('auth-refactor')
      expect(removed).toBe(true)
      const afterRemove = await storage.list()
      expect(afterRemove).not.toContain('auth-refactor')
    })
  })

  // ─── DAG 执行引擎 ───
  describe('#given DAG 执行引擎', () => {
    it('#then 正确计算拓扑顺序和进度', () => {
      const steps = [
        { id: 'a', title: 'A', description: '', dependencies: [], estimatedMinutes: 1, status: 'pending' as const },
        { id: 'b', title: 'B', description: '', dependencies: ['a'], estimatedMinutes: 1, status: 'pending' as const },
        { id: 'c', title: 'C', description: '', dependencies: ['a'], estimatedMinutes: 1, status: 'pending' as const },
        { id: 'd', title: 'D', description: '', dependencies: ['b', 'c'], estimatedMinutes: 1, status: 'pending' as const },
      ]

      const dag = buildDag(steps)

      // 初始只有 A 就绪
      const ready1 = getReadyNodes(dag)
      expect(ready1.length).toBe(1)
      expect(ready1[0]?.step.id).toBe('a')

      // A 完成后 B、C 就绪
      const nodeA = dag.get('a')!
      nodeA.status = 'completed'
      const ready2 = getReadyNodes(dag)
      expect(ready2.length).toBe(2)
      expect(ready2.map(n => n.step.id).sort()).toEqual(['b', 'c'])

      // B、C 完成后 D 就绪
      dag.get('b')!.status = 'completed'
      dag.get('c')!.status = 'completed'
      const ready3 = getReadyNodes(dag)
      expect(ready3.length).toBe(1)
      expect(ready3[0]?.step.id).toBe('d')

      // D 完成后 DAG 结束
      dag.get('d')!.status = 'completed'
      expect(isDagFinished(dag)).toBe(true)
      expect(getDagProgress(dag)).toBe(100)

      const result = collectDagResult(dag)
      expect(result.completed.length).toBe(4)
      expect(result.failed.length).toBe(0)
      expect(result.allSuccessful).toBe(true)
    })
  })

  // ─── Plan Markdown 序列化 ───
  describe('#given Plan Markdown 格式', () => {
    it('#then 序列化和反序列化保持一致性', () => {
      const plan = {
        name: 'test-plan',
        title: '测试计划',
        description: '序列化测试',
        steps: [
          { id: 'step-1', title: 'First', description: '第一步', dependencies: [], estimatedMinutes: 5, status: 'pending' as const },
          { id: 'step-2', title: 'Second', description: '第二步', dependencies: ['step-1'], estimatedMinutes: 10, status: 'completed' as const },
        ],
        createdAt: 1000000,
        updatedAt: 2000000,
        metadata: {},
      }

      const markdown = planToMarkdown(plan)
      expect(markdown).toContain('测试计划')
      expect(markdown).toContain('First')
      expect(markdown).toContain('Second')

      const restored = markdownToPlan('test-plan', markdown)
      expect(restored.name).toBe('test-plan')
      expect(restored.steps.length).toBe(2)
    })
  })
})
