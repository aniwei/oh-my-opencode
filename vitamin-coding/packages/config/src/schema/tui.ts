import { z } from 'zod'

export const TuiConfigSchema = z
  .object({
    compact_mode: z.boolean().optional(),
    show_thinking: z.boolean().optional(),
  })
  .passthrough()
