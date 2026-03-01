// 配置版本迁移系统
// 迁移链：v0 → v1 → v2 … 按顺序执行
// 迁移仅单向前进（不支持回滚）
import { createLogger } from '@vitamin/shared'

const log = createLogger('config:migrator')

// 单个迁移步骤
export interface Migration {
  // 此迁移完成后的目标版本
  version: string
  // 人类可读的描述
  description: string
  // 将配置从前一版本转换到此版本
  migrate(config: Record<string, unknown>): Record<string, unknown>
}

// 内置迁移注册表
let migrations: Migration[] = []

// 注册新迁移，必须按版本顺序注册
export function registerMigration(migration: Migration): void {
  migrations.push(migration)
}

// 重置迁移注册表（仅用于测试）
export function resetMigrations(): void {
  migrations = []
}

// 对配置对象执行所有适用的迁移
// 返回迁移后的配置，并更新 config_version 和 _migrations 日志
export function migrateConfig(config: Record<string, unknown>): {
  config: Record<string, unknown>
  applied: string[]
} {
  const currentVersion = typeof config.config_version === 'string' ? config.config_version : '0.0.0'

  const applied: string[] = []
  let result = { ...config }

  for (const migration of migrations) {
    if (compareVersions(migration.version, currentVersion) > 0) {
      log.info(
        { from: currentVersion, to: migration.version },
        `Applying migration: ${migration.description}`,
      )
      result = migration.migrate(result)
      result.config_version = migration.version
      applied.push(`${currentVersion}→${migration.version}`)
    }
  }

  if (applied.length > 0) {
    const existingMigrations = Array.isArray(result._migrations)
      ? (result._migrations as string[])
      : []
    result._migrations = [...existingMigrations, ...applied]
  }

  return { config: result, applied }
}

// 简单 semver 比较：a > b 返回 > 0，a < b 返回 < 0，相等返回 0
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  const len = Math.max(pa.length, pb.length)

  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na !== nb) return na - nb
  }
  return 0
}
