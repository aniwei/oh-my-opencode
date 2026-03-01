// E2E 测试 — Session 生命周期
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createAgentSession } from '@vitamin/coding-agent'

import { createTestSubsystems, createTempProjectDir, cleanupTempDir, registerStubSisyphus } from './helpers'

describe('E2E: Session 生命周期', () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await createTempProjectDir()
  })

  afterEach(async () => {
    await cleanupTempDir(projectDir)
  })

  describe('#given Session 完整生命周期', () => {
    it('#then 创建、对话、切换模型、释放全流程正常', async () => {
      const subsystems = await createTestSubsystems(projectDir)
      registerStubSisyphus(subsystems, '回复')

      const session = await createAgentSession(subsystems, {
        mode: 'print',
        projectDir,
        verbose: false,
      })

      // 初始状态
      expect(session.id).toBeDefined()
      expect(session.state.isRunning).toBe(false)
      expect(session.state.messageCount).toBe(0)

      // 第一次对话
      await session.prompt('hello')
      expect(session.state.messageCount).toBe(2)

      // 第二次对话
      await session.prompt('world')
      expect(session.state.messageCount).toBe(4)

      // 切换模型
      session.switchModel('gpt-4')
      expect(session.state.currentModel).toBe('gpt-4')

      // 获取系统 Prompt
      const sysPrompt = session.getSystemPrompt()
      expect(typeof sysPrompt).toBe('string')

      // 释放
      await session.dispose()
    })
  })

  describe('#given 多会话并行管理', () => {
    it('#then 多个 session 独立运行互不干扰', async () => {
      const subsystems = await createTestSubsystems(projectDir)
      registerStubSisyphus(subsystems, '回复-A')

      const sessionA = await createAgentSession(subsystems, {
        mode: 'print',
        projectDir,
        verbose: false,
      })

      const sessionB = await createAgentSession(subsystems, {
        mode: 'print',
        projectDir,
        verbose: false,
      })

      await sessionA.prompt('消息 A')
      expect(sessionA.state.messageCount).toBe(2)
      expect(sessionB.state.messageCount).toBe(0)

      await sessionB.prompt('消息 B')
      expect(sessionB.state.messageCount).toBe(2)

      expect(sessionA.id).not.toBe(sessionB.id)

      await sessionA.dispose()
      await sessionB.dispose()
    })
  })
})
