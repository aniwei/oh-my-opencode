> [← 返回目录](README.md)

## 第三部分：各包详细设计

### 3.0 包状态矩阵（实现态 / 规划态）

> 基准目录：`vitamin-coding/packages/`（当前 15 包）

| 包名 | 实现态（代码） | 规划态（后续能力） |
|------|----------------|--------------------|
| `@vitamin/ai` | 已实现多 provider 适配、模型注册、流式输出 | 持续替换为更多官方 SDK provider（分批） |
| `@vitamin/agent` | 已实现会话循环、工具调度、中断与恢复 | 更细粒度事件与可观测性增强 |
| `@vitamin/coding-agent` | 已实现 `interactive/print/json/rpc` 四模式 | 交互层进一步模块化与复用 |
| `@vitamin/config` | 已实现配置加载、合并、校验 | 配置迁移与 schema 演进自动化 |
| `@vitamin/extension` | 已实现扩展声明与加载基础能力 | 扩展隔离与沙箱策略增强 |
| `@vitamin/hooks` | 已实现 Hook 管线与注册机制 | Hook 分类治理与追踪指标 |
| `@vitamin/mcp` | 已实现三层加载 + 官方 MCP SDK transport 封装 | OAuth / 会话恢复策略增强 |
| `@vitamin/orchestrator` | 已实现多 Agent 编排基础能力 | 策略决策与成本优化增强 |
| `@vitamin/sdk` | 已实现嵌入式调用与流式接口 | 更稳定的对外 API 面与版本契约 |
| `@vitamin/server` | 已实现 HTTP API 与 Inspector 基础 | 多租户与权限边界完善 |
| `@vitamin/session` | 已实现会话持久化与恢复 | 历史检索与归档治理 |
| `@vitamin/shared` | 已实现通用工具与基础设施（含 JSONC 解析） | 工具模块进一步收敛与瘦身 |
| `@vitamin/tools` | 已实现工具注册与执行框架 | 工具权限模型细化 |
| `@vitamin/ui-kit` | 已实现共享 UI 组件基础层 | 设计 token 与主题系统完善 |
| `@vitamin/web-ui` | 已实现浏览器端交互入口 | 复杂场景交互与性能优化 |

### 3.1 `@vitamin/ai` — 统一 LLM API 层

> 灵感来源：pi-mono 的 `@mariozechner/pi-ai`，但加入 oh-my-opencode 的 Category 系统和 fallback 链

#### 3.1.1 职责

- 统一多提供商 LLM API（Anthropic, OpenAI, Google, Bedrock, xAI, Groq, OpenRouter, Copilot, Ollama...）
- 模型注册表 + 自动发现
- 流式输出 + 结构化事件
- 费用计算
- API Key 管理（环境变量 + OAuth + 动态刷新）
- Provider fallback 链

#### 3.1.2 目录结构

```
packages/ai/src/
├── index.ts                           # 桶导出
├── types.ts                           # 核心类型（Model, Message, Tool, StreamEvent...）
├── stream.ts                          # 流式编排入口
├── model-registry.ts                  # 模型注册表
├── model-resolver.ts                  # Category→Model 解析
├── models.generated.ts                # 自动生成的模型数据库
├── api-key-resolver.ts                # 多策略 API Key 解析
├── cost-calculator.ts                 # 费用计算（精确到 cache_read/write）
├── fallback-chain.ts                  # Provider fallback 引擎
├── providers/                         # 适配器
│   ├── types.ts                       # Provider 接口
│   ├── anthropic-messages.ts          # Anthropic Messages API
│   ├── openai-completions.ts          # OpenAI Chat Completions
│   ├── openai-responses.ts            # OpenAI Responses API
│   ├── google-generative-ai.ts        # Google Generative AI
│   ├── bedrock-converse.ts            # AWS Bedrock
│   ├── ollama.ts                      # 本地 Ollama
│   └── registry.ts                    # Provider 注册表
└── utils/
    ├── event-stream.ts                # EventStream<E, R> 异步迭代器
    ├── token-counter.ts               # Token 估算
    └── http-client.ts                 # HTTP 客户端封装（代理支持）
```

#### 3.1.3 核心类型

```typescript
// packages/ai/src/types.ts

/** 已知 API 协议类型 */
export type ApiType =
  | "anthropic-messages"
  | "openai-completions"
  | "openai-responses"
  | "google-generative-ai"
  | "bedrock-converse"
  | "ollama"

/** 已知提供商 */
export type KnownProvider =
  | "anthropic" | "openai" | "google" | "amazon-bedrock"
  | "github-copilot" | "xai" | "groq" | "openrouter"
  | "deepseek" | "ollama" | "custom"

/** 模型定义 — 核心数据结构 */
export interface Model {
  /** 唯一标识: "provider/model-id" */
  id: string
  /** 显示名称 */
  name: string
  /** API 协议 */
  api: ApiType
  /** 提供商 */
  provider: KnownProvider
  /** 基础 URL（可覆盖） */
  baseUrl: string
  /** 是否支持推理（thinking/reasoning） */
  reasoning: boolean
  /** 输入模态 */
  input: ("text" | "image" | "audio")[]
  /** 费率（每百万 token） */
  cost: ModelCost
  /** 上下文窗口大小 */
  contextWindow: number
  /** 最大输出 token */
  maxOutputTokens: number
  /** 思维级别支持 */
  thinkingLevels?: ThinkingLevel[]
  /** 传输方式 */
  transport?: "sse" | "websocket" | "auto"
  /** 兼容性覆盖 */
  compat?: ProviderCompat
}

export interface ModelCost {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export type ThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh"

/** 统一消息类型 */
export type Message = UserMessage | AssistantMessage | ToolResultMessage

export interface UserMessage {
  role: "user"
  content: string | ContentPart[]
  timestamp: number
}

export interface AssistantMessage {
  role: "assistant"
  content: (TextContent | ThinkingContent | ToolCall)[]
  usage: Usage
  stopReason: StopReason
  model: string
}

export interface ToolResultMessage {
  role: "tool_result"
  toolCallId: string
  content: (TextContent | ImageContent)[]
  isError: boolean
}

export type ContentPart = TextContent | ImageContent | AudioContent
export interface TextContent { type: "text"; text: string }
export interface ImageContent { type: "image"; source: ImageSource }
export interface ThinkingContent { type: "thinking"; text: string; signature?: string }
export interface ToolCall {
  type: "tool_call"
  id: string
  name: string
  arguments: Record<string, unknown>
}

/** 流式事件（高粒度） */
export type StreamEvent =
  | { type: "start"; partial: AssistantMessage }
  | { type: "text_delta"; index: number; delta: string }
  | { type: "thinking_delta"; index: number; delta: string }
  | { type: "tool_call_start"; toolCall: ToolCall }
  | { type: "tool_call_delta"; id: string; delta: string }
  | { type: "tool_call_end"; id: string; toolCall: ToolCall }
  | { type: "done"; message: AssistantMessage }
  | { type: "error"; error: Error; partial?: AssistantMessage }

/** 工具定义 — 使用 Zod schema */
export interface ToolDefinition<TArgs = unknown> {
  name: string
  description: string
  parameters: ZodType<TArgs>
  /** 工具可见性控制 */
  visibility?: "always" | "when-enabled" | "when-requested"
}

/** 流式上下文 */
export interface StreamContext {
  systemPrompt: string
  messages: Message[]
  tools?: ToolDefinition[]
  thinkingLevel?: ThinkingLevel
  maxTokens?: number
  temperature?: number
  cacheRetention?: "none" | "short" | "long"
}
```

