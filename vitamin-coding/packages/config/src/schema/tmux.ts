import { z } from 'zod'

export const TmuxConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    default_session_prefix: z.string().optional(),
    auto_cleanup: z.boolean().optional(),
    max_sessions: z.number().int().positive().optional(),
  })
  .passthrough()
