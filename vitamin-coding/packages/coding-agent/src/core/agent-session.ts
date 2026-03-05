// AgentSession — 核心会话控制器
import { createLogger } from '@vitamin/shared'

import { createResourceLoader } from './resource-loader'
import { createSlashCommandRegistry } from './slash-commands'
import { buildSystemPrompt } from './system-prompt'

import type { Model } from '@vitamin/ai'
import type {
  AgentSession,
  AgentSessionResult,
  AgentSessionState,
  CLIOptions,
  Subsystems,
  ToolCallRecord,
} from '../types'

const logger = createLogger('coding-agent:session')

const DEFAULT_COPILOT_MODEL = 'github-copilot/claude-sonnet-4'

function normalizeModelId(modelId?: string): string {
  const raw = modelId?.trim()
  if (!raw) return DEFAULT_COPILOT_MODEL

  if (raw.includes('/')) return raw

  if (raw === 'claude-sonnet') {
    return DEFAULT_COPILOT_MODEL
  }

  return raw
}

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
    api: 'github-copilot',
    provider: 'github-copilot',
    baseUrl: 'https://api.githubcopilot.com',
  }
}

// 从模型 ID 创建占位 Model 对象（后续接入模型注册表）
function createPlaceholderModel(modelId: string): Model {
  const resolvedModelId = normalizeModelId(modelId)
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

// 创建 AgentSession
export async function createAgentSession(
  subsystems: Subsystems,
  options: CLIOptions,
): Promise<AgentSession> {
  const resourceLoader = createResourceLoader(options.projectDir)
  const slashCommands = createSlashCommandRegistry()

  async function resolveInitialSessionId(): Promise<string> {
    if (options.continueSession) {
      try {
        await subsystems.sessionManager.getTree(options.continueSession)
        return options.continueSession
      } catch (error) {
        logger.warn(
          'Continue session not found (%s): %s',
          options.continueSession,
          error instanceof Error ? error.message : String(error),
        )
      }
    }

    const created = await subsystems.sessionManager.create()
    return created.id
  }

  let activeSessionId = await resolveInitialSessionId()

  // 加载项目资源
  const resources = await resourceLoader.load()

  // 构建系统 Prompt
  const systemPrompt = buildSystemPrompt(
    subsystems.agentRegistry,
    subsystems.toolRegistry,
    resources,
  )

  // 初始状态
  const legacyDefaultModel = (subsystems.config as { defaultModel?: string }).defaultModel
  const state: AgentSessionState = {
    currentModel: normalizeModelId(options.model ?? subsystems.config.model ?? legacyDefaultModel),
    totalCost: 0,
    totalTokens: { input: 0, output: 0 },
    messageCount: 0,
    isRunning: false,
  }

  let abortController: AbortController | null = null

  async function refreshMessageCount(): Promise<void> {
    try {
      const tree = await subsystems.sessionManager.getTree(activeSessionId)
      const messageCount = tree
        .getActiveMessages()
        .filter((entry) => entry.type === 'message').length
      state.messageCount = messageCount
    } catch (error) {
      logger.warn(
        'Failed to refresh message count for %s: %s',
        activeSessionId,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  await refreshMessageCount()

  const session: AgentSession = {
    get id() {
      return activeSessionId
    },
    subsystems,
    state,

    async prompt(input: string): Promise<AgentSessionResult> {
      const startTime = Date.now()
      state.isRunning = true
      abortController = new AbortController()

      try {
        // 1. 检查斜杠命令
        const cmdResult = await slashCommands.execute(input, session)
        if (cmdResult !== null) {
          return {
            response: cmdResult,
            cost: 0,
            tokens: { input: 0, output: 0 },
            toolCalls: [],
            duration: Date.now() - startTime,
          }
        }

        // 2. Extension 输入拦截
        const inputEvent = { text: input, cancelled: false }
        await subsystems.extensionRunner.getEventBus().emit('input', inputEvent)
        if (inputEvent.cancelled) {
          return {
            response: '',
            cost: 0,
            tokens: { input: 0, output: 0 },
            toolCalls: [],
            duration: Date.now() - startTime,
          }
        }

        // 3. Skill/Template 展开 (§S12.3 Step 3)
        let processedInput = input
        if (subsystems.config.skills && Object.keys(subsystems.config.skills).length > 0) {
          processedInput = await expandSkillReferences(processedInput, subsystems)
        }

        // 4. Hook: chat.message.before
        const userMessage = {
          role: 'user' as const,
          content: processedInput,
          timestamp: Date.now(),
        }
        const beforeInput = {
          message: userMessage,
          sessionId: activeSessionId,
          isFirstMessage: state.messageCount === 0,
          metadata: {},
        }
        const beforeOutput = { message: userMessage, metadata: {}, cancelled: false }
        await subsystems.hookEngine.execute('chat.message.before', beforeInput, beforeOutput)
        if (beforeOutput.cancelled) {
          return {
            response: '',
            cost: 0,
            tokens: { input: 0, output: 0 },
            toolCalls: [],
            duration: Date.now() - startTime,
          }
        }

        // 5. 使用 Agent 处理 (§S12.3 Step 5)
        const toolCalls: ToolCallRecord[] = []
        let responseText = ''
        let inputTokens = 0
        let outputTokens = 0

        // 获取当前 agent（默认使用 central-secretariat）
        const agentRegistration = subsystems.agentRegistry.find('central-secretariat')

        if (agentRegistration) {
          const model = createPlaceholderModel(state.currentModel)
          const tools = subsystems.toolRegistry.getAll()
          const agentInstance = agentRegistration.factory(model, tools, {
            systemPrompt,
            providerRegistry: subsystems.providerRegistry,
          })

          const result = await agentInstance.prompt(processedInput)

          responseText = result.output
          inputTokens = result.usage.inputTokens
          outputTokens = result.usage.outputTokens
        } else {
          responseText = 'No agent available to process the request.'
        }

        // 6. Hook: chat.message.after
        const assistantMessage = {
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: responseText }],
          usage: { inputTokens, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 },
          stopReason: 'end_turn' as const,
          model: state.currentModel,
        }
        const afterInput = {
          message: assistantMessage,
          sessionId: activeSessionId,
          isFirstMessage: false,
          metadata: {},
        }
        const afterOutput = { message: assistantMessage, metadata: {}, cancelled: false }
        await subsystems.hookEngine.execute('chat.message.after', afterInput, afterOutput)

        // 7. Session 持久化 (§S12.3 Step 7)
        try {
          await subsystems.sessionManager.appendMessage(activeSessionId, {
            role: 'user',
            content: processedInput,
            timestamp: Date.now(),
          })
          await subsystems.sessionManager.appendMessage(activeSessionId, assistantMessage)
        } catch (persistError) {
          logger.warn(
            'Session persist failed: %s',
            persistError instanceof Error ? persistError.message : String(persistError),
          )
        }

        // 8. 更新状态（费用统计）
        state.totalTokens.input += inputTokens
        state.totalTokens.output += outputTokens
        state.messageCount += 2 // user + assistant

        const sessionResult: AgentSessionResult = {
          response: responseText,
          cost: 0,
          tokens: { input: inputTokens, output: outputTokens },
          toolCalls,
          duration: Date.now() - startTime,
        }

        return sessionResult
      } finally {
        state.isRunning = false
        abortController = null
      }
    },

    async listSessions() {
      return subsystems.sessionManager.list()
    },

    async switchSession(sessionId: string): Promise<void> {
      await subsystems.sessionManager.getTree(sessionId)
      activeSessionId = sessionId
      await refreshMessageCount()
      logger.info('Switched to session: %s', sessionId)
    },

    async deleteSession(sessionId: string): Promise<void> {
      if (sessionId === activeSessionId) {
        throw new Error('Cannot delete active session')
      }
      await subsystems.sessionManager.remove(sessionId)
    },

    abort(): void {
      if (abortController) {
        abortController.abort()
        state.isRunning = false
      }
    },

    getSystemPrompt(): string {
      return systemPrompt
    },

    switchModel(modelId: string): void {
      state.currentModel = normalizeModelId(modelId)
      logger.info('Model switched to: %s', modelId)
    },

    async compact(): Promise<void> {
      logger.info('Compacting session: %s', activeSessionId)
      await subsystems.sessionManager.compact(activeSessionId)
    },

    async dispose(): Promise<void> {
      session.abort()
      subsystems.extensionRunner.unloadAll()
      subsystems.backgroundManager.cancelAll()

      if (subsystems.server) {
        await subsystems.server.close().catch((err: any) => {
          logger.error({ err }, 'Failed to close inspector server on dispose')
        })
      }

      logger.info('Session disposed: %s', activeSessionId)
    },
  }

  return session
}

// §S12.3 Step 3: Skill/Template 展开 — 替换 @skill-name 引用为 skill 内容
async function expandSkillReferences(input: string, subsystems: Subsystems): Promise<string> {
  // 匹配 @skill-name 模式
  const skillPattern = /@([\w-]+)/g
  const matches = input.match(skillPattern)
  if (!matches) return input

  let expanded = input
  for (const match of matches) {
    const skillName = match.slice(1) // 去掉 @
    try {
      const mcpTools = subsystems.mcpRegistry.getToolsForMcp(skillName)
      if (mcpTools.length > 0) {
        expanded = expanded.replace(
          match,
          `[skill:${skillName} - ${mcpTools.length} tools available]`,
        )
      }
    } catch {
      // 未找到 skill → 保持原文
    }
  }

  return expanded
}
