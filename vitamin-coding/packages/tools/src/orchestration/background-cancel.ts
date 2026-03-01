// background-cancel 工具 — 取消后台任务
import { z } from 'zod'

import type { AgentTool, ToolResult } from '@vitamin/agent'

const BackgroundCancelArgsSchema = z.object({
  taskId: z.string().describe('要取消的后台任务 ID'),
})

type BackgroundCancelArgs = z.infer<typeof BackgroundCancelArgsSchema>

export type CancelBackgroundFn = (taskId: string) => Promise<boolean>

export function createBackgroundCancelTool(
  cancelFn?: CancelBackgroundFn,
): AgentTool<BackgroundCancelArgs> {
  return {
    name: 'background-cancel',
    description: '取消一个正在运行的后台任务。',
    parameters: BackgroundCancelArgsSchema as unknown as import('@vitamin/ai').ZodType<BackgroundCancelArgs>,
    visibility: 'always',

    async execute(_id, args, _signal): Promise<ToolResult> {
      if (!cancelFn) {
        return {
          content: [{ type: 'text', text: 'background-cancel not available' }],
          isError: true,
        }
      }

      const cancelled = await cancelFn(args.taskId)
      return {
        content: [{
          type: 'text',
          text: cancelled
            ? `Task ${args.taskId} cancelled successfully`
            : `Failed to cancel task ${args.taskId} (may already be completed)`,
        }],
        isError: !cancelled,
      }
    },
  }
}
