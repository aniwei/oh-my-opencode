// AgentSession — 核心会话控制器
import { randomUUID } from 'node:crypto'

import { createLogger } from '@vitamin/shared'

import { buildSystemPrompt } from './system-prompt'
import { createResourceLoader } from './resource-loader'
import { createSlashCommandRegistry } from './slash-commands'

import type { Model } from '@vitamin/ai'
import type { Subsystems, AgentSession, AgentSessionState, AgentSessionResult, ToolCallRecord, CLIOptions } from '../types'

const logger = createLogger('coding-agent:session')

// 从模型 ID 创建占位 Model 对象（后续接入模型注册表）
function createPlaceholderModel(modelId: string): Model {
  return {
    id: modelId,
    name: modelId,
    api: 'anthropic-messages',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
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
  const sessionId = randomUUID()
  const resourceLoader = createResourceLoader(options.projectDir)
  const slashCommands = createSlashCommandRegistry()

  // 加载项目资源
  const resources = await resourceLoader.load()

  // 构建系统 Prompt
  const systemPrompt = buildSystemPrompt(
    subsystems.agentRegistry,
    subsystems.toolRegistry,
    resources,
  )

  // 初始状态
  const state: AgentSessionState = {
    currentModel: options.model ?? 'claude-sonnet',
    totalCost: 0,
    totalTokens: { input: 0, output: 0 },
    messageCount: 0,
    isRunning: false,
  }

  let abortController: AbortController | null = null

  const session: AgentSession = {
    id: sessionId,
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
        const userMessage = { role: 'user' as const, content: processedInput, timestamp: Date.now() }
        const beforeInput = { message: userMessage, sessionId, isFirstMessage: state.messageCount === 0, metadata: {} }
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

        // 获取当前 agent（默认使用 sisyphus）
        const agentRegistration = subsystems.agentRegistry.find('sisyphus')

        if (agentRegistration) {
          const model = createPlaceholderModel(state.currentModel)
          const tools = subsystems.toolRegistry.getAll()
          const agentInstance = agentRegistration.factory(model, tools, { systemPrompt })

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
        const afterInput = { message: assistantMessage, sessionId, isFirstMessage: false, metadata: {} }
        const afterOutput = { message: assistantMessage, metadata: {}, cancelled: false }
        await subsystems.hookEngine.execute('chat.message.after', afterInput, afterOutput)

        // 7. Session 持久化 (§S12.3 Step 7)
        try {
          await subsystems.sessionManager.appendMessage(sessionId, {
            role: 'user',
            content: processedInput,
            timestamp: Date.now(),
          })
          await subsystems.sessionManager.appendMessage(sessionId, assistantMessage)
        } catch (persistError) {
          logger.warn('Session persist failed: %s', persistError instanceof Error ? persistError.message : String(persistError))
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
      state.currentModel = modelId
      logger.info('Model switched to: %s', modelId)
    },

    async compact(): Promise<void> {
      logger.info('Compacting session: %s', sessionId)
      // 委托给 sessionManager 的压缩功能
    },

    async dispose(): Promise<void> {
      session.abort()
      subsystems.extensionRunner.unloadAll()
      subsystems.backgroundManager.cancelAll()
      logger.info('Session disposed: %s', sessionId)
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
        expanded = expanded.replace(match, `[skill:${skillName} - ${mcpTools.length} tools available]`)
      }
    } catch {
      // 未找到 skill → 保持原文
    }
  }

  return expanded
}
