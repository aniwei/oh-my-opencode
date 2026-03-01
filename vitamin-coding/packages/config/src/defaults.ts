// VitaminConfig 的内置默认值
import type { VitaminConfig } from './types'

export const DEFAULT_CONFIG: VitaminConfig = {
  $schema: 'https://vitamin.dev/schema/vitamin.schema.json',
  config_version: '1.0.0',
  log_level: 'info',
  model: undefined,
  theme: 'auto',
  tool_preset: 'standard',
  agents: {},
  categories: {},
  extensions: {},
  mcp: {},
  session: {},
  tui: {},
  skills: {},
  compaction: {},
  background_task: {},
  experimental: {},
  disabled_agents: [],
  disabled_hooks: [],
  disabled_mcps: [],
  disabled_skills: [],
  disabled_tools: [],
}
