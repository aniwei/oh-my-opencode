// Extension API 构建器 — 为每个 Extension 构建独立的 API 实例
import { createLogger } from '@vitamin/shared'

import type { AgentTool } from '@vitamin/agent'
import type { HookRegistration, HookTiming } from '@vitamin/hooks'

import type { ExtensionEventBus } from './event-bus'
import type {
  ExtensionAPI,
  ExtensionAgentContext,
  ExtensionConfigContext,
  ExtensionDescriptor,
  ExtensionEventHandler,
  ExtensionEventName,
  ExtensionUIContext,
  McpRegistration,
  SlashCommand,
} from './types'

const logger = createLogger('extension:api-builder')

// 已注册的工具和命令的集中存储
export interface ExtensionRegistry {
  tools: Map<string, AgentTool>
  commands: Map<string, SlashCommand>
  hooks: HookRegistration[]
  mcps: Map<string, McpRegistration>
  shortcuts: Map<string, () => void | Promise<void>>
}

// API 构建器配置
export interface ApiBuilderConfig {
  eventBus: ExtensionEventBus
  registry: ExtensionRegistry
  ui?: ExtensionUIContext
  config?: ExtensionConfigContext
  agent?: ExtensionAgentContext
}

// 为单个 Extension 构建隔离的 API 实例
export function buildExtensionApi(
  descriptor: ExtensionDescriptor,
  config: ApiBuilderConfig,
): { api: ExtensionAPI; dispose: () => void } {
  const { eventBus, registry } = config
  const extName = descriptor.name
  const extLogger = createLogger(`extension:${extName}`)

  // 用于跟踪该 Extension 注册的所有资源，dispose 时清理
  const disposers: (() => void)[] = []

  const api: ExtensionAPI = {
    on<T extends ExtensionEventName>(
      event: T,
      handler: ExtensionEventHandler<T>,
    ): () => void {
      const unsubscribe = eventBus.on(event, handler)
      disposers.push(unsubscribe)
      return unsubscribe
    },

    registerHook<T extends HookTiming>(hook: HookRegistration<T>): () => void {
      // 添加 Extension 前缀，避免命名冲突
      const prefixedHook = {
        ...hook,
        name: `ext:${extName}:${hook.name}`,
      }
      registry.hooks.push(prefixedHook)
      const dispose = () => {
        const index = registry.hooks.indexOf(prefixedHook)
        if (index >= 0) {
          registry.hooks.splice(index, 1)
        }
      }
      disposers.push(dispose)
      return dispose
    },

    registerTool(tool: AgentTool): () => void {
      const toolName = tool.name
      if (registry.tools.has(toolName)) {
        extLogger.warn(`工具 ${toolName} 已注册，覆盖`)
      }
      registry.tools.set(toolName, tool)
      const dispose = () => {
        registry.tools.delete(toolName)
      }
      disposers.push(dispose)
      logger.info(`Extension ${extName} 注册工具: ${toolName}`)
      return dispose
    },

    registerCommand(command: SlashCommand): () => void {
      const cmdName = command.name
      if (registry.commands.has(cmdName)) {
        extLogger.warn(`命令 /${cmdName} 已注册，覆盖`)
      }
      registry.commands.set(cmdName, command)
      const dispose = () => {
        registry.commands.delete(cmdName)
      }
      disposers.push(dispose)
      logger.info(`Extension ${extName} 注册命令: /${cmdName}`)
      return dispose
    },

    log: {
      info(message: string) {
        extLogger.info(message)
      },
      warn(message: string) {
        extLogger.warn(message)
      },
      error(message: string) {
        extLogger.error(message)
      },
    },

    emit(event: string, data: unknown) {
      eventBus.emitBus(event, data)
    },

    onBus(event: string, handler: (data: unknown) => void): () => void {
      const unsubscribe = eventBus.onBus(event, handler)
      disposers.push(unsubscribe)
      return unsubscribe
    },

    registerMcp(mcpConfig: McpRegistration): () => void {
      const mcpName = mcpConfig.name
      registry.mcps.set(mcpName, mcpConfig)
      const dispose = () => {
        registry.mcps.delete(mcpName)
      }
      disposers.push(dispose)
      logger.info(`Extension ${extName} 注册 MCP: ${mcpName}`)
      return dispose
    },

    registerShortcut(key: string, handler: () => void | Promise<void>): () => void {
      const shortcutKey = `ext:${extName}:${key}`
      registry.shortcuts.set(shortcutKey, handler)
      const dispose = () => {
        registry.shortcuts.delete(shortcutKey)
      }
      disposers.push(dispose)
      return dispose
    },

    // 上下文 — 允许外部注入，提供默认的 no-op 回退
    ui: config.ui ?? {
      select: async () => undefined,
      confirm: async () => false,
      input: async () => undefined,
      notify: () => {},
      setStatus: () => {},
    },

    config: config.config ?? {
      get: () => undefined,
      set: async () => {},
      getAll: () => ({}),
    },

    agent: config.agent ?? {
      setModel: () => {},
      getModel: () => 'unknown',
      setThinkingLevel: () => {},
      setActiveTools: () => {},
      sendMessage: async () => {},
      exec: async () => '',
    },
  }

  // dispose 清理函数 — 移除该 Extension 注册的所有资源
  const dispose = () => {
    for (const disposer of disposers) {
      try {
        disposer()
      } catch (error) {
        logger.error(`Dispose failed for extension ${extName}: ${String(error)}`)
      }
    }
    disposers.length = 0
  }

  return { api, dispose }
}

// 创建空的 ExtensionRegistry
export function createExtensionRegistry(): ExtensionRegistry {
  return {
    tools: new Map(),
    commands: new Map(),
    hooks: [],
    mcps: new Map(),
    shortcuts: new Map(),
  }
}
