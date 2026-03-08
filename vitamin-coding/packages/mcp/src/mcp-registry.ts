// MCP 服务注册表 — 管理所有 MCP 服务器（含三层优先级 §S10.1）
import { createLogger } from '@vitamin/shared'
import { z } from 'zod'

import { createMcpClient } from './mcp-client'
import { formatMcpToolName, mcpResultToToolResult } from './types'

import type { AgentTool, ToolResult } from '@vitamin/agent'
import type { McpClient } from './mcp-client'
import type { McpPriority, McpServerConfig, McpToolDefinition } from './types'

const logger = createLogger('mcp:registry')

// 注册表中的 MCP 条目
interface McpEntry {
  name: string
  priority: McpPriority
  client: McpClient
  tools: McpToolDefinition[]
  config: McpServerConfig
  reconnectAttempts: number
}

// MCP 注册表
export class McpRegistry {
  private readonly entries: Map<string, McpEntry> = new Map()
  private static readonly MAX_RECONNECT_ATTEMPTS = 3
  private static readonly RECONNECT_BASE_DELAY_MS = 1000

  // 注册 MCP 服务器（连接 + 获取工具列表）
  async register(
    config: McpServerConfig,
    priority: McpPriority,
  ): Promise<McpToolDefinition[]> {
    const client = createMcpClient(config)

    try {
      await client.connect()
      const tools = await client.listTools()

      this.entries.set(config.name, {
        name: config.name,
        priority,
        client,
        tools,
        config,
        reconnectAttempts: 0,
      })

      logger.info(
        `MCP ${config.name} 注册成功，${String(tools.length)} 个工具，优先级 ${priority}`,
      )
      return tools
    } catch (error) {
      logger.error(`MCP ${config.name} 注册失败: ${String(error)}`)
      await client.disconnect()
      return []
    }
  }

  // 注册并使用预加载的工具（用于测试/内置 MCP）
  registerWithTools(
    name: string,
    priority: McpPriority,
    client: McpClient,
    tools: McpToolDefinition[],
  ): void {
    const config =
      typeof (client as Partial<McpClient>).getConfig === 'function'
        ? client.getConfig()
        : { name, transport: 'stdio' as const, command: 'echo' }

    this.entries.set(name, {
      name,
      priority,
      client,
      tools,
      config,
      reconnectAttempts: 0,
    })
  }

  // 注销 MCP 服务器
  async unregister(name: string): Promise<void> {
    const entry = this.entries.get(name)
    if (!entry) return

    await entry.client.disconnect()
    this.entries.delete(name)
    logger.info(`MCP ${name} 已注销`)
  }

  // 注销所有
  async unregisterAll(): Promise<void> {
    for (const [name] of this.entries) {
      await this.unregister(name)
    }
  }

  // 获取所有 MCP 提供的工具（转换为 AgentTool 格式）
  // 按优先级排序: builtin > user > skill
  getAgentTools(): AgentTool<Record<string, unknown>>[] {
    const priorityOrder: Record<McpPriority, number> = {
      builtin: 0,
      user: 1,
      skill: 2,
    }

    // 按优先级排序
    const sorted = [...this.entries.values()].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    )

    const tools: AgentTool<Record<string, unknown>>[] = []

    for (const entry of sorted) {
      for (const mcpTool of entry.tools) {
        const namespacedName = formatMcpToolName(entry.name, mcpTool.name)
        // 捕获当前迭代变量
        const currentEntry = entry
        const currentMcpTool = mcpTool

        const tool: AgentTool<Record<string, unknown>> = {
          name: namespacedName,
          description: `[MCP:${currentEntry.name}] ${currentMcpTool.description}`,
          // 使用 passthrough schema，MCP 工具参数由 MCP 服务器验证
          parameters: z.record(z.string(), z.unknown()),
          execute: async (
            _id: string,
            args: Record<string, unknown>,
            _signal: AbortSignal,
          ): Promise<ToolResult> => {
            const result = await currentEntry.client.callTool({
              name: currentMcpTool.name,
              arguments: args,
            })
            return mcpResultToToolResult(result)
          },
        }

        tools.push(tool)
      }
    }

    return tools
  }

  // 获取已注册的 MCP 名称列表
  getRegisteredNames(): string[] {
    return [...this.entries.keys()]
  }

  // 获取指定 MCP 的工具列表
  getToolsForMcp(name: string): McpToolDefinition[] {
    return this.entries.get(name)?.tools ?? []
  }

  // 获取 MCP 客户端
  getClient(name: string): McpClient | undefined {
    return this.entries.get(name)?.client
  }

  // 获取 MCP 条目数量
  get size(): number {
    return this.entries.size
  }

  // 自动重连断开的 MCP 服务器（指数退避）
  async reconnect(name: string): Promise<boolean> {
    const entry = this.entries.get(name)
    if (!entry) {
      logger.warn(`MCP ${name} 未注册，无法重连`)
      return false
    }

    if (entry.reconnectAttempts >= McpRegistry.MAX_RECONNECT_ATTEMPTS) {
      logger.error(`MCP ${name} 重连尝试已达上限 (${String(McpRegistry.MAX_RECONNECT_ATTEMPTS)})`)
      return false
    }

    entry.reconnectAttempts++
    const delay = McpRegistry.RECONNECT_BASE_DELAY_MS * Math.pow(2, entry.reconnectAttempts - 1)
    logger.info(`MCP ${name} 将在 ${String(delay)}ms 后重连（第 ${String(entry.reconnectAttempts)} 次）`)

    await new Promise((resolve) => setTimeout(resolve, delay))

    try {
      await entry.client.disconnect()
      const newClient = createMcpClient(entry.config)
      await newClient.connect()
      const tools = await newClient.listTools()

      entry.client = newClient
      entry.tools = tools
      entry.reconnectAttempts = 0

      logger.info(`MCP ${name} 重连成功，${String(tools.length)} 个工具`)
      return true
    } catch (error) {
      logger.error(`MCP ${name} 重连失败: ${String(error)}`)
      return false
    }
  }

  // 检查并重连所有断开的 MCP
  async reconnectDisconnected(): Promise<string[]> {
    const reconnected: string[] = []

    for (const [name, entry] of this.entries) {
      const isConnected = entry.client.isConnected()
      if (!isConnected) {
        const success = await this.reconnect(name)
        if (success) reconnected.push(name)
        continue
      }

      // 主动探测，避免底层连接已断开但本地状态未及时更新
      try {
        await entry.client.listTools()
      } catch (error) {
        logger.warn(`MCP ${name} 健康检查失败，准备重连: ${String(error)}`)
        const success = await this.reconnect(name)
        if (success) reconnected.push(name)
      }
    }

    return reconnected
  }

  // 获取所有 MCP 的连接状态
  getHealthStatus(): Array<{ name: string; connected: boolean; priority: McpPriority; toolCount: number }> {
    return [...this.entries.values()].map((entry) => ({
      name: entry.name,
      connected: entry.client.isConnected(),
      priority: entry.priority,
      toolCount: entry.tools.length,
    }))
  }
}

// 工厂函数
export function createMcpRegistry(): McpRegistry {
  return new McpRegistry()
}
