import { loadConfig } from '@vitamin/config'
import { createExtensionRunner } from '@vitamin/extension'
import { createHookEngine } from '@vitamin/hooks'
import { createMcpRegistry } from '@vitamin/mcp'
import {
  createAnthropicProvider,
  createCopilotProvider,
  createGoogleProvider,
  createOpenAIResponsesProvider,
  createProviderRegistry,
} from '@vitamin/ai'
import {
  AGENT_METADATA,
  AGENT_MODEL_PRIORITY,
  AGENT_TOOL_RESTRICTIONS,
  createAgentRegistry,
  createAtlasAgent,
  createBackgroundManager,
  createCategoryResolver,
  createExploreAgent,
  createHephaestusAgent,
  createLibrarianAgent,
  createMetisAgent,
  createMomusAgent,
  createMultimodalLookerAgent,
  createOracleAgent,
  createPlanStorage,
  createPrometheusAgent,
  createSisyphusAgent,
  createSisyphusJuniorAgent,
  createTaskDispatcher,
  executePlan,
} from '@vitamin/orchestrator'
import { InspectorServer, LogBroadcastHub } from '@vitamin/server'
import { createSessionManager } from '@vitamin/session'
// 7 步初始化序列 + 主入口（§S12.1）
import { createLogger } from '@vitamin/shared'
import { attachLogListener } from '@vitamin/shared'
import { createToolRegistry, registerBuiltinTools } from '@vitamin/tools'

import { createAgentSession } from './core/agent-session'
import { createJsonMode } from './modes/json'
import { createPrintMode } from './modes/print'
import { createRpcMode } from './modes/rpc'

import type { AgentTool } from '@vitamin/agent'
import type { Model } from '@vitamin/ai'
import type { AgentFactory, AgentRegistration, TaskHandle } from '@vitamin/orchestrator'
import type { CLIOptions, ModeRunner, RunMode, Subsystems } from './types'

const logger = createLogger('coding-agent:main')

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

// 创建占位 Model（子系统初始化阶段使用，后续由 config 覆盖）
function createPlaceholderModel(modelId?: string): Model {
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

const BUILTIN_AGENT_FACTORIES: Record<string, AgentFactory> = {
  sisyphus: createSisyphusAgent,
  hephaestus: createHephaestusAgent,
  explore: createExploreAgent,
  oracle: createOracleAgent,
  librarian: createLibrarianAgent,
  'sisyphus-junior': createSisyphusJuniorAgent,
  prometheus: createPrometheusAgent,
  momus: createMomusAgent,
  metis: createMetisAgent,
  atlas: createAtlasAgent,
  'multimodal-looker': createMultimodalLookerAgent,
}

function registerBuiltinAgents(registry: ReturnType<typeof createAgentRegistry>): void {
  for (const [name, factory] of Object.entries(BUILTIN_AGENT_FACTORIES)) {
    const metadata = AGENT_METADATA[name]
    if (!metadata) {
      logger.warn('Missing metadata for agent: %s', name)
      continue
    }

    const registration: AgentRegistration = {
      name,
      factory,
      mode: name === 'sisyphus' ? 'all' : 'subagent',
      metadata,
      modelPriority: AGENT_MODEL_PRIORITY[name] ?? [normalizeModelId('claude-sonnet')],
      toolRestrictions: AGENT_TOOL_RESTRICTIONS[name],
      disableable: name !== 'sisyphus',
      enabled: true,
    }

    registry.register(registration)
  }
}

function resolveToolsForRegistration(
  registration: AgentRegistration,
  allTools: AgentTool[],
): AgentTool[] {
  const restrictions = registration.toolRestrictions
  if (!restrictions) return allTools

  if (restrictions.allowed && restrictions.allowed.length > 0) {
    const allowed = restrictions.allowed
    return allTools.filter((tool) => {
      return allowed.some((pattern) => {
        if (pattern.endsWith('*')) {
          return tool.name.startsWith(pattern.slice(0, -1))
        }
        return tool.name === pattern
      })
    })
  }

  if (restrictions.denied && restrictions.denied.length > 0) {
    const denied = new Set(restrictions.denied)
    return allTools.filter((tool) => !denied.has(tool.name))
  }

  return allTools
}

function createDefaultProviderRegistry() {
  const providerRegistry = createProviderRegistry()

  providerRegistry.register('anthropic-messages', createAnthropicProvider)
  providerRegistry.register('openai-responses', createOpenAIResponsesProvider)
  providerRegistry.register('google-generative-ai', createGoogleProvider)
  providerRegistry.register('github-copilot', createCopilotProvider)

  return providerRegistry
}

// Step 1: CLI 参数已由 cli.ts 解析为 CLIOptions

// Step 2: 加载配置
async function loadVitaminConfig(options: CLIOptions) {
  const result = await loadConfig({
    cwd: options.projectDir,
  })

  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      logger.warn('Config warning: %s', w.message)
    }
  }

  return result.config
}

