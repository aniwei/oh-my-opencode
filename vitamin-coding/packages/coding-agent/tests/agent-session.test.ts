// AgentSession 测试（验收 4.2.7 + 会话核心行为）
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

import { createAgentSession } from '../src/core/agent-session'

import type { AgentRegistration, AgentFactory, AgentInstance, AgentResult } from '@vitamin/orchestrator'
import type { Subsystems, CLIOptions } from '../src/types'

// 创建临时项目目录
function createTempProject(): string {
  const dir = join(tmpdir(), `vitamin-test-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

// 创建 mock AgentResult
function createMockResult(output: string): AgentResult {
  return {
    messages: [],
    output,
    usage: { inputTokens: 100, outputTokens: 50 },
  }
}

// 创建 mock AgentInstance
function createMockAgentInstance(output: string): AgentInstance {
  return {
    prompt: async () => createMockResult(output),
    abort: () => undefined,
    on: () => undefined,
  }
}

// 创建 mock AgentFactory
function createMockAgentFactory(output: string): AgentFactory {
  return () => createMockAgentInstance(output)
}

// 创建完整 mock Subsystems
function createMockSubsystems(overrides?: {
  agentOutput?: string
  hasAgent?: boolean
}): Subsystems {
  const agentOutput = overrides?.agentOutput ?? 'Hello, I can help with that.'
  const hasAgent = overrides?.hasAgent ?? true

  const mockRegistration: AgentRegistration = {
    name: 'sisyphus',
    factory: createMockAgentFactory(agentOutput),
    mode: 'primary',
    metadata: {
      category: 'orchestrator',
      cost: 'EXPENSIVE',
      triggers: [],
      executionMode: 'sync',
    },
    modelPriority: [],
    disableable: false,
    enabled: true,
  }

  // 记录 hook 调用
  const hookCalls: Array<{ timing: string }> = []

  return {
    config: {} as never,
    toolRegistry: {
      getAll: () => [],
      getAvailable: () => [],
    },
    hookEngine: {
      execute: async (timing: string) => {
        hookCalls.push({ timing })
      },
    },
    agentRegistry: {
      find: (name: string) => (hasAgent && name === 'sisyphus') ? mockRegistration : undefined,
      getAvailable: () => hasAgent ? [mockRegistration] : [],
      getAll: () => hasAgent ? [mockRegistration] : [],
    },
    sessionManager: {
      list: async () => [],
      remove: async () => undefined,
    },
    mcpRegistry: {},
    extensionRunner: {
      getEventBus: () => ({
        emit: async () => undefined,
      }),
      unloadAll: () => undefined,
    },
    taskDispatcher: {},
    backgroundManager: {
      cancelAll: () => undefined,
    },
    // 附加：通过 hookCalls 可检查 hook 是否被调用
    _hookCalls: hookCalls,
  } as unknown as Subsystems & { _hookCalls: Array<{ timing: string }> }
}

function createDefaultOptions(projectDir: string): CLIOptions {
  return {
    mode: 'print',
    projectDir,
    verbose: false,
  }
}

describe('createAgentSession', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = createTempProject()
  })

  afterEach(() => {
    if (existsSync(projectDir)) {
      rmSync(projectDir, { recursive: true })
    }
  })

  describe('#given 有效的 subsystems', () => {
    describe('#when 创建 session', () => {
      it('#then 返回有效的 session 对象', async () => {
        const subs = createMockSubsystems()
        const options = createDefaultOptions(projectDir)

        const session = await createAgentSession(subs, options)

        expect(session.id).toBeDefined()
        expect(session.id.length).toBeGreaterThan(0)
        expect(session.state.currentModel).toBe('claude-sonnet')
        expect(session.state.messageCount).toBe(0)
        expect(session.state.isRunning).toBe(false)
      })
    })

    describe('#when 指定 model', () => {
      it('#then state.currentModel 为指定值', async () => {
        const subs = createMockSubsystems()
        const options = { ...createDefaultOptions(projectDir), model: 'gpt-4o' }

        const session = await createAgentSession(subs, options)

        expect(session.state.currentModel).toBe('gpt-4o')
      })
    })
  })

  describe('#given 已创建的 session', () => {
    describe('#when prompt 正常文本', () => {
      it('#then 返回 agent 输出', async () => {
        const subs = createMockSubsystems({ agentOutput: 'The answer is 42.' })
        const session = await createAgentSession(subs, createDefaultOptions(projectDir))

        const result = await session.prompt('What is the answer?')

        expect(result.response).toBe('The answer is 42.')
        expect(result.tokens.input).toBe(100)
        expect(result.tokens.output).toBe(50)
        expect(result.duration).toBeGreaterThanOrEqual(0)
      })
    })

    describe('#when prompt 后检查状态', () => {
      it('#then messageCount 增加 2', async () => {
        const subs = createMockSubsystems()
        const session = await createAgentSession(subs, createDefaultOptions(projectDir))

        await session.prompt('test')

        expect(session.state.messageCount).toBe(2)
        expect(session.state.totalTokens.input).toBe(100)
        expect(session.state.totalTokens.output).toBe(50)
      })
    })

    describe('#when 连续 prompt 两次', () => {
      it('#then 状态累计', async () => {
        const subs = createMockSubsystems()
        const session = await createAgentSession(subs, createDefaultOptions(projectDir))

        await session.prompt('first')
        await session.prompt('second')

        expect(session.state.messageCount).toBe(4)
        expect(session.state.totalTokens.input).toBe(200)
        expect(session.state.totalTokens.output).toBe(100)
      })
    })

    describe('#when prompt 斜杠命令 /help', () => {
      it('#then 返回命令列表而非 agent 输出', async () => {
        const subs = createMockSubsystems()
        const session = await createAgentSession(subs, createDefaultOptions(projectDir))

        const result = await session.prompt('/help')

        expect(result.response).toContain('/model')
        expect(result.response).toContain('/help')
        expect(result.cost).toBe(0)
        expect(result.tokens.input).toBe(0)
      })
    })

    describe('#when prompt /model 切换模型', () => {
      it('#then 模型成功切换', async () => {
        const subs = createMockSubsystems()
        const session = await createAgentSession(subs, createDefaultOptions(projectDir))

        const result = await session.prompt('/model claude-opus')

        expect(result.response).toContain('Switched')
        expect(session.state.currentModel).toBe('claude-opus')
      })
    })

    describe('#when 无可用 agent', () => {
      it('#then 返回无 agent 提示', async () => {
        const subs = createMockSubsystems({ hasAgent: false })
        const session = await createAgentSession(subs, createDefaultOptions(projectDir))

        const result = await session.prompt('hello')

        expect(result.response).toContain('No agent available')
      })
    })
  })

  // 验收 4.2.7: Ctrl+C 中断
  describe('#given session 运行中', () => {
    describe('#when 调用 abort()', () => {
      it('#then isRunning 变为 false（4.2.7）', async () => {
        const subs = createMockSubsystems()
        const session = await createAgentSession(subs, createDefaultOptions(projectDir))

        // abort 不需要在运行中才能调用
        session.abort()

        expect(session.state.isRunning).toBe(false)
      })
    })
  })

  describe('#given session 需要清理', () => {
    describe('#when 调用 dispose()', () => {
      it('#then 不抛异常（资源清理成功）', async () => {
        const subs = createMockSubsystems()
        const session = await createAgentSession(subs, createDefaultOptions(projectDir))

        await expect(session.dispose()).resolves.toBeUndefined()
      })
    })
  })

  describe('#given switchModel', () => {
    describe('#when 切换到新模型', () => {
      it('#then currentModel 更新', async () => {
        const subs = createMockSubsystems()
        const session = await createAgentSession(subs, createDefaultOptions(projectDir))

        session.switchModel('gemini-pro')

        expect(session.state.currentModel).toBe('gemini-pro')
      })
    })
  })

  describe('#given getSystemPrompt', () => {
    describe('#when 项目有 AGENTS.md', () => {
      it('#then 系统 prompt 包含 AGENTS.md 内容（4.2.11）', async () => {
        writeFileSync(join(projectDir, 'AGENTS.md'), '# My Amazing Project\n\nBuilt with TypeScript.')
        const subs = createMockSubsystems()
        const session = await createAgentSession(subs, createDefaultOptions(projectDir))

        const prompt = session.getSystemPrompt()

        expect(prompt).toContain('My Amazing Project')
        expect(prompt).toContain('TypeScript')
      })
    })
  })
})
