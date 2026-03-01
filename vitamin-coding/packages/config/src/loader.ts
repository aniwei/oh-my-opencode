import { homedir } from 'node:os'
// 6 层配置加载管道
//
// 优先级（从高到低）：
// 1. CLI 覆盖
// 2. 环境变量（VITAMIN_*）
// 3. 项目配置（.vitamin/config.jsonc）
// 4. 用户配置（~/.config/vitamin/config.jsonc）
// 5. 扩展默认值
// 6. 框架默认值
import { join } from 'node:path'
import { createLogger, readTextFile } from '@vitamin/shared'
import { DEFAULT_CONFIG } from './defaults'
import { mergeConfigLayers } from './merger'
import { migrateConfig } from './migrator'
import { parseConfigPartially } from './parser'
import { VitaminConfigSchema, VitaminConfigStrictSchema } from './schema/index'
import type { LoadConfigOptions, LoadConfigResult, VitaminConfig } from './types'
import type { ConfigWarning } from './types'

const log = createLogger('config:loader')

// 从所有 6 层加载并合并配置
export async function loadConfig(options: LoadConfigOptions = {}): Promise<LoadConfigResult> {
  const { cwd = process.cwd(), overrides = {}, extensionDefaults = {} } = options
  const warnings: ConfigWarning[] = []

  // 第 1 层：CLI 覆盖（已提供）
  const cliLayer = overrides

  // 第 2 层：环境变量
  const envLayer = loadEnvConfig()

  // 第 3 层：项目配置
  const projectConfigPath = join(cwd, '.vitamin', 'config.jsonc')
  const projectFile = await loadFileConfig(projectConfigPath, warnings)
  const projectLayer = projectFile.config

  // 第 4 层：用户配置
  const userConfigPath = join(homedir(), '.config', 'vitamin', 'config.jsonc')
  const userFile = await loadFileConfig(userConfigPath, warnings)
  const userLayer = userFile.config

  // 第 5 层：扩展默认值
  const extensionLayer = extensionDefaults

  // 第 6 层：框架默认值
  const defaultLayer = DEFAULT_CONFIG

  // 合并：从最低优先级到最高优先级
  const merged = mergeConfigLayers(
    defaultLayer,
    extensionLayer,
    userLayer,
    projectLayer,
    envLayer,
    cliLayer,
  )

  // 如需要则执行迁移
  const { config: migrated, applied } = migrateConfig(merged as Record<string, unknown>)
  if (applied.length > 0) {
    log.info({ applied }, 'Config migrations applied')
  }

  // 使用 Zod 校验（未知字段产生警告但不拒绝）
  const validated = validateConfig(migrated as Partial<VitaminConfig>, warnings)

  return {
    config: { ...DEFAULT_CONFIG, ...validated },
    warnings,
    projectConfigPath: projectFile.exists ? projectConfigPath : undefined,
    userConfigPath: userFile.exists ? userConfigPath : undefined,
  }
}

// 从 VITAMIN_* 环境变量提取配置
function loadEnvConfig(): Partial<VitaminConfig> {
  const config: Partial<VitaminConfig> = {}

  const model = process.env.VITAMIN_MODEL
  if (model) config.model = model

  const theme = process.env.VITAMIN_THEME
  if (theme) config.theme = theme

  const logLevel = process.env.VITAMIN_LOG_LEVEL
  if (logLevel) {
    const validLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal']
    if (validLevels.includes(logLevel)) {
      config.log_level = logLevel as VitaminConfig['log_level']
    }
  }

  return config
}

// 加载并解析 JSONC 配置文件，文件不存在时返回空对象
async function loadFileConfig(
  path: string,
  warnings: ConfigWarning[],
): Promise<{ config: Partial<VitaminConfig>; exists: boolean }> {
  const raw = await readTextFile(path)
  if (raw === undefined) {
    return { config: {}, exists: false }
  }

  log.debug({ path }, 'Loading config file')
  const result = parseConfigPartially(raw)
  warnings.push(...result.warnings)
  return { config: result.config, exists: true }
}

// 使用 Zod 校验配置，未知字段产生警告但不拒绝
function validateConfig(
  config: Partial<VitaminConfig>,
  warnings: ConfigWarning[],
): Partial<VitaminConfig> {
  // 检测未知字段并产生警告
  const strictResult = VitaminConfigStrictSchema.safeParse(config)
  if (strictResult.success) {
    // 严格模式通过，检查是否有超出已知 schema 的字段
    const knownKeys = new Set(Object.keys(VitaminConfigStrictSchema.shape))
    for (const key of Object.keys(config)) {
      if (!knownKeys.has(key)) {
        warnings.push({
          key,
          message: `Unknown config field: "${key}"`,
        })
      }
    }
  }

  // 使用 passthrough 模式解析，保留未知字段
  const result = VitaminConfigSchema.safeParse(config)
  if (result.success) {
    return result.data
  }

  // 收集校验错误作为警告，返回可用部分
  for (const issue of result.error.issues) {
    warnings.push({
      key: issue.path.join('.'),
      message: issue.message,
    })
  }

  // 剥离无效字段并返回其余部分
  const stripped = VitaminConfigSchema.partial().safeParse(config)
  return stripped.success ? stripped.data : {}
}
