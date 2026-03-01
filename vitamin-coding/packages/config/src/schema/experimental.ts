import { z } from 'zod'

export const BackgroundTaskConfigSchema = z
  .object({
    concurrency: z.number().int().positive().optional(),
    enabled: z.boolean().optional(),
  })
  .passthrough()

export const ExperimentalConfigSchema = z
  .object({
    features: z.record(z.string(), z.boolean()).optional(),
    background_task: BackgroundTaskConfigSchema.optional(),
  })
  .passthrough()
