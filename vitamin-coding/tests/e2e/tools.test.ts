// E2E 测试 — 工具注册 + AgentSession 工具可用性
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createTestSubsystems, createTempProjectDir, cleanupTempDir } from './helpers'

describe('E2E: 工具注册与可用性', () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await createTempProjectDir()
  })

  afterEach(async () => {
    await cleanupTempDir(projectDir)
  })

  describe('#given 完整工具注册', () => {
    it('#then AgentSession 可访问所有已注册工具', async () => {
      const subsystems = await createTestSubsystems(projectDir)
      const allTools = subsystems.toolRegistry.getAll()

      // full preset 至少 26 个工具
      expect(allTools.length).toBeGreaterThanOrEqual(26)

      // 关键工具都在
      const toolNames = allTools.map(t => t.name)
      expect(toolNames).toContain('edit')
      expect(toolNames).toContain('read')
      expect(toolNames).toContain('bash')
    })
  })

  describe('#given 工具注册表完整初始化', () => {
    it('#then 工具具有正确的 schema 定义', async () => {
      const subsystems = await createTestSubsystems(projectDir)
      const allTools = subsystems.toolRegistry.getAll()

      for (const tool of allTools) {
        expect(tool.name).toBeDefined()
        expect(typeof tool.name).toBe('string')
        expect(tool.description).toBeDefined()
        expect(typeof tool.description).toBe('string')
      }
    })
  })
})
