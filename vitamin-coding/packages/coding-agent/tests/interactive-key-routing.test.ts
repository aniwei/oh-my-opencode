import { createKeyBindings, sequenceToKeyId } from '../src/core/keybindings'
import { ConversationPage } from '../src/modes/interactive/pages/conversation-page'
import { SessionListPage } from '../src/modes/interactive/pages/session-list-page'
import { SettingsPage } from '../src/modes/interactive/pages/settings-page'

import type { ParsedKey } from '@vitamin/tui'
import type { AgentSession, AgentSessionResult, Subsystems } from '../src/types'

function createMockSession(): AgentSession {
  return {
    id: 'session-1',
    subsystems: {} as Subsystems,
    state: {
      currentModel: 'claude-sonnet',
      totalCost: 0,
      totalTokens: { input: 0, output: 0 },
      messageCount: 0,
      isRunning: false,
    },
    prompt: async (): Promise<AgentSessionResult> => ({
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

function key(name: string, raw: string): ParsedKey {
  return {
    name,
    raw,
    ctrl: false,
    alt: false,
    shift: false,
  }
}

describe('interactive key routing', () => {
  describe('#given key sequence mapping', () => {
    it('#then maps Tab/Shift+Tab/Ctrl+C correctly', () => {
      expect(sequenceToKeyId('\t')).toBe('tab')
      expect(sequenceToKeyId('\x1b[Z')).toBe('shift+tab')
      expect(sequenceToKeyId('\x03')).toBe('ctrl+c')
      expect(sequenceToKeyId('\x02')).toBe('ctrl+b')
    })
  })

  describe('#given key binding registry', () => {
    it('#then handles registered key and ignores missing key', async () => {
      const bindings = createKeyBindings()
      const calls: string[] = []

      bindings.register('tab', () => {
        calls.push('tab')
      })

      await expect(bindings.handle('tab')).resolves.toBe(true)
      await expect(bindings.handle('ctrl+z')).resolves.toBe(false)
      expect(calls).toEqual(['tab'])
    })
  })

  describe('#given settings page', () => {
    it('#then enter key starts edit mode', () => {
      const page = new SettingsPage(createMockSession(), { renderFrame: () => '' }, 80)

      page.handleInput(key('enter', '\r'))
      const lines = page.render()

      expect(lines.some((line) => line.includes('\x1b[4m'))).toBe(true)
    })

    it('#then accepts multi-char CJK input in edit mode', () => {
      const page = new SettingsPage(createMockSession(), { renderFrame: () => '' }, 80)

      page.handleInput(key('enter', '\r'))
      page.handleInput(key('你好', '你好'))

      const lines = page.render()
      expect(lines.some((line) => line.includes('你好'))).toBe(true)
    })

    it('#then render result matches fixed viewport height', () => {
      const page = new SettingsPage(createMockSession(), { renderFrame: () => '' }, 80, 18)

      const lines = page.render()
      expect(lines).toHaveLength(18)
    })
  })

  describe('#given session list page', () => {
    it('#then enter key is accepted without throwing', () => {
      const page = new SessionListPage(createMockSession(), { renderFrame: () => '' }, 80)

      expect(() => page.handleInput(key('enter', '\r'))).not.toThrow()
    })

    it('#then renders split layout on wide terminal', () => {
      const page = new SessionListPage(createMockSession(), { renderFrame: () => '' }, 140)

      const lines = page.render()
      expect(lines.some((line) => line.includes('Selected Session'))).toBe(true)
      expect(lines.some((line) => line.includes('Actions'))).toBe(true)
    })
  })

  describe('#given conversation page', () => {
    it('#then accepts multi-char CJK input before submit', () => {
      const page = new ConversationPage(createMockSession(), { renderFrame: () => '' }, 80)

      page.handleInput(key('中文', '中文'))

      const lines = page.render()
      expect(lines.some((line) => line.includes('中文'))).toBe(true)
    })

    it('#then renders blinking cursor in input line', () => {
      const page = new ConversationPage(createMockSession(), { renderFrame: () => '' }, 80)

      const lines = page.render()
      expect(lines.some((line) => line.includes('\x1b[7m'))).toBe(true)
      expect(lines.some((line) => line.includes('anything...'))).toBe(true)
    })

    it('#then hides cursor when cursor visibility is disabled', () => {
      const page = new ConversationPage(createMockSession(), { renderFrame: () => '' }, 80)

      page.setCursorVisible(false)

      const lines = page.render()
      expect(lines.some((line) => line.includes('\x1b[7m'))).toBe(false)
    })

    it('#then renders context sidebar on wide terminal', () => {
      const page = new ConversationPage(createMockSession(), { renderFrame: () => '' }, 140)
      const mutable = page as unknown as {
        messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>
      }
      mutable.messages = [{ role: 'user', content: 'hello', timestamp: new Date() }]

      const lines = page.render()
      expect(lines.some((line) => line.includes('Context'))).toBe(true)
      expect(lines.some((line) => line.includes('session session-'))).toBe(true)
    })

    it('#then centers message column on wide layout', () => {
      const page = new ConversationPage(createMockSession(), { renderFrame: () => '' }, 140)
      const mutable = page as unknown as {
        messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>
      }
      mutable.messages = [
        { role: 'user', content: 'center-check', timestamp: new Date() },
      ]

      const lines = page.render()
      const contentLine = lines.find((line) => line.includes('center-check')) ?? ''
      const leadingSpaces = contentLine.length - contentLine.trimStart().length
      expect(contentLine.includes('center-check')).toBe(true)
      expect(leadingSpaces).toBeGreaterThanOrEqual(4)
    })

    it('#then toggles sidebar visibility', () => {
      const page = new ConversationPage(createMockSession(), { renderFrame: () => '' }, 140)
      const mutable = page as unknown as {
        messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>
      }
      mutable.messages = [{ role: 'user', content: 'hello', timestamp: new Date() }]

      expect(page.render().some((line) => line.includes('Context'))).toBe(true)
      page.toggleSidebar()
      expect(page.render().some((line) => line.includes('Context'))).toBe(false)
      page.toggleSidebar()
      expect(page.render().some((line) => line.includes('Context'))).toBe(true)
    })

    it('#then renders opencode-like empty home view', () => {
      const page = new ConversationPage(createMockSession(), { renderFrame: () => '' }, 111, 38)

      const lines = page.render()
      expect(lines).toHaveLength(38)
      expect(lines.some((line) => line.includes('anything...'))).toBe(true)
      expect(lines.some((line) => line.includes('╹') && line.includes('▀▀▀'))).toBe(false)
      expect(lines.some((line) => line.includes('tab') && line.includes('ctrl+p'))).toBe(true)
      expect(lines.some((line) => line.includes('Tip') && line.includes('!ls -la'))).toBe(true)
      expect(lines.some((line) => line.includes('1.2.15'))).toBe(true)
    })

    it('#then keeps fullscreen height with body aligned to bottom', () => {
      const page = new ConversationPage(createMockSession(), { renderFrame: () => '' }, 80, 20)

      page.handleInput(key('a', 'a'))
      const lines = page.render()
      expect(lines).toHaveLength(20)
      expect(lines.some((line) => line.includes('输入消息…'))).toBe(false)
    })

    it('#then up/down only scroll message viewport', () => {
      const page = new ConversationPage(createMockSession(), { renderFrame: () => '' }, 80, 14)
      const mutable = page as unknown as {
        messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>
      }
      mutable.messages = Array.from({ length: 10 }, (_, i) => ({
        role: 'user',
        content: `msg-${String(i + 1)}`,
        timestamp: new Date(),
      }))

      const bottomLines = page.render()
      expect(bottomLines.some((line) => line.includes('msg-10'))).toBe(true)
      expect(bottomLines.some((line) => line.includes('msg-9'))).toBe(false)

      page.handleInput(key('up', '\x1b[A'))
      const scrolledUpLines = page.render()
      expect(scrolledUpLines.some((line) => line.includes('msg-10'))).toBe(false)
      expect(scrolledUpLines.some((line) => line.includes('msg-9'))).toBe(true)
      expect(scrolledUpLines.some((line) => line.includes('scroll ↑1'))).toBe(true)

      page.handleInput(key('down', '\x1b[B'))
      const scrolledDownLines = page.render()
      expect(scrolledDownLines.some((line) => line.includes('msg-10'))).toBe(true)
      expect(scrolledDownLines.some((line) => line.includes('scroll ↑1'))).toBe(false)
    })
  })
})
