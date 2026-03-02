// createVitaminAgent — SDK 主入口（§S13.1）
import { createLogger } from '@vitamin/shared'
import { loadConfig } from '@vitamin/config'
import { createToolRegistry, registerBuiltinTools } from '@vitamin/tools'
import { createHookEngine } from '@vitamin/hooks'
import {
  createAgentRegistry,
  createBackgroundManager,
  createCategoryResolver,
  createTaskDispatcher,
} from '@vitamin/orchestrator'
import { createSessionManager } from '@vitamin/session'
import { createExtensionRunner } from '@vitamin/extension'
import type { ExtensionFactory } from '@vitamin/extension'
import { createMcpRegistry } from '@vitamin/mcp'
import { createAgentSession } from '@vitamin/coding-agent'
import type { VitaminConfig } from '@vitamin/config'

import { createAgentStream } from './agent-stream'

import type { Model } from '@vitamin/ai'
import type {
  VitaminAgent,
  VitaminAgentOptions,
  VitaminAgentState,
  ConversationHandle,
  AgentStream as IAgentStream,
  ExternalToolDefinition,
  AgentEventName,
  AgentEventHandler,
} from './types'

const logger = createLogger('sdk:agent')

function inferModelTransport(modelId: string): Pick<Model, 'api' | 'provider' | 'baseUrl'> {
  if (modelId.startsWith('openai/')) {
    return {
      api: 'openai-responses',
      provider: 'openai',
      baseUrl: 'https://api.openai.com',
    }
  }

  if (modelId.startsWith('google/')) {
    return {
      api: 'google-generative-ai',
      provider: 'google',
      baseUrl: 'https://generativelanguage.googleapis.com',
    }
  }

  if (modelId.startsWith('github-copilot/')) {
    return {
      api: 'github-copilot',
      provider: 'github-copilot',
      baseUrl: 'https://api.githubcopilot.com',
    }
  }

  return {
    api: 'anthropic-messages',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
  }
}

// 创建占位 Model（SDK 初始化阶段使用）
function createPlaceholderModel(modelId?: string): Model {
  const resolvedModelId = modelId ?? 'claude-sonnet'
  const transport = inferModelTransport(resolvedModelId)

  return {
    id: resolvedModelId,
    name: resolvedModelId,
    api: transport.api,
    provider: transport.provider,
    baseUrl: transport.baseUrl,
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200_000,
    maxOutputTokens: 8192,
  }
}

// 创建 VitaminAgent 实例（§S13.1 五步）
export async function createVitaminAgent(options: VitaminAgentOptions): Promise<VitaminAgent> {
  // Step 1: 加载配置
  const configResult = await loadConfig({ cwd: options.projectDir })
  const config = configResult.config

  // Step 2: 初始化子系统
  const toolRegistry = createToolRegistry()
  const hookEngine = createHookEngine()
  const agentRegistry = createAgentRegistry()
  const backgroundManager = createBackgroundManager()
  const categoryResolver = createCategoryResolver()
  const sessionManager = createSessionManager({
    baseDir: options.projectDir + '/.vitamin/sessions',
  })
  const extensionRunner = createExtensionRunner()
  const mcpRegistry = createMcpRegistry()

  const taskDispatcher = createTaskDispatcher({
    registry: agentRegistry,
    categoryResolver,
    backgroundManager,
    resolveModel: (_reg) => createPlaceholderModel(options.model),
    resolveTools: (_reg) => toolRegistry.getAll(),
  })

  registerBuiltinTools(toolRegistry, options.projectDir)

  // Step 3: 加载扩展
  if (options.extensions) {
    for (const extFactory of options.extensions) {
      try {
        await extensionRunner.loadOne({
          name: `sdk-extension-${Math.random().toString(36).slice(2, 8)}`,
          source: 'local' as const,
          entryPoint: '',
          factory: extFactory as ExtensionFactory,
        })
      } catch (error) {
        logger.warn('Failed to load extension: %s', (error as Error).message)
      }
    }
  }

  const subsystems = {
    config: config as VitaminConfig,
    toolRegistry,
    hookEngine,
    agentRegistry,
    sessionManager,
    mcpRegistry,
    extensionRunner,
    taskDispatcher,
    backgroundManager,
  }

  // Step 4: 创建 AgentSession
  const session = await createAgentSession(subsystems, {
    mode: 'print',
    projectDir: options.projectDir,
    verbose: false,
    model: options.model,
  })

  let disposed = false
  const eventListeners = new Map<string, Set<(...args: any[]) => void>>()

  // Step 5: 返回 VitaminAgent 实例
  const agent: VitaminAgent = {
    prompt(text: string): IAgentStream {
      return createAgentStream(async (push, done, _signal) => {
        push({ type: 'start' })

        const result = await session.prompt(text)

        // 模拟流式事件（实际应从 agent 事件监听器获取）
        if (result.response.length > 0) {
          push({ type: 'text_delta', text: result.response })
        }

        for (const tc of result.toolCalls) {
          push({ type: 'tool_call', name: tc.name, args: tc.args })
          push({ type: 'tool_result', name: tc.name, result: tc.result })
        }

        push({ type: 'done', result })
        done()
        return result
      })
    },

    conversation(): ConversationHandle {
      const history: import('@vitamin/coding-agent').AgentSessionResult[] = []
      let ended = false

      return {
        send(text: string): IAgentStream {
          if (ended) {
            throw new Error('Conversation has ended')
          }

          return createAgentStream(async (push, done, _signal) => {
            push({ type: 'start' })

            const result = await session.prompt(text)
            history.push(result)

            if (result.response.length > 0) {
              push({ type: 'text_delta', text: result.response })
            }

            for (const tc of result.toolCalls) {
              push({ type: 'tool_call', name: tc.name, args: tc.args })
              push({ type: 'tool_result', name: tc.name, result: tc.result })
            }

            push({ type: 'done', result })
            done()
            return result
          })
        },

        getHistory() {
          return [...history]
        },

        get turnCount() {
          return history.length
        },

        end() {
          ended = true
        },
      }
    },

    steer(message: string): void {
      // 向会话注入引导消息
      session.prompt(message).catch((error) => {
        logger.error('Steer failed: %s', (error as Error).message)
      })
    },

    abort(): void {
      session.abort()
    },

    getState(): VitaminAgentState {
      return {
        model: session.state.currentModel,
        isRunning: session.state.isRunning,
        messageCount: session.state.messageCount,
        totalTokens: { ...session.state.totalTokens },
      }
    },

    async dispose(): Promise<void> {
      if (disposed) return
      disposed = true
      eventListeners.clear()
      await session.dispose()
      logger.info('VitaminAgent disposed')
    },

    registerTool(tool: ExternalToolDefinition): () => void {
      const agentTool = {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        execute: async (args: Record<string, unknown>) => {
          const result = await tool.execute(args)
          return { content: result, isError: false }
        },
      }
      toolRegistry.register(agentTool as any)
      logger.info(`工具已注册: ${tool.name}`)

      return () => {
        toolRegistry.unregister(tool.name)
        logger.info(`工具已注销: ${tool.name}`)
      }
    },

    on<E extends AgentEventName>(event: E, handler: AgentEventHandler<E>): () => void {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, new Set())
      }
      eventListeners.get(event)!.add(handler as any)

      return () => {
        eventListeners.get(event)?.delete(handler as any)
      }
    },
  }

  return agent
}
