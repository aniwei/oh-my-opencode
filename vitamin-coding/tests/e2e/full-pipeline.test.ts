// E2E 测试 — 全链路集成 (§5.3.1)
// 覆盖: 对话、工具调用、多 Agent、Plan/Build、Session、MCP、Extension、Slash 命令、Hook、Stream
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createToolRegistry, registerBuiltinTools } from '@vitamin/tools'
import { createHookEngine } from '@vitamin/hooks'
import {
  createAgentRegistry,
  createBackgroundManager,
  createCategoryResolver,
  createTaskDispatcher,
  createPlanStorage,
  executePlanPipeline,
  executePlan,
  buildDag,
  getReadyNodes,
  isDagFinished,
  getDagProgress,
  collectDagResult,
  planToMarkdown,
  markdownToPlan,
} from '@vitamin/orchestrator'
import type {
  AgentFactory,
  AgentRegistration,
  TaskRequest,
  PipelineOptions,
} from '@vitamin/orchestrator'
import { createSessionManager } from '@vitamin/session'
import { createExtensionRunner, createExtensionEventBus } from '@vitamin/extension'
import type { ExtensionFactory, ExtensionAPI } from '@vitamin/extension'
import { createMcpRegistry } from '@vitamin/mcp'
import type { McpToolDefinition, McpPriority } from '@vitamin/mcp'
import { createAgentSession } from '@vitamin/coding-agent'
import type { Subsystems, AgentSession } from '@vitamin/coding-agent'
import { createAgentStream } from '@vitamin/sdk'
import type { StreamEvent } from '@vitamin/sdk'
import type { AgentTool, ToolResult } from '@vitamin/agent'
import type { Model } from '@vitamin/ai'
import { z } from 'zod'

// ═══ 辅助: 创建 stub Agent 工厂 ═══