#### 3.1.4 流式 API

```typescript
// packages/ai/src/stream.ts

import { EventStream } from "./utils/event-stream"

/**
 * 底层流式 API — 返回 EventStream
 * 
 * 使用示例:
 *   const stream = ai.stream(model, { systemPrompt, messages, tools })
 *   for await (const event of stream) { handle(event) }
 *   const result = await stream.result()  // 完整的 AssistantMessage
 */
export function stream(
  model: Model,
  context: StreamContext,
  options?: StreamOptions
): EventStream<StreamEvent, AssistantMessage>

/**
 * 一次性完成 — await 直接拿到结果
 */
export async function complete(
  model: Model,
  context: StreamContext,
  options?: StreamOptions
): Promise<AssistantMessage>

/**
 * 简化版流式 — 额外接受 thinkingLevel 参数
 */
export function streamSimple(
  model: Model,
  context: Omit<StreamContext, "thinkingLevel"> & { thinkingLevel?: ThinkingLevel },
  options?: StreamOptions
): EventStream<StreamEvent, AssistantMessage>
```

#### 3.1.5 Category→Model 自动解析（oh-my-opencode 核心特性）

```typescript
// packages/ai/src/model-resolver.ts

/**
 * 任务分类 — 决定使用哪个模型
 * 来源：oh-my-opencode 的 Category 系统
 */
export interface Category {
  name: string
  description: string
  /** 优先模型（按优先级排序） */
  preferredModels: string[]
  /** 特征要求 */
  requirements?: {
    reasoning?: boolean
    multimodal?: boolean
    minContextWindow?: number
    maxCostPerMillion?: number
  }
}

/** 内置分类（来自 oh-my-opencode DEFAULT_CATEGORIES） */
export const BUILTIN_CATEGORIES: Record<string, Category> = {
  general: {
    name: "general",
    description: "General coding tasks",
    preferredModels: ["anthropic/claude-opus-4-6", "openai/gpt-5.3-codex"]
  },
  quick: {
    name: "quick",
    description: "Small fast tasks, translations, simple edits",
    preferredModels: ["anthropic/claude-haiku-4-5", "openai/gpt-4.1-mini"]
  },
  deep: {
    name: "deep",
    description: "Deep logical reasoning and autonomous problem solving",
    preferredModels: ["openai/gpt-5.3-codex", "anthropic/claude-opus-4-6"]
  },
  ui: {
    name: "ui",
    description: "Frontend UI/UX, visual changes, CSS",
    preferredModels: ["google/gemini-3.1-pro", "anthropic/claude-sonnet-4-6"]
  },
  search: {
    name: "search",
    description: "Web search, low-cost retrieval",
    preferredModels: ["xai/grok-code-fast", "deepseek/deepseek-chat"]
  },
  writing: {
    name: "writing",
    description: "Documentation, writing tasks",
    preferredModels: ["moonshot/kimi-k2.5", "anthropic/claude-sonnet-4-6"]
  },
  planning: {
    name: "planning",
    description: "Architecture, complex planning",
    preferredModels: ["anthropic/claude-opus-4-6", "openai/o3"]
  },
  review: {
    name: "review",
    description: "Code review, quality analysis",
    preferredModels: ["openai/gpt-5.2", "anthropic/claude-opus-4-6"]
  }
}

/**
 * 三级 fallback 模型解析
 * 
 * 1. 用户配置覆盖 (config.categories.xxx.model)
 * 2. Category 默认 (BUILTIN_CATEGORIES.xxx.preferredModels)
 * 3. 系统 fallback (Claude → OpenAI → Gemini → Copilot → Ollama)
 */
export function resolveModel(
  category: string,
  config: ResolverConfig,
  availableModels: Model[]
): Model
```

#### 3.1.6 Fallback 链引擎

```typescript
// packages/ai/src/fallback-chain.ts

export interface FallbackChainConfig {
  /** 最大重试次数 */
  maxRetries: number
  /** 可重试错误类型 */
  retryableErrors: ("rate_limit" | "overloaded" | "server_error" | "timeout")[]
  /** 是否允许降级到其他提供商 */
  crossProviderFallback: boolean
  /** 退避策略 */
  backoff: { initial: number; multiplier: number; max: number }
}

/**
 * 带 fallback 的流式调用
 * 
 * - 同提供商重试（指数退避）
 * - 跨提供商降级（rate_limit / overloaded 时切换提供商）
 * - 上下文溢出不重试（交给上层 compaction）
 */
export function streamWithFallback(
  models: Model[],
  context: StreamContext,
  config: FallbackChainConfig,
  options?: StreamOptions
): EventStream<StreamEvent & { type: "fallback"; from: string; to: string }, AssistantMessage>
```

---

### 3.2 `@vitamin/agent` — 最小化 Agent 运行时

> 灵感来源：pi-mono 的 `@mariozechner/pi-agent-core`（5 个文件实现完整 Agent 循环），
> 但增加了多 Agent 支持和 oh-my-opencode 的 Hook 集成点

#### 3.2.1 职责

- Agent 状态机（idle → streaming → tool_executing → completed）
- Agent 循环（LLM 调用 → 工具执行 → 继续判断）
- Steering 消息队列（用户中断）
- FollowUp 消息队列（排队发送）
- 自定义消息类型（declaration merging）
- Agent 事件发射

#### 3.2.2 目录结构

```
packages/agent/src/
├── index.ts                    # 桶导出
├── types.ts                    # 核心类型（AgentState, AgentEvent, AgentConfig...）
├── agent.ts                    # Agent 类（状态机 + 消息队列）
├── agent-loop.ts               # Agent 循环（核心逻辑）
├── tool-executor.ts            # 工具执行引擎（顺序 + 并行模式）
├── agent-factory.ts            # Agent 工厂（createAgent）
└── errors.ts                   # Agent 错误类型
```

#### 3.2.3 核心类型

