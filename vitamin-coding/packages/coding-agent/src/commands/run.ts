// `vitamin run <prompt>` — 一次性命令行执行
import { createLogger } from '@vitamin/shared'

import { createPrintMode } from '../modes/print'

import type { AgentSession, CLIOptions } from '../types'

const logger = createLogger('coding-agent:cmd:run')

export interface RunCommandOptions {
  prompt: string
  model?: string
  maxTokens?: number
  verbose: boolean
}

// 执行 `vitamin run` 命令
export async function executeRunCommand(
  session: AgentSession,
  options: CLIOptions,
): Promise<void> {
  if (!options.prompt) {
    process.stderr.write('Error: vitamin run requires a prompt argument.\n')
    process.stderr.write('Usage: vitamin run "Fix the bug in auth.ts"\n')
    process.exitCode = 1
    return
  }

  logger.info('Executing run command with prompt: %s', options.prompt.slice(0, 80))

  const printMode = createPrintMode()
  await printMode.run(session, options)
}

// 创建 run 命令描述
export function createRunCommandHelp(): string {
  return `
vitamin run — Run a one-shot prompt

Usage:
  vitamin run <prompt>           Execute a single prompt
  vitamin run "Fix the bug"      Quick task execution

Options:
  -m, --model <id>        Override model for this run
  --max-tokens <n>        Max output tokens

Examples:
  vitamin run "Explain this codebase"
  vitamin run "Fix the failing test in auth.ts" --model claude-opus
  vitamin run "Add error handling to the API routes"
`.trim()
}
