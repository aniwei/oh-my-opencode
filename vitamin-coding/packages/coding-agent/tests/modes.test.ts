// Print/JSON 模式测试（验收 4.2.1, 4.2.3）
import type { AgentSession, AgentSessionResult, CLIOptions, Subsystems } from '../src/types'

import { createJsonMode } from '../src/modes/json'
import { createPrintMode } from '../src/modes/print'

// 创建 mock session
function createMockSession(promptResponse: AgentSessionResult): AgentSession {
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
    prompt: async () => promptResponse,
    abort: () => undefined,
    getSystemPrompt: () => 'system prompt',
    switchModel: () => undefined,
    compact: async () => undefined,
    dispose: async () => undefined,
  }
}

function createDefaultOptions(prompt?: string): CLIOptions {
  return {
    mode: prompt ? 'print' : 'interactive',
    projectDir: '/tmp/test',
    verbose: false,
    prompt,
  }
}

// 捕获 stdout/stderr 输出
function captureOutput(): { stdout: string[]; stderr: string[]; restore: () => void } {
  const stdout: string[] = []
  const stderr: string[] = []

  const origWrite = process.stdout.write.bind(process.stdout)
  const origError = process.stderr.write.bind(process.stderr)

  process.stdout.write = (chunk: string | Uint8Array) => {
    stdout.push(String(chunk))
    return true
  }

  process.stderr.write = (chunk: string | Uint8Array) => {
    stderr.push(String(chunk))
    return true
  }

  return {
    stdout,
    stderr,
    restore: () => {
      process.stdout.write = origWrite
      process.stderr.write = origError
    },
  }
}

describe('createPrintMode', () => {
  // 验收 4.2.1: `vitamin "Fix the bug"` 非交互模式完成对话
  describe('#given print 模式', () => {
    describe('#when 提供 prompt', () => {
      it('#then 输出响应到 stdout（4.2.1）', async () => {
        const result: AgentSessionResult = {
          response: 'I found and fixed the bug in line 42.',
          cost: 0.005,
          tokens: { input: 500, output: 200 },
          toolCalls: [],
          duration: 1500,
        }
        const session = createMockSession(result)
        const options = createDefaultOptions('Fix the bug')
        const mode = createPrintMode()

        const output = captureOutput()
        try {
          await mode.run(session, options)
        } finally {
          output.restore()
        }

        const stdoutText = output.stdout.join('')
        expect(stdoutText).toContain('I found and fixed the bug in line 42.')
      })
    })

    describe('#when 有费用信息', () => {
      it('#then 费用信息输出到 stderr', async () => {
        const result: AgentSessionResult = {
          response: 'Done.',
          cost: 0.0123,
          tokens: { input: 1000, output: 500 },
          toolCalls: [],
          duration: 2000,
        }
        const session = createMockSession(result)
        const options = createDefaultOptions('hello')
        const mode = createPrintMode()

        const output = captureOutput()
        try {
          await mode.run(session, options)
        } finally {
          output.restore()
        }

        const stderrText = output.stderr.join('')
        expect(stderrText).toContain('Cost')
        expect(stderrText).toContain('Tokens')
      })
    })

    describe('#when 未提供 prompt', () => {
      it('#then 输出错误到 stderr', async () => {
        const session = createMockSession({
          response: '',
          cost: 0,
          tokens: { input: 0, output: 0 },
          toolCalls: [],
          duration: 0,
        })
        const options = createDefaultOptions() // no prompt
        const mode = createPrintMode()

        const output = captureOutput()
        const origExitCode = process.exitCode
        try {
          await mode.run(session, options)
        } finally {
          output.restore()
          process.exitCode = origExitCode
        }

        const stderrText = output.stderr.join('')
        expect(stderrText).toContain('No prompt')
      })
    })
  })
})

describe('createJsonMode', () => {
  // 验收 4.2.3: `vitamin --json "query"` 输出合法 JSON
  describe('#given JSON 模式', () => {
    describe('#when 提供 prompt', () => {
      it('#then 输出合法 JSON 含 messages 数组（4.2.3）', async () => {
        const result: AgentSessionResult = {
          response: 'The answer is 42.',
          cost: 0.01,
          tokens: { input: 800, output: 300 },
          toolCalls: [],
          duration: 1200,
        }
        const session = createMockSession(result)
        const options = { ...createDefaultOptions('what is the answer'), mode: 'json' as const }
        const mode = createJsonMode()

        const output = captureOutput()
        try {
          await mode.run(session, options)
        } finally {
          output.restore()
        }

        const stdoutText = output.stdout.join('')
        const parsed = JSON.parse(stdoutText)

        expect(parsed.messages).toBeDefined()
        expect(Array.isArray(parsed.messages)).toBe(true)
        expect(parsed.messages).toHaveLength(2)
        expect(parsed.messages[0].role).toBe('user')
        expect(parsed.messages[1].role).toBe('assistant')
        expect(parsed.messages[1].content).toBe('The answer is 42.')
        expect(parsed.cost).toBe(0.01)
        expect(parsed.tokens).toEqual({ input: 800, output: 300 })
        expect(parsed.model).toBe('claude-sonnet')
        expect(parsed.duration).toBe(1200)
      })
    })

    describe('#when 未提供 prompt', () => {
      it('#then 输出 JSON 错误对象', async () => {
        const session = createMockSession({
          response: '',
          cost: 0,
          tokens: { input: 0, output: 0 },
          toolCalls: [],
          duration: 0,
        })
        const options = createDefaultOptions() // no prompt
        const mode = createJsonMode()

        const output = captureOutput()
        const origExitCode = process.exitCode
        try {
          await mode.run(session, options)
        } finally {
          output.restore()
          process.exitCode = origExitCode
        }

        const stdoutText = output.stdout.join('')
        const parsed = JSON.parse(stdoutText)

        expect(parsed.error).toBeDefined()
        expect(parsed.error).toContain('No prompt')
      })
    })
  })
})
