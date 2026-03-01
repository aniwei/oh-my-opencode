import { z } from 'zod'

export const SkillsConfigSchema = z
  .object({
    enabled: z.array(z.string()).optional(),
    disabled: z.array(z.string()).optional(),
  })
  .passthrough()
