import { z } from 'zod'

export const ExtensionConfigSchema = z.record(z.string(), z.unknown())

export const ExtensionsConfigSchema = z
  .object({
    enabled: z.array(z.string()).optional(),
    disabled: z.array(z.string()).optional(),
    options: ExtensionConfigSchema.optional(),
  })
  .passthrough()
