import { z } from 'zod'

export const NotificationConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    sound: z.boolean().optional(),
    on_completion: z.boolean().optional(),
    on_error: z.boolean().optional(),
    on_idle: z.boolean().optional(),
  })
  .passthrough()
