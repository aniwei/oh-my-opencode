// Skill MCP 管理器测试
import { describe, expect, it } from 'vitest'

import { createSkillMcpManager } from '../src/skill-mcp-manager'

describe('SkillMcpManager', () => {
  describe('#given 创建了管理器', () => {
    describe('#when 初始状态', () => {
      it('#then 没有活跃实例', () => {
        const manager = createSkillMcpManager()
        expect(manager.size).toBe(0)
      })
    })

    describe('#when 检查不存在的 Skill', () => {
      it('#then isAvailable 返回 false', () => {
        const manager = createSkillMcpManager()
        expect(manager.isAvailable('nonexistent')).toBe(false)
      })
    })

    describe('#when 获取不存在 Skill 的工具', () => {
      it('#then 返回空数组', () => {
        const manager = createSkillMcpManager()
        expect(manager.getTools('nonexistent')).toEqual([])
      })
    })

    describe('#when 停止不存在的 Skill', () => {
      it('#then 静默处理不抛出', async () => {
        const manager = createSkillMcpManager()
        await manager.stop('nonexistent')
        expect(manager.size).toBe(0)
      })
    })

    describe('#when 重启不存在的 Skill', () => {
      it('#then 返回 false', async () => {
        const manager = createSkillMcpManager()
        const result = await manager.restart('nonexistent')
        expect(result).toBe(false)
      })
    })

    describe('#when 停止所有', () => {
      it('#then 不抛出', async () => {
        const manager = createSkillMcpManager()
        await manager.stopAll()
        expect(manager.size).toBe(0)
      })
    })
  })
})
