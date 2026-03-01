// E2E 共享辅助函数 — 测试工厂和工具集
import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

import type { Subsystems } from '@vitamin/coding-agent'
import type { AgentTool } from '@vitamin/agent'
import type { Model } from '@vitamin/ai'
import type { AgentFactory } from '@vitamin/orchestrator'

// 创建 stub Agent 工厂
export function createStubAgentFactory(outputFn: (prompt: string) => string): AgentFactory {
  return (_model: Model, _tools: AgentTool[]) => ({
    prompt: async (message: string) => ({
      messages: [],
      output: outputFn(message),
      usage: { inputTokens: 100, outputTokens: 50 },
    }),
    abort: () => {},
    on: () => {},
  })
}

// 创建完整的 Subsystems
export async function createTestSubsystems(projectDir: string): Promise<Subsystems> {
  const toolRegistry = createToolRegistry()
  const hookEngine = createHookEngine()
  const agentRegistry = createAgentRegistry()
  const backgroundManager = createBackgroundManager()
  const categoryResolver = createCategoryResolver()
  const sessionManager = createSessionManager({
    baseDir: join(projectDir, '.vitamin/sessions'),
  })
  const extensionRunner = createExtensionRunner()
  const mcpRegistry = createMcpRegistry()

  const taskDispatcher = createTaskDispatcher({
    registry: agentRegistry,
    categoryResolver,
    backgroundManager,
    resolveModel: () => ({
      id: 'test-model',
      name: 'Test Model',
      api: 'anthropic-messages',
      provider: 'anthropic',
      baseUrl: 'https://test',
      reasoning: false,
      input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200_000,
      maxOutputTokens: 8192,
    } as never),
    resolveTools: () => toolRegistry.getAll(),
  })

  registerBuiltinTools(toolRegistry, projectDir)

  return {
    config: {} as Subsystems['config'],
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

// 创建临时项目目录
export async function createTempProjectDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'vitamin-e2e-'))
  await mkdir(join(dir, '.vitamin'), { recursive: true })
  return dir
}

// 清理临时目录
export async function cleanupTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true })
}

// 创建默认的 sisyphus 注册
export function registerStubSisyphus(subsystems: Subsystems, output = '回复'): void {
  subsystems.agentRegistry.register({
    name: 'sisyphus',
    factory: createStubAgentFactory(() => output),
    mode: 'primary',
    metadata: {
      category: 'orchestrator',
      cost: 'MODERATE',
      triggers: [],
      executionMode: 'sync',
    },
    modelPriority: ['test-model'],
    disableable: false,
    enabled: true,
  })
}
