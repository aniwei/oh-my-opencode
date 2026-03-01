// Print（非交互）模式
import { createLogger } from '@vitamin/shared'

import type { AgentSession, CLIOptions, ModeRunner } from '../../types'

const logger = createLogger('coding-agent:print')

// 打印模式运行器
export function createPrintMode(): ModeRunner {
  return {
    async run(session: AgentSession, options: CLIOptions): Promise<void> {
      const prompt = options.prompt
      if (!prompt) {
        process.stderr.write('Error: No prompt provided for print mode.\n')
        process.exitCode = 1
        return
      }

      logger.info('Print mode: processing prompt')

      const result = await session.prompt(prompt)

      // 输出响应到 stdout
      process.stdout.write(result.response + '\n')

      // 成本信息到 stderr（不污染 stdout）
      if (result.cost > 0) {
        process.stderr.write(`\nCost: $${result.cost.toFixed(4)} | Tokens: ${String(result.tokens.input)} in / ${String(result.tokens.output)} out | Duration: ${String(result.duration)}ms\n`)
      }
    },
  }
}
