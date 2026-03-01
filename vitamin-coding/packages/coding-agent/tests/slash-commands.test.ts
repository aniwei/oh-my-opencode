// 斜杠命令测试（验收 4.2.4, 4.2.5, 4.2.6）
import { parseSlashCommand, SlashCommandRegistry, createSlashCommandRegistry, BUILTIN_COMMANDS } from '../src/core/slash-commands'

import type { AgentSession, AgentSessionState, Subsystems } from '../src/types'

// 创建最小化 mock session
function createMockSession(overrides?: Partial<AgentSessionState>): AgentSession {
  const state: AgentSessionState = {
    currentModel: 'claude-sonnet',
    totalCost: 0.125,
    totalTokens: { input: 5000, output: 2000 },
    messageCount: 10,
    isRunning: false,
    ...overrides,
  }

  let switchedModel: string | undefined

  return {
    id: 'test-session-id',
    subsystems: createMockSubsystems(),
    state,
    prompt: async () => ({ response: '', cost: 0, tokens: { input: 0, output: 0 }, toolCalls: [], duration: 0 }),
    abort: () => undefined,
    getSystemPrompt: () => 'test prompt',
    switchModel: (m) => { switchedModel = m; state.currentModel = m },
    compact: async () => undefined,
    dispose: async () => undefined,
  }
}

// 创建 mock subsystems（仅 sessionManager 的 list/remove 被用到）
function createMockSubsystems(): Subsystems {
  const sessionList = [
    { id: 's-1', title: '会话一', createdAt: 1000, updatedAt: 2000, messageCount: 5, tags: [] },
    { id: 's-2', title: '会话二', createdAt: 1500, updatedAt: 2500, messageCount: 3, tags: [] },
    { id: 's-3', title: '会话三', createdAt: 2000, updatedAt: 3000, messageCount: 8, tags: [] },
  ]

  const deletedIds: string[] = []

  return {
    sessionManager: {
      list: async () => sessionList,
      remove: async (id: string) => { deletedIds.push(id) },
    },
  } as unknown as Subsystems
}

describe('parseSlashCommand', () => {
  describe('#given 普通文本', () => {
    it('#then 返回 null', () => {
      expect(parseSlashCommand('hello world')).toBeNull()
    })
  })

  describe('#given 空字符串', () => {
    it('#then 返回 null', () => {
      expect(parseSlashCommand('')).toBeNull()
    })
  })

  describe('#given /model claude-opus', () => {
    it('#then 解析为 name=model, args=claude-opus', () => {
      const result = parseSlashCommand('/model claude-opus')

      expect(result).toEqual({ name: 'model', args: 'claude-opus' })
    })
  })

  describe('#given /help 无参数', () => {
    it('#then 解析为 name=help, args 为空', () => {
      const result = parseSlashCommand('/help')

      expect(result).toEqual({ name: 'help', args: '' })
    })
  })

  describe('#given 斜杠前有空格', () => {
    it('#then 正确解析', () => {
      const result = parseSlashCommand('  /compact')

      expect(result).toEqual({ name: 'compact', args: '' })
    })
  })
})

describe('SlashCommandRegistry', () => {
  describe('#given 7 个内置命令', () => {
    it('#then BUILTIN_COMMANDS 包含 model/clear/compact/session/export/help/cost', () => {
      const names = BUILTIN_COMMANDS.map(c => c.name)

      expect(names).toContain('model')
      expect(names).toContain('clear')
      expect(names).toContain('compact')
      expect(names).toContain('session')
      expect(names).toContain('export')
      expect(names).toContain('help')
      expect(names).toContain('cost')
      expect(names).toHaveLength(7)
    })
  })

  describe('#given 新的注册表', () => {
    let registry: SlashCommandRegistry

    beforeEach(() => {
      registry = createSlashCommandRegistry()
    })

    describe('#when execute 普通文本', () => {
      it('#then 返回 null（不是命令）', async () => {
        const session = createMockSession()
        const result = await registry.execute('hello world', session)

        expect(result).toBeNull()
      })
    })

    describe('#when execute 未知命令', () => {
      it('#then 返回错误提示', async () => {
        const session = createMockSession()
        const result = await registry.execute('/unknown', session)

        expect(result).toContain('Unknown command')
        expect(result).toContain('/help')
      })
    })

    // 验收 4.2.4: /model 运行时切换模型
    describe('#when /model claude-opus', () => {
      it('#then 切换模型并确认（4.2.4）', async () => {
        const session = createMockSession()
        const result = await registry.execute('/model claude-opus', session)

        expect(result).toContain('Switched')
        expect(result).toContain('claude-opus')
        expect(session.state.currentModel).toBe('claude-opus')
      })
    })

    describe('#when /model 无参数', () => {
      it('#then 显示当前模型', async () => {
        const session = createMockSession()
        const result = await registry.execute('/model', session)

        expect(result).toContain('claude-sonnet')
      })
    })

    // 验收 4.2.5: /session list 展示所有会话
    describe('#when /session list', () => {
      it('#then 返回 3 个会话的列表（4.2.5）', async () => {
        const session = createMockSession()
        const result = await registry.execute('/session list', session)

        expect(result).toContain('s-1')
        expect(result).toContain('s-2')
        expect(result).toContain('s-3')
        expect(result).toContain('会话一')
        expect(result).toContain('会话二')
        expect(result).toContain('会话三')
      })
    })

    describe('#when /session delete s-2', () => {
      it('#then 返回删除确认', async () => {
        const session = createMockSession()
        const result = await registry.execute('/session delete s-2', session)

        expect(result).toContain('s-2')
        expect(result).toContain('deleted')
      })
    })

    // 验收 4.2.6: /compact 手动触发压缩
    describe('#when /compact', () => {
      it('#then 触发会话压缩并确认（4.2.6）', async () => {
        let compactCalled = false
        const session = createMockSession()
        session.compact = async () => { compactCalled = true }

        const result = await registry.execute('/compact', session)

        expect(result).toContain('compacted')
        expect(compactCalled).toBe(true)
      })
    })

    describe('#when /clear', () => {
      it('#then 返回清除确认', async () => {
        const session = createMockSession()
        const result = await registry.execute('/clear', session)

        expect(result).toContain('cleared')
      })
    })

    describe('#when /cost', () => {
      it('#then 显示累计费用和 token 统计', async () => {
        const session = createMockSession()
        const result = await registry.execute('/cost', session)

        expect(result).toContain('0.1250')
        expect(result).toContain('5000')
        expect(result).toContain('2000')
      })
    })

    describe('#when /help', () => {
      it('#then 列出所有命令', async () => {
        const session = createMockSession()
        const result = await registry.execute('/help', session)

        expect(result).toContain('/model')
        expect(result).toContain('/clear')
        expect(result).toContain('/compact')
        expect(result).toContain('/session')
        expect(result).toContain('/help')
        expect(result).toContain('/cost')
      })
    })

    describe('#when register 自定义命令', () => {
      it('#then 新命令可用', async () => {
        registry.register({
          name: 'ping',
          description: 'Test command',
          handler: async () => 'pong',
        })

        const session = createMockSession()
        const result = await registry.execute('/ping', session)

        expect(result).toBe('pong')
      })
    })
  })
})
