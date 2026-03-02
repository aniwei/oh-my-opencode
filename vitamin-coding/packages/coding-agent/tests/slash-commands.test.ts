// 斜杠命令测试（验收 4.2.4, 4.2.5, 4.2.6）
import {
  BUILTIN_COMMANDS,
  type SlashCommandRegistry,
  createSlashCommandRegistry,
  parseSlashCommand,
} from '../src/core/slash-commands'

import type { AgentSession, AgentSessionState, Subsystems } from '../src/types'

interface MockSession extends AgentSession {
  _switchCalls: string[]
  _deleteCalls: string[]
}

// 创建最小化 mock session
function createMockSession(overrides?: Partial<AgentSessionState>): MockSession {
  const state: AgentSessionState = {
    currentModel: 'claude-sonnet',
    totalCost: 0.125,
    totalTokens: { input: 5000, output: 2000 },
    messageCount: 10,
    isRunning: false,
    ...overrides,
  }

  const switchCalls: string[] = []
  const deleteCalls: string[] = []

  return {
    id: 's-1',
    subsystems: createMockSubsystems(),
    state,
    prompt: async () => ({
      response: '',
      cost: 0,
      tokens: { input: 0, output: 0 },
      toolCalls: [],
      duration: 0,
    }),
    abort: () => undefined,
    listSessions: async () => [
      { id: 's-1', title: '会话一', createdAt: 1000, updatedAt: 2000, messageCount: 5, tags: [] },
      { id: 's-2', title: '会话二', createdAt: 1500, updatedAt: 2500, messageCount: 3, tags: [] },
      { id: 's-3', title: '会话三', createdAt: 2000, updatedAt: 3000, messageCount: 8, tags: [] },
    ],
    switchSession: async (sessionId: string) => {
      if (!['s-1', 's-2', 's-3'].includes(sessionId)) {
        throw new Error('not found')
      }
      switchCalls.push(sessionId)
    },
    deleteSession: async (sessionId: string) => {
      if (!['s-2', 's-3'].includes(sessionId)) {
        throw new Error('Cannot delete active session')
      }
      deleteCalls.push(sessionId)
    },
    getSystemPrompt: () => 'test prompt',
    switchModel: (m) => {
      state.currentModel = m
    },
    compact: async () => undefined,
    dispose: async () => undefined,
    _switchCalls: switchCalls,
    _deleteCalls: deleteCalls,
  }
}

// 创建 mock subsystems（仅 sessionManager 的 list/remove 被用到）
function createMockSubsystems(): Subsystems {
  const sessionList = [
    { id: 's-1', title: '会话一', createdAt: 1000, updatedAt: 2000, messageCount: 5, tags: [] },
    { id: 's-2', title: '会话二', createdAt: 1500, updatedAt: 2500, messageCount: 3, tags: [] },
    { id: 's-3', title: '会话三', createdAt: 2000, updatedAt: 3000, messageCount: 8, tags: [] },
  ]

  return {
    sessionManager: {
      list: async () => sessionList,
      remove: async () => undefined,
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
  describe('#given 11 个内置命令', () => {
    it('#then BUILTIN_COMMANDS 包含 model/clear/compact/session/export/init/undo/redo/share/help/cost', () => {
      const names = BUILTIN_COMMANDS.map((c) => c.name)

      expect(names).toContain('model')
      expect(names).toContain('clear')
      expect(names).toContain('compact')
      expect(names).toContain('session')
      expect(names).toContain('export')
      expect(names).toContain('init')
      expect(names).toContain('undo')
      expect(names).toContain('redo')
      expect(names).toContain('share')
      expect(names).toContain('help')
      expect(names).toContain('cost')
      expect(names).toHaveLength(11)
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

        expect(result).toContain('未知命令')
        expect(result).toContain('/help')
      })
    })

    // 验收 4.2.4: /model 运行时切换模型
    describe('#when /model claude-opus', () => {
      it('#then 切换模型并确认（4.2.4）', async () => {
        const session = createMockSession()
        const result = await registry.execute('/model claude-opus', session)

        expect(result).toContain('已切换到模型')
        expect(result).toContain('claude-opus')
        expect(session.state.currentModel).toBe('claude-opus')
      })
    })

    describe('#when /model 无参数', () => {
      it('#then 显示当前模型', async () => {
        const session = createMockSession()
        const result = await registry.execute('/model', session)

        expect(result).toContain('当前模型')
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
        expect(result).toContain('[active]')
      })
    })

    describe('#when /session switch s-2', () => {
      it('#then 触发真实切换调用', async () => {
        const session = createMockSession()
        const result = await registry.execute('/session switch s-2', session)

        expect(result).toContain('已切换到会话')
        expect(session._switchCalls).toEqual(['s-2'])
      })
    })

    describe('#when /session switch 不存在会话', () => {
      it('#then 返回会话不存在提示', async () => {
        const session = createMockSession()
        const result = await registry.execute('/session switch s-404', session)

        expect(result).toContain('会话不存在')
      })
    })

    describe('#when /session delete s-2', () => {
      it('#then 返回删除确认', async () => {
        const session = createMockSession()
        const result = await registry.execute('/session delete s-2', session)

        expect(result).toContain('s-2')
        expect(result).toContain('已删除')
        expect(session._deleteCalls).toEqual(['s-2'])
      })
    })

    describe('#when /session delete 当前会话', () => {
      it('#then 返回不能删除当前会话提示', async () => {
        const session = createMockSession()
        const result = await registry.execute('/session delete s-1', session)

        expect(result).toContain('不能删除当前会话')
      })
    })

    // 验收 4.2.6: /compact 手动触发压缩
    describe('#when /compact', () => {
      it('#then 触发会话压缩并确认（4.2.6）', async () => {
        let compactCalled = false
        const session = createMockSession()
        session.compact = async () => {
          compactCalled = true
        }

        const result = await registry.execute('/compact', session)

        expect(result).toContain('会话已压缩')
        expect(compactCalled).toBe(true)
      })
    })

    describe('#when /clear', () => {
      it('#then 返回清除确认', async () => {
        const session = createMockSession()
        const result = await registry.execute('/clear', session)

        expect(result).toContain('已清空')
      })
    })

    describe('#when /init', () => {
      it('#then 返回初始化提示', async () => {
        const session = createMockSession()
        const result = await registry.execute('/init', session)

        expect(result).toContain('初始化向导已触发')
      })
    })

    describe('#when /undo', () => {
      it('#then 返回撤销提示', async () => {
        const session = createMockSession()
        const result = await registry.execute('/undo', session)

        expect(result).toContain('已撤销上一条消息')
      })
    })

    describe('#when /redo', () => {
      it('#then 返回重做提示', async () => {
        const session = createMockSession()
        const result = await registry.execute('/redo', session)

        expect(result).toContain('已重做上一条撤销操作')
      })
    })

    describe('#when /share', () => {
      it('#then 返回分享提示', async () => {
        const session = createMockSession()
        const result = await registry.execute('/share', session)

        expect(result).toContain('分享已创建')
      })
    })

    describe('#when /cost', () => {
      it('#then 显示累计费用和 token 统计', async () => {
        const session = createMockSession()
        const result = await registry.execute('/cost', session)

        expect(result).toContain('总成本')
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
        expect(result).toContain('/init')
        expect(result).toContain('/undo')
        expect(result).toContain('/redo')
        expect(result).toContain('/share')
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
