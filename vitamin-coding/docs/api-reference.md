# API 参考

> Vitamin Coding 13 个 npm 包的公共 API 概览

## 包总览

| 包名 | 说明 | 层级 |
|------|------|------|
| `@vitamin/shared` | 公共工具（Logger、Error、Path） | L0 基础 |
| `@vitamin/ai` | 统一 LLM API 层（Model、Provider、Stream） | L1 核心 |
| `@vitamin/config` | 配置加载与验证（Zod v4） | L1 核心 |
| `@vitamin/agent` | Agent 核心循环（prompt → tool → response） | L2 能力 |
| `@vitamin/tools` | 26 个内置工具 + 工具注册表 | L2 能力 |
| `@vitamin/hooks` | 生命周期 Hook 引擎（18 事件 × 优先级） | L2 能力 |
| `@vitamin/session` | 会话管理（JSONL 存储、压缩、导出） | L2 能力 |
| `@vitamin/orchestrator` | 多 Agent 编排（注册、委派、DAG、Plan） | L3 编排 |
| `@vitamin/extension` | 扩展系统（加载、事件总线、内置 Extension） | L3 编排 |
| `@vitamin/mcp` | MCP 协议支持（Client、Registry、OAuth） | L3 编排 |
| `@vitamin/tui` | 终端 UI（Ink 组件） | L4 交互 |
| `@vitamin/coding-agent` | CLI 入口（main、AgentSession、Modes） | L5 应用 |
| `@vitamin/sdk` | 嵌入式 SDK（创建 Agent、RPC、Stream） | L5 应用 |

---

## @vitamin/shared

```typescript
// 日志
createLogger(namespace: string): Logger
// Logger: { info, warn, error, debug }

// 错误
VitaminError        // 基础错误类（code + context）
McpError            // MCP 相关错误
ConfigError         // 配置相关错误

// 路径工具
resolveProjectPath(base: string, relative: string): string
isInsideDirectory(child: string, parent: string): boolean

// 文件工具
readTextFile(path: string): Promise<string | undefined>
writeTextFile(path: string, content: string): Promise<void>
fileExists(path: string): Promise<boolean>
```

---

## @vitamin/ai

```typescript
// 模型
interface Model {
  id: string
  name: string
  api: ApiType              // 'anthropic-messages' | 'openai-completions' | ...
  provider: KnownProvider   // 'anthropic' | 'openai' | 'google' | 'ollama' | ...
  reasoning: boolean
  contextWindow: number
  maxOutputTokens: number
  cost: ModelCost
}

// 模型注册表
createModelRegistry(): ModelRegistry
  .register(model: Model): void
  .find(id: string): Model | undefined
  .getAll(): Model[]

// Provider
createProviderRegistry(): ProviderRegistry
  .register(provider: ProviderAdapter): void

// 流式调用
stream(options: StreamOrchestratorOptions): AsyncIterable<StreamEvent>
complete(options: StreamOrchestratorOptions): Promise<AssistantMessage>

// 模型解析
resolveModel(modelId: string, config?: ResolverConfig): Model

// Fallback 链
streamWithFallback(options, config: FallbackChainConfig): AsyncIterable<StreamEvent>

// 费用计算
calculateCost(model: Model, usage: Usage): number
createCostTracker(): CostTracker

// API Key
resolveApiKey(provider: string, options?: ApiKeyResolverOptions): string | undefined
```

---

## @vitamin/agent

```typescript
// Agent 工具
interface AgentTool<TArgs = unknown> {
  name: string
  description: string
  parameters: ZodType<TArgs>    // 支持 parse() 和 safeParse()
  visibility?: 'agent' | 'user' | 'both'
  execute(id: string, args: TArgs, signal: AbortSignal, onUpdate?: Function): Promise<ToolResult>
}

interface ToolResult {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; source: ImageSource }>
  isError?: boolean
}

// Agent 循环
agentLoop(options: AgentLoopOptions): Promise<AgentMessage[]>
createToolExecutor(): ToolExecutor

// Agent 创建
createAgent(config: AgentConfig): Agent
  .prompt(message: string): Promise<{ messages, output, usage }>
  .abort(): void
```

---

## @vitamin/tools

```typescript
// 工具注册表
createToolRegistry(): ToolRegistry
  .register(tool: AgentTool, options?: ToolRegistrationOptions): void
  .get(name: string): AgentTool | undefined
  .getAll(): AgentTool[]
  .getByPreset(preset: ToolPreset): AgentTool[]

type ToolPreset = 'minimal' | 'standard' | 'full'

// 注册全部内置工具
registerBuiltinTools(registry: ToolRegistry, projectDir: string, callbacks?): void

// 26 个内置工具
// minimal(4): read, write, edit, bash
// standard(+6): grep, glob, find, ls, ast-grep, delegate-task
// full(+16): edit-diff, look-at, interactive-bash, hashline-edit, ...
```

---

## @vitamin/hooks

```typescript
// Hook 引擎
createHookEngine(): HookEngine
  .register(registration: HookRegistration): void
  .execute(timing: HookTiming, input, output?): Promise<void>
  .getRegistered(): HookRegistration[]

interface HookRegistration {
  name: string
  timing: HookTiming       // 18 种: 'chat.message.before' | 'tool.execute.after' | ...
  priority: number          // 越小越先执行
  enabled: boolean
  handler: HookHandler
}

// 14 个内置 Hook
createFirstMessageVariantHook()
createKeywordDetectionHook()
createFileGuardHook()
createOutputTruncationHook()
createContextInjectorHook(config: ContextInjectorConfig)
createThinkingValidatorHook()
// ... 等
```