```typescript
// packages/agent/src/types.ts

import type { Model, Message, ToolDefinition, StreamEvent, ThinkingLevel } from "@vitamin/ai"

/** Agent 运行状态 */
export type AgentStatus = "idle" | "streaming" | "tool_executing" | "completed" | "error" | "aborted"

/** Agent 模式（来自 oh-my-opencode） */
export type AgentMode = "primary" | "subagent" | "all"

/** Agent 事件（细粒度，供 Hook/Extension 订阅） */
export type AgentEvent =
  | { type: "status_change"; from: AgentStatus; to: AgentStatus }
  | { type: "turn_start"; turnIndex: number }
  | { type: "turn_end"; turnIndex: number; message: AssistantMessage }
  | { type: "stream_event"; event: StreamEvent }
  | { type: "tool_call_start"; toolCall: ToolCallEvent }
  | { type: "tool_call_end"; toolCall: ToolCallEvent; result: ToolResult }
  | { type: "steering_injected"; messages: AgentMessage[] }
  | { type: "follow_up_start"; messages: AgentMessage[] }
  | { type: "error"; error: Error }
  | { type: "abort" }
  | { type: "compaction_needed"; tokenCount: number; threshold: number }

/** 可扩展消息类型（pi-mono 的 declaration merging 模式） */
export interface CustomAgentMessages {
  // 应用层通过 declaration merging 扩展
  // 例如: planMessage: PlanMessage
}
export type AgentMessage = Message | CustomAgentMessages[keyof CustomAgentMessages]

/** Agent 状态 */
export interface AgentState {
  status: AgentStatus
  systemPrompt: string
  model: Model
  thinkingLevel?: ThinkingLevel
  tools: AgentTool[]
  messages: AgentMessage[]
  turnCount: number
  tokenUsage: { input: number; output: number; cacheRead: number }
  isStreaming: boolean
  currentStreamMessage: AssistantMessage | null
  pendingToolCalls: Set<string>
  error?: Error
}

/** Agent 循环配置（pi-mono 核心设计） */
export interface AgentLoopConfig {
  model: Model
  /** AgentMessage[] → LLM Message[] 转换 */
  convertToLlm: (messages: AgentMessage[]) => Message[] | Promise<Message[]>
  /** 上下文转换（压缩/裁剪/注入） */
  transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>
  /** Steering 消息获取 */
  getSteeringMessages?: () => Promise<AgentMessage[]>
  /** FollowUp 消息获取 */
  getFollowUpMessages?: () => Promise<AgentMessage[]>
  /** API Key 动态获取 */
  getApiKey?: (provider: string) => Promise<string | undefined>
  /** 最大连续工具调用轮次 */
  maxToolTurns?: number
  /** 思维级别 */
  thinkingLevel?: ThinkingLevel
}

/** Agent 工具（封装 ToolDefinition + execute） */
export interface AgentTool<TArgs = unknown> extends ToolDefinition<TArgs> {
  execute: (
    id: string,
    args: TArgs,
    signal: AbortSignal,
    onUpdate?: (update: string) => void
  ) => Promise<ToolResult>
}

export interface ToolResult {
  content: (TextContent | ImageContent)[]
  isError?: boolean
  metadata?: Record<string, unknown>
}
```

#### 3.2.4 Agent 类

```typescript
// packages/agent/src/agent.ts

export class Agent {
  // 状态
  private state: AgentState
  private listeners: Set<(event: AgentEvent) => void> = new Set()
  private steeringQueue: AgentMessage[] = []
  private followUpQueue: AgentMessage[] = []
  private abortController: AbortController | null = null

  constructor(config: AgentConfig)

  /** 只读状态快照 */
  get snapshot(): Readonly<AgentState>

  /** 发送提示，启动 Agent 循环 */
  async prompt(messages: AgentMessage[]): Promise<void>

  /** 从当前上下文继续（重试/恢复） */
  async continue(): Promise<void>

  /** 注入 Steering 消息（中断当前工具执行） */
  steer(message: AgentMessage): void

  /** 排队 FollowUp 消息（Agent 完成后自动继续） */
  followUp(message: AgentMessage): void

  /** 取消当前操作 */
  abort(): void

  /** 订阅事件 */
  on(listener: (event: AgentEvent) => void): () => void

  /** 更新 Agent 配置（热更新模型、工具等） */
  update(partial: Partial<AgentConfig>): void
}
```

#### 3.2.5 Agent 循环

```typescript
// packages/agent/src/agent-loop.ts

/**
 * Agent 核心循环
 *
 * 双层循环结构（来自 pi-mono）:
 * 
 * 外循环: 处理 FollowUp 消息
 *   └── 内循环: 处理工具调用 + Steering 消息
 *       ├── streamAssistantResponse() — 调 LLM
 *       ├── executeToolCalls() — 执行工具
 *       │   └── 每个工具后检查 Steering 队列
 *       └── 检查是否有待处理的 Steering/工具调用
 * 
 * 退出条件:
 * - stopReason === "end_turn" 且无 FollowUp
 * - Agent 被 abort()
 * - 达到 maxToolTurns
 */
export async function agentLoop(
  initialMessages: AgentMessage[],
  config: AgentLoopConfig,
  toolExecutor: ToolExecutor,
  signal: AbortSignal,
  emit: (event: AgentEvent) => void
): Promise<void>
```

---

### 3.3 `@vitamin/orchestrator` — 多 Agent 编排引擎

> 核心来源：oh-my-opencode 的 Sisyphus/Prometheus/Atlas 编排系统，这是 vitamin 最重要的差异化

#### 3.3.1 职责

- Agent 注册表（内置 + 自定义 Agent 管理）
- 多 Agent 调度（`task()` 委派、并行/串行/后台执行）
- Plan/Build 编排（Prometheus→Momus→Atlas 管线）
- Category→Agent 映射
- Agent 元数据系统（用于动态 Prompt 生成）
- 后台 Agent 管理器

#### 3.3.2 目录结构

```
packages/orchestrator/src/
├── index.ts                        # 桶导出
├── types.ts                        # 编排类型
│
├── registry/                       # Agent 注册表
│   ├── agent-registry.ts           # Agent 注册/查找/元数据
│   ├── builtin-agents.ts           # 11 个内置 Agent 工厂
│   └── agent-metadata.ts           # Agent Prompt 元数据
│
├── agents/                         # 内置 Agent 定义
│   ├── sisyphus.ts                 # 主编排器（通用入口）
│   ├── hephaestus.ts               # 自主深度工作者
│   ├── atlas/                      # Todo 编排执行器
│   │   ├── atlas.ts
│   │   └── atlas-prompt.ts
│   ├── prometheus/                 # 计划生成器
│   │   ├── prometheus.ts
│   │   ├── system-prompt.ts
│   │   ├── identity-constraints.ts
│   │   ├── interview-mode.ts
│   │   ├── plan-generation.ts
│   │   ├── plan-template.ts
│   │   └── behavioral-summary.ts
│   ├── metis.ts                    # 计划前分析师
│   ├── momus.ts                    # 计划审查员
│   ├── oracle.ts                   # 战略顾问（只读）
│   ├── explore.ts                  # 代码库搜索（只读）
│   ├── librarian.ts                # 外部知识搜索（只读）
│   └── multimodal-looker.ts        # 多模态查看器
│
├── delegation/                     # 任务委派系统
│   ├── task-dispatcher.ts          # task() 核心调度
│   ├── category-resolver.ts        # Category→Agent 映射
│   ├── execution-modes.ts          # sync/async/background 执行模式
│   └── delegation-prompt.ts        # 动态委派 Prompt 生成
│
├── plan-build/                     # Plan/Build 编排
│   ├── plan-pipeline.ts            # Metis→Prometheus→Momus 管线
│   ├── plan-executor.ts            # 计划执行引擎
│   └── plan-storage.ts             # 计划文件管理 (.vitamin/plans/)
│
├── background/                     # 后台 Agent 管理
│   ├── background-manager.ts       # 并发控制 + 生命周期
│   └── background-notification.ts  # 后台任务通知
│
└── dynamic-prompt/                 # 动态 Prompt 构建
    ├── prompt-builder.ts           # Agent 感知的 Prompt 生成
    └── agent-summaries.ts          # Agent 能力摘要（注入主编排器 Prompt）
```

