// Skill MCP 管理器 — 管理 Skill 内嵌 MCP 的生命周期（§S10.3）
import { createLogger } from '@vitamin/shared'

import { createMcpClient } from './mcp-client'

import type { McpClient } from './mcp-client'
import type { McpToolDefinition, SkillMcpConfig } from './types'

const logger = createLogger('mcp:skill-manager')

// 最大自动重启次数
const MAX_RESTART_ATTEMPTS = 3

// Skill MCP 实例状态
interface SkillMcpInstance {
  skillName: string
  config: SkillMcpConfig
  client: McpClient
  tools: McpToolDefinition[]
  restartCount: number
  available: boolean
}

// Skill MCP 管理器
export class SkillMcpManager {
  private readonly instances: Map<string, SkillMcpInstance> = new Map()

  // 启动 Skill MCP（§S10.3 激活流程）
  async start(
    skillName: string,
    config: SkillMcpConfig,
  ): Promise<McpToolDefinition[]> {
    // 如果已存在，先停止
    if (this.instances.has(skillName)) {
      await this.stop(skillName)
    }

    const client = createMcpClient({
      name: config.name,
      transport: config.transport,
      command: config.command,
      args: config.args,
      url: config.url,
    })

    try {
      await client.connect()
      const tools = await client.listTools()

      this.instances.set(skillName, {
        skillName,
        config,
        client,
        tools,
        restartCount: 0,
        available: true,
      })

      logger.info(`Skill MCP ${skillName} 启动成功，${String(tools.length)} 个工具`)
      return tools
    } catch (error) {
      logger.error(`Skill MCP ${skillName} 启动失败: ${String(error)}`)
      return []
    }
  }

  // 停止 Skill MCP（§S10.3 停用流程）
  async stop(skillName: string): Promise<void> {
    const instance = this.instances.get(skillName)
    if (!instance) return

    try {
      await instance.client.disconnect()
    } catch (error) {
      logger.warn(`Skill MCP ${skillName} 断开连接失败: ${String(error)}`)
    }

    this.instances.delete(skillName)
    logger.info(`Skill MCP ${skillName} 已停止`)
  }

  // 重启 Skill MCP（§S10.3 异常处理: 最多 3 次）
  async restart(skillName: string): Promise<boolean> {
    const instance = this.instances.get(skillName)
    if (!instance) return false

    if (instance.restartCount >= MAX_RESTART_ATTEMPTS) {
      logger.warn(
        `Skill MCP ${skillName} 重启次数已达上限 (${String(MAX_RESTART_ATTEMPTS)})，标记不可用`,
      )
      instance.available = false
      return false
    }

    instance.restartCount++
    logger.info(
      `Skill MCP ${skillName} 重启 (${String(instance.restartCount)}/${String(MAX_RESTART_ATTEMPTS)})`,
    )

    try {
      await instance.client.disconnect()
    } catch {
      // 忽略断开连接错误
    }

    const newClient = createMcpClient({
      name: instance.config.name,
      transport: instance.config.transport,
      command: instance.config.command,
      args: instance.config.args,
      url: instance.config.url,
    })

    try {
      await newClient.connect()
      const tools = await newClient.listTools()

      instance.client = newClient
      instance.tools = tools
      instance.available = true

      logger.info(`Skill MCP ${skillName} 重启成功`)
      return true
    } catch (error) {
      logger.error(`Skill MCP ${skillName} 重启失败: ${String(error)}`)
      instance.available = false
      return false
    }
  }

  // 获取 Skill MCP 提供的工具
  getTools(skillName: string): McpToolDefinition[] {
    const instance = this.instances.get(skillName)
    if (!instance?.available) return []
    return instance.tools
  }

  // 获取所有可用的 Skill MCP 工具
  getAllTools(): Map<string, McpToolDefinition[]> {
    const result = new Map<string, McpToolDefinition[]>()
    for (const [name, instance] of this.instances) {
      if (instance.available) {
        result.set(name, instance.tools)
      }
    }
    return result
  }

  // 检查 Skill MCP 是否可用
  isAvailable(skillName: string): boolean {
    return this.instances.get(skillName)?.available ?? false
  }

  // 获取活跃 Skill MCP 数量
  get size(): number {
    return this.instances.size
  }

  // 停止所有
  async stopAll(): Promise<void> {
    const names = [...this.instances.keys()]
    for (const name of names) {
      await this.stop(name)
    }
  }
}

// 工厂函数
export function createSkillMcpManager(): SkillMcpManager {
  return new SkillMcpManager()
}
