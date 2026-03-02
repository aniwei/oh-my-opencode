import { describe, expect, it, vi } from 'vitest'

import type { AgentSession, CLIOptions, Subsystems } from '../src/types'
import { InteractiveApp } from '../src/modes/interactive/app'

import type { ConversationPage } from '../src/modes/interactive/pages/conversation-page'
import type { SessionListPage } from '../src/modes/interactive/pages/session-list-page'
import type { SettingsPage } from '../src/modes/interactive/pages/settings-page'

function createMockSession(): AgentSession {
  return {
    id: 'mock-session',
    subsystems: {} as Subsystems,
    state: {
      currentModel: 'claude-sonnet',
      totalCost: 0,
      totalTokens: { input: 0, output: 0 },
      messageCount: 0,
      isRunning: false,
    },
    prompt: async () => ({
      response: 'ok',
      cost: 0,
      tokens: { input: 0, output: 0 },
      toolCalls: [],
      duration: 0,
    }),
    listSessions: async () => [],
    switchSession: async () => undefined,
    deleteSession: async () => undefined,
    abort: () => undefined,
    getSystemPrompt: () => 'system prompt',
    switchModel: () => undefined,
    compact: async () => undefined,
    dispose: async () => undefined,
  }
}

function createOptions(): CLIOptions {
  return {
    mode: 'interactive',
    projectDir: '/tmp/project',
    verbose: false,
  }
}

function setupInteractiveApp(session: AgentSession = createMockSession()) {
  const terminalCallbacks = new Map<string, (...args: unknown[]) => void>()

  const terminal = {
    writes: [] as string[],
    rawEnabled: false,
    listening: false,
    getSize: vi.fn(() => ({ cols: 120, rows: 40 })),
    write: vi.fn((data: string) => {
      terminal.writes.push(data)
    }),
    enableRawMode: vi.fn(() => {
      terminal.rawEnabled = true
    }),
    disableRawMode: vi.fn(() => {
      terminal.rawEnabled = false
    }),
    startListening: vi.fn(() => {
      terminal.listening = true
    }),
    stopListening: vi.fn(() => {
      terminal.listening = false
    }),
    on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      terminalCallbacks.set(event, callback)
    }),
    emit: (event: string, ...args: unknown[]) => {
      const callback = terminalCallbacks.get(event)
      if (callback) {
        callback(...args)
      }
    },
  }

  const renderer = {
    resize: vi.fn(),
    getHeight: vi.fn(() => 40),
    fullRedraw: vi.fn((lines: string[]) => lines.join('\n')),
    renderFrame: vi.fn((lines: string[]) => lines.join('\n')),
  }

  const conversationPage = {
    handleInput: vi.fn(),
    resize: vi.fn(),
    render: vi.fn(() => ['Conversation']),
    setCursorVisible: vi.fn(),
  }

  const sessionListPage = {
    handleInput: vi.fn(),
    resize: vi.fn(),
    render: vi.fn(() => ['Sessions']),
  }

  const settingsPage = {
    handleInput: vi.fn(),
    resize: vi.fn(),
    render: vi.fn(() => ['Settings']),
  }

  const app = new InteractiveApp(session, createOptions(), {
    createTerminal: () => terminal as never,
    createRenderer: () => renderer as never,
    createConversationPage: (_session, _renderer, _width, _height) =>
      conversationPage as unknown as ConversationPage,
    createSessionListPage: (_session, _renderer, _width, _height) =>
      sessionListPage as unknown as SessionListPage,
    createSettingsPage: (_session, _renderer, _width, _height) =>
      settingsPage as unknown as SettingsPage,
  })

  return {
    app,
    terminal,
    renderer,
    conversationPage,
    sessionListPage,
    settingsPage,
  }
}

describe('InteractiveApp', () => {
  it('启动与退出会完整管理 terminal 生命周期', async () => {
    vi.useFakeTimers()
    const env = setupInteractiveApp()

    const startPromise = env.app.start()

    expect(env.terminal.enableRawMode).toHaveBeenCalledTimes(1)
    expect(env.terminal.startListening).toHaveBeenCalledTimes(1)
    expect(env.renderer.fullRedraw).toHaveBeenCalled()
    expect(env.renderer.fullRedraw).toHaveBeenCalledWith(expect.arrayContaining(['Conversation']))
    expect((env.renderer.fullRedraw.mock.calls[0]?.[0] as string[]).length).toBe(40)

    env.terminal.emit('data', '\x04')
    vi.advanceTimersByTime(200)
    await startPromise

    expect(env.terminal.stopListening).toHaveBeenCalledTimes(1)
    expect(env.terminal.disableRawMode).toHaveBeenCalledTimes(1)
    expect(env.terminal.writes).toContain('\x1b[?25l')
    expect(env.terminal.writes).toContain('\x1b[?25h')
    expect(env.terminal.writes).toContain('\x1b[2J')

    vi.useRealTimers()
  })

  it('全局快捷键优先于页面输入，Tab 切页不下沉到页面', async () => {
    vi.useFakeTimers()
    const env = setupInteractiveApp()

    const startPromise = env.app.start()

    env.terminal.emit('data', '\t')

    expect(env.conversationPage.handleInput).not.toHaveBeenCalled()
    expect(env.sessionListPage.render).toHaveBeenCalled()

    env.terminal.emit('data', '\x04')
    vi.advanceTimersByTime(200)
    await startPromise

    vi.useRealTimers()
  })

  it('resize 时同步 renderer 与所有页面宽度', async () => {
    vi.useFakeTimers()
    const env = setupInteractiveApp()

    const startPromise = env.app.start()

    env.renderer.getHeight = vi.fn(() => 50)
    env.terminal.emit('resize', 140, 50)

    expect(env.renderer.resize).toHaveBeenCalledWith(140, 50)
    expect(env.conversationPage.resize).toHaveBeenCalledWith(140, 50)
    expect(env.sessionListPage.resize).toHaveBeenCalledWith(140, 50)
    expect(env.settingsPage.resize).toHaveBeenCalledWith(140, 50)
    const lastCall = env.renderer.renderFrame.mock.calls.at(-1)?.[0] as string[] | undefined
    expect(lastCall?.length).toBe(50)

    env.terminal.emit('data', '\x04')
    vi.advanceTimersByTime(200)
    await startPromise

    vi.useRealTimers()
  })

  it('Ctrl+C 在 Agent 运行中触发 abort 且不立即退出', async () => {
    vi.useFakeTimers()
    const session = createMockSession()
    const abortSpy = vi.fn(() => {
      session.state.isRunning = false
    })
    session.abort = abortSpy
    session.state.isRunning = true

    const env = setupInteractiveApp(session)

    const startPromise = env.app.start()
    env.terminal.emit('data', '\x03')

    expect(abortSpy).toHaveBeenCalledTimes(1)
    expect(env.terminal.stopListening).not.toHaveBeenCalled()

    env.terminal.emit('data', '\x04')
    vi.advanceTimersByTime(200)
    await startPromise

    vi.useRealTimers()
  })
})