#### 3.3.3 编排架构

```
用户消息
  │
  ▼
Sisyphus（主编排器）
  │
  ├── Phase 0: Intent Gate — 意图分类
  │   ├── 简单任务 → 直接执行
  │   ├── 探索任务 → task(category: "search", subagent: "explore")
  │   ├── 复杂任务 → task(subagent: "metis") → Plan/Build 模式
  │   └── 特定领域 → task(category: "ui" | "deep" | "quick")
  │
  ├── Phase 1: 委派
  │   └── task() 调度
  │       ├── category 路径: Category→Model→Agent 自动解析
  │       │   └── sisyphus-junior 作为分类执行器
  │       └── subagent 路径: 直接调用命名 Agent
  │
  ├── Phase 2: Plan/Build（复杂任务）
  │   ├── Metis（预分析）→ 评估复杂度、收集上下文
  │   ├── Prometheus（规划）→ 需求访谈 + 计划生成
  │   ├── Momus（审查）→ 计划质量验证
  │   └── Atlas（执行）→ 按计划步骤并行分发
  │
  └── Phase 3: 执行
      ├── 同步执行（小任务）
      ├── 后台执行（独立任务）
      └── 并行执行（由 Atlas 批量分发）
```

#### 3.3.4 task() 调度接口

```typescript
// packages/orchestrator/src/delegation/task-dispatcher.ts

export interface TaskRequest {
  /** 任务分类（与 subagent 二选一） */
  category?: string
  /** 直接指定子代理（与 category 二选一） */
  subagent?: string
  /** 详细任务 prompt */
  prompt: string
  /** 简短描述（可选，用于日志和 UI 展示） */
  description?: string
  /** 执行模式 */
  mode: "sync" | "background"
  /** 继续已有会话 */
  sessionId?: string
  /** 需要加载的 Skills */
  skills?: string[]
  /** 依赖任务 ID（仅 Atlas 并行模式使用） */
  dependsOn?: string[]
}

export interface TaskResult {
  taskId: string
  status: "completed" | "failed" | "running" | "cancelled"
  output?: string
  error?: Error
  usage?: { tokens: number; cost: number; duration: number }
  agentUsed: string
  modelUsed: string
}

/**
 * 统一调度入口
 *
 * 调度决策流:
 * 1. 技能解析 → 2. 上下文获取 → 3. 路由决策:
 *    - category → resolveCategory() → Agent + Model
 *    - subagent → resolveSubagent() → 直接实例化
 * 4. 执行: sync → 阻塞等待 / background → 后台运行
 */
export class TaskDispatcher {
  constructor(
    registry: AgentRegistry,
    backgroundManager: BackgroundManager,
    config: OrchestratorConfig
  )

  async dispatch(request: TaskRequest): Promise<TaskResult>
}
```

#### 3.3.5 Agent 注册表

```typescript
// packages/orchestrator/src/registry/agent-registry.ts

export interface AgentRegistration {
  name: string
  factory: AgentFactory
  mode: AgentMode
  metadata: AgentPromptMetadata
  /** 是否可被配置禁用 */
  disableable: boolean
}

export interface AgentPromptMetadata {
  /** Agent 分组 */
  category: "exploration" | "specialist" | "advisor" | "utility" | "orchestrator"
  /** 费用等级 */
  cost: "FREE" | "CHEAP" | "EXPENSIVE"
  /** 触发条件（注入 Sisyphus Prompt） */
  triggers: Array<{ domain: string; trigger: string }>
  /** 适用场景 */
  useWhen?: string[]
  /** 不适用场景 */
  avoidWhen?: string[]
}

export class AgentRegistry {
  /** 注册内置 Agent */
  registerBuiltin(registration: AgentRegistration): void

  /** 注册自定义 Agent（Extension 提供） */
  registerCustom(registration: AgentRegistration): void

  /** 查找 Agent */
  get(name: string): AgentRegistration | undefined

  /** 获取所有可用 Agent（排除已禁用） */
  getAvailable(): AgentRegistration[]

  /** 生成 Sisyphus 的委派表（动态 Prompt 片段） */
  buildDelegationTable(): string

  /** 热插拔: 运行时禁用/启用 Agent */
  setEnabled(name: string, enabled: boolean): void
}
```

---

### 3.4 `@vitamin/tools` — 工具注册表 + 内置工具

> 来源：oh-my-opencode 的 26 个工具 + pi-mono 的极简工具设计

#### 3.4.1 目录结构

```
packages/tools/src/
├── index.ts                        # 桶导出
├── types.ts                        # 工具类型
├── tool-registry.ts                # 工具注册表
├── tool-validator.ts               # 参数验证引擎
│
├── builtin/                        # 内置工具
│   ├── read.ts                     # 文件读取（支持图片缩放）
│   ├── write.ts                    # 文件创建/覆写
│   ├── edit.ts                     # 精确文本替换
│   ├── edit-diff.ts                # 差异编辑（模糊匹配，来自 pi-mono）
│   ├── bash.ts                     # Shell 命令执行
│   ├── grep.ts                     # 正则/文本搜索
│   ├── glob.ts                     # 文件名匹配
│   ├── find.ts                     # 文件查找
│   ├── ls.ts                       # 目录列表
│   ├── ast-grep.ts                 # AST 结构化搜索
│   ├── look-at.ts                  # 多模态查看（截图/图片分析）
│   ├── interactive-bash.ts         # 交互式终端
│   └── hashline-edit.ts            # Hashline 编辑
│
├── orchestration/                  # 编排工具
│   ├── delegate-task.ts            # task() 委派入口
│   ├── start-work.ts               # Plan/Build 入口
│   ├── background-output.ts        # 后台任务输出
│   ├── background-cancel.ts        # 后台任务取消
│   └── call-agent.ts               # 直接调用 Agent
│
├── skill/                          # Skill 工具
│   ├── skill-executor.ts           # Skill 执行
│   ├── skill-mcp.ts                # Skill MCP 管理
│   └── skill-loader.ts             # Skill 加载
│
├── session/                        # 会话工具
│   └── session-manager.ts          # 会话切换/列表
│
└── task/                           # 任务管理工具
    ├── task-create.ts
    ├── task-get.ts
    ├── task-list.ts
    └── task-update.ts
```

