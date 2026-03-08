import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeText } from '@vitamin/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/loader'

describe('loadConfig', () => {
  // 保存原始环境变量，测试后恢复
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('#given no config files exist', () => {
    it('#then returns defaults', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'vitamin-cfg-'))
      try {
        const { config, warnings, projectConfigPath, userConfigPath } = await loadConfig({
          cwd: tempDir,
        })
        expect(config.log_level).toBe('info')
        expect(config.config_version).toBe('1.0.0')
        expect(warnings).toHaveLength(0)
        expect(projectConfigPath).toBeUndefined()
        expect(userConfigPath).toBeUndefined()
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })
  })

  describe('#given a project config file', () => {
    it('#then loads and merges it over defaults', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'vitamin-cfg-'))
      try {
        const configDir = join(tempDir, '.vitamin')
        await mkdir(configDir, { recursive: true })
        await writeText(
          join(configDir, 'config.jsonc'),
          `{
            // project config
            "log_level": "debug",
            "model": "claude-sonnet-4-6",
          }`,
        )

        const { config, projectConfigPath } = await loadConfig({ cwd: tempDir })
        expect(config.log_level).toBe('debug')
        expect(config.model).toBe('claude-sonnet-4-6')
        expect(projectConfigPath).toBe(join(configDir, 'config.jsonc'))
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })
  })

  describe('#given CLI overrides', () => {
    it('#then CLI takes highest priority', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'vitamin-cfg-'))
      try {
        const configDir = join(tempDir, '.vitamin')
        await mkdir(configDir, { recursive: true })
        await writeText(join(configDir, 'config.jsonc'), '{ "model": "project-model" }')

        const { config } = await loadConfig({
          cwd: tempDir,
          overrides: { model: 'cli-model' },
        })
        expect(config.model).toBe('cli-model')
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })
  })

  describe('#given extension defaults', () => {
    it('#then extension defaults are lower priority than project config', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'vitamin-cfg-'))
      try {
        const configDir = join(tempDir, '.vitamin')
        await mkdir(configDir, { recursive: true })
        await writeText(join(configDir, 'config.jsonc'), '{ "model": "project-model" }')

        const { config } = await loadConfig({
          cwd: tempDir,
          extensionDefaults: {
            model: 'extension-model',
            theme: 'extension-theme',
          },
        })
        expect(config.model).toBe('project-model')
        expect(config.theme).toBe('extension-theme')
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })
  })

  describe('#given VITAMIN_* environment variables', () => {
    it('#then env layer overrides file config but not CLI', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'vitamin-cfg-'))
      try {
        const configDir = join(tempDir, '.vitamin')
        await mkdir(configDir, { recursive: true })
        await writeText(join(configDir, 'config.jsonc'), '{ "model": "project-model" }')

        process.env.VITAMIN_MODEL = 'env-model'
        process.env.VITAMIN_LOG_LEVEL = 'debug'

        const { config } = await loadConfig({ cwd: tempDir })
        // 环境变量优先级高于项目配置
        expect(config.model).toBe('env-model')
        expect(config.log_level).toBe('debug')
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

    it('#then CLI overrides still take precedence over env', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'vitamin-cfg-'))
      try {
        process.env.VITAMIN_MODEL = 'env-model'

        const { config } = await loadConfig({
          cwd: tempDir,
          overrides: { model: 'cli-model' },
        })
        expect(config.model).toBe('cli-model')
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })
  })

  describe('#given a JSONC file with parse errors', () => {
    it('#then returns partial config with warnings', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'vitamin-cfg-'))
      try {
        const configDir = join(tempDir, '.vitamin')
        await mkdir(configDir, { recursive: true })
        await writeText(
          join(configDir, 'config.jsonc'),
          `{
  "log_level": "debug",
  "model": BROKEN_VALUE
}`,
        )

        const { config, warnings } = await loadConfig({ cwd: tempDir })
        // 有效字段应被恢复
        expect(config.log_level).toBe('debug')
        // 无效字段产生警告
        expect(warnings.length).toBeGreaterThan(0)
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })
  })

  describe('#given unknown config fields', () => {
    it('#then produces warnings for unrecognized keys', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'vitamin-cfg-'))
      try {
        const configDir = join(tempDir, '.vitamin')
        await mkdir(configDir, { recursive: true })
        await writeText(
          join(configDir, 'config.jsonc'),
          '{ "log_level": "info", "unknown_field": true }',
        )

        const { warnings } = await loadConfig({ cwd: tempDir })
        const unknownWarning = warnings.find((w) => w.key === 'unknown_field')
        expect(unknownWarning).toBeDefined()
        expect(unknownWarning?.message).toContain('Unknown')
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })
  })
})
