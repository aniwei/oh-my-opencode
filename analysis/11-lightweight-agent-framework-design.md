# Vitamin Coding — 轻量级 Agent 框架设计文档

> 基于 OpenCode + oh-my-opencode 源码 | Node.js 实现 | 2026-02-28

---

## 目录

1. [设计目标与动机](#1-设计目标与动机)
2. [架构总览](#2-架构总览)
3. [核心抽象层设计](#3-核心抽象层设计)
4. [Agent 系统](#4-agent-系统)
5. [Tool 系统](#5-tool-系统)
6. [Hook / Middleware 系统](#6-hook--middleware-系统)
7. [Session 与执行引擎](#7-session-与执行引擎)
8. [配置系统](#8-配置系统)
9. [MCP 集成层](#9-mcp-集成层)
10. [Skill 系统](#10-skill-系统)
11. [并发与后台任务](#11-并发与后台任务)
12. [初始化流程](#12-初始化流程)
13. [API 设计](#13-api-设计)
14. [与现有系统的对比](#14-与现有系统的对比)
15. [分阶段实施路线](#15-分阶段实施路线)

---

## 1. 设计目标与动机

### 1.1 现状分析

当前 oh-my-opencode 以 **OpenCode Plugin** 形态存在，深度耦合 OpenCode 运行时：

```
OpenCode Runtime (Go 进程)
  │
  └─→ Plugin System (fork 子进程)
        └─→ oh-my-opencode (TypeScript)
              ├─ 11 Agents
              ├─ 26 Tools
              ├─ 46 Hooks
              └─ 19 Features
```

**痛点：**

| 问题 | 描述 |
|------|------|
| **Runtime 耦合** | 必须依赖 OpenCode Go 进程的 session/event/config API |
| **IPC 瓶颈** | Plugin 通过 HTTP 与 OpenCode 通信，延迟高 |
| **部署限制** | 只能作为 OpenCode 插件运行，无法独立使用 |
| **调试困难** | Plugin 在子进程中运行，断点和日志分散 |
| **模型提供者锁定** | 依赖 OpenCode 管理的 Provider 连接 |

### 1.2 目标

设计一个 **轻量级独立 Agent 框架**，整合 OpenCode SDK 和 oh-my-opencode 的精华：

| 目标 | 量化指标 |
|------|---------|
| **独立运行** | 无需 OpenCode Runtime，Node.js 直接启动 |
| **保持兼容** | 可选桥接回 OpenCode Plugin 模式 |
| **核心精简** | 框架核心 < 3000 行，无业务逻辑 |
| **零依赖核心** | 核心层仅依赖 Node.js stdlib |
| **保留精华** | Agent 编排、Hook 生命周期、MCP、Skill、Task 委派 |
| **TypeScript First** | 完整类型推断，Zod 运行时校验 |

### 1.3 非目标

- 不重写 OpenCode Runtime（Go → Node.js）
- 不实现 TUI/GUI
- 不内置特定 LLM Provider SDK（通过 Adapter 扩展）
- 不替代 oh-my-opencode 的业务逻辑（框架只提供骨架）

---

## 2. 架构总览

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Application Layer                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │ Sisyphus │ │ Oracle   │ │Roundtable│ │ Custom Agents ... │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      Framework Layer                            │
│  ┌──────────────┐ ┌─────────────┐ ┌─────────────────────────┐  │
│  │ Agent Engine  │ │ Tool Engine │ │ Hook / Middleware Engine │  │
│  │ ├ Registry    │ │ ├ Registry  │ │ ├ Lifecycle Hooks       │  │
│  │ ├ Resolver    │ │ ├ Executor  │ │ ├ Guard Chain           │  │
│  │ ├ Fallback    │ │ └ Schema    │ │ └ Transform Pipeline    │  │
│  │ └ Orchestrator│ │             │ │                         │  │
│  └──────────────┘ └─────────────┘ └─────────────────────────┘  │
│  ┌──────────────┐ ┌─────────────┐ ┌─────────────────────────┐  │
│  │ Session Mgr  │ │ Config Mgr  │ │ Concurrency Manager     │  │
│  └──────────────┘ └─────────────┘ └─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      Adapter Layer                              │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐  │
│  │ Anthropic  │ │ OpenAI    │ │ OpenCode  │ │ Custom LLM    │  │
│  │ Adapter    │ │ Adapter   │ │ Bridge    │ │ Adapter       │  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────────┘  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                    │
│  │ MCP Client│ │ Skill     │ │ FS / Shell│                    │
│  │ Adapter   │ │ Loader    │ │ Adapter   │                    │
│  └───────────┘ └───────────┘ └───────────┘                    │
├─────────────────────────────────────────────────────────────────┤
│                      Platform Layer                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Node.js Runtime (fs, net, child_process, worker_threads)  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 模块拓扑图

```
                    createFramework(config)
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    ConfigManager    AdapterRegistry   PluginRegistry
          │                │                │
          ├─────┬──────────┤                │
          ▼     ▼          ▼                ▼
     AgentEngine   ToolEngine    HookEngine
          │           │              │
          ├───────────┼──────────────┤
          ▼           ▼              ▼
      SessionManager ──────→ ConcurrencyManager
          │
          ▼
      ExecutionEngine (Chat Loop)
          │
          ├─→ LLM Adapter.chat(messages, tools)
          ├─→ ToolEngine.execute(toolCall)
          ├─→ HookEngine.emit("tool.execute.before")
          └─→ AgentEngine.delegate(subagent, task)
```

---

## 3. 核心抽象层设计

### 3.1 从现有源码提取的核心接口

oh-my-opencode 的成功源于几个关键抽象。框架将这些精华提取为 **与 OpenCode 无关** 的接口：

#### 3.1.1 来自 OpenCode SDK 的核心类型

```typescript
// ---- 来自 @opencode-ai/sdk AgentConfig ----
// 需要解耦为框架自有类型

interface AgentConfig {
  name: string
  model: string
  description: string
  prompt: string                    // system prompt
  mode: "primary" | "subagent" | "all"
  temperature?: number
  maxTokens?: number
  tools?: Record<string, boolean>   // tool 白名单/黑名单
  permission?: PermissionConfig
  // 扩展字段 (oh-my-opencode 引入)
  thinking?: { type: "enabled"; budgetTokens: number }
  reasoningEffort?: "low" | "medium" | "high"
  maxSteps?: number
  [key: string]: unknown
}

// ---- 来自 @opencode-ai/plugin ToolDefinition ----
// 保留 Zod schema 驱动的工具定义模式

interface ToolDefinition<TArgs = unknown> {
  description: string
  args: ZodSchema<TArgs>            // Zod schema → JSON Schema → LLM function calling
  execute(args: TArgs, context: ToolContext): Promise<string>
}

// ---- 来自 @opencode-ai/plugin Hooks ----
// 提取为通用中间件模式

interface FrameworkHooks {
  "agent.create"?: HookFn<AgentCreateInput, AgentCreateOutput>
  "agent.message"?: HookFn<ChatInput, ChatOutput>
  "tool.execute.before"?: HookFn<ToolBeforeInput, ToolBeforeOutput>
  "tool.execute.after"?: HookFn<ToolAfterInput, ToolAfterOutput>
  "session.created"?: HookFn<SessionEvent, void>
  "session.idle"?: HookFn<SessionEvent, void>
  "session.error"?: HookFn<SessionErrorEvent, void>
  "session.compacting"?: HookFn<CompactInput, CompactOutput>
  "messages.transform"?: HookFn<void, MessagesTransformOutput>
}
```

#### 3.1.2 来自 oh-my-opencode 的核心模式

```typescript
// ---- 来自 oh-my-opencode AgentFactory 模式 ----
type AgentFactory = ((model: string, ...extra: unknown[]) => AgentConfig) & {
  mode: AgentMode
}

// ---- 来自 oh-my-opencode 的 Agent Prompt 元数据 ----
interface AgentPromptMetadata {
  category: string           // "exploration" | "specialist" | "advisor" | "utility"
  cost: "FREE" | "CHEAP" | "EXPENSIVE"
  triggers: Array<{ domain: string; trigger: string }>
  useWhen?: string[]
  avoidWhen?: string[]
  keyTrigger?: string
}

// ---- 来自 oh-my-opencode 的 Fallback Chain ----
interface FallbackEntry {
  providers: string[]
  model: string
  variant?: string
}

interface ModelRequirement {
  fallbackChain: FallbackEntry[]
  requiresModel?: string
  requiresProvider?: string[]
}

// ---- 来自 oh-my-opencode 的 Skill 系统 ----
interface Skill {
  name: string
  description: string
  content: string | (() => Promise<string>)   // 支持懒加载
  scope: "builtin" | "user" | "project"
  metadata?: Record<string, string>
  mcpConfig?: McpConfig
  allowedTools?: string[]
}
```

### 3.2 核心 DI 容器

```typescript
// 框架核心：不到 100 行的 DI 容器
interface FrameworkContext {
  // 基础设施
  readonly directory: string          // 工作目录
  readonly config: ResolvedConfig     // 已解析配置
  readonly logger: Logger             // 日志

  // 引擎
  readonly agents: AgentEngine        // Agent 注册与解析
  readonly tools: ToolEngine          // Tool 注册与执行
  readonly hooks: HookEngine          // Hook 注册与分发
  readonly sessions: SessionManager   // Session 生命周期
  readonly concurrency: ConcurrencyManager  // 并发控制

  // 适配器
  readonly adapters: AdapterRegistry  // LLM / MCP / FS 适配器
}
```

---

## 4. Agent 系统

### 4.1 设计来源

从 oh-my-opencode 源码提取的 Agent 架构核心：

| 源码组件 | 框架抽象 | 原始位置 |
|---------|---------|---------|
| `AgentFactory` 模式 | `AgentProvider` 接口 | `src/agents/types.ts` |
| `agentSources` + `agentMetadata` | `AgentRegistry` | `src/agents/builtin-agents.ts` |
| `collectPendingBuiltinAgents` | `AgentResolver` | `src/agents/builtin-agents/general-agents.ts` |
| `AGENT_MODEL_REQUIREMENTS` | `FallbackResolver` | `src/shared/model-requirements.ts` |
| `dynamic-agent-prompt-builder` | `PromptComposer` | `src/agents/dynamic-agent-prompt-builder.ts` |
| `buildAgent` + `applyOverrides` | `AgentBuilder` | `src/agents/agent-builder.ts` |

### 4.2 Agent 注册与生命周期

```typescript
// ──── AgentProvider：Agent 提供者接口 ────

interface AgentProvider {
  /** 工厂函数：接受模型标识，返回 AgentConfig */
  create(model: string, context?: AgentCreateContext): AgentConfig

  /** Agent 运行模式 */
  mode: AgentMode                // "primary" | "subagent" | "all"

  /** 元数据：供编排器决策何时分派 */
  metadata?: AgentPromptMetadata

  /** 模型回退链 */
  fallback?: FallbackEntry[]
}

// ──── AgentRegistry：注册中心 ────

interface AgentRegistry {
  /** 注册 Agent（支持工厂函数简写） */
  register(name: string, provider: AgentProvider | AgentFactory): void

  /** 批量注册 */
  registerAll(agents: Record<string, AgentProvider | AgentFactory>): void

  /** 获取 Agent（已解析模型、应用覆盖） */
  resolve(name: string, overrides?: Partial<AgentConfig>): ResolvedAgent | null

  /** 列出所有可用 Agent（含模型可用性校验） */
  available(): AvailableAgent[]

  /** 禁用 Agent */
  disable(name: string): void
}

// ──── ResolvedAgent：已完全解析的 Agent ────

interface ResolvedAgent {
  name: string
  config: AgentConfig           // 完整配置（model 已解析、overrides 已应用）
  metadata?: AgentPromptMetadata
  fallbackChain: FallbackEntry[]
  resolvedModel: { provider: string; model: string; variant?: string }
}
```

### 4.3 Agent 解析流程（3 步模型解析）

从 oh-my-opencode 的 `applyModelResolution()` 提取：

```
Step 1: 用户覆盖 (config.agents.{name}.model)
  │ 有 → 使用用户指定模型
  │ 无 ↓
Step 2: Fallback Chain 解析
  │ 遍历 fallbackChain → 检查 provider 可用性 → 返回第一个可用
  │ 有 → 使用 fallback 解析模型
  │ 无 ↓
Step 3: 系统默认
  └→ 使用 framework.config.defaultModel
```

```typescript
// 来自 oh-my-opencode 的模型解析算法简化版
class FallbackResolver {
  resolve(
    chain: FallbackEntry[],
    availableProviders: Set<string>,
  ): { provider: string; model: string; variant?: string } | null {
    for (const entry of chain) {
      for (const provider of entry.providers) {
        if (availableProviders.has(provider)) {
          return { provider, model: entry.model, variant: entry.variant }
        }
      }
    }
    return null
  }
}
```

### 4.4 Agent 编排（Task 委派）

从 oh-my-opencode 的 `task()` 工具和 `delegate-task/` 模块提取：

```typescript
// ─── 编排器接口（Sisyphus 模式） ───

interface Orchestrator {
  /** 委派任务给子 Agent */
  delegate(task: DelegateTask): Promise<TaskResult>

  /** 后台委派（非阻塞） */
  delegateBackground(task: DelegateTask): Promise<string>  // 返回 taskID

  /** 等待后台任务完成 */
  awaitTask(taskID: string): Promise<TaskResult>
}

interface DelegateTask {
  description: string
  prompt: string
  agent?: string              // 指定子 agent 名称
  category?: string           // 或按 category 分派（→ 默认 agent）
  background?: boolean        // 后台执行
  sessionID?: string          // 继续现有 session
  skills?: string[]           // 加载的 skill 列表
}

interface TaskResult {
  status: "completed" | "error" | "cancelled"
  output?: string
  error?: string
  sessionID: string
  duration: number
}
```

**委派解析逻辑（来自 `delegate-task/tools.ts`）：**

```
DelegateTask
  │
  ├─ task.agent 指定 → AgentRegistry.resolve(task.agent)
  │                     → 直接使用指定 Agent
  │
  └─ task.category 指定 → CategoryResolver.resolve(task.category)
                          → 匹配 category → 选择对应模型
                          → 默认使用 "sisyphus-junior" agent
```

---

## 5. Tool 系统

### 5.1 设计来源

| 源码组件 | 框架抽象 | 原始位置 |
|---------|---------|---------|
| `tool()` 辅助函数 | `defineTool()` | `@opencode-ai/plugin/tool.d.ts` |
| `createToolRegistry` | `ToolEngine` | `src/plugin/tool-registry.ts` |
| `createXXXTools` 工厂 | `ToolProvider` 接口 | `src/tools/*/` |
| `filterDisabledTools` | `ToolEngine.disable()` | `src/plugin/tool-registry.ts` |
| `ToolContext` | `ToolExecutionContext` | `@opencode-ai/plugin` |

### 5.2 Tool 定义与注册

```typescript
import { z } from "zod"

// ──── 工具定义（保留 oh-my-opencode 的 Zod schema 驱动模式） ────

function defineTool<T extends z.ZodRawShape>(input: {
  description: string
  args: T
  execute(args: z.infer<z.ZodObject<T>>, ctx: ToolExecutionContext): Promise<string>
}): ToolDefinition

// ──── 工具执行上下文 ────

interface ToolExecutionContext {
  sessionID: string
  messageID: string
  agent: string               // 当前执行的 agent 名称
  abort: AbortSignal          // 取消信号
  framework: FrameworkContext  // 框架实例引用（访问其他引擎）
}

// ──── 工具引擎 ────

interface ToolEngine {
  /** 注册工具 */
  register(name: string, tool: ToolDefinition): void

  /** 批量注册（工厂模式） */
  registerProvider(factory: (ctx: FrameworkContext) => Record<string, ToolDefinition>): void

  /** 获取工具 for LLM function calling schema */
  getToolSchemas(filter?: ToolFilter): ToolSchema[]

  /** 执行工具调用（经过 Hook 链） */
  execute(call: ToolCall): Promise<ToolResult>

  /** 禁用工具 */
  disable(name: string): void

  /** 启用工具 */
  enable(name: string): void
}

// ──── 工具调用与结果 ────

interface ToolCall {
  name: string
  args: Record<string, unknown>
  callID: string
  sessionID: string
}

interface ToolResult {
  output: string
  title?: string
  metadata?: Record<string, unknown>
}
```

### 5.3 工具执行流水线

```
ToolEngine.execute(call)
  │
  ▼
┌─────────────────────────────┐
│ HookEngine.emit(            │
│   "tool.execute.before",    │  ← ① Guard Chain (可修改 args、可拦截)
│   { tool, sessionID },      │
│   { args }                  │
│ )                           │
└──────────┬──────────────────┘
           │ (args 可能被修改)
           ▼
┌─────────────────────────────┐
│ tool.execute(args, ctx)     │  ← ② 实际执行
└──────────┬──────────────────┘
           │ (output: string)
           ▼
┌─────────────────────────────┐
│ HookEngine.emit(            │
│   "tool.execute.after",     │  ← ③ Post-processing (可修改 output)
│   { tool, sessionID },      │
│   { title, output, metadata}│
│ )                           │
└──────────┬──────────────────┘
           │
           ▼
        ToolResult
```

### 5.4 内置工具分类（来自 oh-my-opencode）

框架不内置业务工具，但提供以下 **工具包** 作为 `@vitamin-coding/tools-*` 独立包：

| 工具包 | 来源 | 工具 |
|--------|------|------|
| `tools-filesystem` | `oh-my-opencode/tools/grep,glob` | grep, glob, read, write, edit |
| `tools-ast` | `oh-my-opencode/tools/ast-grep` | ast_grep (结构化代码搜索) |
| `tools-shell` | `oh-my-opencode/tools/interactive-bash` | bash, shell |
| `tools-session` | `oh-my-opencode/tools/session` | session_manager |
| `tools-delegation` | `oh-my-opencode/tools/delegate-task` | task (委派) |
| `tools-lsp` | `oh-my-opencode/tools/builtin` | diagnostics, definitions, references, etc. |

---

## 6. Hook / Middleware 系统

### 6.1 设计来源

oh-my-opencode 的 46 个 Hook 分 3 层组织。框架将此简化为 **统一中间件模型**：

| oh-my-opencode 层级 | 框架抽象 | Hook 数量 |
|---------------------|---------|---------|
| Core Session Hooks (23) | `lifecycle` 分类 | 按需注册 |
| Core Tool Guard Hooks (10) | `guard` 分类 | 按需注册 |
| Core Transform Hooks (4) | `transform` 分类 | 按需注册 |
| Continuation Hooks (7) | `lifecycle` 分类 | 按需注册 |
| Skill Hooks (2) | `skill` 分类 | 按需注册 |

### 6.2 Hook 引擎

```typescript
// ──── Hook 函数签名（来自 OpenCode Plugin Hooks 模式） ────

type HookFn<TInput, TOutput> = (input: TInput, output: TOutput) => Promise<void>

// ──── Hook 事件类型完整表（整合 OpenCode + oh-my-opencode） ────

interface HookEvents {
  // Session 生命周期
  "session.created": HookFn<{ sessionID: string; parentID?: string }, void>
  "session.deleted": HookFn<{ sessionID: string }, void>
  "session.idle": HookFn<{ sessionID: string }, void>
  "session.error": HookFn<{ sessionID: string; error: Error }, { retry: boolean }>
  "session.compacting": HookFn<{ sessionID: string }, { context: string[] }>

  // 消息生命周期
  "chat.message": HookFn<ChatMessageInput, ChatMessageOutput>
  "chat.params": HookFn<ChatParamsInput, ChatParamsOutput>
  "messages.transform": HookFn<void, { messages: Message[] }>

  // 工具生命周期
  "tool.execute.before": HookFn<ToolBeforeInput, ToolBeforeOutput>
  "tool.execute.after": HookFn<ToolAfterInput, ToolAfterOutput>

  // Agent 生命周期
  "agent.resolved": HookFn<{ agent: ResolvedAgent }, { agent: ResolvedAgent }>
  "agent.delegated": HookFn<{ task: DelegateTask }, { task: DelegateTask }>

  // 配置
  "config.loaded": HookFn<{ config: ResolvedConfig }, { config: ResolvedConfig }>
}

// ──── HookEngine ────

interface HookEngine {
  /** 注册 Hook（支持优先级） */
  on<K extends keyof HookEvents>(
    event: K,
    handler: HookEvents[K],
    options?: { priority?: number; name?: string },
  ): Disposable

  /** 发射事件（按优先级顺序执行，支持 output 链式修改） */
  emit<K extends keyof HookEvents>(
    event: K,
    input: Parameters<HookEvents[K]>[0],
    output: Parameters<HookEvents[K]>[1],
  ): Promise<void>

  /** 注册 Hook Provider（批量注册，对应 oh-my-opencode 的工厂模式） */
  registerProvider(
    name: string,
    factory: (ctx: FrameworkContext) => Partial<HookEvents>,
  ): void

  /** 禁用 Hook */
  disable(name: string): void
}
```

### 6.3 Hook 安全包装（来自 `safeCreateHook`）

```typescript
// 来自 oh-my-opencode src/shared/safe-create-hook.ts 的模式
// 框架内置：Hook 注册自动包装 try-catch

class HookEngineImpl implements HookEngine {
  private safeMode: boolean = true  // 默认开启

  registerProvider(name: string, factory: () => Partial<HookEvents>): void {
    if (this.safeMode) {
      try {
        const hooks = factory()
        this.registerHooks(name, hooks)
      } catch (error) {
        this.logger.warn(`Hook provider "${name}" failed to create, skipping`, error)
        // 不崩溃，继续运行
      }
    } else {
      const hooks = factory()
      this.registerHooks(name, hooks)
    }
  }
}
```

### 6.4 典型 Hook 示例（来自源码）

**Guard Hook — 文件写入限制（来自 `roundtable-md-only`）：**

```typescript
// 框架化后的等价实现

framework.hooks.on("tool.execute.before", async (input, output) => {
  const agent = framework.sessions.getAgent(input.sessionID)

  if (agent?.name !== "roundtable") return   // 仅拦截 roundtable

  if (["Write", "Edit"].includes(input.tool)) {
    const filePath = output.args.file_path as string
    if (!filePath.startsWith(".sisyphus/") || !filePath.endsWith(".md")) {
      throw new Error("Roundtable can only write to .sisyphus/*.md")
    }
  }

  if (["task", "call_omo_agent"].includes(input.tool)) {
    output.args.prompt = DISCUSSION_WARNING + output.args.prompt
  }
}, { name: "roundtable-md-only", priority: 100 })
```

**Transform Hook — 上下文注入（来自 `context-injector`）：**

```typescript
framework.hooks.on("messages.transform", async (_input, output) => {
  const contextParts = collectPendingContext()
  if (contextParts.length > 0) {
    output.messages.push({
      role: "user",
      content: contextParts.join("\n"),
    })
  }
}, { name: "context-injector", priority: -100 })  // 低优先级 → 最后执行
```

---

## 7. Session 与执行引擎

### 7.1 设计来源

| 源码组件 | 框架抽象 | 原始位置 |
|---------|---------|---------|
| `client.session.*` API | `SessionManager` | `@opencode-ai/sdk` |
| Event 系统 (30 种事件) | `SessionEventBus` | `src/plugin/event.ts` |
| BackgroundManager.launch | `ExecutionEngine.run` | `src/features/background-agent/manager.ts` |
| Session recovery | `SessionRecovery` | `src/hooks/session-recovery/` |
| Model fallback on error | `FallbackHandler` | `src/hooks/model-fallback/` |

### 7.2 Session 管理

```typescript
// ──── Session 状态 ────

interface Session {
  id: string
  parentID?: string
  agent: string
  model: { provider: string; model: string; variant?: string }
  status: "idle" | "running" | "error" | "completed"
  messages: Message[]
  createdAt: Date
  metadata: Record<string, unknown>
}

// ──── SessionManager ────

interface SessionManager {
  /** 创建新 Session */
  create(input: CreateSessionInput): Promise<Session>

  /** 获取 Session */
  get(id: string): Session | undefined

  /** 向 Session 发送消息（触发 Agent Chat Loop） */
  prompt(id: string, message: string): Promise<void>

  /** 终止 Session */
  abort(id: string): Promise<void>

  /** 获取 Session 的 Agent */
  getAgent(id: string): ResolvedAgent | undefined

  /** 列出活跃 Session */
  active(): Session[]

  /** Fork Session（创建子 Session） */
  fork(parentID: string, input: ForkInput): Promise<Session>
}
```

### 7.3 执行引擎（Chat Loop）

框架核心的 Chat Loop 从 OpenCode Runtime 的概念抽象而来，但改为 Node.js 原生实现：

```typescript
// ──── 执行引擎：单次 Agent 对话循环 ────

class ExecutionEngine {
  async run(session: Session): Promise<void> {
    const agent = this.agents.resolve(session.agent)
    const adapter = this.adapters.getLLM(agent.resolvedModel.provider)

    let stepCount = 0
    const maxSteps = agent.config.maxSteps ?? 100

    while (stepCount < maxSteps && !session.abort.aborted) {
      // ① Hook: chat.params
      const params = { temperature: agent.config.temperature }
      await this.hooks.emit("chat.params", { sessionID: session.id, agent, model: agent.resolvedModel }, params)

      // ② 获取工具 schemas
      const tools = this.tools.getToolSchemas({
        agent: agent.name,
        whitelist: agent.config.tools,
      })

      // ③ Hook: messages.transform
      const messages = [...session.messages]
      await this.hooks.emit("messages.transform", {}, { messages })

      // ④ LLM API 调用
      const response = await adapter.chat({
        model: agent.resolvedModel.model,
        messages: [{ role: "system", content: agent.config.prompt }, ...messages],
        tools,
        ...params,
      })

      // ⑤ 处理响应
      for (const part of response.parts) {
        if (part.type === "text") {
          session.messages.push({ role: "assistant", content: part.text })
        }
        if (part.type === "tool_use") {
          // ⑥ 工具调用（经过 Hook 链）
          const result = await this.tools.execute({
            name: part.name,
            args: part.args,
            callID: part.id,
            sessionID: session.id,
          })
          session.messages.push({
            role: "tool",
            toolCallID: part.id,
            content: result.output,
          })
        }
      }

      // ⑦ 无工具调用 → 对话结束
      if (!response.parts.some(p => p.type === "tool_use")) break
      stepCount++
    }

    // ⑧ Hook: session.idle
    await this.hooks.emit("session.idle", { sessionID: session.id }, {})
  }
}
```

### 7.4 错误恢复与模型降级

来自 oh-my-opencode 的 `session-recovery` + `model-fallback` 机制：

```
Session 执行中
  │
  ├─ 正常完成 → session.idle event
  │
  └─ 错误发生
      │
      ├─ Hook: session.error → { retry: true }
      │   │
      │   ├─ 可恢复错误 (thinking block, tool result format)
      │   │   → SessionRecovery → 修复消息 → 重试
      │   │
      │   └─ 模型错误 (rate limit, quota, context overflow)
      │       → FallbackHandler → 下一个模型 → 重试
      │
      └─ Hook: session.error → { retry: false }
          → 标记 session error → 通知上层
```

---

## 8. 配置系统

### 8.1 设计来源

| 源码组件 | 框架抽象 | 原始位置 |
|---------|---------|---------|
| `loadPluginConfig` | `ConfigLoader` | `src/plugin-config.ts` |
| `OhMyOpenCodeConfigSchema` | `FrameworkConfigSchema` | `src/config/schema/` |
| `mergeConfigs` | 内置合并策略 | `src/plugin-config.ts` |
| `migrateConfigFile` | `ConfigMigrator` | `src/plugin-config.ts` |
| `ConfigHandler` 6 阶段 | `ConfigPipeline` | `src/plugin-handlers/config-handler.ts` |

### 8.2 配置 Schema

```typescript
import { z } from "zod"

// 框架配置 — Zod v4，保留 oh-my-opencode 的 snake_case + JSONC 约定
const FrameworkConfigSchema = z.object({
  // ── 框架核心 ──
  $schema: z.string().optional(),
  default_model: z.string().optional(),          // 默认模型 (provider/model 格式)
  default_agent: z.string().optional(),          // 默认 Agent 名称
  safe_mode: z.boolean().default(true),          // Hook 安全模式

  // ── Agent 覆盖 ──
  agents: z.record(z.string(), z.object({
    model: z.string().optional(),
    temperature: z.number().optional(),
    prompt_append: z.string().optional(),
    variant: z.string().optional(),
    fallback_models: z.union([z.string(), z.array(z.string())]).optional(),
    disable: z.boolean().optional(),
    tools: z.record(z.string(), z.boolean()).optional(),
  })).optional(),

  // ── Category 配置 ──
  categories: z.record(z.string(), z.object({
    model: z.string().optional(),
    variant: z.string().optional(),
    temperature: z.number().optional(),
  })).optional(),

  // ── 禁用列表 ──
  disabled_agents: z.array(z.string()).optional(),
  disabled_tools: z.array(z.string()).optional(),
  disabled_hooks: z.array(z.string()).optional(),
  disabled_mcps: z.array(z.string()).optional(),
  disabled_skills: z.array(z.string()).optional(),

  // ── Provider 配置 ──
  providers: z.record(z.string(), z.object({
    api_key: z.string().optional(),
    base_url: z.string().optional(),
    enabled: z.boolean().default(true),
  })).optional(),

  // ── 并发配置 ──
  concurrency: z.object({
    max_background_tasks: z.number().default(5),
    max_per_model: z.number().default(5),
  }).optional(),

  // ── MCP 配置 ──
  mcps: z.record(z.string(), z.object({
    type: z.enum(["remote", "stdio"]),
    url: z.string().optional(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    enabled: z.boolean().default(true),
  })).optional(),

  // ── Skill 配置 ──
  skills: z.object({
    paths: z.array(z.string()).optional(),
    builtin_enabled: z.boolean().default(true),
  }).optional(),

  // ── 扩展字段 ──
  extensions: z.record(z.string(), z.unknown()).optional(),
}).strict()

type FrameworkConfig = z.infer<typeof FrameworkConfigSchema>
```

### 8.3 多级配置合并

保留 oh-my-opencode 的 3 级合并策略：

```
Priority (高 → 低):
  1. 运行时参数 (createFramework({ ... }))
  2. 项目配置  ({cwd}/.vitamin-coding/config.jsonc)
  3. 用户配置  (~/.config/vitamin-coding/config.jsonc)
  4. 框架默认值

合并规则:
  ├─ agents, categories, providers, mcps → deepMerge
  ├─ disabled_* 数组 → Set 并集
  └─ 其他标量 → 高优先级覆盖
```

---

## 9. MCP 集成层

### 9.1 设计来源

| 源码组件 | 框架抽象 | 原始位置 |
|---------|---------|---------|
| `createBuiltinMcps` | `McpRegistry` | `src/mcp/index.ts` |
| `SkillMcpManager` | `McpLifecycleManager` | `src/features/skill-mcp-manager/` |
| Claude Code MCP 加载 | `McpConfigLoader` | `src/features/claude-code-mcp-loader/` |

### 9.2 MCP 接口

```typescript
// ──── MCP 配置 ────

interface McpConfig {
  type: "remote" | "stdio"
  // Remote
  url?: string
  headers?: Record<string, string>
  // Stdio
  command?: string
  args?: string[]
  env?: Record<string, string>
  // 通用
  enabled: boolean
  oauth?: boolean
}

// ──── MCP 注册中心 ────

interface McpRegistry {
  /** 注册 MCP */
  register(name: string, config: McpConfig): void

  /** 连接 MCP（建立 stdio 进程或 HTTP 连接） */
  connect(name: string): Promise<McpConnection>

  /** 断开 MCP */
  disconnect(name: string): Promise<void>

  /** 获取 MCP 提供的工具（自动注入到 ToolEngine） */
  tools(name: string): Promise<ToolDefinition[]>

  /** 列出所有 MCP 状态 */
  status(): McpStatus[]
}

// ──── MCP 连接 ────

interface McpConnection {
  name: string
  type: "remote" | "stdio"
  status: "connected" | "disconnected" | "error"
  tools: ToolDefinition[]
  callTool(name: string, args: Record<string, unknown>): Promise<string>
  close(): Promise<void>
}
```

### 9.3 MCP 工具自动注入

```
McpRegistry.connect("websearch")
  │
  ▼
McpConnection.tools → [webSearch, ...]
  │
  ▼
ToolEngine.register("mcp:websearch:webSearch", toolDefinition)
  │  (命名空间化: mcp:{mcpName}:{toolName})
  │
  ▼
Agent 可通过 tools 白名单访问: { "mcp:websearch:webSearch": true }
```

---

## 10. Skill 系统

### 10.1 设计来源

| 源码组件 | 框架抽象 | 原始位置 |
|---------|---------|---------|
| `discoverAllSkills` | `SkillDiscovery` | `src/features/opencode-skill-loader/loader.ts` |
| `loadSkillsFromDir` | `SkillDirectoryLoader` | `src/features/opencode-skill-loader/skill-directory-loader.ts` |
| `mergeSkills` | `SkillMerger` | `src/features/opencode-skill-loader/merger.ts` |
| YAML front matter | `SkillMetadataParser` | `src/features/opencode-skill-loader/types.ts` |

### 10.2 Skill 接口

```typescript
// ──── Skill 定义 ────

interface Skill {
  name: string
  description?: string
  content: string | (() => Promise<string>)  // 支持惰性加载
  scope: "builtin" | "user" | "project"
  metadata?: {
    model?: string
    agent?: string
    subtask?: boolean
    allowedTools?: string[]
    mcpConfig?: McpConfig
  }
}

// ──── SkillEngine ────

interface SkillEngine {
  /** 从目录发现 Skills */
  discover(paths: string[]): Promise<Skill[]>

  /** 注册 Skill */
  register(skill: Skill): void

  /** 获取 Skill（加载内容） */
  resolve(name: string): Promise<ResolvedSkill | null>

  /** 列出可用 Skills */
  available(): SkillSummary[]

  /** 注入到 Agent prompt */
  injectToPrompt(agentName: string, prompt: string): Promise<string>
}
```

### 10.3 Skill 发现路径（来自 oh-my-opencode 的 6 路径）

```
框架默认搜索顺序 (高优先级 → 低):
  1. {project}/.vitamin-coding/skills/     (项目级 - 框架格式)
  2. {project}/.opencode/skills/            (项目级 - OpenCode 兼容)
  3. {project}/.claude/skills/              (项目级 - Claude Code 兼容)
  4. ~/.config/vitamin-coding/skills/      (用户级 - 框架格式)
  5. ~/.config/opencode/skills/             (用户级 - OpenCode 兼容)
  6. ~/.claude/skills/                      (用户级 - Claude Code 兼容)

格式: {skill-name}/SKILL.md 或 {skill-name}.md
YAML Front Matter:
  ---
  name: my-skill
  description: A helpful skill
  model: anthropic/claude-sonnet-4-6
  allowed-tools: [grep, glob]
  ---
  Skill content here...
```

---

## 11. 并发与后台任务

### 11.1 设计来源

| 源码组件 | 框架抽象 | 原始位置 |
|---------|---------|---------|
| `BackgroundManager` | `ConcurrencyManager` + `TaskQueue` | `src/features/background-agent/manager.ts` |
| `ConcurrencyManager` | `ConcurrencySlotManager` | `src/features/background-agent/concurrency-manager.ts` |
| `TaskHistory` | `TaskStore` | `src/features/background-agent/task-history.ts` |
| `FallbackRetryHandler` | `RetryPolicy` | `src/features/background-agent/fallback-retry-handler.ts` |

### 11.2 并发模型

```typescript
// ──── 任务状态 ────

type TaskStatus = "pending" | "running" | "completed" | "error" | "cancelled"

interface BackgroundTask {
  id: string
  sessionID?: string
  parentSessionID: string
  description: string
  agent: string
  status: TaskStatus
  result?: string
  error?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

// ──── 并发管理器 ────

interface ConcurrencyManager {
  /** 提交后台任务 */
  submit(task: SubmitTaskInput): Promise<BackgroundTask>

  /** 等待任务完成 */
  await(taskID: string): Promise<BackgroundTask>

  /** 取消任务 */
  cancel(taskID: string): Promise<void>

  /** 获取任务状态 */
  status(taskID: string): BackgroundTask | undefined

  /** 按父 Session 查询任务 */
  byParent(parentSessionID: string): BackgroundTask[]

  /** 获取队列统计 */
  stats(): QueueStats
}

// ──── 并发槽管理（来自 oh-my-opencode ConcurrencyManager） ────

class ConcurrencySlotManager {
  private slots: Map<string, number> = new Map()  // key → 当前占用数
  private maxPerKey: number

  constructor(maxPerKey: number = 5) {
    this.maxPerKey = maxPerKey
  }

  /** 获取并发槽（key = "provider/model"） */
  acquire(key: string): boolean {
    const current = this.slots.get(key) ?? 0
    if (current >= this.maxPerKey) return false
    this.slots.set(key, current + 1)
    return true
  }

  /** 释放并发槽 */
  release(key: string): void {
    const current = this.slots.get(key) ?? 0
    this.slots.set(key, Math.max(0, current - 1))
  }
}
```

### 11.3 后台任务执行流程

```
ConcurrencyManager.submit(task)
  │
  ├─ 创建 BackgroundTask (status=pending)
  │
  ├─ 计算 concurrencyKey = "{provider}/{model}"
  │
  ├─ ConcurrencySlotManager.acquire(key)
  │   ├─ 成功 → 立即执行
  │   └─ 失败 → 加入队列等待
  │
  └─→ 执行:
      ├─ SessionManager.create({ agent, parentID })
      ├─ SessionManager.prompt(sessionID, task.prompt)
      ├─ ExecutionEngine.run(session)  ← 完整 Chat Loop
      ├─ 完成 → status=completed
      ├─ 错误 → RetryPolicy 检查
      │   ├─ 可重试 → FallbackChain 下一个模型 → 重新执行
      │   └─ 不可重试 → status=error
      └─ ConcurrencySlotManager.release(key)
          → 检查队列 → 启动下一个待执行任务
```

---

## 12. 初始化流程

### 12.1 对比：oh-my-opencode vs 框架

**oh-my-opencode 初始化（需要 OpenCode Runtime）：**

```
OpenCode Runtime → fork Plugin Process → Plugin(ctx)
  ├─→ loadPluginConfig()         # JSONC
  ├─→ createManagers()           # 4 managers
  ├─→ createTools()              # 26 tools (async: skill discovery)
  ├─→ createHooks()              # 46 hooks (3 tiers)
  └─→ createPluginInterface()    # 8 OpenCode handlers
```

**框架初始化（独立运行）：**

```typescript
import { createFramework } from "@vitamin-coding/core"

const framework = await createFramework({
  directory: process.cwd(),
  config: "./vitamin-coding.jsonc",   // 或直接传对象
  providers: [
    anthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY }),
    openaiAdapter({ apiKey: process.env.OPENAI_API_KEY }),
  ],
})
```

### 12.2 框架初始化序列

```
createFramework(options)
  │
  ├─① ConfigLoader.load()
  │   ├─ 读取用户配置 (~/.config/vitamin-coding/config.jsonc)
  │   ├─ 读取项目配置 (./.vitamin-coding/config.jsonc)
  │   ├─ 合并 + Zod 校验
  │   └─→ ResolvedConfig
  │
  ├─② AdapterRegistry.init()
  │   ├─ 注册 LLM Adapters (anthropic, openai, ...)
  │   ├─ 验证 API Keys
  │   └─→ 可用 Provider 集合
  │
  ├─③ AgentEngine.init()
  │   ├─ 收集所有 AgentProvider
  │   ├─ 解析 FallbackChain → 可用 Agent 列表
  │   ├─ 应用用户覆盖
  │   └─→ AgentRegistry
  │
  ├─④ ToolEngine.init()
  │   ├─ 注册内置工具
  │   ├─ 注册 MCP 工具
  │   ├─ 过滤禁用工具
  │   └─→ ToolRegistry
  │
  ├─⑤ SkillEngine.init()  (async)
  │   ├─ 发现 Skills (6 路径并行)
  │   ├─ 合并 + 去重
  │   └─→ SkillRegistry
  │
  ├─⑥ HookEngine.init()
  │   ├─ 注册内置 Hooks
  │   ├─ 注册用户 Hooks
  │   ├─ safeCreateHook 包装
  │   └─→ HookRegistry
  │
  ├─⑦ McpRegistry.init()
  │   ├─ 注册内置 MCPs
  │   ├─ 自动连接 enabled MCPs
  │   └─→ MCP 工具注入到 ToolEngine
  │
  └─⑧ 构建 FrameworkContext
      └─→ 返回 Framework 实例
```

### 12.3 可选 OpenCode Bridge 模式

框架可运行在两种模式下：

```
模式 A: 独立运行 (Standalone)
  ┌─────────────┐
  │ Node.js App │ → createFramework() → framework.run("Build a feature")
  └─────────────┘

模式 B: OpenCode Plugin Bridge (兼容模式)
  ┌──────────────┐     ┌──────────────────┐
  │ OpenCode     │ ──→ │ Plugin Bridge    │ ──→ framework.handleHook(event)
  │ Runtime (Go) │     │ (adapter layer)  │
  └──────────────┘     └──────────────────┘
```

```typescript
// 模式 B: 桥接回 OpenCode Plugin
import { createOpenCodeBridge } from "@vitamin-coding/opencode-bridge"

const plugin: Plugin = async (ctx) => {
  const framework = await createFramework({ directory: ctx.directory })
  return createOpenCodeBridge(framework, ctx)
  // 自动映射 framework hooks → OpenCode plugin hooks
}
export default plugin
```

---

## 13. API 设计

### 13.1 顶层 API

```typescript
// ──── 创建框架实例 ────

const framework = await createFramework({
  directory: "./my-project",
  providers: [anthropicAdapter(), openaiAdapter()],
})

// ──── 注册 Agent ────

framework.agents.register("my-agent", {
  mode: "subagent",
  metadata: { category: "specialist", cost: "CHEAP", triggers: [...] },
  fallback: [
    { providers: ["anthropic"], model: "claude-sonnet-4-6" },
    { providers: ["openai"], model: "gpt-5-nano" },
  ],
  create(model) {
    return {
      name: "my-agent",
      model,
      description: "A specialist agent",
      prompt: "You are a specialist...",
      temperature: 0.3,
    }
  },
})

// ──── 注册 Tool ────

framework.tools.register("search_docs", defineTool({
  description: "Search documentation",
  args: { query: z.string(), limit: z.number().default(10) },
  async execute({ query, limit }, ctx) {
    const results = await searchIndex(query, limit)
    return JSON.stringify(results)
  },
}))

// ──── 注册 Hook ────

framework.hooks.on("tool.execute.before", async (input, output) => {
  console.log(`Tool ${input.tool} called with args:`, output.args)
}, { name: "logger" })

// ──── 运行任务 ────

const result = await framework.run({
  message: "Refactor the authentication module to use JWT",
  agent: "sisyphus",           // 可选: 指定入口 Agent
})

console.log(result.output)     // Agent 的最终输出
console.log(result.sessionID)  // Session ID，可继续对话

// ──── 继续对话 ────

const followUp = await framework.run({
  message: "Also add rate limiting to the endpoints",
  sessionID: result.sessionID,  // 继续已有 session
})

// ──── 委派子任务（编程式） ────

const taskResult = await framework.delegate({
  description: "Review auth module",
  prompt: "Review the JWT implementation for security issues",
  agent: "oracle",
  background: true,
})
```

### 13.2 LLM Adapter 接口

```typescript
// ──── LLM Adapter：Provider 抽象层 ────

interface LLMAdapter {
  /** Provider 标识 */
  readonly id: string         // "anthropic", "openai", "google", ...

  /** 支持的模型列表 */
  models(): Promise<ModelInfo[]>

  /** Chat Completion（含工具调用） */
  chat(input: ChatInput): Promise<ChatResponse>

  /** 流式 Chat Completion */
  chatStream(input: ChatInput): AsyncIterable<ChatStreamEvent>

  /** 检查连接/认证状态 */
  healthCheck(): Promise<boolean>
}

interface ChatInput {
  model: string
  messages: Message[]
  tools?: ToolSchema[]
  temperature?: number
  maxTokens?: number
  // Provider 特定选项
  thinking?: { type: "enabled"; budgetTokens: number }  // Anthropic
  reasoningEffort?: string                                // OpenAI
  [key: string]: unknown
}

interface ChatResponse {
  parts: ResponsePart[]
  usage: { inputTokens: number; outputTokens: number }
  model: string
  stopReason: "end_turn" | "tool_use" | "max_tokens"
}

type ResponsePart =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; args: Record<string, unknown> }
  | { type: "thinking"; text: string }

// ──── 工厂函数 ────

function anthropicAdapter(config?: { apiKey?: string; baseUrl?: string }): LLMAdapter
function openaiAdapter(config?: { apiKey?: string; baseUrl?: string }): LLMAdapter
function opencodeBridgeAdapter(client: OpencodeClient): LLMAdapter  // 桥接模式
```

### 13.3 Plugin 系统（扩展框架）

```typescript
// ──── 框架 Plugin（不是 OpenCode Plugin，是框架自身的扩展机制） ────

interface FrameworkPlugin {
  name: string
  version?: string
  setup(framework: FrameworkContext): Promise<void> | void
}

// ──── 使用示例 ────

const omoPlugin: FrameworkPlugin = {
  name: "oh-my-opencode",
  version: "4.0.0",
  setup(fw) {
    // 注册所有 oh-my-opencode 的 agent
    fw.agents.registerAll(omoAgents)

    // 注册所有 tool
    fw.tools.registerProvider(createOmoTools)

    // 注册所有 hook
    fw.hooks.registerProvider("omo-core", createOmoCoreHooks)
    fw.hooks.registerProvider("omo-guard", createOmoGuardHooks)

    // 注册 MCP
    fw.mcps.register("websearch", createWebsearchConfig())
  },
}

const framework = await createFramework({
  plugins: [omoPlugin],
})
```

---

## 14. 与现有系统的对比

### 14.1 架构对比

| 维度 | OpenCode (当前) | oh-my-opencode (当前) | 轻量级框架 (目标) |
|------|----------------|---------------------|-----------------|
| **Runtime** | Go 进程 | Go 进程的 TS 插件 | Node.js 独立进程 |
| **IPC** | 无 (单进程) | HTTP (Go↔TS) | 无 (单进程) |
| **Agent 数** | 动态 (config) | 11 内置 + custom | 0 内置 (全由 Plugin 注册) |
| **Tool 数** | 内置 10+ | 26 | 0 内置 (全由 Plugin 注册) |
| **Hook 数** | 12 hook points | 46 具体 hooks | 12 hook points + 任意注册 |
| **配置** | JSONC/TOML | JSONC + Zod v4 | JSONC + Zod v4 |
| **MCP** | 内置支持 | 3 层 MCP | MCP 适配器 |
| **LLM 调用** | Go SDK | 通过 Go 代理 | Node.js 直接调用 |
| **包大小** | ~50MB (Go binary) | ~2MB (TS bundle) | < 500KB (核心) |
| **依赖** | Go stdlib | @opencode-ai/sdk + Zod + 12 pkgs | Zod (核心唯一) |

### 14.2 能力对比

| 能力 | oh-my-opencode | 轻量级框架 | 实现方式 |
|------|---------------|-----------|---------|
| Multi-Agent 编排 | ✅ Sisyphus | ✅ AgentEngine | 保留 task 委派 + fallback 模式 |
| 并行后台 Agent | ✅ BackgroundManager | ✅ ConcurrencyManager | 简化: 无 tmux, 纯 Promise |
| 工具守卫 | ✅ tool.execute.before | ✅ HookEngine | 统一中间件模型 |
| Model Fallback | ✅ 3步解析 + 运行时降级 | ✅ FallbackResolver | 保留完整 fallback chain |
| Skill 发现 | ✅ 6 路径 + YAML | ✅ SkillEngine | 兼容 OpenCode/Claude 格式 |
| MCP 集成 | ✅ 3 层 | ✅ McpRegistry | 简化: remote + stdio |
| Session 恢复 | ✅ thinking/tool_result 修复 | ✅ SessionRecovery | 保留核心恢复逻辑 |
| TUI | ❌ (依赖 OpenCode) | ❌ (不实现) | 通过外部 UI 集成 |
| Permission 系统 | ✅ ask/allow/deny | ✅ PermissionEngine | 保留白名单/黑名单模式 |

### 14.3 代码量对比

| 模块 | oh-my-opencode | 轻量级框架 (预估) |
|------|---------------|-----------------|
| 核心框架 | ~8000 行 (plugin/, shared/) | ~2500 行 |
| Agent 系统 | ~4000 行 (agents/) | ~800 行 (纯框架) |
| Tool 系统 | ~6000 行 (tools/) | ~400 行 (纯框架) |
| Hook 系统 | ~8000 行 (hooks/) | ~500 行 (纯框架) |
| 配置系统 | ~3000 行 (config/, plugin-config) | ~600 行 |
| Feature 模块 | ~15000 行 (features/) | ~1000 行 |
| **总计** | ~143,000 行 | ~5,800 行 (核心) |

---

## 15. 分阶段实施路线

### Phase 1: 核心骨架 (2 周)

**目标**: 最小可运行的 Agent 框架

```
@vitamin-coding/core
├── src/
│   ├── index.ts              # createFramework()
│   ├── types.ts              # 核心类型
│   ├── config/
│   │   ├── loader.ts         # JSONC 加载 + Zod 校验
│   │   ├── schema.ts         # FrameworkConfigSchema
│   │   └── merger.ts         # 多级配置合并
│   ├── agent/
│   │   ├── engine.ts         # AgentEngine (注册/解析/fallback)
│   │   ├── registry.ts       # AgentRegistry
│   │   └── fallback.ts       # FallbackResolver
│   ├── tool/
│   │   ├── engine.ts         # ToolEngine (注册/执行)
│   │   ├── define.ts         # defineTool() 辅助函数
│   │   └── schema.ts         # Zod → JSON Schema 转换
│   ├── hook/
│   │   ├── engine.ts         # HookEngine (注册/分发/优先级)
│   │   └── safe-wrap.ts      # safeCreateHook 包装
│   ├── session/
│   │   ├── manager.ts        # SessionManager
│   │   └── execution.ts      # ExecutionEngine (Chat Loop)
│   └── adapter/
│       ├── types.ts          # LLMAdapter 接口
│       └── registry.ts       # AdapterRegistry
```

**交付物**:
- `createFramework()` 可运行
- 手动注册 Agent/Tool/Hook
- 单个 LLM Adapter 可驱动 Chat Loop
- 基本 Hook 生命周期

### Phase 2: 适配器生态 (2 周)

```
@vitamin-coding/adapter-anthropic    # Anthropic Messages API
@vitamin-coding/adapter-openai       # OpenAI Chat Completions
@vitamin-coding/adapter-google       # Gemini API
@vitamin-coding/adapter-openrouter   # OpenRouter 统一接口
```

**交付物**:
- 4 个 LLM Adapter (含 streaming)
- Model Fallback 全自动切换
- API Key 配置 + Health Check

### Phase 3: MCP + Skill (1 周)

```
@vitamin-coding/mcp       # MCP Client (remote + stdio)
@vitamin-coding/skills     # Skill 发现 + 加载 + 注入
```

**交付物**:
- MCP 连接管理 + 工具自动注入
- Skill 发现 (兼容 OpenCode/Claude 格式)
- Skill 内容注入到 Agent prompt

### Phase 4: 并发 + 委派 (1 周)

```
@vitamin-coding/concurrency   # ConcurrencyManager + TaskQueue
```

**交付物**:
- 后台任务执行
- 并发槽管理 (per model/provider)
- Fallback 重试
- 任务状态跟踪

### Phase 5: oh-my-opencode 迁移 (3 周)

```
@vitamin-coding/omo-agents     # 迁移 11 Agent
@vitamin-coding/omo-tools      # 迁移 26 Tools
@vitamin-coding/omo-hooks      # 迁移 46 Hooks
@vitamin-coding/opencode-bridge # OpenCode Plugin 兼容层
```

**交付物**:
- oh-my-opencode 功能完整迁移
- 可作为 OpenCode Plugin 运行 (桥接模式)
- 可独立运行 (Standalone 模式)

### Phase 6: DX + 文档 (1 周)

```
@vitamin-coding/cli            # CLI: init, doctor, run
@vitamin-coding/create-agent   # Agent 脚手架
```

**交付物**:
- `npx @vitamin-coding/cli init` 项目初始化
- `npx @vitamin-coding/cli run "Build a feature"` 命令行运行
- API 文档 + 教程 + 示例

---

## 附录 A: 包结构

```
@vitamin-coding/
├── core                    # 框架核心 (~2500 LOC)
├── adapter-anthropic       # Anthropic API
├── adapter-openai          # OpenAI API
├── adapter-google          # Google Gemini API
├── adapter-openrouter      # OpenRouter
├── mcp                     # MCP 客户端
├── skills                  # Skill 系统
├── concurrency             # 并发管理
├── tools-filesystem        # grep, glob, read, write, edit
├── tools-shell             # bash, shell
├── tools-ast               # ast_grep
├── tools-lsp               # LSP 工具
├── tools-delegation        # task 委派工具
├── opencode-bridge         # OpenCode Plugin 兼容层
├── omo-agents              # oh-my-opencode 11 Agents
├── omo-tools               # oh-my-opencode 26 Tools
├── omo-hooks               # oh-my-opencode 46 Hooks
└── cli                     # CLI 工具
```

## 附录 B: 关键设计决策

| 决策 | 选项 | 选择 | 理由 |
|------|------|------|------|
| 运行环境 | Node.js / Bun / Deno | Node.js (兼容 Bun) | 最广泛的生态 + Bun 兼容 |
| Schema 校验 | Zod / Ajv / io-ts | Zod v4 | oh-my-opencode 已验证，TS 推断最佳 |
| 配置格式 | JSON / YAML / TOML / JSONC | JSONC | 支持注释 + JSON 兼容 + oh-my-opencode 一致 |
| IPC 机制 | HTTP / stdio / worker_threads | 无 (进程内) | 消除 IPC 瓶颈 |
| 包管理 | monorepo / 独立包 | monorepo (workspace) | 一致版本 + 开发效率 |
| LLM 调用 | 直接 SDK / 统一 Adapter | 统一 Adapter 接口 | 可替换 + 可测试 |
| Agent 定义 | 静态 config / 工厂函数 | 工厂函数 (AgentFactory) | 动态 prompt 构建需要 |
| Hook 排序 | 注册顺序 / 显式优先级 | 显式优先级 (number) | 精确控制执行顺序 |
| MCP 传输 | 仅 stdio / 仅 HTTP / 两者 | 两者 (remote + stdio) | 兼容所有 MCP 服务 |
| 默认工具 | 内置 / 全由 Plugin 提供 | 全由 Plugin 提供 | 框架零业务逻辑 |

## 附录 C: 从 oh-my-opencode 可直接复用的模块

| 模块 | 源码位置 | 复用度 | 改造量 |
|------|---------|--------|--------|
| `FallbackResolver` | `src/shared/model-requirements.ts` | 90% | 移除 OpenCode 特定 provider 映射 |
| `safeCreateHook` | `src/shared/safe-create-hook.ts` | 100% | 直接复用 |
| `permission-compat` | `src/shared/permission-compat.ts` | 100% | 直接复用 |
| `ConfigLoader` (JSONC) | `src/plugin-config.ts` | 70% | 移除 migration, 简化路径 |
| `SkillLoader` | `src/features/opencode-skill-loader/` | 80% | 移除 Claude Code 特定逻辑 |
| `dynamic-agent-prompt-builder` | `src/agents/dynamic-agent-prompt-builder.ts` | 90% | 移除 OpenCode 特定注入 |
| `ConcurrencyManager` | `src/features/background-agent/concurrency-manager.ts` | 85% | 移除 tmux 集成 |
| `agent-builder` | `src/agents/agent-builder.ts` | 90% | 移除 category prompt appends |
| 所有 Agent 工厂 | `src/agents/*/` | 95% | 仅更改导入路径 |
| 所有 Tool 工厂 | `src/tools/*/` | 80% | 替换 PluginInput → FrameworkContext |
| 所有 Hook 工厂 | `src/hooks/*/` | 80% | 替换 PluginInput → FrameworkContext |