#### 3.4.2 工具注册表

```typescript
// packages/tools/src/tool-registry.ts

export interface ToolRegistryConfig {
  /** 禁用的工具名列表 */
  disabledTools?: string[]
  /** 工具集预设 */
  preset?: "minimal" | "standard" | "full"
  /** 自定义工具可见性 */
  visibility?: Record<string, "always" | "when-enabled" | "when-requested">
}

/**
 * 工具预设:
 * - minimal: read, write, edit, bash (4个，pi-mono 风格)
 * - standard: minimal + grep, glob, find, ls, ast-grep, delegate-task (10个)
 * - full: standard + 所有编排/skill/session/task 工具 (26个, oh-my-opencode 风格)
 */
export class ToolRegistry {
  /** 注册工具 */
  register(name: string, tool: AgentTool): void

  /** Extension 注册工具 */
  registerExternal(name: string, tool: AgentTool, source: string): void

  /** 获取当前可用工具 */
  getAvailable(): Map<string, AgentTool>

  /** 按预设过滤 */
  applyPreset(preset: ToolRegistryConfig["preset"]): void

  /** 包装工具（Extension 拦截层） */
  wrapWithExtensions(wrapper: ToolWrapper): void
}
```

---

### 3.5 `@vitamin/hooks` — 生命周期 Hook 引擎

> 来源：oh-my-opencode 的 46 个 Hook，按三层架构组织

#### 3.5.1 目录结构

```
packages/hooks/src/
├── index.ts                        # 桶导出
├── types.ts                        # Hook 类型
├── hook-engine.ts                  # Hook 注册 + 执行引擎
├── safe-hook.ts                    # 安全 Hook 包装（错误隔离）
│
├── core/                           # 核心 Hook（~37个）
│   ├── session/                    # 会话相关
│   │   ├── first-message-variant.ts
│   │   ├── session-recovery.ts
│   │   ├── session-history.ts
│   │   └── keyword-detection.ts
│   ├── tool-guard/                 # 工具守卫
│   │   ├── file-guard.ts           # 文件操作保护
│   │   ├── label-truncator.ts      # 标签截断
│   │   ├── rules-injector.ts       # 规则注入
│   │   └── output-truncation.ts    # 输出截断
│   ├── transform/                  # 消息变换
│   │   ├── context-injector.ts     # 上下文注入
│   │   ├── thinking-validator.ts   # 思考块验证
│   │   └── anthropic-effort.ts     # Anthropic effort 调整
│   └── quality/                    # 质量控制
│       ├── comment-checker.ts      # 注释质量检查
│       ├── babysitting.ts          # 不稳定 Agent 保姆
│       └── ralph-loop.ts           # 循环检测
│
├── continuation/                   # 延续 Hook（~7个）
│   ├── compaction-context.ts       # 压缩上下文注入
│   ├── compaction-todo.ts          # 压缩时 Todo 保存
│   ├── continuation-prompt.ts      # 延续 Prompt
│   └── background-notification.ts  # 后台通知
│
└── skill/                          # Skill Hook（~2个）
    ├── skill-reminder.ts           # Skill 提醒
    └── skill-auto-command.ts       # Skill 自动命令
```

#### 3.5.2 Hook 引擎

```typescript
// packages/hooks/src/hook-engine.ts

/** Hook 时机 */
export type HookTiming =
  // 消息流
  | "chat.message.before"
  | "chat.message.after"
  | "chat.params"
  | "chat.system.transform"
  | "chat.messages.transform"
  // 工具
  | "tool.execute.before"
  | "tool.execute.after"
  | "tool.register"
  // 会话
  | "session.created"
  | "session.deleted"
  | "session.idle"
  | "session.error"
  | "session.compacting"
  // Agent
  | "agent.start"
  | "agent.end"
  | "agent.turn.start"
  | "agent.turn.end"
  // 配置
  | "config.loaded"
  | "config.changed"

/** Hook 注册 */
export interface HookRegistration<T extends HookTiming = HookTiming> {
  name: string
  timing: T
  /** 优先级（低数字先执行） */
  priority: number
  /** 是否可禁用 */
  disableable: boolean
  /** Hook 处理函数 */
  handler: HookHandler<T>
}

/**
 * Hook 引擎
 * 
 * 特性:
 * - 安全执行（单个 Hook 失败不影响其他）
 * - 优先级排序
 * - 可配置禁用
 * - 执行追踪（timing/error logging）
 * - 链式处理（前一个 Hook 的输出作为后一个的输入）
 */
export class HookEngine {
  /** 注册 Hook */
  register<T extends HookTiming>(registration: HookRegistration<T>): void

  /** 执行 Hook 链 */
  async execute<T extends HookTiming>(
    timing: T,
    input: HookInput<T>,
    output: HookOutput<T>
  ): Promise<void>

  /** 禁用指定 Hook */
  disable(name: string): void

  /** 获取已注册的 Hook */
  getRegistered(timing?: HookTiming): HookRegistration[]
}
```

---

### 3.6 `@vitamin/extension` — 扩展系统

> 核心来源：pi-mono 的 Extension System（26 事件 + UI 控制 + Provider 注册），
> 与 oh-my-opencode 的 Hook 系统统一

#### 3.6.1 设计理念

vitamin 的扩展系统是 **Hook + Extension 的统一体**：
- **Hook**（数据流拦截）：继承 oh-my-opencode 的 46 个生命周期钩子
- **Extension**（功能扩展）：继承 pi-mono 的 UI 控制、工具/命令/Provider 注册

两者通过 **统一的 ExtensionAPI** 暴露给扩展开发者：

```
Extension = Hook集合 + 工具注册 + 命令注册 + UI 控制 + Provider 注册
```

#### 3.6.2 目录结构

```
packages/extension/src/
├── index.ts
├── types.ts                        # ExtensionAPI + ExtensionUIContext
├── extension-runner.ts             # 扩展运行器
├── extension-loader.ts             # 发现 + 加载扩展
├── tool-wrapper.ts                 # 工具拦截包装器
├── api-builder.ts                  # ExtensionAPI 构建器
└── builtin/                        # 内置等效扩展
    ├── plan-mode.ts                # Plan/Build 模式
    └── skill-system.ts             # Skill 系统
```

#### 3.6.3 ExtensionAPI