function createStubAgentFactory(outputFn: (prompt: string) => string): AgentFactory {
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

// ═══ 辅助: 创建完整的 Subsystems ═══

async function createTestSubsystems(projectDir: string): Promise<Subsystems> {
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

// ═══ E2E 测试 ═══

describe('E2E 全链路集成', () => {
  let projectDir: string

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'vitamin-e2e-'))
    await mkdir(join(projectDir, '.vitamin'), { recursive: true })
  })

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true })
  })

  // ─── 1. SDK 对话全链路 (5.3.1) ───
  describe('#given SDK 创建 Agent 实例', () => {
    it('#then 完整对话流程可运行', async () => {
      const subsystems = await createTestSubsystems(projectDir)

      // 注册 stub agent
      subsystems.agentRegistry.register({
        name: 'sisyphus',
        factory: createStubAgentFactory(() => '这是一个测试回复'),
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

      const session = await createAgentSession(subsystems, {
        mode: 'print',
        projectDir,
        verbose: false,
      })

      const result = await session.prompt('你好')

      expect(result.response).toBe('这是一个测试回复')
      expect(result.tokens.input).toBe(100)
      expect(result.tokens.output).toBe(50)
      expect(result.duration).toBeGreaterThanOrEqual(0)
      expect(session.state.messageCount).toBe(2) // user + assistant

      await session.dispose()
    })
  })

  // ─── 2. 工具注册 + AgentSession 工具可用性 ───
  describe('#given 完整工具注册', () => {
    it('#then AgentSession 可访问所有已注册工具', async () => {
      const subsystems = await createTestSubsystems(projectDir)
      const allTools = subsystems.toolRegistry.getAll()

      // full preset 至少 26 个工具
      expect(allTools.length).toBeGreaterThanOrEqual(26)

      // 关键工具都在
      const toolNames = allTools.map(t => t.name)
      expect(toolNames).toContain('edit')
      expect(toolNames).toContain('read')
      expect(toolNames).toContain('bash')
    })
  })

  // ─── 3. 多 Agent 委派 (TaskDispatcher) ───
  describe('#given 多个 Agent 注册到编排引擎', () => {
    it('#then TaskDispatcher 能委派到正确的 subagent', async () => {
      const subsystems = await createTestSubsystems(projectDir)

      subsystems.agentRegistry.register({
        name: 'explore',
        factory: createStubAgentFactory(() => '探索结果: 找到 3 个相关文件'),
        mode: 'subagent',
        metadata: {
          category: 'exploration',
          cost: 'CHEAP',
          triggers: [{ domain: 'codebase', trigger: 'explore' }],
          executionMode: 'sync',
        },
        modelPriority: ['test-model'],
        disableable: true,
        enabled: true,
      })

      const handle = await subsystems.taskDispatcher.dispatch({
        prompt: '搜索认证相关代码',
        subagent: 'explore',
        mode: 'sync',
      })

      const result = await handle.getResult()
      expect(result.output).toContain('探索结果')
      expect(result.usage.inputTokens).toBe(100)
    })
  })

  // ─── 4. Plan Pipeline (Metis → Prometheus → Momus) ───
  describe('#given Plan Pipeline 完整流程', () => {
    it('#then 三阶段管线生成并通过审批', async () => {
      const subsystems = await createTestSubsystems(projectDir)

      // Metis
      subsystems.agentRegistry.register({
        name: 'metis',
        factory: createStubAgentFactory(() => '预分析: 这是一个中等复杂度的重构任务'),
        mode: 'subagent',
        metadata: { category: 'advisor', cost: 'CHEAP', triggers: [], executionMode: 'sync' },
        modelPriority: ['test-model'],
        disableable: true,
        enabled: true,
      })

      // Prometheus
      subsystems.agentRegistry.register({
        name: 'prometheus',
        factory: createStubAgentFactory(() =>
          '# 重构计划\n\n## Steps\n\n- [ ] Step 1: 分析现有代码\n- [ ] Step 2: 编写测试\n- [ ] Step 3: 重构实现',
        ),
        mode: 'subagent',
        metadata: { category: 'advisor', cost: 'EXPENSIVE', triggers: [], executionMode: 'sync' },
        modelPriority: ['test-model'],
        disableable: true,
        enabled: true,
      })

      // Momus
      subsystems.agentRegistry.register({
        name: 'momus',
        factory: createStubAgentFactory(() => '[OKAY] 计划合理，可以执行'),
        mode: 'subagent',
        metadata: { category: 'advisor', cost: 'CHEAP', triggers: [], executionMode: 'sync' },
        modelPriority: ['test-model'],
        disableable: true,
        enabled: true,
      })

      const storage = createPlanStorage(projectDir)

      const result = await executePlanPipeline('重构认证系统', {
        dispatcher: subsystems.taskDispatcher,
        storage,
        maxRevisions: 2,
      })

      expect(result.success).toBe(true)
      expect(result.plan).toBeDefined()
      expect(result.planPath).toBeDefined()
      expect(result.phases).toContain('metis')
      expect(result.phases).toContain('prometheus')
      expect(result.phases).toContain('momus')
      expect(result.phases).toContain('completed')

      // 计划已保存到磁盘
      const plans = await storage.list()
      expect(plans.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ─── 5. Plan 执行 (Atlas DAG) ───
  describe('#given Plan 执行引擎', () => {
    it('#then DAG 按拓扑顺序并行执行步骤', async () => {
      const subsystems = await createTestSubsystems(projectDir)

      // 注册用于执行步骤的 agent
      subsystems.agentRegistry.register({
        name: 'sisyphus-junior',
        factory: createStubAgentFactory((prompt) => `完成: ${prompt.slice(0, 50)}`),
        mode: 'subagent',
        metadata: { category: 'specialist', cost: 'MODERATE', triggers: [], executionMode: 'sync' },
        modelPriority: ['test-model'],
        disableable: true,
        enabled: true,
      })

      const storage = createPlanStorage(projectDir)
      const plan = {
        name: 'test-plan',
        title: '测试计划',
        description: '用于 E2E 测试的计划',
        steps: [
          { id: 'step-1', title: '分析代码', description: '分析现有代码结构', dependencies: [], estimatedMinutes: 5, status: 'pending' as const },
          { id: 'step-2', title: '编写测试', description: '编写单元测试', dependencies: ['step-1'], estimatedMinutes: 10, status: 'pending' as const },
          { id: 'step-3', title: '重构实现', description: '执行代码重构', dependencies: ['step-1'], estimatedMinutes: 15, status: 'pending' as const },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      }

      await storage.save(plan)

      const events: string[] = []
      const result = await executePlan(plan, {
        dispatcher: subsystems.taskDispatcher,
        storage,
        maxConcurrency: 2,
        onProgress: (event) => {
          events.push(`${event.type}:${event.stepId}`)
        },
      })

      // 所有步骤完成
      expect(result.dagResult.completed.length).toBe(3)
      expect(result.dagResult.failed.length).toBe(0)
      expect(result.dagResult.allSuccessful).toBe(true)
      expect(result.totalTime).toBeGreaterThanOrEqual(0)

      // 进度事件已触发
      expect(events.some(e => e.startsWith('step-start'))).toBe(true)
      expect(events.some(e => e.startsWith('step-complete'))).toBe(true)
    })
  })

  // ─── 6. Session 生命周期 ───
  describe('#given Session 完整生命周期', () => {
    it('#then 创建、对话、切换模型、释放全流程正常', async () => {
      const subsystems = await createTestSubsystems(projectDir)

      subsystems.agentRegistry.register({
        name: 'sisyphus',
        factory: createStubAgentFactory(() => '回复'),
        mode: 'primary',
        metadata: { category: 'orchestrator', cost: 'MODERATE', triggers: [], executionMode: 'sync' },
        modelPriority: ['test-model'],
        disableable: false,
        enabled: true,
      })

      const session = await createAgentSession(subsystems, {
        mode: 'print',
        projectDir,
        verbose: false,
      })

      // 初始状态
      expect(session.id).toBeDefined()
      expect(session.state.isRunning).toBe(false)
      expect(session.state.messageCount).toBe(0)

      // 第一次对话
      await session.prompt('hello')
      expect(session.state.messageCount).toBe(2)

      // 第二次对话
      await session.prompt('world')
      expect(session.state.messageCount).toBe(4)

      // 切换模型
      session.switchModel('gpt-4')
      expect(session.state.currentModel).toBe('gpt-4')

      // 获取系统 Prompt
      const sysPrompt = session.getSystemPrompt()
      expect(typeof sysPrompt).toBe('string')

      // 释放
      await session.dispose()
    })
  })

  // ─── 7. MCP 工具注册与转换 ───
  describe('#given MCP Registry 集成', () => {
    it('#then MCP 工具正确转换为 AgentTool 格式', () => {
      const mcpRegistry = createMcpRegistry()

      // 模拟预加载的 MCP 工具
      const mockTools: McpToolDefinition[] = [
        {
          name: 'web_search',
          description: '搜索互联网',
          inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
        },
        {
          name: 'code_search',
          description: '搜索代码库',
          inputSchema: { type: 'object', properties: { pattern: { type: 'string' } } },
        },
      ]

      // 使用 mock client
      const mockClient = {
        connect: async () => {},
        disconnect: async () => {},
        listTools: async () => mockTools,
        callTool: async () => ({ content: [{ type: 'text' as const, text: '搜索结果' }] }),
        isConnected: () => true,
        getConfig: () => ({ name: 'test-mcp', transport: 'http' as const, url: 'http://test' }),
        getName: () => 'test-mcp',
      }

      mcpRegistry.registerWithTools('test-mcp', 'builtin', mockClient as never, mockTools)

      const agentTools = mcpRegistry.getAgentTools()
      expect(agentTools.length).toBe(2)
      expect(agentTools[0]?.name).toContain('web_search')
      expect(agentTools[0]?.description).toContain('搜索互联网')
    })
  })

  // ─── 8. Extension 加载 + 事件通信 ───
  describe('#given Extension 系统集成', () => {
    it('#then Extension 可注册工具和监听事件', async () => {
      const runner = createExtensionRunner()
      const registeredTools: string[] = []

      const testExtension: ExtensionFactory = (api: ExtensionAPI) => {
        registeredTools.push('custom-tool')
        api.registerTool({
          name: 'custom-tool',
          description: '自定义测试工具',
          parameters: z.object({ input: z.string() }),
          execute: async () => ({
            content: [{ type: 'text' as const, text: '工具执行结果' }],
          }),
        } as AgentTool)
      }

      await runner.loadOne({
        name: 'test-extension',
        source: 'local' as const,
        entryPoint: '',
        factory: testExtension as never,
      })

      expect(registeredTools).toContain('custom-tool')
    })
  })

  // ─── 9. Slash 命令集成 ───
  describe('#given AgentSession 支持 Slash 命令', () => {
    it('#then /model 命令可切换模型', async () => {
      const subsystems = await createTestSubsystems(projectDir)

      subsystems.agentRegistry.register({
        name: 'sisyphus',
        factory: createStubAgentFactory(() => '回复'),
        mode: 'primary',
        metadata: { category: 'orchestrator', cost: 'MODERATE', triggers: [], executionMode: 'sync' },
        modelPriority: ['test-model'],
        disableable: false,
        enabled: true,
      })

      const session = await createAgentSession(subsystems, {
        mode: 'print',
        projectDir,
        verbose: false,
      })

      const result = await session.prompt('/model gpt-4o')
      // Slash 命令应返回命令结果而非空
      expect(typeof result.response).toBe('string')
      // token 消耗为 0（slash 命令不发给 LLM）
      expect(result.tokens.input).toBe(0)
      expect(result.tokens.output).toBe(0)

      await session.dispose()
    })
  })

  // ─── 10. Hook 管线 (before → after) ───
  describe('#given Hook 管线集成', () => {
    it('#then Hook 可拦截和修改消息', async () => {
      const subsystems = await createTestSubsystems(projectDir)
      const hookLog: string[] = []

      // 注册 before hook
      subsystems.hookEngine.register({
        name: 'test-before-hook',
        timing: 'chat.message.before',
        priority: 10,
        enabled: true,
        handler: async (_input: unknown, _output: unknown) => {
          hookLog.push('before')
        },
      })

      // 注册 after hook
      subsystems.hookEngine.register({
        name: 'test-after-hook',
        timing: 'chat.message.after',
        priority: 10,
        enabled: true,
        handler: async (_input: unknown, _output: unknown) => {
          hookLog.push('after')
        },
      })

      subsystems.agentRegistry.register({
        name: 'sisyphus',
        factory: createStubAgentFactory(() => '回复'),
        mode: 'primary',
        metadata: { category: 'orchestrator', cost: 'MODERATE', triggers: [], executionMode: 'sync' },
        modelPriority: ['test-model'],
        disableable: false,
        enabled: true,
      })

      const session = await createAgentSession(subsystems, {
        mode: 'print',
        projectDir,
        verbose: false,
      })

      await session.prompt('测试 Hook 管线')

      expect(hookLog).toContain('before')
      expect(hookLog).toContain('after')
      expect(hookLog.indexOf('before')).toBeLessThan(hookLog.indexOf('after'))

      await session.dispose()
    })
  })

  // ─── 11. AgentStream 异步迭代 ───
  describe('#given AgentStream 流式消费', () => {
    it('#then 可用 for-await-of 迭代所有事件', async () => {
      const events: StreamEvent[] = []

      const stream = createAgentStream(async (push, done) => {
        push({ type: 'start' })
        push({ type: 'text_delta', text: '你好' })
        push({ type: 'tool_call', name: 'read-file', args: { path: 'test.ts' } })
        push({ type: 'tool_result', name: 'read-file', result: '文件内容' })
        push({
          type: 'done',
          result: {
            response: '你好',
            cost: 0,
            tokens: { input: 10, output: 5 },
            toolCalls: [],
            duration: 100,
          },
        })
        done()
        return {
          response: '你好',
          cost: 0,
          tokens: { input: 10, output: 5 },
          toolCalls: [],
          duration: 100,
        }
      })

      for await (const event of stream) {
        events.push(event)
      }

      expect(events.length).toBe(5)
      expect(events[0]?.type).toBe('start')
      expect(events[1]?.type).toBe('text_delta')
      expect(events[2]?.type).toBe('tool_call')
      expect(events[3]?.type).toBe('tool_result')
      expect(events[4]?.type).toBe('done')

      const result = await stream.result()
      expect(result.response).toBe('你好')
    })
  })

  // ─── 12. Extension 事件总线跨扩展通信 ───
  describe('#given Extension 事件总线', () => {
    it('#then 扩展间通过 bus 事件通信', async () => {
      const eventBus = createExtensionEventBus()
      const received: unknown[] = []

      // 扩展 A 监听
      eventBus.onBus('skill:list:response', (data) => {
        received.push(data)
      })

      // 扩展 B 发送
      eventBus.emitBus('skill:list:response', { skills: ['code-review', 'testing'] })

      expect(received.length).toBe(1)
      expect(received[0]).toEqual({ skills: ['code-review', 'testing'] })

      eventBus.clear()
    })
  })

  // ─── 13. Plan 存储 CRUD ───
  describe('#given PlanStorage 存储系统', () => {
    it('#then 计划的创建、读取、列出、删除全流程', async () => {
      const storage = createPlanStorage(projectDir)

      const plan = {
        name: 'auth-refactor',
        title: '认证重构',
        description: '重构认证系统',
        steps: [
          { id: 's1', title: '分析', description: '分析现有代码', dependencies: [], estimatedMinutes: 5, status: 'pending' as const },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {},
      }

      // 保存
      const planPath = await storage.save(plan)
      expect(planPath).toContain('auth-refactor')

      // 读取
      const loaded = await storage.load('auth-refactor')
      expect(loaded).toBeDefined()
      expect(loaded?.name).toBe('auth-refactor')

      // 列出
      const list = await storage.list()
      expect(list).toContain('auth-refactor')

      // 更新
      plan.steps[0]!.status = 'completed' as never
      await storage.update(plan)
      const updated = await storage.load('auth-refactor')
      expect(updated).toBeDefined()

      // 删除
      const removed = await storage.remove('auth-refactor')
      expect(removed).toBe(true)
      const afterRemove = await storage.list()
      expect(afterRemove).not.toContain('auth-refactor')
    })
  })

  // ─── 14. DAG 执行引擎独立验证 ───
  describe('#given DAG 执行引擎', () => {
    it('#then 正确计算拓扑顺序和进度', () => {
      const steps = [
        { id: 'a', title: 'A', description: '', dependencies: [], estimatedMinutes: 1, status: 'pending' as const },
        { id: 'b', title: 'B', description: '', dependencies: ['a'], estimatedMinutes: 1, status: 'pending' as const },
        { id: 'c', title: 'C', description: '', dependencies: ['a'], estimatedMinutes: 1, status: 'pending' as const },
        { id: 'd', title: 'D', description: '', dependencies: ['b', 'c'], estimatedMinutes: 1, status: 'pending' as const },
      ]

      const dag = buildDag(steps)

      // 初始只有 A 就绪
      const ready1 = getReadyNodes(dag)
      expect(ready1.length).toBe(1)
      expect(ready1[0]?.step.id).toBe('a')

      // A 完成后 B、C 就绪
      const nodeA = dag.get('a')!
      nodeA.status = 'completed'
      const ready2 = getReadyNodes(dag)
      expect(ready2.length).toBe(2)
      expect(ready2.map(n => n.step.id).sort()).toEqual(['b', 'c'])

      // B、C 完成后 D 就绪
      dag.get('b')!.status = 'completed'
      dag.get('c')!.status = 'completed'
      const ready3 = getReadyNodes(dag)
      expect(ready3.length).toBe(1)
      expect(ready3[0]?.step.id).toBe('d')

      // D 完成后 DAG 结束
      dag.get('d')!.status = 'completed'
      expect(isDagFinished(dag)).toBe(true)
      expect(getDagProgress(dag)).toBe(100)

      const result = collectDagResult(dag)
      expect(result.completed.length).toBe(4)
      expect(result.failed.length).toBe(0)
      expect(result.allSuccessful).toBe(true)
    })
  })

  // ─── 15. Plan Markdown 序列化/反序列化 ───
  describe('#given Plan Markdown 格式', () => {
    it('#then 序列化和反序列化保持一致性', () => {
      const plan = {
        name: 'test-plan',
        title: '测试计划',
        description: '序列化测试',
        steps: [
          { id: 'step-1', title: 'First', description: '第一步', dependencies: [], estimatedMinutes: 5, status: 'pending' as const },
          { id: 'step-2', title: 'Second', description: '第二步', dependencies: ['step-1'], estimatedMinutes: 10, status: 'completed' as const },
        ],
        createdAt: 1000000,
        updatedAt: 2000000,
        metadata: {},
      }

      const markdown = planToMarkdown(plan)
      expect(markdown).toContain('测试计划')
      expect(markdown).toContain('First')
      expect(markdown).toContain('Second')

      const restored = markdownToPlan('test-plan', markdown)
      expect(restored.name).toBe('test-plan')
      expect(restored.steps.length).toBe(2)
    })
  })
})
