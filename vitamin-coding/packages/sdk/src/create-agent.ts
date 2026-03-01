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
import { createMcpRegistry } from '@vitamin/mcp'
import { createAgentSession } from '@vitamin/coding-agent'

import { createAgentStream } from './agent-stream'

import type { VitaminAgent, VitaminAgentOptions, VitaminAgentState, ConversationHandle, AgentStream as IAgentStream } from './types'

const logger = createLogger('sdk:agent')

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
    resolveModel: (_reg) => ({
      id: options.model ?? 'claude-sonnet',
      name: options.model ?? 'claude-sonnet',
      api: 'anthropic-messages',
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      reasoning: false,
      input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200_000,
      maxOutputTokens: 8192,
    } as never),
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
          factory: extFactory as never,
        })
      } catch (error) {
        logger.warn('Failed to load extension: %s', (error as Error).message)
      }
    }
  }

  const subsystems = {
    config: config as never,
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

  // Step 5: 返回 VitaminAgent 实例
  const agent: VitaminAgent = {
    prompt(text: string): IAgentStream {
      return createAgentStream(async (push, done) => {
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

          return createAgentStream(async (push, done) => {
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
      await session.dispose()
      logger.info('VitaminAgent disposed')
    },
  }

  return agent
}