```typescript
// packages/extension/src/types.ts

/**
 * Extension 工厂函数签名
 * 
 * 示例:
 *   export default function myExtension(api: ExtensionAPI) {
 *     api.on("agent.turn.end", async (event) => { ... })
 *     api.registerTool({ name: "my_tool", ... })
 *     api.registerCommand("my-command", { ... })
 *   }
 */
export type ExtensionFactory = (api: ExtensionAPI) => void | Promise<void>

export interface ExtensionAPI {
  // ═══════════════════════════════════════
  // 事件订阅（合并 pi-mono 26 事件 + oh-my-opencode 46 Hook）
  // ═══════════════════════════════════════

  /** 会话事件 */
  on(event: "session.start", handler: SessionEventHandler): void
  on(event: "session.switch", handler: SessionEventHandler): void
  on(event: "session.fork", handler: SessionEventHandler): void
  on(event: "session.end", handler: SessionEventHandler): void
  on(event: "session.compacting", handler: CompactionHandler): void

  /** Agent 事件 */
  on(event: "agent.start", handler: AgentStartHandler): void
  on(event: "agent.end", handler: AgentEndHandler): void
  on(event: "agent.turn.start", handler: TurnHandler): void
  on(event: "agent.turn.end", handler: TurnHandler): void

  /** 消息事件 */
  on(event: "message.start", handler: MessageHandler): void
  on(event: "message.update", handler: MessageHandler): void
  on(event: "message.end", handler: MessageHandler): void

  /** 工具事件 */
  on(event: "tool.call", handler: ToolCallHandler): void          // 可阻止
  on(event: "tool.result", handler: ToolResultHandler): void      // 可修改
  on(event: "tool.execute.before", handler: ToolGuardHandler): void
  on(event: "tool.execute.after", handler: ToolGuardHandler): void

  /** 消息变换（oh-my-opencode 的 context injection） */
  on(event: "context.transform", handler: ContextTransformHandler): void
  on(event: "system.transform", handler: SystemTransformHandler): void

  /** 输入拦截（pi-mono） */
  on(event: "input", handler: InputHandler): void

  /** 模型选择 */
  on(event: "model.select", handler: ModelSelectHandler): void

  /** 资源发现 */
  on(event: "resources.discover", handler: ResourceDiscoverHandler): void

  // ═══════════════════════════════════════
  // 注册
  // ═══════════════════════════════════════

  /** 注册 LLM 可调用工具 */
  registerTool(tool: ExtensionToolDefinition): void

  /** 注册 /command 斜杠命令 */
  registerCommand(name: string, options: CommandOptions): void

  /** 注册键盘快捷键 */
  registerShortcut(key: string, options: ShortcutOptions): void

  /** 注册 CLI 标志 */
  registerFlag(name: string, options: FlagOptions): void

  /** 注册自定义消息渲染器 */
  registerMessageRenderer(type: string, renderer: MessageRenderer): void

  /** 注册 LLM 提供商（含 OAuth）*/
  registerProvider(name: string, config: ProviderConfig): void

  /** 注册 Hook（低级 API，直接操作 HookEngine） */
  registerHook(registration: HookRegistration): void

  // ═══════════════════════════════════════
  // 操作
  // ═══════════════════════════════════════

  /** 发送自定义消息 */
  sendMessage(message: AgentMessage, options?: { skipInput?: boolean }): void

  /** 设置活跃工具集 */
  setActiveTools(toolNames: string[]): void

  /** 切换模型 */
  setModel(model: string): void

  /** 设置思维级别 */
  setThinkingLevel(level: ThinkingLevel): void

  /** 执行 Shell 命令 */
  exec(command: string, args?: string[], options?: ExecOptions): Promise<ExecResult>

  /** 扩展间事件总线 */
  events: EventBus

  /** UI 上下文（仅 TUI 模式可用） */
  ui: ExtensionUIContext

  /** Agent 上下文 */
  agent: {
    state: Readonly<AgentState>
    steer(message: AgentMessage): void
    followUp(message: AgentMessage): void
    abort(): void
  }

  /** 配置上下文 */
  config: {
    get<T>(path: string): T | undefined
    getProjectDir(): string
  }

  /** 日志 */
  log: Logger
}
```

#### 3.6.4 ExtensionUIContext（来自 pi-mono，核心差异化）

```typescript
// packages/extension/src/types.ts

export interface ExtensionUIContext {
  // ── 对话框 ──
  select(title: string, options: SelectOption[]): Promise<string | null>
  confirm(title: string, message: string): Promise<boolean>
  input(title: string, placeholder?: string): Promise<string | null>
  notify(message: string, type?: "info" | "warn" | "error"): void
  editor(title: string, prefill?: string): Promise<string | null>
  /** 任意自定义 TUI 组件（overlay 模式） */
  custom<T>(factory: ComponentFactory<T>, options?: CustomUIOptions): Promise<T>

  // ── UI 控制 ──
  setStatus(key: string, text: string): void
  setWorkingMessage(message: string): void
  setWidget(key: string, content: ComponentFactory): void
  setFooter(factory: ComponentFactory): void
  setHeader(factory: ComponentFactory): void
  setEditorComponent(factory: ComponentFactory): void
  setTitle(title: string): void
  setTheme(theme: ThemeConfig): void

  // ── 编辑器控制 ──
  onTerminalInput(handler: (input: string) => void): void
  pasteToEditor(text: string): void
  setEditorText(text: string): void
  getEditorText(): string
}
```

---

### 3.7 `@vitamin/session` — 会话管理

> 来源：pi-mono 的 Session 树（JSONL + 分支/导航），oh-my-opencode 的会话恢复

#### 3.7.1 目录结构

```
packages/session/src/
├── index.ts
├── types.ts                        # 会话类型
├── session-manager.ts              # 会话 CRUD + 持久化
├── session-tree.ts                 # 树结构操作
├── compaction/                     # 上下文压缩
│   ├── compactor.ts                # 压缩引擎
│   ├── strategies/                 # 压缩策略
│   │   ├── summary.ts             # LLM 摘要 (默认)
│   │   ├── sliding-window.ts      # 滑动窗口
│   │   └── incremental.ts         # 增量压缩 (vitamin 独创)
│   └── todo-preserver.ts          # 压缩时保存 Todo 状态
├── export/                         # 导出
│   ├── html-export.ts
│   └── gist-export.ts
└── storage/
    ├── jsonl-storage.ts            # JSONL 文件存储
    └── sqlite-storage.ts           # SQLite 存储 (可选)
```

#### 3.7.2 Session 树