// Step 3: 初始化子系统（并行初始化无依赖的子系统）
async function initSubsystems(config: unknown, options: CLIOptions): Promise<Subsystems> {
  const providerRegistry = createDefaultProviderRegistry()
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
  const backgroundTasks = new Map<string, TaskHandle>()

  registerBuiltinAgents(agentRegistry)

  const taskDispatcher = createTaskDispatcher({
    registry: agentRegistry,
    categoryResolver,
    backgroundManager,
    resolveModel: (_registration) => createPlaceholderModel(),
    resolveTools: (registration) =>
      resolveToolsForRegistration(registration, toolRegistry.getAll()),
    defaultFactoryOptions: {
      providerRegistry,
    },
  })

  const planStorage = createPlanStorage(options.projectDir)

  // 注册内置工具
  registerBuiltinTools(toolRegistry, options.projectDir, {
    taskDispatchFn: async ({ prompt, subagent, category, mode }) => {
      const handle = await taskDispatcher.dispatch({
        prompt,
        subagent,
        category,
        mode,
      })

      if (mode === 'background') {
        backgroundTasks.set(handle.taskId, handle)
        return { success: true, taskId: handle.taskId }
      }

      try {
        const result = await handle.getResult()
        return { success: true, output: result.output }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
    startWorkFn: async (planName) => {
      const plan = await planStorage.load(planName)
      if (!plan) {
        return { success: false, message: `未找到计划：${planName}` }
      }

      const result = await executePlan(plan, {
        dispatcher: taskDispatcher,
        storage: planStorage,
      })

      const summary = result.dagResult
      return {
        success: summary.allSuccessful,
        message: [
          `计划 ${planName} 已执行。`,
          `已完成：${String(summary.completed.length)}`,
          `失败：${String(summary.failed.length)}`,
          `已取消：${String(summary.cancelled.length)}`,
        ].join(' '),
      }
    },
    getBackgroundOutputFn: async (taskId) => {
      const handle = backgroundTasks.get(taskId)
      if (!handle) {
        return { status: 'not_found', error: '未找到任务' }
      }

      const status = handle.getStatus()
      if (status === 'completed') {
        try {
          const result = await handle.getResult()
          return { status, output: result.output }
        } catch (error) {
          return { status: 'error', error: error instanceof Error ? error.message : String(error) }
        }
      }

      if (status === 'error') {
        return {
          status,
          error: handle.error?.message ?? '任务失败',
        }
      }

      return { status }
    },
    cancelBackgroundFn: async (taskId) => {
      const handle = backgroundTasks.get(taskId)
      if (!handle) return false
      handle.cancel()
      return true
    },
    callAgentFn: async (agent, prompt) => {
      try {
        const handle = await taskDispatcher.dispatch({
          prompt,
          subagent: agent,
          mode: 'sync',
        })
        const result = await handle.getResult()
        return { success: true, output: result.output }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  })

  let server: InspectorServer | undefined = undefined

  if (options.inspect) {
    const port = options.inspect === true ? 9229 : options.inspect
    const logHub = new LogBroadcastHub(1000, 10000, true)

    // Bridge Pino to LogBroadcastHub
    attachLogListener((logObj) => {
      logHub.publish({
        level:
          logObj.level === 50
            ? 'error'
            : logObj.level === 40
              ? 'warn'
              : logObj.level === 20
                ? 'debug'
                : 'info',
        source: 'system',
        timestamp: new Date(logObj.time || Date.now()).toISOString(),
        payload: logObj,
        sessionId: logObj.sessionId,
        userId: logObj.userId,
      })
    })

    server = new InspectorServer({ port, logHub })
    server.start().then(() => {
      logger.info(`Inspector server started on port ${port}`)
    }).catch((err) => {
      logger.error({ err }, '启动 Inspector 服务器失败')
    })
  }

  return {
    config: config as Subsystems['config'],
    providerRegistry,
    toolRegistry,
    hookEngine,
    agentRegistry,
    sessionManager,
    mcpRegistry,
    extensionRunner,
    taskDispatcher,
    backgroundManager,
    server,
  }
}

// Step 5: 根据模式选择运行器
function selectMode(mode: RunMode): ModeRunner {
  switch (mode) {
    case 'print':
      return createPrintMode()
    case 'json':
      return createJsonMode()
    case 'rpc':
      return createRpcMode()
  }
}

// 主入口（7 步初始化）
export async function main(options: CLIOptions): Promise<void> {
  logger.info('Starting Vitamin with mode: %s', options.mode)

  try {
    // Step 2: loadConfig
    const config = await loadVitaminConfig(options)

    // Step 3: initSubsystems
    const subsystems = await initSubsystems(config, options)

    // Step 4: createAgentSession
    const session = await createAgentSession(subsystems, options)

    // Step 5: selectMode
    const mode = selectMode(options.mode)

    // Step 6: loadResources (已在 createAgentSession 中完成)

    // Step 7: enterMainLoop
    await mode.run(session, options)

    // 清理
    await session.dispose()
  } catch (error) {
    logger.error('致命错误：%s', error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
