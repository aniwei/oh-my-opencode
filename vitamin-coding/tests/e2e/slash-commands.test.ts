// E2E 测试 — Slash 命令集成
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createAgentSession } from '@vitamin/coding-agent'

import { createTestSubsystems, createTempProjectDir, cleanupTempDir, registerStubSisyphus } from './helpers'

describe('E2E: Slash 命令', () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await createTempProjectDir()
  })

  afterEach(async () => {
    await cleanupTempDir(projectDir)
  })

  describe('#given AgentSession 支持 Slash 命令', () => {
    it('#then /model 命令可切换模型', async () => {
      const subsystems = await createTestSubsystems(projectDir)
      registerStubSisyphus(subsystems)

      const session = await createAgentSession(subsystems, {
        mode: 'print',
        projectDir,
        verbose: false,
      })

      const result = await session.prompt('/model gpt-4o')
      // Slash 命令应返回命令结果而非空
      expect(typeof result.response).toBe('string')
      // token 消耗为 0（slash 命令不发给 LLM）
      expect(result.tokens.input).toBe(0)
      expect(result.tokens.output).toBe(0)

      await session.dispose()
    })
  })

  describe('#given 未知的 Slash 命令', () => {
    it('#then 返回错误提示信息', async () => {
      const subsystems = await createTestSubsystems(projectDir)
      registerStubSisyphus(subsystems)

      const session = await createAgentSession(subsystems, {
        mode: 'print',
        projectDir,
        verbose: false,
      })

      const result = await session.prompt('/unknown-command')
      expect(typeof result.response).toBe('string')
      expect(result.tokens.input).toBe(0)

      await session.dispose()
    })
  })
})