```typescript
// packages/session/src/types.ts

/** 会话条目（JSONL 每条记录） */
export interface SessionEntry {
  id: string
  parentId: string | null
  type: "message" | "system" | "compaction" | "branch_point"
  content: AgentMessage | SystemEvent | CompactionRecord
  timestamp: number
  metadata?: Record<string, unknown>
}

/** 会话树节点 */
export interface SessionNode {
  entry: SessionEntry
  children: SessionNode[]
}

/**
 * 会话管理器
 *
 * 核心特性（来自 pi-mono）:
 * - 树结构：每个对话可以在任意节点分支
 * - JSONL 存储：追加写入，单文件包含完整树
 * - 导航：/tree 命令可视化导航整棵树
 * - 分支：/fork 从任意节点创建新分支
 */
export class SessionManager {
  /** 创建新会话 */
  create(name?: string): Session

  /** 切换到已有会话 */
  switch(sessionId: string): Session

  /** 从当前节点创建分支 */
  fork(fromEntryId?: string): Session

  /** 获取树结构 */
  getTree(sessionId: string): SessionNode

  /** 导航到树中某个节点 */
  navigateTo(entryId: string): void

  /** 列出所有会话（含标签） */
  list(): SessionInfo[]

  /** 导出会话 */
  export(sessionId: string, format: "html" | "json" | "gist"): Promise<string>

  /** 自动恢复上次会话 */
  recover(): Session | null
}
```

#### 3.7.3 增量压缩（vitamin 独创）

```typescript
// packages/session/src/compaction/strategies/incremental.ts

/**
 * 增量压缩策略
 *
 * 与传统"全量摘要"不同，增量压缩保留最近 N 条原文消息，
 * 只对更早的消息进行 LLM 摘要。每次压缩时，仅对新增的
 * "已过期"消息进行摘要，并合并到已有摘要中。
 *
 * 优势:
 * - 保留近期上下文的完整细节
 * - 避免重复摘要已经摘要过的内容
 * - 摘要质量更高（每次只处理少量新消息）
 * - 支持 Todo/进度 状态保留
 *
 * 结构:
 * [摘要(v3)] + [原文 msg N-5] + [原文 msg N-4] + ... + [原文 msg N]
 *  ↑ 增量更新                    ↑ 滑动窗口保留
 */
export class IncrementalCompactor implements CompactionStrategy {
  constructor(config: {
    /** 保留最近 N 条原文消息 */
    retainRecent: number
    /** 摘要更新模型 */
    summaryModel: Model
    /** 摘要最大 token */
    summaryMaxTokens: number
  })

  async compact(
    messages: AgentMessage[],
    existingSummary?: string
  ): Promise<CompactionResult>
}
```

---

### 3.8 `@vitamin/config` — 多级配置系统

> 来源：oh-my-opencode 的 JSONC 多级配置 + Zod v4 验证

#### 3.8.1 目录结构

```
packages/config/src/
├── index.ts
├── types.ts
├── loader.ts                       # 配置加载 + 合并
├── parser.ts                       # JSONC 解析 + 部分容错
├── merger.ts                       # 多级合并策略
├── migrator.ts                     # 配置迁移（版本间自动升级）
├── watcher.ts                      # 配置热重载
├── schema/                         # Zod v4 Schema
│   ├── root.ts                     # VitaminConfigSchema
│   ├── agents.ts                   # Agent 覆盖
│   ├── categories.ts               # Category 配置
│   ├── tools.ts                    # 工具配置
│   ├── extensions.ts               # 扩展配置
│   ├── session.ts                  # 会话配置
│   ├── tui.ts                      # UI 配置
│   ├── experimental.ts             # 实验性功能
│   └── mcp.ts                      # MCP 配置
└── defaults.ts                     # 内置默认值
```

#### 3.8.2 配置层级

```
优先级（高 → 低）:
  CLI 参数 (--model claude-opus-4-6)
    → 环境变量 (VITAMIN_MODEL=xxx)
      → Project (.vitamin/config.jsonc)
        → User (~/.config/vitamin/config.jsonc)
          → Extension 默认值
            → 内置默认值
```

#### 3.8.3 配置 Schema（根）

```typescript
// packages/config/src/schema/root.ts

export const VitaminConfigSchema = z.object({
  $schema: z.string().optional(),

  // ── Agent 系统 ──
  agents: AgentOverridesSchema.optional(),
  disabled_agents: z.array(z.string()).optional(),

  // ── Category 系统 ──
  categories: CategoriesConfigSchema.optional(),

  // ── 工具 ──
  tool_preset: z.enum(["minimal", "standard", "full"]).optional(),
  disabled_tools: z.array(z.string()).optional(),

  // ── Hook ──
  disabled_hooks: z.array(z.string()).optional(),

  // ── 扩展 ──
  extensions: ExtensionsConfigSchema.optional(),

  // ── MCP ──
  mcp: McpConfigSchema.optional(),
  disabled_mcps: z.array(z.string()).optional(),

  // ── 会话 ──
  session: SessionConfigSchema.optional(),

  // ── 压缩 ──
  compaction: CompactionConfigSchema.optional(),

  // ── UI ──
  tui: TuiConfigSchema.optional(),
  theme: z.string().optional(),

  // ── Skill ──
  skills: SkillsConfigSchema.optional(),
  disabled_skills: z.array(z.string()).optional(),

  // ── 后台任务 ──
  background_task: BackgroundTaskConfigSchema.optional(),

  // ── 实验性 ──
  experimental: ExperimentalConfigSchema.optional(),

  // ── 运行时 ──
  model_fallback: z.boolean().optional(),
  tmux: TmuxConfigSchema.optional(),
  notification: NotificationConfigSchema.optional(),

  // ── 迁移记录 ──
  _migrations: z.array(z.string()).optional(),
})

export type VitaminConfig = z.infer<typeof VitaminConfigSchema>
```

---

### 3.9 `@vitamin/mcp` — MCP 协议支持

> 来源：oh-my-opencode 的三层 MCP 系统

#### 3.9.1 三层 MCP 架构

```
┌─────────────────────────────────────────────────┐
│               vitamin MCP 系统                   │
│                                                  │
│  Tier 1: 内置 MCP                                │
│  ├── websearch (Exa/Tavily)                     │
│  ├── context7 (库文档搜索)                       │
│  └── grep_app (代码搜索)                         │
│                                                  │
│  Tier 2: 用户配置 MCP                            │
│  └── .vitamin/mcp.json (stdio + HTTP)           │
│      ├── ${VAR} 环境变量展开                     │
│      └── OAuth 令牌管理                          │
│                                                  │
│  Tier 3: Skill 嵌入 MCP                          │
│  └── SKILL.md YAML frontmatter 中的 MCP 定义     │
│      └── SkillMcpManager 生命周期管理            │
└─────────────────────────────────────────────────┘
```

#### 3.9.2 目录结构

```
packages/mcp/src/
├── index.ts
├── types.ts                        # MCP 类型
├── mcp-client.ts                   # 统一 MCP 客户端
├── mcp-registry.ts                 # MCP 服务注册表
├── mcp-loader.ts                   # MCP 配置加载（.vitamin/mcp.json）
├── skill-mcp-manager.ts            # Skill 嵌入 MCP 管理
├── oauth-manager.ts                # OAuth 令牌管理
├── builtin/                        # 内置 MCP
│   ├── websearch.ts
│   ├── context7.ts
│   └── grep-app.ts
└── transports/
    ├── stdio.ts                    # stdio 传输
    └── http.ts                     # HTTP/SSE 传输
```

