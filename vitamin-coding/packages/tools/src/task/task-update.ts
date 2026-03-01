// task-update 工具 — 更新任务状态
import { z } from 'zod'

import type { AgentTool, ToolResult } from '@vitamin/agent'

const TaskUpdateArgsSchema = z.object({
  taskId: z.string().describe('任务 ID'),
  action: z.enum(['cancel', 'retry']).describe('执行的操作'),
})

type TaskUpdateArgs = z.infer<typeof TaskUpdateArgsSchema>

export type UpdateTaskFn = (taskId: string, action: 'cancel' | 'retry') => Promise<{
  success: boolean
  message: string
}>

export function createTaskUpdateTool(updateFn?: UpdateTaskFn): AgentTool<TaskUpdateArgs> {
  return {
    name: 'task-update',
    description: '更新任务状态：取消或重试任务。',
    parameters: TaskUpdateArgsSchema as unknown as import('@vitamin/ai').ZodType<TaskUpdateArgs>,
    visibility: 'always',

    async execute(_id, args, _signal): Promise<ToolResult> {
      if (!updateFn) {
        return { content: [{ type: 'text', text: 'task-update not available' }], isError: true }
      }

      const result = await updateFn(args.taskId, args.action)
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      }
    },
  }
}
