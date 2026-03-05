// `vitamin config` — 配置管理命令
import { access, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { createLogger } from '@vitamin/shared'

const logger = createLogger('coding-agent:cmd:config')

// 配置操作
export type ConfigAction = 'get' | 'set' | 'list' | 'path' | 'edit' | 'reset'

export interface ConfigCommandArgs {
  action: ConfigAction
  key?: string
  value?: string
}

// 解析 config 子命令参数
export function parseConfigArgs(argsStr: string): ConfigCommandArgs {
  const parts = argsStr.trim().split(/\s+/)
  const action = (parts[0] ?? 'list') as ConfigAction

  switch (action) {
    case 'get':
      return { action, key: parts[1] }
    case 'set':
      return { action, key: parts[1], value: parts.slice(2).join(' ') }
    case 'list':
    case 'path':
    case 'edit':
    case 'reset':
      return { action }
    default:
      return { action: 'list' }
  }
}

// 通过 dot-path 读取嵌套对象值
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.')
  let current: unknown = obj

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }

  return current
}

// 通过 dot-path 设置嵌套对象值
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.')
  let current: Record<string, unknown> = obj

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i] as string
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }

  const lastKey = keys[keys.length - 1]
  if (lastKey !== undefined) {
    current[lastKey] = value
  }
}

// 加载配置文件
async function loadConfigFile(
  projectDir: string,
): Promise<{ config: Record<string, unknown>; path: string }> {
  const configPath = join(projectDir, '.vitamin', 'config.json')

  try {
    await access(configPath)
    const content = await readFile(configPath, 'utf-8')
    return { config: JSON.parse(content) as Record<string, unknown>, path: configPath }
  } catch {
    return { config: {}, path: configPath }
  }
}

// 保存配置文件
async function saveConfigFile(configPath: string, config: Record<string, unknown>): Promise<void> {
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n')
}

// 展平对象为 dot-path 列表（用于 list）
function flattenConfig(
  obj: Record<string, unknown>,
  prefix = '',
): Array<{ key: string; value: unknown }> {
  const entries: Array<{ key: string; value: unknown }> = []

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      entries.push(...flattenConfig(value as Record<string, unknown>, fullKey))
    } else {
      entries.push({ key: fullKey, value })
    }
  }

  return entries
}

// 执行 config 命令
export async function executeConfigCommand(projectDir: string, argsStr: string): Promise<void> {
  const args = parseConfigArgs(argsStr)
  logger.info('Config command: %s', args.action)

  switch (args.action) {
    case 'get': {
      if (!args.key) {
        process.stderr.write('错误：vitamin config get 需要指定 key。\n')
        process.stderr.write('用法：vitamin config get <key>\n')
        return
      }

      const { config } = await loadConfigFile(projectDir)
      const value = getNestedValue(config, args.key)

      if (value === undefined) {
        process.stderr.write(`未找到 key "${args.key}"。\n`)
      } else {
        process.stdout.write(
          typeof value === 'string' 
            ? value + '\n' 
            : JSON.stringify(value, null, 2) + '\n',
        )
      }
      break
    }

    case 'set': {
      if (!args.key || args.value === undefined) {
        process.stderr.write('错误：vitamin config set 需要 key 和 value。\n')
        process.stderr.write('用法：vitamin config set <key> <value>\n')
        return
      }

      const { config, path } = await loadConfigFile(projectDir)

      // 尝试 JSON parse，失败则作为字符串
      let parsedValue: unknown
      try {
        parsedValue = JSON.parse(args.value)
      } catch {
        parsedValue = args.value
      }

      setNestedValue(config, args.key, parsedValue)
      await saveConfigFile(path, config)
      process.stdout.write(`已设置 ${args.key} = ${JSON.stringify(parsedValue)}\n`)
      break
    }

    case 'list': {
      const { config } = await loadConfigFile(projectDir)
      const entries = flattenConfig(config)

      if (entries.length === 0) {
        process.stdout.write('当前没有配置项。\n')
        return
      }

      const maxKeyLen = Math.max(...entries.map((e) => e.key.length))
      for (const entry of entries) {
        const valueStr = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value)
        process.stdout.write(`  ${entry.key.padEnd(maxKeyLen + 2)} ${valueStr}\n`)
      }
      break
    }

    case 'path': {
      const { path } = await loadConfigFile(projectDir)
      process.stdout.write(path + '\n')
      break
    }

    case 'edit': {
      const { path } = await loadConfigFile(projectDir)
      const editor = process.env['EDITOR'] ?? process.env['VISUAL'] ?? 'vi'

      const { execSync } = await import('node:child_process')
      try {
        execSync(`${editor} ${path}`, { stdio: 'inherit' })
      } catch {
        process.stderr.write(`打开编辑器失败：${editor}\n`)
      }
      break
    }

    case 'reset': {
      const { path } = await loadConfigFile(projectDir)
      const defaultConfig = {
        $schema: 'https://vitamin.dev/schema.json',
        model: 'github-copilot/claude-sonnet-4',
        defaultModel: 'github-copilot/claude-sonnet-4',
        agents: {},
        categories: {},
        mcps: {},
      }
      await saveConfigFile(path, defaultConfig)
      process.stdout.write('配置已重置为默认值。\n')
      break
    }
  }
}

// 创建 config 命令帮助
export function createConfigCommandHelp(): string {
  return `
vitamin config — 配置管理

子命令:
  vitamin config list              列出所有配置项
  vitamin config get <key>         获取配置值
  vitamin config set <key> <val>   设置配置值
  vitamin config path              显示配置文件路径
  vitamin config edit              用编辑器打开配置文件
  vitamin config reset             重置为默认配置

示例:
  vitamin config get model
  vitamin config set model github-copilot/claude-sonnet-4
  vitamin config list
`.trim()
}
