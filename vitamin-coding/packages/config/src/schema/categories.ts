import { z } from 'zod'

export const CategoryConfigSchema = z
  .object({
    preferred_models: z.array(z.string()).optional(),
    default_model: z.string().optional(),
  })
  .passthrough()

export const CategoriesConfigSchema = z.record(z.string(), CategoryConfigSchema)
