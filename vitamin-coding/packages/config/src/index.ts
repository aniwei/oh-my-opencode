export type {
  VitaminConfig,
  AgentConfig,
  CategoryConfig,
  ConfigWarning,
  LoadConfigOptions,
  LoadConfigResult,
} from './types'

export {
  VitaminConfigSchema,
  VitaminConfigStrictSchema,
  AgentConfigSchema,
  CategoryConfigSchema,
  LogLevelSchema,
} from './schema/index'
export type { VitaminConfigFromSchema } from './schema/index'

export { parseConfigPartially, offsetToPosition } from './parser'
export { mergeConfigs, mergeConfigLayers } from './merger'
export { DEFAULT_CONFIG } from './defaults'
export { migrateConfig, registerMigration, resetMigrations } from './migrator'
export type { Migration } from './migrator'
export { loadConfig } from './loader'
export { createConfigWatcher, ConfigWatcher } from './watcher'
export type { ConfigWatcherOptions } from './watcher'
