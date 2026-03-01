// start-work 工具 — 启动计划执行
import { z } from 'zod'

import type { AgentTool, ToolResult } from '@vitamin/agent'

const StartWorkArgsSchema = z.object({
  planName: z.string().describe('要执行的计划名称'),
})

type StartWorkArgs = z.infer<typeof StartWorkArgsSchema>

export type StartWorkFn = (planName: string) => Promise<{ success: boolean; message: string }>

export function createStartWorkTool(startWorkFn?: StartWorkFn): AgentTool<StartWorkArgs> {
  return {
    name: 'start-work',
    description: '启动一个已生成的计划的执行。Atlas 将按 DAG 拓扑并行执行计划步骤。',
    parameters: StartWorkArgsSchema as unknown as import('@vitamin/ai').ZodType<StartWorkArgs>,
    visibility: 'always',

    async execute(_id, args, _signal): Promise<ToolResult> {
      if (!startWorkFn) {
        return {
          content: [{ type: 'text', text: 'start-work is not available: plan executor not initialized' }],
          isError: true,
        }
      }

      const result = await startWorkFn(args.planName)
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      }
    },
  }
}
