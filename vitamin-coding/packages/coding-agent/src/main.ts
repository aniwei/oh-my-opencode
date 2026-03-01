// 7 步初始化序列 + 主入口（§S12.1）
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

import { createAgentSession } from './core/agent-session'
import { createPrintMode } from './modes/print'
import { createJsonMode } from './modes/json'
import { createInteractiveMode } from './modes/interactive'

import type { CLIOptions, Subsystems, RunMode, ModeRunner } from './types'

const logger = createLogger('coding-agent:main')

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
  const toolRegistry = createToolRegistry()
  const hookEngine = createHookEngine()
  const agentRegistry = createAgentRegistry()
  const backgroundManager = createBackgroundManager()
  const categoryResolver = createCategoryResolver()
  const sessionManager = createSessionManager({ baseDir: options.projectDir + '/.vitamin/sessions' })
  const extensionRunner = createExtensionRunner()
  const mcpRegistry = createMcpRegistry()

  const taskDispatcher = createTaskDispatcher({
    registry: agentRegistry,
    categoryResolver,
    backgroundManager,
    resolveModel: (_registration) => ({ id: 'claude-sonnet', provider: 'anthropic', name: 'Claude Sonnet' }) as never,
    resolveTools: (_registration) => toolRegistry.getAll(),
  })

  // 注册内置工具
  registerBuiltinTools(toolRegistry, options.projectDir)

  return {
    config: config as Subsystems['config'],
    toolRegistry,
    hookEngine,
    agentRegistry,
    sessionManager,
    mcpRegistry,
    extensionRunner,
    taskDispatcher,
    backgroundManager,
  }
}

// Step 5: 根据模式选择运行器
function selectMode(mode: RunMode): ModeRunner {
  switch (mode) {
    case 'print':
      return createPrintMode()
    case 'json':
      return createJsonMode()
    case 'interactive':
      return createInteractiveMode()
    case 'rpc':
      // RPC 模式（SDK 使用）
      return {
        async run(_session, _options) {
          process.stdout.write('RPC mode not yet implemented.\n')
        },
      }
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
    logger.error('Fatal error: %s', error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
