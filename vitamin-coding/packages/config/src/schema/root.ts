// VitaminConfig 及子结构的 Zod 校验模式
import { z } from 'zod'
import { AgentsConfigSchema } from './agents'
import { CategoriesConfigSchema } from './categories'
import { CompactionConfigSchema } from './compaction'
import { BackgroundTaskConfigSchema, ExperimentalConfigSchema } from './experimental'
import { ExtensionsConfigSchema } from './extensions'
import { McpConfigSchema } from './mcp'
import { NotificationConfigSchema } from './notification'
import { SessionConfigSchema } from './session'
import { SkillsConfigSchema } from './skills'
import { ToolPresetSchema } from './tools'
import { TmuxConfigSchema } from './tmux'
import { TuiConfigSchema } from './tui'

export const LogLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])

// 已知字段的严格模式（不包含 passthrough，用于检测未知字段）
export const VitaminConfigStrictSchema = z.object({
  $schema: z.string().optional(),
  config_version: z.string().optional(),
  log_level: LogLevelSchema.optional(),
  model: z.string().optional(),
  model_fallback: z.array(z.string()).optional(),
  theme: z.string().optional(),
  agents: AgentsConfigSchema.optional(),
  categories: CategoriesConfigSchema.optional(),
  tool_preset: ToolPresetSchema.optional(),
  extensions: ExtensionsConfigSchema.optional(),
  mcp: McpConfigSchema.optional(),
  session: SessionConfigSchema.optional(),
  tui: TuiConfigSchema.optional(),
  skills: SkillsConfigSchema.optional(),
  compaction: CompactionConfigSchema.optional(),
  tmux: TmuxConfigSchema.optional(),
  notification: NotificationConfigSchema.optional(),
  background_task: BackgroundTaskConfigSchema.optional(),
  experimental: ExperimentalConfigSchema.optional(),
  disabled_agents: z.array(z.string()).optional(),
  disabled_hooks: z.array(z.string()).optional(),
  disabled_mcps: z.array(z.string()).optional(),
  disabled_skills: z.array(z.string()).optional(),
  disabled_tools: z.array(z.string()).optional(),
  _migrations: z.array(z.string()).optional(),
})

// 实际解析用模式，保留未知字段以便后续处理
export const VitaminConfigSchema = VitaminConfigStrictSchema.passthrough()

// 从模式派生的类型别名
export type VitaminConfigFromSchema = z.infer<typeof VitaminConfigSchema>