---

### 3.10 `@vitamin/coding-agent` — 主产品 CLI

> 最终产品包，组装所有子包

#### 3.10.1 目录结构

```
packages/coding-agent/src/
├── index.ts                        # 入口
├── cli.ts                          # CLI 定义 (Commander.js)
├── main.ts                         # 启动流程
│
├── core/
│   ├── agent-session.ts            # AgentSession（核心会话管理）
│   ├── system-prompt.ts            # 系统提示构建
│   ├── resource-loader.ts          # 资源加载（AGENTS.md, .vitamin/）
│   ├── keybindings.ts              # 键绑定
│   ├── slash-commands.ts           # 斜杠命令
│   └── prompt-templates.ts         # 提示模板
│
├── modes/                          # 运行模式
│   ├── interactive/                # 交互模式（Ink）
│   │   ├── app.ts                  # Interactive 应用
│   │   ├── pages/                  # 页面组件
│   │   └── widgets/                # 自定义 Widget
│   ├── print/                      # 打印模式（非交互）
│   ├── json/                       # JSON 模式（机器可读）
│   └── rpc/                        # RPC 模式（SDK 入口）
│
├── commands/                       # CLI 命令
│   ├── run.ts                      # vitamin run
│   ├── doctor.ts                   # vitamin doctor
│   ├── install.ts                  # vitamin install
│   └── config.ts                   # vitamin config
│
└── extensions/                     # 内置扩展
    ├── plan-mode/                  # Plan/Build 模式
    ├── git-master/                 # Git 高级操作
    ├── skill-loader/               # Skill 系统
    └── tmux-manager/               # Tmux 管理
```

#### 3.10.2 启动流程

```
vitamin [prompt]
  │
  ├── 1. 解析 CLI 参数
  ├── 2. 加载配置（6 层优先级）
  │     └── VitaminConfig 合并 + Zod 验证 + 迁移
  ├── 3. 初始化子系统
  │     ├── ModelRegistry.init()           # 加载模型数据库
  │     ├── ToolRegistry.init(preset)      # 注册工具
  │     ├── HookEngine.init()              # 注册 Hook
  │     ├── AgentRegistry.init()           # 注册 Agent
  │     ├── SessionManager.init()          # 初始化会话
  │     ├── McpRegistry.init()             # 加载 MCP
  │     └── ExtensionRunner.init()         # 加载 Extension
  ├── 4. 创建 AgentSession
  │     ├── 绑定 Event Subscription
  │     ├── 构建 System Prompt
  │     └── 解析初始 Model
  ├── 5. 选择运行模式
  │     ├── interactive → Interactive App (Ink)
  │     ├── --print → Print Mode
  │     ├── --json → JSON Mode
  │     └── --rpc → RPC Mode
  └── 6. 进入主循环
        ├── 用户输入 → AgentSession.prompt()
        ├── Agent 循环执行
        └── 输出渲染
```

---

### 3.11 `@vitamin/sdk` — 嵌入式 SDK

> 来源：pi-mono 的 SDK/RPC 模式

```typescript
// packages/sdk/src/index.ts

import { AgentSession } from "@vitamin/coding-agent"
import type { StreamEvent, TaskResult } from "@vitamin/ai"

/**
 * Vitamin SDK — 将 coding agent 嵌入任何 Node.js 应用
 *
 * 使用示例:
 *   const vitamin = await createVitaminAgent({ projectDir: "./" })
 *   const result = await vitamin.prompt("Fix the login bug")
 *   for await (const event of result.stream) { ... }
 */
export async function createVitaminAgent(options: {
  projectDir: string
  model?: string
  config?: Partial<VitaminConfig>
  extensions?: ExtensionFactory[]
}): Promise<VitaminAgent>

export interface VitaminAgent {
  /** 发送 prompt，返回流式结果 */
  prompt(text: string, options?: PromptOptions): AgentStream

  /** 继续当前对话 */
  continue(): AgentStream

  /** 中断并注入消息 */
  steer(message: string): void

  /** 取消当前操作 */
  abort(): void

  /** 获取 Agent 状态 */
  get state(): Readonly<AgentState>

  /** 事件订阅 */
  on(event: string, handler: Function): () => void

  /** 销毁 */
  dispose(): Promise<void>
}

export interface AgentStream {
  /** 异步迭代流式事件 */
  [Symbol.asyncIterator](): AsyncIterator<StreamEvent>

  /** 等待完成结果 */
  result(): Promise<AgentResult>
}
```

---

### 3.12 `@vitamin/shared` — 共享工具库

```
packages/shared/src/
├── index.ts
├── logger.ts                       # pino 结构化日志
├── fs.ts                           # 文件系统工具
├── path.ts                         # 路径工具
├── process.ts                      # 进程管理
├── string.ts                       # 字符串工具
├── json.ts                         # JSON/JSONC 解析
├── error.ts                        # 错误类型
├── types.ts                        # 公共类型
├── event-emitter.ts                # 类型安全事件发射器
└── disposable.ts                   # 资源清理
```

---

### 3.13 `@vitamin/server` — HTTP 服务与可观测入口

> 定位：把 CLI/Agent 能力暴露为可编程服务层，承接 Inspector 与 Web 前端访问

#### 3.13.1 目录结构（摘录）

```
packages/server/src/
├── index.ts
├── app.ts                          # 服务初始化
├── routes/                         # 路由注册
├── api/                            # 对话、会话、状态等 API
├── middleware/                     # 认证、日志、限流
└── inspector/                      # Inspector 相关入口
```

#### 3.13.2 双层标注

- 实现态：基础 HTTP API、会话操作、流式输出入口已落地。
- 规划态：权限模型、多租户、审计日志等服务治理能力。

---

### 3.14 `@vitamin/web-ui` — 浏览器端交互

> 定位：对接 `@vitamin/server` API，提供浏览器会话与操作界面

#### 3.14.1 目录结构（摘录）

```
packages/web-ui/src/
├── app.tsx
├── pages/
├── components/
├── services/                       # API + 流式事件客户端
└── state/
```

#### 3.14.2 双层标注

- 实现态：基础会话页面与接口对接能力已存在。
- 规划态：复杂工作流编排、性能优化和更强可观测性。

---

### 3.15 `@vitamin/ui-kit` — 共享 UI 组件层

> 定位：统一 Web 端与 Inspector 端的设计 token、基础组件与主题约定

#### 3.15.1 目录结构（摘录）

```
packages/ui-kit/src/
├── index.ts
├── tokens/
├── theme/
└── components/
```

#### 3.15.2 双层标注

- 实现态：基础 token 与组件复用能力已建立。
- 规划态：主题系统与组件标准进一步稳定化。
