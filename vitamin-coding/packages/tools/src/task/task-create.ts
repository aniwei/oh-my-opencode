// task-create 工具 — 创建后台任务
import { z } from 'zod'

import type { AgentTool, ToolResult } from '@vitamin/agent'

const TaskCreateArgsSchema = z.object({
  prompt: z.string().describe('任务描述'),
  category: z.string().optional().describe('任务类别'),
  subagent: z.string().optional().describe('指定执行 Agent'),
})

type TaskCreateArgs = z.infer<typeof TaskCreateArgsSchema>

export type CreateTaskFn = (args: { prompt: string; category?: string; subagent?: string }) => Promise<{
  taskId: string
}>

export function createTaskCreateTool(createFn?: CreateTaskFn): AgentTool<TaskCreateArgs> {
  return {
    name: 'task-create',
    description: '创建一个后台任务。',
    parameters: TaskCreateArgsSchema as unknown as import('@vitamin/ai').ZodType<TaskCreateArgs>,
    visibility: 'always',

    async execute(_id, args, _signal): Promise<ToolResult> {
      if (!createFn) {
        return { content: [{ type: 'text', text: 'task-create not available' }], isError: true }
      }

      const result = await createFn({
        prompt: args.prompt,
        category: args.category,
        subagent: args.subagent,
      })

      return { content: [{ type: 'text', text: `Task created: ${result.taskId}` }] }
    },
  }
}
