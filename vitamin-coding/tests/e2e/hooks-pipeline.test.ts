// E2E 测试 — Hook 管线 (before → after)
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createAgentSession } from '@vitamin/coding-agent'

import { createTestSubsystems, createTempProjectDir, cleanupTempDir, registerStubSisyphus } from './helpers'

describe('E2E: Hook 管线', () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await createTempProjectDir()
  })

  afterEach(async () => {
    await cleanupTempDir(projectDir)
  })

  describe('#given Hook 管线集成', () => {
    it('#then Hook 可拦截和修改消息', async () => {
      const subsystems = await createTestSubsystems(projectDir)
      const hookLog: string[] = []

      // 注册 before hook
      subsystems.hookEngine.register({
        name: 'test-before-hook',
        timing: 'chat.message.before',
        priority: 10,
        enabled: true,
        handler: async (_input: unknown, _output: unknown) => {
          hookLog.push('before')
        },
      })

      // 注册 after hook
      subsystems.hookEngine.register({
        name: 'test-after-hook',
        timing: 'chat.message.after',
        priority: 10,
        enabled: true,
        handler: async (_input: unknown, _output: unknown) => {
          hookLog.push('after')
        },
      })

      registerStubSisyphus(subsystems)

      const session = await createAgentSession(subsystems, {
        mode: 'print',
        projectDir,
        verbose: false,
      })

      await session.prompt('测试 Hook 管线')

      expect(hookLog).toContain('before')
      expect(hookLog).toContain('after')
      expect(hookLog.indexOf('before')).toBeLessThan(hookLog.indexOf('after'))

      await session.dispose()
    })
  })

  describe('#given 多个同类型 Hook 按优先级排序', () => {
    it('#then 优先级小的 Hook 先执行', async () => {
      const subsystems = await createTestSubsystems(projectDir)
      const order: number[] = []

      subsystems.hookEngine.register({
        name: 'low-priority-hook',
        timing: 'chat.message.before',
        priority: 100,
        enabled: true,
        handler: async () => { order.push(100) },
      })

      subsystems.hookEngine.register({
        name: 'high-priority-hook',
        timing: 'chat.message.before',
        priority: 1,
        enabled: true,
        handler: async () => { order.push(1) },
      })

      registerStubSisyphus(subsystems)

      const session = await createAgentSession(subsystems, {
        mode: 'print',
        projectDir,
        verbose: false,
      })

      await session.prompt('优先级测试')

      expect(order[0]).toBe(1)
      expect(order[1]).toBe(100)

      await session.dispose()
    })
  })
})