---

## @vitamin/session

```typescript
// 会话管理器
createSessionManager(config: { baseDir: string }): SessionManager
  .create(id: string): Promise<SessionEntry>
  .get(id: string): Promise<SessionEntry | undefined>
  .list(): Promise<SessionSummary[]>
  .delete(id: string): Promise<boolean>

// 会话树
createSessionTree(): SessionTree   // 分支与合并

// 压缩引擎
createCompactor(config?: CompactorConfig): Compactor
  .compact(entries: SessionEntry[]): Promise<CompactionResult>

// 压缩策略
createSummaryStrategy()         // LLM 摘要
createSlidingWindowStrategy()   // 滑动窗口
createIncrementalStrategy()     // 增量压缩

// HTML 导出
exportToHtml(entries: SessionEntry[], options?: HtmlExportOptions): string
```

---

## @vitamin/orchestrator

```typescript
// Agent 注册表
createAgentRegistry(): AgentRegistry
  .register(registration: AgentRegistration): void
  .find(name: string): AgentRegistration | undefined
  .getAll(): AgentRegistration[]

// 任务调度
createTaskDispatcher(options: TaskDispatcherOptions): TaskDispatcher
  .dispatch(request: TaskRequest): Promise<TaskHandle>

interface TaskRequest {
  prompt: string
  subagent?: string
  category?: string
  mode?: 'sync' | 'background'
}

// Plan-Build 管线
executePlanPipeline(request: string, options: PipelineOptions): Promise<PipelineResult>
executePlan(plan: Plan, options: PlanExecutorOptions): Promise<PlanExecutionResult>
createPlanStorage(projectRoot: string): PlanStorage

// DAG 执行
buildDag(steps: PlanStep[]): Map<string, DagNode>
getReadyNodes(dag): DagNode[]
isDagFinished(dag): boolean
validateDagNoCycles(dag): boolean

// 13 个 Agent 工厂
createCentralSecretariatAgent()    // 主 Agent
createExploreAgent()     // 代码探索
createOracleAgent()      // 知识查询
createPrometheusAgent()  // 计划生成
createAtlasAgent()       // 计划执行
createMomusAgent()       // 代码审查
// ... 等
```

---

## @vitamin/extension

```typescript
// Extension 运行器
createExtensionRunner(): ExtensionRunner
  .loadOne(descriptor: ExtensionDescriptor): Promise<void>
  .unloadAll(): void
  .getEventBus(): ExtensionEventBus

// 事件总线
createExtensionEventBus(): ExtensionEventBus
  .on(event, handler): () => void     // 类型化事件
  .emit(event, payload): Promise<void>
  .onBus(event, handler): () => void  // 自定义事件（扩展间通信）
  .emitBus(event, data): void

// 4 个内置 Extension
createPlanModeExtension(callbacks)      // /plan + /start-work 命令
createSkillLoaderExtension(callbacks)   // Skill 加载器
createGitMasterExtension(callbacks)     // Git 工具 (commit/push/branch/status)
createTmuxManagerExtension(callbacks)   // Tmux 工具 (create/list/kill/send/capture)
```

---

## @vitamin/mcp

```typescript
// MCP 客户端
createMcpClient(config: McpServerConfig): McpClient
  .connect(): Promise<void>
  .disconnect(): Promise<void>
  .listTools(): Promise<McpToolDefinition[]>
  .callTool(params): Promise<McpToolCallResult>

// MCP 注册表
createMcpRegistry(): McpRegistry
  .register(config, priority): Promise<McpToolDefinition[]>
  .registerWithTools(name, priority, client, tools): void
  .getAgentTools(): AgentTool[]

// MCP 配置加载
parseMcpConfig(path: string): McpConfigFile
expandEnvVars(value: string): string

// OAuth
createOAuthManager(): OAuthManager

// Skill MCP
createSkillMcpManager(): SkillMcpManager
```

---

## @vitamin/coding-agent

```typescript
// 主入口
main(options: CLIOptions): Promise<void>

// CLI 解析
parseCLI(argv: string[]): CLIOptions

// 会话创建
createAgentSession(subsystems: Subsystems, options: CLIOptions): Promise<AgentSession>

interface AgentSession {
  id: string
  state: AgentSessionState
  prompt(input: string): Promise<AgentSessionResult>
  abort(): void
  switchModel(modelId: string): void
  compact(): Promise<void>
  dispose(): Promise<void>
}

// 系统 Prompt
buildSystemPrompt(registry, tools, resources): string

// 斜杠命令
createSlashCommandRegistry(): SlashCommandRegistry
  .register(command: SlashCommandDef): void
  .execute(input: string, session): Promise<string | null>

// 模式
createPrintMode(): ModeRunner
createJsonMode(): ModeRunner
```

---

## @vitamin/sdk

```typescript
// 创建 Agent（SDK 主入口）
createVitaminAgent(options: VitaminAgentOptions): Promise<VitaminAgent>

interface VitaminAgent {
  prompt(text: string): AgentStream
  steer(message: string): void
  abort(): void
  getState(): VitaminAgentState
  dispose(): Promise<void>
}

// 流式消费
interface AgentStream extends AsyncIterable<StreamEvent> {
  result(): Promise<AgentSessionResult>
  abort(): void
}

type StreamEvent =
  | { type: 'start' }
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: string }
  | { type: 'done'; result: AgentSessionResult }
  | { type: 'error'; error: string }

// RPC
createRpcServer(options?: RPCServerOptions): RPCServerHandle
createRpcClient(options?: RPCClientOptions): RPCClientHandle
```
