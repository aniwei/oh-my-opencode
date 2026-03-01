// MCP 配置加载器 — .vitamin/mcp.json 解析 + ${VAR} 环境变量展开
import { createLogger, McpError } from '@vitamin/shared'

import type { McpConfigFile, McpServerConfig, McpServerConfigEntry } from './types'

const logger = createLogger('mcp:loader')

// 环境变量展开（支持 ${VAR} 和 ${VAR:-default} 语法）
export function expandEnvVars(value: string, env: Record<string, string | undefined> = process.env): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, expr: string) => {
    // 支持默认值语法: ${VAR:-default}
    const colonIndex = expr.indexOf(':-')
    if (colonIndex >= 0) {
      const varName = expr.slice(0, colonIndex)
      const defaultValue = expr.slice(colonIndex + 2)
      return env[varName] ?? defaultValue
    }
    return env[expr] ?? ''
  })
}

// 递归展开对象中所有字符串值的环境变量
export function expandEnvVarsInObject<T>(
  obj: T,
  env: Record<string, string | undefined> = process.env,
): T {
  if (typeof obj === 'string') {
    return expandEnvVars(obj, env) as T
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => expandEnvVarsInObject(item, env)) as T
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = expandEnvVarsInObject(value, env)
    }
    return result as T
  }
  return obj
}

// 解析 MCP 配置文件 JSON 字符串
export function parseMcpConfig(jsonText: string): McpConfigFile {
  try {
    const raw = JSON.parse(jsonText) as Record<string, unknown>
    const mcpServers = (raw.mcpServers ?? {}) as Record<string, McpServerConfigEntry>
    return { mcpServers }
  } catch (error) {
    throw new McpError(`MCP 配置解析失败: ${String(error)}`, { code: 'MCP_CONFIG_PARSE_ERROR' })
  }
}

// 将配置条目转换为 McpServerConfig
export function configEntryToServerConfig(
  name: string,
  entry: McpServerConfigEntry,
): McpServerConfig {
  // 自动推断传输类型
  const transport = entry.transport ?? (entry.command ? 'stdio' : 'http')

  return {
    name,
    transport,
    command: entry.command,
    args: entry.args,
    env: entry.env,
    url: entry.url,
    headers: entry.headers,
  }
}

// MCP 配置加载器
export class McpConfigLoader {
  // 从文件路径加载 MCP 配置
  async loadFromFile(
    configPath: string,
    env?: Record<string, string | undefined>,
  ): Promise<McpServerConfig[]> {
    const { readFile } = await import('node:fs/promises')

    try {
      const text = await readFile(configPath, 'utf-8')
      return this.loadFromText(text, env)
    } catch (error) {
      logger.warn(`MCP 配置文件不存在或不可读: ${configPath}`)
      return []
    }
  }

  // 从 JSON 字符串加载
  loadFromText(
    jsonText: string,
    env?: Record<string, string | undefined>,
  ): McpServerConfig[] {
    const config = parseMcpConfig(jsonText)
    const expanded = expandEnvVarsInObject(config, env)
    const configs: McpServerConfig[] = []

    for (const [name, entry] of Object.entries(expanded.mcpServers)) {
      configs.push(configEntryToServerConfig(name, entry))
    }

    logger.info(`从配置加载 ${String(configs.length)} 个 MCP 服务器`)
    return configs
  }
}

// 工厂函数
export function createMcpConfigLoader(): McpConfigLoader {
  return new McpConfigLoader()
}
