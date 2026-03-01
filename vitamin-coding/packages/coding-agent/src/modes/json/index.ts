// JSON 输出模式
import { createLogger } from '@vitamin/shared'

import type { AgentSession, CLIOptions, JsonOutput, ModeRunner } from '../../types'

const logger = createLogger('coding-agent:json')

// JSON 模式运行器
export function createJsonMode(): ModeRunner {
  return {
    async run(session: AgentSession, options: CLIOptions): Promise<void> {
      const prompt = options.prompt
      if (!prompt) {
        const errorOutput = JSON.stringify({ error: 'No prompt provided' })
        process.stdout.write(errorOutput + '\n')
        process.exitCode = 1
        return
      }

      logger.info('JSON mode: processing prompt')

      const result = await session.prompt(prompt)

      const output: JsonOutput = {
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: result.response },
        ],
        cost: result.cost,
        tokens: result.tokens,
        model: session.state.currentModel,
        duration: result.duration,
      }

      // 输出合法 JSON 到 stdout
      process.stdout.write(JSON.stringify(output, null, 2) + '\n')
    },
  }
}
