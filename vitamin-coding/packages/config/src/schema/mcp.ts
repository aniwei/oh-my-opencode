import { z } from 'zod'

export const McpServerSchema = z
  .object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    url: z.string().url().optional(),
  })
  .passthrough()

export const McpConfigSchema = z
  .object({
    servers: z.record(z.string(), McpServerSchema).optional(),
  })
  .passthrough()
