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
export async function executeRunCommand(session: AgentSession, options: CLIOptions): Promise<void> {
  if (!options.prompt) {
    process.stderr.write('错误：vitamin run 需要提供提示词参数。\n')
    process.stderr.write('用法：vitamin run "修复 auth.ts 中的 bug"\n')
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
vitamin run — 执行一次性任务

用法:
  vitamin run <prompt>             执行单次提示词任务
  vitamin run "修复这个 bug"        快速任务执行

选项:
  -m, --model <id>          指定本次运行模型
  --max-tokens <n>          最大输出 token 数

示例:
  vitamin run "解释这个代码库"
  vitamin run "修复 auth.ts 里失败的测试" --model claude-opus
  vitamin run "为 API 路由增加错误处理"
`.trim()
}
