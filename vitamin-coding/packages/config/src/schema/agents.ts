import { z } from 'zod'

export const AgentConfigSchema = z
  .object({
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().positive().optional(),
    thinking_budget: z.number().int().positive().optional(),
    disabled: z.boolean().optional(),
  })
  .passthrough()

export const AgentsConfigSchema = z.record(z.string(), AgentConfigSchema)
