# vitamin-coding-agent 技术方案

> 版本：v0.1.0-draft | 日期：2026-02-27
> 定位：基于 Node.js 的下一代 AI 编码代理框架

---

## 目录

- [第一部分：设计理念与定位](#第一部分设计理念与定位)
- [第二部分：Monorepo 总体架构](#第二部分monorepo-总体架构)
- [第三部分：各包详细设计](#第三部分各包详细设计)
- [第四部分：核心流程与数据流](#第四部分核心流程与数据流)
- [第五部分：扩展系统设计](#第五部分扩展系统设计)
- [第六部分：工程基建与开发规范](#第六部分工程基建与开发规范)
- [第七部分：实施路线图](#第七部分实施路线图)
- [第八部分：pi-mono 融合详解——原因、目的与实现](#第八部分pi-mono-融合详解原因目的与实现)
- [第九部分：云端部署——数据持久化与缓存](#第九部分云端部署数据持久化与缓存)
- [第十部分：试验性特性讨论](#第十部分试验性特性讨论)
- [附录：设计决策记录](#附录设计决策记录)

---

## 第一部分：设计理念与定位

### 1.1 核心目标

构建一个**独立的、可嵌入的、全栈自研**的 AI 编码代理框架：

1. **以 oh-my-opencode 的能力为核心**：多 Agent 编排（11 Agent 矩阵）、Plan/Build 模式、Category→Model 智能映射、46 个生命周期 Hook、26 个工具、三层 MCP、Skill 系统
2. **吸纳 pi-mono 的架构优势**：分层解耦包设计、极简 Agent 运行时、Session 树（分支/导航）、Extension UI 控制、Steering/FollowUp 消息队列、SDK/RPC 模式
3. **独立产品**（非插件）：拥有完整技术栈——从 LLM API 到 TUI，不受任何上游约束

### 1.2 设计原则

| 原则 | 说明 | 来源 |
|------|------|------|
| **分层自治** | 每个包可独立使用：只用 `@vitamin/ai` 调 LLM，或只用 `@vitamin/agent` 跑循环 | pi-mono |
| **丰富内置 + 可卸载** | 默认提供完整 Agent 矩阵、Plan/Build、MCP，但均可通过配置禁用 | oh-my-opencode |
| **正确的模型做正确的事** | Category 系统自动将任务域映射到最适合的 AI 模型 | oh-my-opencode |
| **激进可扩展** | Extension 可修改 UI、注册工具/命令/提供商/快捷键 | pi-mono |
| **渐进复杂度** | 简单任务零配置，复杂编排可深度定制 | 综合 |
| **SDK-first** | 核心逻辑与 UI 分离，支持 CLI/Web/SDK/RPC 多种前端 | pi-mono |

### 1.3 与前辈的差异定位

```
┌─────────────────────────────────────────────────────────────────┐
│                    vitamin-coding-agent                         │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ pi-mono 的       │  │ oh-my-opencode 的│  │ vitamin 独创  │ │
│  │ 架构优势         │  │ 能力核心         │  │               │ │
│  │                  │  │                  │  │               │ │
│  │ - 分层包设计     │  │ - 11 Agent 矩阵  │  │ - 统一调度总线│ │
│  │ - 极简 Agent 核心│  │ - Plan/Build     │  │ - 双模式扩展  │ │
│  │ - Session 树     │  │ - Category 映射  │  │ - 增量压缩    │ │
│  │ - Steering 队列  │  │ - 46 个 Hook     │  │ - Agent 热插拔│ │
│  │ - Extension UI   │  │ - 26 个工具      │  │ - 可视化调试  │ │
│  │ - SDK/RPC        │  │ - 三层 MCP       │  │ - 依赖拓扑    │ │
│  │ - 差异渲染 TUI   │  │ - Skill 系统     │  │   并行执行    │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 第二部分：Monorepo 总体架构

### 2.1 包结构

```
vitamin-coding-agent/
├── pnpm-workspace.yaml
├── package.json                    # Root: scripts, devDependencies
├── tsconfig.base.json              # Base TypeScript config
├── biome.json                      # Linter + Formatter
├── vitest.workspace.ts             # 统一测试配置
├── turbo.json                      # Turborepo 构建编排
│
├── packages/
│   ├── ai/                         # @vitamin/ai         — 统一 LLM API 层
│   ├── agent/                      # @vitamin/agent      — 最小化 Agent 运行时
│   ├── orchestrator/               # @vitamin/orchestrator — 多 Agent 编排引擎
│   ├── tools/                      # @vitamin/tools      — 工具注册表 + 内置工具
│   ├── hooks/                      # @vitamin/hooks      — 生命周期 Hook 引擎
│   ├── extension/                  # @vitamin/extension   — 扩展系统（Hook + UI 控制）
│   ├── session/                    # @vitamin/session    — 会话管理（树结构 + 持久化）
│   ├── config/                     # @vitamin/config     — 多级配置系统
│   ├── mcp/                        # @vitamin/mcp        — MCP 协议支持
│   ├── tui/                        # @vitamin/tui        — 终端 UI 框架
│   ├── coding-agent/               # @vitamin/coding-agent — 主产品 CLI
│   ├── sdk/                        # @vitamin/sdk        — 嵌入式 SDK
│   └── shared/                     # @vitamin/shared     — 共享工具库
│
├── extensions/                     # 官方 Extension 集合
│   ├── plan-mode/                  # Plan/Build 模式（从 oh-my-opencode 移植）
│   ├── git-master/                 # Git 高级操作
│   ├── skill-loader/               # Skill 系统
│   └── tmux-manager/               # Tmux 会话管理
│
├── docs/                           # 文档站点
├── benchmarks/                     # 性能基准测试
└── scripts/                        # 构建/发布脚本
```

### 2.2 包依赖拓扑

```
                         @vitamin/shared (0 dependencies)
                              │
                ┌─────────────┼───────────────┐
                ▼             ▼               ▼
          @vitamin/ai    @vitamin/config   @vitamin/tui
                │             │
                ▼             │
         @vitamin/agent ◄─────┘
           │    │
           │    ▼
           │  @vitamin/hooks
           │    │
           ▼    ▼
      @vitamin/tools
           │
           ▼
    @vitamin/orchestrator
           │
     ┌─────┼──────┐
     ▼     ▼      ▼
@vitamin/ @vitamin/ @vitamin/
session   mcp      extension
     │     │        │
     └─────┼────────┘
           ▼
    @vitamin/coding-agent ──→ @vitamin/tui
           │
           ▼
       @vitamin/sdk
```

### 2.3 技术栈选型

| 层面 | 选择 | 理由 |
|------|------|------|
| **Runtime** | Node.js 22+ | 用户要求；LTS；原生 ESM；`--experimental-strip-types` 支持 TS 直接运行 |
| **Language** | TypeScript 5.7+ | 严格模式；`satisfies`；装饰器 |
| **Package Manager** | pnpm 9+ | 用户要求；严格依赖；workspace protocol |
| **Monorepo 编排** | Turborepo | 增量构建；远程缓存；拓扑排序 |
| **构建** | tsup (esbuild) | ESM + CJS 双输出；声明文件；tree-shaking |
| **测试** | vitest | 快速；workspace 模式；coverage；与 TypeScript 天然集成 |
| **Lint/Format** | Biome | 比 ESLint+Prettier 快 25x；零配置 |
| **Schema 验证** | Zod v4 | oh-my-opencode 已验证；JSON Schema 导出；coerce |
| **CLI 框架** | Commander.js | 成熟；子命令；自动帮助 |
| **日志** | pino | 结构化 JSON 日志；低开销 |
| **HTTP 客户端** | undici (原生 fetch) | Node.js 内置；性能优于 axios |

---

## 第三部分：各包详细设计

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

### 3.10 `@vitamin/tui` — 终端 UI 框架

> 来源：pi-mono 的自研 pi-tui（差异渲染 + CSI 2026 + 组件化）

#### 3.10.1 设计理念

**不使用 React-like 虚拟 DOM**。采用 pi-mono 验证过的"每帧返回字符串数组"模型：
- 每个组件 `render(width): string[]`
- 框架负责差异比较 + 最小化终端输出
- CSI 2026 同步输出（原子屏幕更新，消除闪烁）

#### 3.10.2 目录结构

```
packages/tui/src/
├── index.ts
├── types.ts                        # Component, Theme, Terminal
├── renderer.ts                     # 差异渲染引擎
├── terminal.ts                     # 终端抽象 (TTY I/O)
├── theme.ts                        # 主题系统（热重载）
│
├── components/                     # 内置组件
│   ├── text.ts                     # 多行文本 + 折行
│   ├── truncated-text.ts           # 单行截断
│   ├── input.ts                    # 单行输入
│   ├── editor.ts                   # 多行编辑器（Tab 补全、粘贴处理）
│   ├── markdown.ts                 # Markdown 渲染（语法高亮）
│   ├── select-list.ts              # 交互式选择列表
│   ├── image.ts                    # 内联图片（Kitty/iTerm2）
│   ├── loader.ts                   # 加载动画
│   ├── box.ts                      # 布局盒子
│   ├── container.ts                # 容器
│   └── spacer.ts                   # 间隔
│
├── overlays/                       # Overlay 系统
│   ├── overlay-manager.ts          # Overlay 管理器
│   └── overlay.ts                  # 基础 Overlay
│
├── input/                          # 输入处理
│   ├── key-parser.ts               # 按键解析
│   ├── ime-handler.ts              # IME 输入法支持（CJK）
│   └── focusable.ts                # 焦点管理
│
└── utils/
    ├── ansi.ts                     # ANSI 颜色/样式
    ├── measure.ts                  # 字符宽度测量（CJK 双宽度）
    └── csi.ts                      # CSI 序列
```

---

### 3.11 `@vitamin/coding-agent` — 主产品 CLI

> 最终产品包，组装所有子包

#### 3.11.1 目录结构

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
│   ├── interactive/                # 交互模式（TUI）
│   │   ├── app.ts                  # TUI 应用
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

#### 3.11.2 启动流程

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
  │     ├── interactive → TUI App
  │     ├── --print → Print Mode
  │     ├── --json → JSON Mode
  │     └── --rpc → RPC Mode
  └── 6. 进入主循环
        ├── 用户输入 → AgentSession.prompt()
        ├── Agent 循环执行
        └── 输出渲染
```

---

### 3.12 `@vitamin/sdk` — 嵌入式 SDK

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

### 3.13 `@vitamin/shared` — 共享工具库

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

## 第四部分：核心流程与数据流

### 4.1 用户输入到 LLM 响应完整流程

```
用户输入 "Fix the login bug in auth.ts"
  │
  ▼
┌─ AgentSession.prompt(text) ─────────────────────────────────────────────┐
│                                                                         │
│  1. Extension 输入拦截                                                   │
│     └── ExtensionRunner.emitInput(text)                                 │
│         ├── Extension 可拦截/转换/取消                                    │
│         └── 斜杠命令检查 (/command → Extension handler)                  │
│                                                                         │
│  2. Skill/Template 展开                                                  │
│     ├── /skill:name → 读取 SKILL.md 注入上下文                           │
│     └── /template → 变量替换                                             │
│                                                                         │
│  3. Steering/FollowUp 检查                                               │
│     └── Agent 正在运行? → 排入 steer/followUp 队列                       │
│                                                                         │
│  4. Hook: chat.message.before                                            │
│     ├── keyword-detection (检测 "plan", "build" 等)                      │
│     ├── first-message-variant (首次消息特殊处理)                          │
│     └── session-recovery (恢复上下文)                                     │
│                                                                         │
│  5. Extension: before_agent_start                                        │
│     └── 可注入额外消息 + 修改系统提示                                      │
│                                                                         │
│  6. Agent.prompt(messages)                                               │
│     └── ↓↓↓                                                             │
└─────────────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─ Agent Loop ────────────────────────────────────────────────────────────┐
│                                                                         │
│  外循环: while(true) — FollowUp 处理                                     │
│  │                                                                       │
│  │  内循环: while(hasToolCalls || pendingMessages) — 工具 + Steering      │
│  │  │                                                                     │
│  │  │  7. Hook: agent.turn.start                                          │
│  │  │                                                                     │
│  │  │  8. transformContext(messages)                                       │
│  │  │     ├── Hook: context.transform (上下文注入)                        │
│  │  │     ├── 增量压缩检查 → 需要时触发压缩                               │
│  │  │     └── Token 预算检查                                              │
│  │  │                                                                     │
│  │  │  9. convertToLlm(agentMessages) → LLM Messages                     │
│  │  │                                                                     │
│  │  │  10. @vitamin/ai stream(model, context)                             │
│  │  │      ├── Provider 适配器 (Anthropic/OpenAI/Google...)               │
│  │  │      ├── Fallback 链 (重试/降级)                                    │
│  │  │      └── StreamEvent 流式输出 → UI 渲染                             │
│  │  │                                                                     │
│  │  │  11. 工具调用?                                                      │
│  │  │      ├── Hook: tool.execute.before (文件守卫, 规则注入)              │
│  │  │      ├── Extension: tool.call (可阻止)                              │
│  │  │      ├── ToolExecutor.execute(toolCall)                             │
│  │  │      ├── Extension: tool.result (可修改)                            │
│  │  │      ├── Hook: tool.execute.after (输出截断, 元数据)                 │
│  │  │      └── 检查 Steering 队列 → 有则中断剩余工具                      │
│  │  │                                                                     │
│  │  │  12. Hook: agent.turn.end                                           │
│  │  │                                                                     │
│  │  └── 检查: stopReason === "end_turn" && 无 Steering?                   │
│  │         ├── YES → 退出内循环                                           │
│  │         └── NO → 继续内循环                                            │
│  │                                                                         │
│  └── 检查 FollowUp 队列                                                   │
│       ├── 有 → 注入 FollowUp 消息，继续外循环                              │
│       └── 无 → 结束                                                       │
│                                                                         │
└─ Agent Loop End ────────────────────────────────────────────────────────┘
  │
  ▼
┌─ 后处理 ────────────────────────────────────────────────────────────────┐
│                                                                         │
│  13. Hook: chat.message.after                                            │
│  14. SessionManager.persist(entries) — 追加写入 JSONL                     │
│  15. Extension: agent.end                                                │
│  16. 费用计算 + 统计更新                                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Plan/Build 模式流程

```
用户: "Refactor the authentication system to use JWT"
  │
  ▼
Sisyphus Intent Gate → 检测到复杂任务
  │
  ▼
task(subagent: "metis", prompt: "Analyze auth refactoring requirements")
  │
  ▼
┌─ Metis 分析 ──────────────────────────────────────┐
│  1. explore agents (背景) → 搜索 auth 相关代码      │
│  2. librarian agents (背景) → 搜索 JWT 最佳实践    │
│  3. 生成复杂度评估 + 上下文摘要                      │
└───────────────────────────────┬────────────────────┘
                                │
                                ▼
task(subagent: "prometheus", prompt: metis_output + user_request)
  │
  ▼
┌─ Prometheus 规划 ─────────────────────────────────┐
│  Phase 1: Interview 需求访谈                       │
│  ├── 自动预研（explore + librarian 并行）          │
│  ├── 向用户提问 → 6 项清关检查                     │
│  └── 记录到 .vitamin/drafts/{name}.md              │
│                                                    │
│  Phase 2: Plan Generation                          │
│  ├── 生成结构化计划                                │
│  ├── 依赖拓扑分析                                  │
│  └── 写入 .vitamin/plans/{name}.md                 │
└───────────────────────────────┬────────────────────┘
                                │
                                ▼
task(subagent: "momus", prompt: plan_file)
  │
  ▼
┌─ Momus 审查 ──────────────────────────────────────┐
│  验证: 可行性 + 完整性 + 风险 + 优化建议            │
│  └── 通过 → 批注计划 / 拒绝 → 反馈给 Prometheus   │
└───────────────────────────────┬────────────────────┘
                                │
                                ▼
/start-work {name} → Atlas 执行
  │
  ▼
┌─ Atlas 并行执行 ──────────────────────────────────┐
│  1. 解析计划步骤 → 构建依赖 DAG                     │
│  2. 拓扑排序 → 确定可并行的步骤组                    │
│  3. 每组步骤:                                       │
│     ├── task(category: "quick") → Haiku 处理简单步骤│
│     ├── task(category: "ui") → Gemini 处理 UI 步骤  │
│     ├── task(category: "deep") → GPT-5.3 深度步骤   │
│     └── 等待依赖完成后启动下一组                     │
│  4. 收集所有步骤结果                                 │
│  5. 生成执行报告                                     │
└────────────────────────────────────────────────────┘
```

### 4.3 多 Agent 编排数据流

```
┌──────────────────────────────────────────────────────────────────┐
│                     统一调度总线 (Task Dispatcher)                 │
│                                                                  │
│     ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐       │
│     │ Category│  │Subagent │  │ Plan/   │  │Background│       │
│     │ Route   │  │ Route   │  │ Build   │  │  Route   │       │
│     └────┬────┘  └────┬────┘  └────┬────┘  └────┬─────┘       │
│          │            │            │            │               │
│     ┌────▼────┐  ┌────▼────┐  ┌────▼────┐  ┌────▼─────┐       │
│     │ Model   │  │ Agent   │  │Pipeline │  │ BG Mgr   │       │
│     │Resolver │  │Registry │  │ Engine  │  │(限流+池) │       │
│     └────┬────┘  └────┬────┘  └────┬────┘  └────┬─────┘       │
│          │            │            │            │               │
│     ┌────▼────────────▼────────────▼────────────▼─────┐         │
│     │              Agent 实例工厂                       │         │
│     │  Agent(model, tools, systemPrompt, hooks)        │         │
│     └──────────────────────┬──────────────────────────┘         │
│                            │                                    │
│     ┌──────────────────────▼──────────────────────────┐         │
│     │             Agent Loop Executor                  │         │
│     │  stream → toolCalls → steering → followUp        │         │
│     └──────────────────────┬──────────────────────────┘         │
│                            │                                    │
│     ┌──────────────────────▼──────────────────────────┐         │
│     │         SessionManager (JSONL Tree)              │         │
│     │  每个 Agent 运行记录持久化到会话树               │         │
│     └─────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────┘
```

### 4.4 Extension 加载与绑定流程

```
vitamin 启动
  │
  ├── ExtensionLoader.discover()
  │   ├── 内置扩展 (packages/coding-agent/src/extensions/)
  │   ├── node_modules/@vitamin/ext-* (npm 发布)
  │   ├── .vitamin/extensions/ (本地扩展)
  │   └── config.extensions.paths[] (配置指定)
  │
  ├── 对每个发现的扩展:
  │   ├── import() 加载模块
  │   ├── 构建 ExtensionAPI 实例
  │   │   ├── 注入: HookEngine 引用
  │   │   ├── 注入: ToolRegistry 引用
  │   │   ├── 注入: AgentSession 引用
  │   │   ├── 注入: ExtensionUIContext (仅 TUI 模式)
  │   │   └── 注入: Config + Logger
  │   └── 调用 extensionFactory(api)
  │       └── 扩展注册事件监听器、工具、命令等
  │
  └── ExtensionRunner 就绪
      ├── 工具注册表已更新（含扩展工具）
      ├── Hook 引擎已更新（含扩展 Hook）
      ├── 命令系统已更新（含扩展命令）
      └── 所有工具已包装（Extension 可拦截）
```

---

## 第五部分：扩展系统设计

### 5.1 扩展开发示例

#### 5.1.1 基础扩展：自定义工具

```typescript
// extensions/my-search/index.ts
import type { ExtensionFactory } from "@vitamin/extension"
import { z } from "zod"

const mySearchExtension: ExtensionFactory = (api) => {
  api.registerTool({
    name: "my_search",
    description: "Search internal documentation",
    parameters: z.object({
      query: z.string().describe("Search query"),
      limit: z.number().default(10),
    }),
    async execute(id, args, signal) {
      const results = await searchInternalDocs(args.query, args.limit, signal)
      return { content: [{ type: "text", text: JSON.stringify(results) }] }
    }
  })
}

export default mySearchExtension
```

#### 5.1.2 高级扩展：Plan Mode（从 oh-my-opencode 移植）

```typescript
// extensions/plan-mode/index.ts
import type { ExtensionFactory } from "@vitamin/extension"

const planModeExtension: ExtensionFactory = (api) => {
  // 注册 /plan 命令
  api.registerCommand("plan", {
    description: "Enter plan mode for complex tasks",
    async handler(args, context) {
      // 1. 调用 Metis 预分析
      const analysis = await api.agent.dispatch({
        subagent: "metis",
        prompt: args.join(" "),
        mode: "sync"
      })

      // 2. 调用 Prometheus 生成计划
      const plan = await api.agent.dispatch({
        subagent: "prometheus",
        prompt: `${analysis.output}\n\nUser request: ${args.join(" ")}`,
        mode: "sync"
      })

      // 3. 调用 Momus 审查
      const review = await api.agent.dispatch({
        subagent: "momus",
        prompt: plan.output,
        mode: "sync"
      })

      // 4. UI 展示计划
      api.ui.notify(`Plan generated: ${plan.output?.split("\n")[0]}`, "info")
    }
  })

  // 注册 /start-work 命令
  api.registerCommand("start-work", {
    description: "Execute a plan",
    async handler(args) {
      // Atlas 并行执行
      // ...
    }
  })

  // 关键词检测
  api.on("input", async (event) => {
    if (event.text.match(/\b(plan|refactor|redesign|architect)\b/i)) {
      api.ui.setStatus("plan-hint", "Tip: Use /plan for complex tasks")
    }
  })
}

export default planModeExtension
```

#### 5.1.3 UI 扩展：自定义状态面板

```typescript
// extensions/cost-tracker/index.ts
import type { ExtensionFactory } from "@vitamin/extension"

const costTrackerExtension: ExtensionFactory = (api) => {
  let totalCost = 0
  let totalTokens = 0

  api.on("agent.turn.end", async (event) => {
    totalCost += event.usage?.cost ?? 0
    totalTokens += event.usage?.totalTokens ?? 0

    api.ui.setStatus("cost", `$${totalCost.toFixed(4)} | ${totalTokens} tokens`)
  })

  api.ui.setWidget("cost-panel", (width) => {
    return [
      `Cost: $${totalCost.toFixed(4)}`,
      `Tokens: ${totalTokens}`,
      `Model: ${api.agent.state.model.name}`
    ]
  })
}

export default costTrackerExtension
```

### 5.2 扩展分发

```
扩展来源（优先级高→低）:
  1. 内置扩展（coding-agent/src/extensions/）
  2. npm 包 (@vitamin/ext-*)
  3. 本地目录 (.vitamin/extensions/)
  4. Git 仓库 (config.extensions.git[])
  5. 配置路径 (config.extensions.paths[])
```

#### package.json 示例

```json
{
  "name": "@vitamin/ext-plan-mode",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "vitamin": {
    "name": "Plan Mode",
    "description": "Plan/Build orchestration for complex tasks",
    "version": ">=0.1.0",
    "capabilities": ["tools", "commands", "hooks"]
  }
}
```

---

## 第六部分：工程基建与开发规范

### 6.1 pnpm workspace 配置

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "extensions/*"
```

```json
// 根 package.json
{
  "name": "vitamin-coding-agent",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.0.0" },
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "test": "vitest",
    "test:ci": "vitest run --reporter=verbose",
    "typecheck": "turbo run typecheck",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "clean": "turbo run clean && rm -rf node_modules",
    "release": "changeset publish"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.0.0",
    "@changesets/cli": "^2.27.0",
    "turbo": "^2.3.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "tsup": "^8.3.0"
  }
}
```

### 6.2 Turborepo 配置

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["tsconfig.base.json"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

### 6.3 子包构建配置（tsup）

```typescript
// packages/ai/tsup.config.ts
import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node22",
  splitting: false,
  treeshake: true,
  external: ["@vitamin/*"],
})
```

### 6.4 TypeScript 基础配置

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2024"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 6.5 测试策略

```typescript
// vitest.workspace.ts
import { defineWorkspace } from "vitest/config"

export default defineWorkspace([
  "packages/*/vitest.config.ts",
  "extensions/*/vitest.config.ts",
])
```

| 类型 | 工具 | 范围 | 注意 |
|------|------|------|------|
| 单元测试 | vitest | 每个包内 co-located `*.test.ts` | given/when/then 嵌套 describe |
| 集成测试 | vitest | `packages/coding-agent/tests/` | 跨包集成 |
| E2E 测试 | 自定义 | `tests/e2e/` | 真实 LLM 调用（CI 中 mock） |
| 性能测试 | vitest bench | `benchmarks/` | Agent 循环吞吐量 |

### 6.6 开发规范

| 规范 | 说明 |
|------|------|
| 文件命名 | kebab-case（`agent-loop.ts`, `model-resolver.ts`） |
| 导出 | 每个包一个 `index.ts` 桶导出 |
| 工厂模式 | 所有系统组件使用 `createXxx()` 工厂函数 |
| 错误处理 | 永远不用空 `catch(e) {}`；自定义错误类型 |
| 类型安全 | 严格模式；禁用 `as any` / `@ts-ignore` / `@ts-expect-error` |
| 注释 | 禁止 AI 生成模式注释；JSDoc 仅用于公共 API |
| 日志 | 所有运行时模块使用 `@vitamin/shared` 的 pino 日志 |
| 代码量 | 单文件 200 LOC 软上限；禁止 catch-all 文件（`utils.ts`） |

### 6.7 CI/CD

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test:ci
      - run: pnpm build
```

---

## 第七部分：实施路线图

### Phase 0: 基础设施（2 周）

```
Week 1:
  ├── 初始化 pnpm monorepo
  ├── 配置 Turborepo + tsup + vitest + Biome
  ├── 创建所有包骨架（package.json + tsconfig.json + src/index.ts）
  └── CI/CD 基础 pipeline

Week 2:
  ├── @vitamin/shared — 日志、FS工具、错误类型、事件发射器
  └── @vitamin/config — Schema 定义、JSONC 加载、多级合并
```

### Phase 1: AI + Agent 核心（3 周）

```
Week 3:
  ├── @vitamin/ai — 类型系统、EventStream、模型注册表
  └── @vitamin/ai — Anthropic + OpenAI 适配器

Week 4:
  ├── @vitamin/ai — Google + Ollama 适配器、fallback 链
  ├── @vitamin/ai — Category→Model 解析、费用计算
  └── @vitamin/agent — 核心类型、Agent 类、Agent 循环

Week 5:
  ├── @vitamin/agent — Steering/FollowUp 队列、工具执行器
  └── @vitamin/tools — 工具注册表 + 基础 4 工具 (read, write, edit, bash)
```

### Phase 2: 编排引擎（3 周）

```
Week 6:
  ├── @vitamin/hooks — Hook 引擎、安全执行、核心 Hook
  └── @vitamin/tools — 扩展工具 (grep, glob, find, ls, ast-grep)

Week 7:
  ├── @vitamin/orchestrator — Agent 注册表、task() 调度器
  ├── @vitamin/orchestrator — Category→Agent 映射
  └── @vitamin/orchestrator — 后台 Agent 管理器

Week 8:
  ├── @vitamin/orchestrator — 内置 Agent (sisyphus, explore, oracle, librarian, hephaestus)
  └── @vitamin/orchestrator — 动态 Prompt 构建器
```

### Phase 3: 会话 + 扩展（2 周）

```
Week 9:
  ├── @vitamin/session — JSONL 树存储、SessionManager
  ├── @vitamin/session — 增量压缩策略
  └── @vitamin/extension — ExtensionAPI、ExtensionRunner

Week 10:
  ├── @vitamin/extension — 工具包装器、扩展加载器
  └── @vitamin/mcp — MCP 客户端、三层 MCP 加载
```

### Phase 4: TUI + CLI（3 周）

```
Week 11:
  ├── @vitamin/tui — 差异渲染引擎、终端抽象
  └── @vitamin/tui — 基础组件 (Text, Editor, Markdown, Input)

Week 12:
  ├── @vitamin/tui — 高级组件 (SelectList, Image, Overlay)
  └── @vitamin/coding-agent — AgentSession、系统提示构建

Week 13:
  ├── @vitamin/coding-agent — 交互模式 TUI 应用
  ├── @vitamin/coding-agent — CLI 命令 (run, doctor, install)
  └── @vitamin/sdk — SDK 接口 + RPC 模式
```

### Phase 5: Plan/Build + 高级功能（2 周）

```
Week 14:
  ├── @vitamin/orchestrator — Prometheus (规划) + Momus (审查) + Atlas (执行)
  ├── @vitamin/orchestrator — Plan/Build 管线
  └── 内置扩展: plan-mode, skill-loader

Week 15:
  ├── 内置扩展: git-master, tmux-manager
  ├── E2E 测试套件
  ├── 文档站点
  └── v0.1.0 发布
```

### 里程碑总结

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M0 | Week 2 | 基础设施就绪，可以开始开发 |
| M1 | Week 5 | 单 Agent 可工作（LLM 对话 + 4 基础工具） |
| **MVP** | **Week 5** | **单 Agent CLI 可用——最小可交付产品** |
| M2 | Week 8 | 多 Agent 编排可工作（task() 委派 + 5 Agent） |
| M3 | Week 10 | Extension 系统可用，Session 树可用 |
| M4 | Week 13 | 完整 CLI 产品可用（TUI + SDK） |
| **GA** | **Week 13** | **多 Agent + Extension 可用——正式发布候选** |
| M5 | Week 15 | Plan/Build + 所有高级功能，v0.1.0 发布 |

### 7.1 工期双轨估算（理想 / 保守）

为避免路线图被误读为“承诺排期”，本提案给出双轨估算：

| 范围 | 理想工期（全职、低返工） | 保守工期（含风险缓冲） | 缓冲系数 |
|------|------------------------|------------------------|----------|
| Part 1-6 核心功能 | 15 周 | 19 周 | +25% |
| 10.2 实时日志 | 2 天 | 3 天 | +50% |
| 10.3 Inspector | 15 天 | 20 天 | +33% |
| 10.4 断点系统 | 16 天 | 21 天 | +31% |
| 10.5 Agent 合成 | 22 天 | 29 天 | +32% |
| 10.6 上行反馈 + 协商 | 31 天 | 40 天 | +29% |
| 全量（含试验特性） | 34 周 | 43 周 | +26% |

风险缓冲规则：

1. 设计性特性（Inspector/断点/协商）默认 +30%
2. 外部依赖特性（Wasm 运行时/浏览器沙箱）默认 +40%
3. 跨包联动变更（涉及 3 个以上包）额外 +10%

执行建议：

- 里程碑承诺使用“保守工期”
- 内部冲刺计划使用“理想工期”
- 每完成一个 Phase 后滚动重估剩余工期

---

## 第八部分：pi-mono 融合详解——原因、目的与实现

> 本章针对每一个从 pi-mono 吸纳的设计点，给出**为什么要融合**、**oh-my-opencode 存在什么问题**、**pi-mono 如何解决**、以及**在 vitamin 中的完整实现代码和流程**。

### 8.1 融合总览：7 个融合点

| # | 融合点 | oh-my-opencode 的痛点 | pi-mono 的优势 | vitamin 怎么做 |
|---|--------|----------------------|----------------|---------------|
| 1 | 分层包设计 | 单体插件，无法独立使用 LLM/Agent 层 | 7 包分层，每层可独立 npm install | 13 包 pnpm monorepo，每层 0 向上依赖 |
| 2 | 极简 Agent 运行时 | Agent 循环耦合在 OpenCode 内部，无法复用 | 5 文件实现完整 Agent 循环 | `@vitamin/agent` 独立包，6 文件 |
| 3 | Steering/FollowUp 消息队列 | 用户无法在 Agent 工作时排队发消息 | 双队列 + 工具间隙中断 | Agent 类原生支持，工具执行粒度中断 |
| 4 | Session 树（分支/导航） | 线性会话，回溯只能重来 | JSONL 树结构 + /tree + /fork | `@vitamin/session` 树存储 + 增量压缩 |
| 5 | Extension UI 控制 | 插件无法修改 UI（纯后端 Hook） | Extension 可替换编辑器、页脚、overlay | 统一 ExtensionAPI + ExtensionUIContext |
| 6 | SDK/RPC 多前端模式 | 只能作为 CLI 插件运行 | SDK + RPC + Print + JSON 4 种模式 | `@vitamin/sdk` 独立包 |
| 7 | 差异渲染 TUI | 依赖 OpenCode 的 Ink (React) TUI | 自研差异渲染 + CSI 2026 | `@vitamin/tui` 独立包 |

---

### 8.2 融合点 1：分层包设计

#### 8.2.1 为什么要融合

**oh-my-opencode 的痛点**：

oh-my-opencode 是 OpenCode 的**插件**。它的所有代码（143k LOC）编译为单个插件包，运行在 OpenCode 进程内：

```typescript
// oh-my-opencode/src/index.ts — 整个系统是一个 Plugin 函数
import type { Plugin } from "@opencode-ai/plugin"

const OhMyOpenCodePlugin: Plugin = async (ctx) => {
  // 所有 143k LOC 的代码通过这个入口加载
  const pluginConfig = loadPluginConfig(ctx.directory, ctx)
  const managers = createManagers({ ctx, pluginConfig, ... })
  const toolsResult = await createTools({ ctx, pluginConfig, managers })
  const hooks = createHooks({ ctx, pluginConfig, ... })
  return createPluginInterface({ ctx, pluginConfig, managers, hooks, tools: toolsResult.filteredTools })
}
```

这意味着：
- 你**不能**只用 oh-my-opencode 的 Agent 编排去驱动一个 Web 应用
- 你**不能**只用它的 LLM 调度层去写一个脚本
- 你**不能**把它嵌入 Electron 或 Slack Bot
- 一切能力被锁在了 `Plugin` 接口的 8 个 handler 里

**pi-mono 如何解决**：

pi-mono 将系统切为 7 个独立 npm 包，每个包可以单独 `npm install`：

```bash
# 只需要 LLM API？
npm install @mariozechner/pi-ai

# 需要 Agent 循环？
npm install @mariozechner/pi-agent-core

# 需要完整编码助手？
npm install @mariozechner/pi-coding-agent
```

他们的 Slack Bot（`mom` 包）就是直接引用 `pi-coding-agent` 核心，套了一个 Slack 前端。

#### 8.2.2 vitamin 的融合实现

```typescript
// ═══════════════════════════════════════════════════════
// 场景 1：只使用 LLM API 层（脚本/工具）
// ═══════════════════════════════════════════════════════

import { stream, getModel, ModelRegistry } from "@vitamin/ai"

// 初始化模型注册表
await ModelRegistry.init()
const model = getModel("anthropic", "claude-opus-4-6")

// 直接调用 LLM
const eventStream = stream(model, {
  systemPrompt: "You are a code reviewer.",
  messages: [{ role: "user", content: "Review this function...", timestamp: Date.now() }],
  tools: [],
})

for await (const event of eventStream) {
  if (event.type === "text_delta") {
    process.stdout.write(event.delta)
  }
}

const result = await eventStream.result()
console.log(`\nTokens: ${result.usage.inputTokens + result.usage.outputTokens}`)

// ═══════════════════════════════════════════════════════
// 场景 2：使用 Agent 循环（自定义 Agent 应用）
// ═══════════════════════════════════════════════════════

import { Agent } from "@vitamin/agent"
import { stream as aiStream } from "@vitamin/ai"
import { createReadTool, createBashTool } from "@vitamin/tools"

const agent = new Agent({
  model: getModel("anthropic", "claude-sonnet-4-6"),
  systemPrompt: "You are a coding assistant.",
  tools: [createReadTool(), createBashTool({ cwd: process.cwd() })],
  streamFunction: aiStream,
})

agent.on((event) => {
  switch (event.type) {
    case "stream_event":
      if (event.event.type === "text_delta") process.stdout.write(event.event.delta)
      break
    case "tool_call_start":
      console.log(`\n[Tool] ${event.toolCall.name}(${JSON.stringify(event.toolCall.arguments)})`)
      break
  }
})

await agent.prompt([{ role: "user", content: "List all TypeScript files in src/", timestamp: Date.now() }])

// ═══════════════════════════════════════════════════════
// 场景 3：使用完整编排引擎（嵌入到 Web 后端）
// ═══════════════════════════════════════════════════════

import { createVitaminAgent } from "@vitamin/sdk"

const vitamin = await createVitaminAgent({
  projectDir: "/path/to/project",
  model: "anthropic/claude-opus-4-6",
  extensions: [],  // 可选加载扩展
})

// 嵌入任何后端
app.post("/api/chat", async (req, res) => {
  const agentStream = vitamin.prompt(req.body.message)
  for await (const event of agentStream) {
    res.write(JSON.stringify(event) + "\n")
  }
  res.end()
})
```

**包依赖关系确保零耦合**：

```
@vitamin/ai      → 0 个 @vitamin/* 依赖（仅 @vitamin/shared）
@vitamin/agent   → 仅依赖 @vitamin/ai
@vitamin/tools   → 仅依赖 @vitamin/agent + @vitamin/ai
@vitamin/sdk     → 组装所有包，但用户只需 import 一个入口
```

每个包的 `package.json` 严格声明依赖，pnpm 的严格模式确保不会出现 phantom dependency。

---

### 8.3 融合点 2：极简 Agent 运行时

#### 8.3.1 为什么要融合

**oh-my-opencode 的痛点**：

oh-my-opencode 不拥有 Agent 循环——它使用 OpenCode 内置的 Agent 运行时。这意味着：

```typescript
// oh-my-opencode 的 Agent 定义只是一个「配置对象」，不是真正的 Agent 类
export type AgentFactory = ((model: string) => AgentConfig) & { mode: AgentMode }

// AgentConfig 只是返回给 OpenCode 的配置
interface AgentConfig {
  systemPrompt: string
  model: string
  tools: ToolPermissions
  maxTokens?: number
  // ... OpenCode 负责实际执行
}
```

oh-my-opencode **无法控制**：
- LLM 调用的重试策略
- 工具执行的中断逻辑
- 消息的转换和裁剪时机
- Agent 循环的终止条件

一切都由 OpenCode 的黑盒 Agent Loop 决定。

**pi-mono 如何解决**：

pi-mono 用仅 5 个文件实现了完整可控的 Agent 循环：

```typescript
// pi-mono/packages/agent/src/agent-loop.ts — 核心 ~200 行
async function runLoop(context, newMessages, config, signal, stream, streamFn) {
  // 外循环：处理 FollowUp 消息
  while (true) {
    // 内循环：处理工具调用 + Steering
    while (hasMoreToolCalls || pendingMessages.length > 0) {
      // 1. 处理 Steering 消息注入
      if (pendingMessages.length > 0) {
        messages.push(...pendingMessages)
        pendingMessages = []
      }

      // 2. 调用 LLM
      const transformed = await config.transformContext?.(messages, signal) ?? messages
      const llmMessages = await config.convertToLlm(transformed)
      const assistantMsg = await streamAssistantResponse(llmMessages, config, signal, streamFn)

      // 3. 执行工具
      if (assistantMsg.toolCalls?.length) {
        const { toolResults, steeringMessages } = await executeToolCalls(
          assistantMsg.toolCalls, tools, config, signal
        )
        // 工具间隙检查 Steering
        if (steeringMessages.length > 0) pendingMessages.push(...steeringMessages)
      }
    }

    // 外循环：检查 FollowUp
    const followUps = await config.getFollowUpMessages?.()
    if (!followUps?.length) break
    messages.push(...followUps)
  }
}
```

#### 8.3.2 vitamin 的融合实现

vitamin 采用 pi-mono 的 Agent Loop 架构，但扩展了多 Agent 感知能力：

```typescript
// packages/agent/src/agent-loop.ts

import type { AgentMessage, AgentLoopConfig, AgentEvent, AgentTool } from "./types"
import type { StreamEvent, AssistantMessage } from "@vitamin/ai"
import { ToolExecutor } from "./tool-executor"

/**
 * Agent 核心循环
 *
 * 来自 pi-mono 的双层循环架构：
 * - 外循环处理 FollowUp（Agent 完成后用户排队的新消息）
 * - 内循环处理工具调用 + Steering（Agent 工作中用户的中断消息）
 *
 * vitamin 扩展：
 * - 每个 turn 发射细粒度事件（供 Hook/Extension 拦截）
 * - 工具执行支持 Hook 守卫（tool.execute.before / after）
 * - 上下文压缩集成（transformContext 可调用增量压缩器）
 * - 多 Agent 隔离（每个 Agent 实例有独立的消息历史和状态）
 */
export async function agentLoop(
  initialMessages: AgentMessage[],
  config: AgentLoopConfig,
  tools: AgentTool[],
  signal: AbortSignal,
  emit: (event: AgentEvent) => void
): Promise<void> {
  const executor = new ToolExecutor(tools)
  const messages: AgentMessage[] = [...initialMessages]
  let turnIndex = 0

  // ╔══════════════════════════════════════════════════╗
  // ║  外循环：FollowUp 处理（pi-mono 架构）           ║
  // ╚══════════════════════════════════════════════════╝
  while (!signal.aborted) {
    let hasMoreWork = true
    let pendingMessages: AgentMessage[] = []

    // ╔══════════════════════════════════════════════════╗
    // ║  内循环：工具调用 + Steering（pi-mono 架构）     ║
    // ╚══════════════════════════════════════════════════╝
    while (hasMoreWork && !signal.aborted) {
      // ── Step 1: 注入 Steering 消息 ──
      if (pendingMessages.length > 0) {
        emit({ type: "steering_injected", messages: pendingMessages })
        messages.push(...pendingMessages)
        pendingMessages = []
      }

      // ── Step 2: turn 开始（vitamin 扩展：事件） ──
      emit({ type: "turn_start", turnIndex })

      // ── Step 3: 上下文转换（pi-mono 的 transformContext 钩子）──
      // vitamin 扩展：这里可以触发增量压缩
      const contextMessages = config.transformContext
        ? await config.transformContext(messages, signal)
        : messages

      // ── Step 4: 消息格式转换（pi-mono 的 convertToLlm）──
      // 关键设计：应用层可以有自定义消息类型（如 PlanMessage、CompactionSummary），
      // 只在发给 LLM 时转换为标准 Message[]
      const llmMessages = await config.convertToLlm(contextMessages)

      // ── Step 5: 调用 LLM（流式输出）──
      const assistantMessage = await streamAssistantResponse(
        config.model,
        {
          systemPrompt: config.systemPrompt,
          messages: llmMessages,
          tools: executor.getToolDefinitions(),
          thinkingLevel: config.thinkingLevel,
        },
        config,
        signal,
        emit
      )

      messages.push(assistantMessage)

      // ── Step 6: 工具执行（带 Steering 中断检查）──
      const toolCalls = extractToolCalls(assistantMessage)
      if (toolCalls.length > 0) {
        const { results, interrupted } = await executeToolCallsWithSteering(
          toolCalls,
          executor,
          config,
          signal,
          emit
        )
        messages.push(...results)

        // 检查 Steering 队列（pi-mono 的工具间隙中断设计）
        if (interrupted) {
          const steering = await config.getSteeringMessages?.()
          if (steering?.length) pendingMessages.push(...steering)
        }
      }

      // ── Step 7: turn 结束 ──
      emit({ type: "turn_end", turnIndex, message: assistantMessage })
      turnIndex++

      // 判断是否需要继续内循环
      hasMoreWork = toolCalls.length > 0 || pendingMessages.length > 0
    }

    // ── 外循环：检查 FollowUp 队列 ──
    const followUps = await config.getFollowUpMessages?.()
    if (!followUps?.length) break

    emit({ type: "follow_up_start", messages: followUps })
    messages.push(...followUps)
  }
}

/**
 * 带 Steering 中断的工具执行
 *
 * pi-mono 的精巧设计：在每个工具执行后检查 Steering 队列。
 * 如果用户在 Agent 执行多个工具时发了新消息，剩余工具被跳过，
 * 用户消息立即注入上下文。
 *
 * vitamin 扩展：增加了 Hook 守卫（tool.execute.before / after），
 * 允许 Extension 在工具执行前后拦截或修改。
 */
async function executeToolCallsWithSteering(
  toolCalls: ToolCall[],
  executor: ToolExecutor,
  config: AgentLoopConfig,
  signal: AbortSignal,
  emit: (event: AgentEvent) => void
): Promise<{ results: AgentMessage[]; interrupted: boolean }> {
  const results: AgentMessage[] = []
  let interrupted = false

  for (const toolCall of toolCalls) {
    if (signal.aborted) break

    // vitamin 扩展：工具前置 Hook
    emit({ type: "tool_call_start", toolCall })

    // 检查 Steering 队列（pi-mono 的核心中断设计）
    const steeringMessages = await config.getSteeringMessages?.()
    if (steeringMessages?.length) {
      // 跳过剩余工具，标记为 "Skipped due to queued user message"
      results.push(createSkippedToolResult(toolCall, "Skipped due to queued user message"))
      interrupted = true
      continue
    }

    // 执行工具
    try {
      const result = await executor.execute(toolCall, signal)
      results.push(createToolResultMessage(toolCall.id, result))
      emit({ type: "tool_call_end", toolCall, result })
    } catch (error) {
      results.push(createToolResultMessage(toolCall.id, { content: [{ type: "text", text: String(error) }], isError: true }))
      emit({ type: "error", error: error as Error })
    }
  }

  return { results, interrupted }
}
```

**对比 oh-my-opencode**：oh-my-opencode 的所有 Agent 只能返回配置对象给 OpenCode，实际执行完全黑盒。vitamin 拥有整个 Agent Loop，每一步都可以被 Hook/Extension 拦截。

---

### 8.4 融合点 3：Steering/FollowUp 消息队列

#### 8.4.1 为什么要融合

**oh-my-opencode 的痛点**：

oh-my-opencode 寄生在 OpenCode 上，OpenCode 的 Agent 使用简单的「请求-响应」模型。当 Agent 正在执行长时间工具（如 `bash` 运行测试套件、或 `explore` 搜索大代码库），用户**无法**：
- 中途修正方向（"等等，不要改那个文件"）
- 补充信息（"顺便说一下，数据库密码在 .env 里"）
- 排队下一个请求（"完成后帮我也看看 auth 模块"）

用户只能等待 Agent 完全结束才能输入，这在复杂任务中非常影响效率。

**pi-mono 如何解决**：

pi-mono 的 Agent 类有两个消息队列：

```typescript
// pi-mono/packages/agent/src/agent.ts
class Agent {
  private steeringQueue: AgentMessage[] = []   // 中断队列
  private followUpQueue: AgentMessage[] = []   // 排队队列

  // 用户在 Agent 工作时发消息 → 进入 Steering 队列
  // Agent 在下一个工具间隙检查队列，如果有消息就中断
  steer(message: AgentMessage): void {
    this.steeringQueue.push(message)
  }

  // 用户排队「下一个」请求 → 进入 FollowUp 队列
  // Agent 完成当前对话后自动续接
  followUp(message: AgentMessage): void {
    this.followUpQueue.push(message)
  }
}
```

#### 8.4.2 vitamin 的融合实现

```typescript
// packages/agent/src/agent.ts

import type { Model, StreamContext } from "@vitamin/ai"
import type {
  AgentMessage, AgentState, AgentStatus, AgentConfig,
  AgentEvent, AgentLoopConfig
} from "./types"
import { agentLoop } from "./agent-loop"

export class Agent {
  private state: AgentState
  private listeners = new Set<(event: AgentEvent) => void>()
  private abortController: AbortController | null = null

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 来自 pi-mono 的双队列设计
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  private steeringQueue: AgentMessage[] = []
  private followUpQueue: AgentMessage[] = []

  /**
   * Steering 队列模式：
   * - "all": 一次性注入所有排队消息
   * - "one-at-a-time": 每次只注入一条，其余保留
   */
  steeringMode: "all" | "one-at-a-time" = "all"
  followUpMode: "all" | "one-at-a-time" = "one-at-a-time"

  constructor(config: AgentConfig) {
    this.state = this.createInitialState(config)
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 核心 API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 发送 prompt 启动 Agent 循环
   */
  async prompt(messages: AgentMessage[]): Promise<void> {
    this.setStatus("streaming")
    this.abortController = new AbortController()

    const loopConfig: AgentLoopConfig = {
      model: this.state.model,
      systemPrompt: this.state.systemPrompt,
      convertToLlm: this.config.convertToLlm ?? defaultConvertToLlm,
      transformContext: this.config.transformContext,
      thinkingLevel: this.state.thinkingLevel,

      // ━━━ pi-mono 的队列桥接 ━━━
      getSteeringMessages: async () => {
        if (this.steeringQueue.length === 0) return []
        if (this.steeringMode === "all") {
          const msgs = [...this.steeringQueue]
          this.steeringQueue = []
          return msgs
        }
        // one-at-a-time: 只取第一条
        return [this.steeringQueue.shift()!]
      },

      getFollowUpMessages: async () => {
        if (this.followUpQueue.length === 0) return []
        if (this.followUpMode === "all") {
          const msgs = [...this.followUpQueue]
          this.followUpQueue = []
          return msgs
        }
        return [this.followUpQueue.shift()!]
      },

      getApiKey: this.config.getApiKey,
    }

    try {
      await agentLoop(
        [...this.state.messages, ...messages],
        loopConfig,
        this.state.tools,
        this.abortController.signal,
        (event) => this.emit(event)
      )
      this.setStatus("completed")
    } catch (error) {
      if (this.abortController.signal.aborted) {
        this.setStatus("aborted")
      } else {
        this.state.error = error as Error
        this.setStatus("error")
      }
    }
  }

  /**
   * 中断当前工具执行，注入用户消息
   *
   * 用户场景：Agent 正在执行 bash 命令，用户突然说
   * "等等，先别跑测试，先看看 config 文件"
   * → steer() 将消息放入队列
   * → Agent 在下一个工具间隙检测到 → 跳过剩余工具
   * → 用户消息注入上下文 → LLM 重新规划
   */
  steer(message: AgentMessage): void {
    this.steeringQueue.push(message)
  }

  /**
   * 排队下一个请求（Agent 完成后自动继续）
   *
   * 用户场景：Agent 正在修 bug，用户想说
   * "修完后帮我也写个测试"
   * → followUp() 将消息放入队列
   * → Agent 完成当前对话 → 检测到 FollowUp → 自动继续
   */
  followUp(message: AgentMessage): void {
    this.followUpQueue.push(message)
  }

  /**
   * 取消当前操作
   */
  abort(): void {
    this.abortController?.abort()
    this.emit({ type: "abort" })
  }

  /**
   * 从当前上下文继续（重试/恢复）
   */
  async continue(): Promise<void> {
    await this.prompt([])
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 事件系统
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  on(listener: (event: AgentEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: AgentEvent): void {
    for (const listener of this.listeners) {
      try { listener(event) } catch { /* 单个 listener 失败不影响其他 */ }
    }
  }

  private setStatus(status: AgentStatus): void {
    const from = this.state.status
    this.state.status = status
    this.emit({ type: "status_change", from, to: status })
  }

  /** 只读状态快照 */
  get snapshot(): Readonly<AgentState> {
    return { ...this.state }
  }
}
```

**实际使用场景演示**：

```typescript
// 交互模式中的 Steering/FollowUp

import { Agent } from "@vitamin/agent"

const agent = new Agent({ model, systemPrompt, tools, streamFunction })

// 用户发送初始请求
await agent.prompt([{ role: "user", content: "Refactor the auth module", timestamp: Date.now() }])
// → Agent 开始工作：读取文件 → 分析 → 编辑...

// ═══ 30 秒后，Agent 还在执行 bash 命令 ═══

// 用户突然想补充信息（Steering）
agent.steer({
  role: "user",
  content: "Important: don't change the JWT secret format, other services depend on it",
  timestamp: Date.now()
})
// → Agent 在下一个工具间隙收到这条消息
// → 跳过剩余工具
// → LLM 看到用户的补充信息后重新规划

// 用户还想排队一个后续任务（FollowUp）
agent.followUp({
  role: "user",
  content: "After refactoring, please also write unit tests for the new auth module",
  timestamp: Date.now()
})
// → Agent 完成 auth 重构后
// → 自动检测到 FollowUp 队列
// → 无缝继续执行测试编写任务
```

---

### 8.5 融合点 4：Session 树（分支/导航）

#### 8.5.1 为什么要融合

**oh-my-opencode 的痛点**：

oh-my-opencode 依赖 OpenCode 的会话管理，会话是**线性**的：

```
消息 1 → 消息 2 → 消息 3 → 消息 4 → 消息 5 (当前)
```

问题场景：
- 你在消息 3 时让 Agent 开始重构，到消息 5 发现方向错了
- 你想「回到消息 3 重新来」，但**无法**——只能开新会话、重新描述需求
- 之前的探索和上下文全部丢失

**pi-mono 如何解决**：

pi-mono 的会话是**树结构**，存储为 JSONL：

```
消息 1 → 消息 2 → 消息 3 ─┬─ 消息 4a → 消息 5a (分支 A: 尝试方案一)
                           └─ 消息 4b → 消息 5b (分支 B: 尝试方案二，从消息 3 fork)
```

用户可以：
- `/tree` — 可视化查看整棵对话树
- `/fork` — 从任意节点创建分支
- 导航到任意历史节点继续对话
- 所有分支共存在单个 JSONL 文件中

#### 8.5.2 vitamin 的融合实现

```typescript
// packages/session/src/types.ts

/**
 * Session Entry — JSONL 中的每一行
 *
 * 来自 pi-mono 的树结构设计：每个 entry 有 parentId，
 * 形成一棵树。分支就是在同一个 parentId 下的多个子节点。
 */
export interface SessionEntry {
  /** 唯一 ID（UUID v7，时间有序） */
  id: string
  /** 父节点 ID（null = 根节点） */
  parentId: string | null
  /** 条目类型 */
  type: "message" | "system" | "compaction" | "branch_point"
  /** 内容 */
  content: AgentMessage | SystemEvent | CompactionRecord
  /** 时间戳 */
  timestamp: number
  /** 扩展元数据 */
  metadata?: Record<string, unknown>
}

/**
 * Session Tree Node — 内存中的树表示
 */
export interface SessionNode {
  entry: SessionEntry
  children: SessionNode[]
}

export interface SessionInfo {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  messageCount: number
  branchCount: number
  labels: string[]
}
```

```typescript
// packages/session/src/session-manager.ts

import type { SessionEntry, SessionNode, SessionInfo } from "./types"
import { JsonlStorage } from "./storage/jsonl-storage"
import { buildTree, getPathToRoot, getLeafNodes } from "./session-tree"

export class SessionManager {
  private storage: JsonlStorage
  private currentSessionId: string | null = null
  /** 当前活跃的叶节点 ID（即对话的"光标"位置） */
  private currentEntryId: string | null = null

  constructor(private sessionsDir: string) {
    this.storage = new JsonlStorage(sessionsDir)
  }

  /**
   * 创建新会话
   */
  async create(name?: string): Promise<SessionInfo> {
    const sessionId = generateSessionId()
    const sessionName = name ?? `session-${new Date().toISOString().slice(0, 10)}`
    await this.storage.createSession(sessionId, sessionName)
    this.currentSessionId = sessionId
    this.currentEntryId = null
    return this.getInfo(sessionId)
  }

  /**
   * 追加消息到当前会话
   * parentId 自动设为 currentEntryId（链式追加）
   */
  async append(content: AgentMessage, type: SessionEntry["type"] = "message"): Promise<SessionEntry> {
    const entry: SessionEntry = {
      id: generateEntryId(),
      parentId: this.currentEntryId,
      type,
      content,
      timestamp: Date.now(),
    }
    await this.storage.appendEntry(this.currentSessionId!, entry)
    this.currentEntryId = entry.id  // 移动"光标"
    return entry
  }

  /**
   * 从指定节点创建分支（pi-mono 的 /fork 功能）
   *
   * 使用场景：用户说 "回到刚才那个方案A的位置重新来"
   * → fromEntryId 指向方案 A 之前的那个节点
   * → 后续消息成为新分支
   *
   * 关键：不创建新文件！同一个 JSONL 文件，不同 parentId 就是不同分支。
   */
  async fork(fromEntryId?: string): Promise<void> {
    const targetId = fromEntryId ?? this.currentEntryId
    if (!targetId) throw new Error("No entry to fork from")

    // 只需要把 currentEntryId 移回去
    // 后续的 append() 自动以这个节点为父，形成新分支
    this.currentEntryId = targetId

    // 记录分支点元数据
    await this.storage.appendEntry(this.currentSessionId!, {
      id: generateEntryId(),
      parentId: targetId,
      type: "branch_point",
      content: { type: "fork", fromEntryId: targetId, timestamp: Date.now() },
      timestamp: Date.now(),
    })
  }

  /**
   * 获取完整的会话树（pi-mono 的 /tree 功能）
   */
  async getTree(): Promise<SessionNode> {
    const entries = await this.storage.readAllEntries(this.currentSessionId!)
    return buildTree(entries)
  }

  /**
   * 导航到树中某个节点
   * 后续 append 将在这个节点下继续
   */
  navigateTo(entryId: string): void {
    this.currentEntryId = entryId
  }

  /**
   * 获取当前对话路径（从根到当前光标的线性消息列表）
   */
  async getCurrentPath(): Promise<SessionEntry[]> {
    if (!this.currentEntryId) return []
    const entries = await this.storage.readAllEntries(this.currentSessionId!)
    return getPathToRoot(entries, this.currentEntryId).reverse()
  }

  /**
   * 列出所有分支的叶节点（用于 /tree 可视化）
   */
  async getLeaves(): Promise<SessionEntry[]> {
    const entries = await this.storage.readAllEntries(this.currentSessionId!)
    return getLeafNodes(entries)
  }

  /**
   * vitamin 独创：增量压缩集成
   * 压缩不删除原始消息，而是在树中插入 compaction 节点
   */
  async compact(compactionResult: CompactionRecord): Promise<void> {
    await this.storage.appendEntry(this.currentSessionId!, {
      id: generateEntryId(),
      parentId: this.currentEntryId,
      type: "compaction",
      content: compactionResult,
      timestamp: Date.now(),
    })
  }
}
```

```typescript
// packages/session/src/session-tree.ts — 树操作工具函数

import type { SessionEntry, SessionNode } from "./types"

/**
 * 从 JSONL entries 构建内存树
 *
 * JSONL 文件格式示例:
 *   {"id":"e1","parentId":null,"type":"message","content":{"role":"user",...}}
 *   {"id":"e2","parentId":"e1","type":"message","content":{"role":"assistant",...}}
 *   {"id":"e3","parentId":"e2","type":"message","content":{"role":"user",...}}
 *   {"id":"e4","parentId":"e2","type":"message","content":{"role":"user",...}}
 *                                  ↑ e3 和 e4 都是 e2 的子节点 = 分支
 */
export function buildTree(entries: SessionEntry[]): SessionNode {
  const nodeMap = new Map<string, SessionNode>()
  let root: SessionNode | null = null

  for (const entry of entries) {
    nodeMap.set(entry.id, { entry, children: [] })
  }

  for (const entry of entries) {
    const node = nodeMap.get(entry.id)!
    if (entry.parentId === null) {
      root = node
    } else {
      const parent = nodeMap.get(entry.parentId)
      parent?.children.push(node)
    }
  }

  return root ?? { entry: { id: "root", parentId: null, type: "system", content: {}, timestamp: 0 }, children: [] }
}

/**
 * 获取从某节点到根的路径
 * 用于恢复对话上下文（只返回当前分支的消息，不包括其他分支）
 */
export function getPathToRoot(entries: SessionEntry[], leafId: string): SessionEntry[] {
  const entryMap = new Map(entries.map(e => [e.id, e]))
  const path: SessionEntry[] = []
  let current = entryMap.get(leafId)

  while (current) {
    path.push(current)
    current = current.parentId ? entryMap.get(current.parentId) : undefined
  }

  return path  // 从叶到根
}

/**
 * 获取所有叶节点（没有子节点的节点）
 * 用于 /tree 命令展示所有分支的「末端」
 */
export function getLeafNodes(entries: SessionEntry[]): SessionEntry[] {
  const hasChildren = new Set<string>()
  for (const entry of entries) {
    if (entry.parentId) hasChildren.add(entry.parentId)
  }
  return entries.filter(e => !hasChildren.has(e.id))
}
```

**与 oh-my-opencode 的对比**：

```
oh-my-opencode（线性）:   msg1 → msg2 → msg3 → msg4 → msg5
                          如果 msg4 方向错了，只能新建会话

vitamin（树结构）:        msg1 → msg2 → msg3 ─┬─ msg4a → msg5a  ← 分支 A
                                              └─ msg4b → msg5b  ← 分支 B（/fork from msg3）
                                              └─ [compaction]   ← 增量压缩节点
                          任何时候可以回到 msg3 重新探索
```

---

### 8.6 融合点 5：Extension UI 控制

#### 8.6.1 为什么要融合

**oh-my-opencode 的痛点**：

oh-my-opencode 有强大的 Hook 系统（46 个 Hook），但**所有 Hook 都是纯数据流操作**：

```typescript
// oh-my-opencode 的 Hook 只能操作数据，不能操作 UI
"chat.message": (input, output) => { /* 修改消息内容 */ }
"tool.execute.before": (input, output) => { /* 修改工具参数 */ }
"experimental.chat.messages.transform": (input, output) => { /* 注入上下文 */ }
```

oh-my-opencode **不能**：
- 在终端显示自定义面板（如费用追踪、任务进度）
- 替换编辑器组件（如实现 Vim 模式）
- 弹出选择对话框让用户选择
- 自定义消息渲染方式
- 修改页眉、页脚、状态栏

因为 oh-my-opencode 是 OpenCode 的插件，UI 完全由 OpenCode 控制。

**pi-mono 如何解决**：

pi-mono 的 Extension 系统提供了 `ExtensionUIContext`，可以控制 UI 的**每一个部分**：

```typescript
// pi-mono Extension 可以：
pi.ui.setFooter((width) => ["[F1] Help  [F2] Settings  [F3] Cost: $0.42"])
pi.ui.setHeader((width) => ["Plan Mode - Step 3/7"])
pi.ui.setEditorComponent(myVimEditor)  // 替换整个编辑器！
pi.ui.custom(myDashboard, { overlay: true })  // 自定义 overlay
pi.ui.setStatus("cost", "$0.42 | 15k tokens")
pi.ui.setTheme(myCustomTheme)  // 运行时换肤
```

#### 8.6.2 vitamin 的融合实现

vitamin 将 oh-my-opencode 的 Hook 和 pi-mono 的 Extension 统一为 `ExtensionAPI`：

```typescript
// packages/extension/src/api-builder.ts

import type { ExtensionAPI, ExtensionFactory, ExtensionUIContext } from "./types"
import type { HookEngine, HookTiming } from "@vitamin/hooks"
import type { ToolRegistry } from "@vitamin/tools"
import type { Agent } from "@vitamin/agent"

/**
 * 为每个 Extension 构建独立的 API 实例
 *
 * 设计理念：统一 oh-my-opencode 的 Hook + pi-mono 的 Extension
 *
 * oh-my-opencode 贡献了：46 种 Hook 时机（数据流拦截）
 * pi-mono 贡献了：UI 控制 + 工具/命令/Provider 注册
 * vitamin 统一为：一个 ExtensionAPI
 */
export function buildExtensionAPI(deps: {
  hookEngine: HookEngine
  toolRegistry: ToolRegistry
  agentRef: { current: Agent | null }
  uiContext: ExtensionUIContext | null  // TUI 模式下可用，SDK 模式下为 null
  commandRegistry: CommandRegistry
  providerRegistry: ProviderRegistry
  eventBus: EventBus
  config: VitaminConfig
  logger: Logger
  extensionName: string
}): ExtensionAPI {
  const {
    hookEngine, toolRegistry, agentRef, uiContext,
    commandRegistry, providerRegistry, eventBus, config, logger, extensionName
  } = deps

  return {
    // ═══════════════════════════════════════════════════════
    // 事件订阅 — 统一入口
    // 来源：oh-my-opencode 的 46 Hook + pi-mono 的 26 Extension 事件
    // 实现：代理到 HookEngine.register()
    // ═══════════════════════════════════════════════════════
    on(event: string, handler: Function): void {
      // 将 Extension 事件映射为 Hook 注册
      const hookTiming = mapEventToHookTiming(event)
      hookEngine.register({
        name: `${extensionName}:${event}`,
        timing: hookTiming,
        priority: 100,  // Extension Hook 优先级低于内置 Hook
        disableable: true,
        handler: (...args: unknown[]) => handler(...args),
      })
    },

    // ═══════════════════════════════════════════════════════
    // 工具注册 — 来自 pi-mono
    // oh-my-opencode 的工具是内置的，不支持 Extension 添加
    // ═══════════════════════════════════════════════════════
    registerTool(tool) {
      toolRegistry.registerExternal(tool.name, {
        ...tool,
        async execute(id, args, signal, onUpdate) {
          // 执行前/后自动触发 Hook（oh-my-opencode 的 tool.execute.before/after）
          await hookEngine.execute("tool.execute.before", { tool: tool.name, args }, {})
          const result = await tool.execute(id, args, signal, onUpdate)
          await hookEngine.execute("tool.execute.after", { tool: tool.name, result }, {})
          return result
        },
      }, extensionName)
    },

    // ═══════════════════════════════════════════════════════
    // 命令注册 — 来自 pi-mono
    // oh-my-opencode 不支持自定义斜杠命令
    // ═══════════════════════════════════════════════════════
    registerCommand(name, options) {
      commandRegistry.register(`/${name}`, {
        ...options,
        source: extensionName,
      })
    },

    // ═══════════════════════════════════════════════════════
    // Provider 注册 — 来自 pi-mono
    // oh-my-opencode 不支持 Extension 注册新的 LLM 提供商
    // ═══════════════════════════════════════════════════════
    registerProvider(name, providerConfig) {
      providerRegistry.register(name, providerConfig)
    },

    // ═══════════════════════════════════════════════════════
    // Hook 注册 — 来自 oh-my-opencode（低级 API）
    // pi-mono 没有 Hook 概念，所有拦截通过 Extension 事件
    // vitamin 保留 Hook 作为底层机制
    // ═══════════════════════════════════════════════════════
    registerHook(registration) {
      hookEngine.register({
        ...registration,
        name: `${extensionName}:${registration.name}`,
      })
    },

    // ═══════════════════════════════════════════════════════
    // UI 控制 — 来自 pi-mono 的 ExtensionUIContext
    // oh-my-opencode 完全不支持
    // ═══════════════════════════════════════════════════════
    ui: uiContext ?? createNoopUIContext(),  // SDK 模式下为 noop

    // ═══════════════════════════════════════════════════════
    // Agent 操作 — vitamin 独创
    // 结合 pi-mono 的 steer/followUp + oh-my-opencode 的 task 调度
    // ═══════════════════════════════════════════════════════
    agent: {
      get state() { return agentRef.current?.snapshot ?? null },
      steer(message) { agentRef.current?.steer(message) },
      followUp(message) { agentRef.current?.followUp(message) },
      abort() { agentRef.current?.abort() },
    },

    // ═══════════════════════════════════════════════════════
    // 其他能力
    // ═══════════════════════════════════════════════════════
    events: eventBus,
    config: {
      get: (path) => getConfigValue(config, path),
      getProjectDir: () => config.projectDir,
    },
    log: logger.child({ extension: extensionName }),

    registerShortcut(key, options) {
      commandRegistry.registerShortcut(key, { ...options, source: extensionName })
    },

    registerFlag(name, options) {
      commandRegistry.registerFlag(name, { ...options, source: extensionName })
    },

    registerMessageRenderer(type, renderer) {
      uiContext?.registerMessageRenderer?.(type, renderer)
    },

    sendMessage(message, options) {
      agentRef.current?.steer(message)
    },

    setActiveTools(toolNames) {
      toolRegistry.setActiveTools(toolNames)
    },

    setModel(model) {
      agentRef.current?.update({ model: resolveModel(model) })
    },

    setThinkingLevel(level) {
      agentRef.current?.update({ thinkingLevel: level })
    },

    async exec(command, args, options) {
      return executeCommand(command, args, options)
    },
  }
}

/**
 * 事件名映射为 Hook 时机
 * 统一 pi-mono 事件名和 oh-my-opencode Hook 名
 */
function mapEventToHookTiming(event: string): HookTiming {
  const mapping: Record<string, HookTiming> = {
    // pi-mono 事件 → vitamin Hook
    "session.start": "session.created",
    "session.end": "session.deleted",
    "agent.start": "agent.start",
    "agent.end": "agent.end",
    "turn.start": "agent.turn.start",
    "turn.end": "agent.turn.end",
    "tool.call": "tool.execute.before",
    "tool.result": "tool.execute.after",
    "context.transform": "chat.messages.transform",
    "system.transform": "chat.system.transform",
    "input": "chat.message.before",
    "model.select": "config.changed",
    // oh-my-opencode Hook 直接透传
    "chat.message.before": "chat.message.before",
    "chat.message.after": "chat.message.after",
    "chat.params": "chat.params",
    "tool.execute.before": "tool.execute.before",
    "tool.execute.after": "tool.execute.after",
    "session.compacting": "session.compacting",
  }
  return mapping[event] ?? (event as HookTiming)
}
```

**完整 Extension 示例：Plan Mode（oh-my-opencode 功能 + pi-mono 扩展形式）**

```typescript
// extensions/plan-mode/src/index.ts
//
// 这个 Extension 展示了融合的最终效果：
// - 使用 oh-my-opencode 的 Plan/Build 编排逻辑
// - 通过 pi-mono 的 Extension API 暴露
// - 拥有 pi-mono 的 UI 控制能力

import type { ExtensionFactory } from "@vitamin/extension"

const planModeExtension: ExtensionFactory = (api) => {
  let currentPlan: Plan | null = null
  let currentStep = 0

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 命令注册（来自 pi-mono）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  api.registerCommand("plan", {
    description: "Start plan mode for complex tasks (from oh-my-opencode)",
    args: [{ name: "task", description: "Task description", required: true }],
    async handler({ args }) {
      const taskDescription = args.join(" ")

      // ── Step 1: Metis 预分析（oh-my-opencode 编排）──
      api.ui.setStatus("plan", "Phase 1/3: Analyzing...")
      api.ui.setHeader((width) => [
        centerText("Plan Mode - Analyzing requirements", width)
      ])

      api.sendMessage({
        role: "user",
        content: `[PLAN MODE] Analyze this task for planning:\n\n${taskDescription}`,
        timestamp: Date.now(),
      })
    },
  })

  api.registerCommand("start-work", {
    description: "Execute a plan (Atlas parallel execution)",
    args: [{ name: "plan", description: "Plan name", required: true }],
    async handler({ args }) {
      const planName = args[0]
      const planContent = await readPlanFile(api, planName)
      if (!planContent) {
        api.ui.notify(`Plan not found: ${planName}`, "error")
        return
      }

      currentPlan = parsePlan(planContent)
      currentStep = 0

      // ── UI：显示计划进度面板（pi-mono UI 控制）──
      api.ui.setWidget("plan-progress", (width) => {
        if (!currentPlan) return []
        return [
          `Plan: ${currentPlan.name}`,
          `Progress: ${currentStep}/${currentPlan.steps.length}`,
          ...currentPlan.steps.map((step, i) => {
            const status = i < currentStep ? "done" : i === currentStep ? "running" : "pending"
            const icon = status === "done" ? "[x]" : status === "running" ? "[>]" : "[ ]"
            return `  ${icon} ${step.description}`
          }),
        ]
      })

      // ── 执行：给 Agent 发消息开始执行 ──
      api.sendMessage({
        role: "user",
        content: `Execute this plan step by step:\n\n${planContent}`,
        timestamp: Date.now(),
      })
    },
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Hook：工具执行后更新进度（来自 oh-my-opencode）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  api.on("tool.execute.after", async (event) => {
    if (!currentPlan) return

    // 检测当前步骤是否完成（基于工具执行结果分析）
    if (isStepCompleted(currentPlan.steps[currentStep], event)) {
      currentStep++
      api.ui.setStatus("plan", `Step ${currentStep}/${currentPlan.steps.length}`)

      if (currentStep >= currentPlan.steps.length) {
        api.ui.notify("Plan completed!", "info")
        api.ui.setWidget("plan-progress", () => [])  // 清除进度面板
        currentPlan = null
      }
    }
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 快捷键（来自 pi-mono）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  api.registerShortcut("ctrl+p", {
    description: "Quick plan from selection",
    async handler() {
      const text = api.ui.getEditorText()
      if (text) {
        // 弹出确认对话框（pi-mono UI 控制）
        const confirmed = await api.ui.confirm(
          "Start Plan Mode?",
          `Create a plan for: "${text.slice(0, 100)}..."?`
        )
        if (confirmed) {
          api.ui.setEditorText("")  // 清空编辑器
          // 触发 /plan 命令
          api.sendMessage({
            role: "user",
            content: `[PLAN MODE] ${text}`,
            timestamp: Date.now(),
          })
        }
      }
    },
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 上下文注入（来自 oh-my-opencode 的 context transform）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  api.on("context.transform", async (event) => {
    if (currentPlan) {
      // 在每轮 LLM 调用时注入当前计划进度
      event.additionalContext.push({
        role: "user",
        content: `[PLAN CONTEXT] Current step: ${currentStep + 1}/${currentPlan.steps.length}\n` +
          `Step: ${currentPlan.steps[currentStep]?.description ?? "All done"}\n` +
          `Remaining: ${currentPlan.steps.slice(currentStep + 1).map(s => s.description).join(", ")}`,
        timestamp: Date.now(),
      })
    }
  })
}

export default planModeExtension
```

这个 Extension 展示了**为什么两者必须融合**：
- **oh-my-opencode 的 Hook** 提供了工具执行后的数据拦截（检测步骤完成）
- **oh-my-opencode 的 context transform** 提供了上下文注入（注入计划进度）
- **pi-mono 的 registerCommand** 提供了 /plan 和 /start-work 命令
- **pi-mono 的 UI 控制** 提供了进度面板、通知、确认对话框
- **pi-mono 的 registerShortcut** 提供了 Ctrl+P 快捷键

任何单独一方都无法实现这个完整功能。

---

### 8.7 融合点 6：SDK/RPC 多前端模式

#### 8.7.1 为什么要融合

**oh-my-opencode 的痛点**：

oh-my-opencode 只能作为 OpenCode 的 CLI 插件运行。如果你想：
- 在 Web 应用中嵌入 AI 编码能力 → **不行**
- 在 CI/CD 管道中自动化使用 → **不行**（必须安装 OpenCode）
- 在 Electron 应用中集成 → **不行**
- 在 VS Code 扩展中使用编排引擎 → **不行**

**pi-mono 如何解决**：

pi-mono 提供 4 种运行模式：

```bash
pi                    # 交互模式 (TUI)
pi -p "fix the bug"   # 打印模式 (stdout 输出)
pi --json ...         # JSON 模式 (机器可读)
pi --rpc              # RPC 模式 (进程间通信)
```

还有 SDK：
```typescript
import { createSession } from "@mariozechner/pi-coding-agent/sdk"
const session = await createSession({ projectDir: "." })
const result = await session.prompt("Fix the login bug")
```

#### 8.7.2 vitamin 的融合实现

```typescript
// packages/sdk/src/index.ts

import { AgentSession } from "@vitamin/coding-agent/core"
import { VitaminConfig, loadConfig } from "@vitamin/config"
import { ModelRegistry, stream as aiStream } from "@vitamin/ai"
import { AgentRegistry } from "@vitamin/orchestrator"
import { ToolRegistry } from "@vitamin/tools"
import { HookEngine } from "@vitamin/hooks"
import { SessionManager } from "@vitamin/session"
import { ExtensionRunner } from "@vitamin/extension"

export interface VitaminAgentOptions {
  /** 项目目录 */
  projectDir: string
  /** 模型覆盖 */
  model?: string
  /** 配置覆盖 */
  config?: Partial<VitaminConfig>
  /** 额外扩展 */
  extensions?: ExtensionFactory[]
  /** 运行模式 */
  mode?: "full" | "minimal"
}

/**
 * 创建 vitamin Agent 实例
 *
 * 4 种使用场景：
 * 1. CLI 交互模式：由 @vitamin/coding-agent 调用
 * 2. 脚本/CI：
 *    const agent = await createVitaminAgent({ projectDir: "./" })
 *    const result = await agent.prompt("fix the bug").result()
 * 3. Web 后端：
 *    app.post("/chat", (req, res) => {
 *      const stream = agent.prompt(req.body.message)
 *      for await (const event of stream) res.write(event)
 *    })
 * 4. Electron / VS Code：
 *    同场景 2，在渲染进程或扩展 host 进程中运行
 */
export async function createVitaminAgent(options: VitaminAgentOptions): Promise<VitaminAgent> {
  const { projectDir, model, config: configOverride, extensions: extraExtensions, mode } = options

  // ── 1. 加载配置（6 层优先级）──
  const config = loadConfig(projectDir, configOverride)

  // ── 2. 初始化子系统 ──
  await ModelRegistry.init()
  const hookEngine = new HookEngine()
  const toolRegistry = new ToolRegistry(config.tool_preset ?? "standard")
  const agentRegistry = new AgentRegistry(config)
  const sessionManager = new SessionManager(`${projectDir}/.vitamin/sessions`)

  // ── 3. 加载扩展 ──
  const extensionRunner = new ExtensionRunner({
    hookEngine,
    toolRegistry,
    agentRegistry,
    config,
    uiContext: null,  // SDK 模式无 UI
  })
  await extensionRunner.loadBuiltinExtensions()
  if (extraExtensions) {
    for (const ext of extraExtensions) {
      await extensionRunner.loadExtension(ext, "sdk-user")
    }
  }

  // ── 4. 创建 AgentSession ──
  const session = new AgentSession({
    config,
    modelOverride: model,
    hookEngine,
    toolRegistry,
    agentRegistry,
    sessionManager,
    extensionRunner,
    streamFunction: aiStream,
  })

  // ── 5. 返回 SDK 接口 ──
  return {
    prompt(text, promptOptions) {
      return session.prompt(text, promptOptions)
    },

    continue() {
      return session.continue()
    },

    steer(message) {
      session.agent.steer({
        role: "user",
        content: message,
        timestamp: Date.now(),
      })
    },

    abort() {
      session.agent.abort()
    },

    get state() {
      return session.agent.snapshot
    },

    on(event, handler) {
      return session.on(event, handler)
    },

    async dispose() {
      await extensionRunner.dispose()
      await sessionManager.close()
    },
  }
}
```

**对比表**：

| 使用场景 | oh-my-opencode | vitamin |
|----------|----------------|---------|
| CLI 交互 | 通过 OpenCode 插件 | `vitamin` CLI 命令 |
| 脚本自动化 | 不支持 | `createVitaminAgent()` |
| Web 后端 | 不支持 | SDK + EventStream |
| CI/CD | 不支持 | `vitamin --json` 模式 |
| Electron | 不支持 | SDK 嵌入 |
| RPC | 不支持 | `vitamin --rpc` + JSON-RPC |
| Slack Bot | 不支持 | SDK 嵌入（参考 pi-mono 的 mom 包） |

---

### 8.8 融合点 7：差异渲染 TUI

#### 8.8.1 为什么要融合

**oh-my-opencode 的痛点**：

oh-my-opencode 使用 OpenCode 的 TUI（基于 Go 的 BubbleTea → 后来的 Ink-like 自建方案）。作为插件，oh-my-opencode **无法**：
- 优化渲染性能（全量 re-render 在大输出时闪烁）
- 添加内联图片支持
- 支持 CJK IME 精确定位
- 自定义 overlay 系统

**pi-mono 如何解决**：

pi-mono 自研了 `pi-tui`，核心设计极其精巧：

```typescript
// pi-tui 的组件模型简到极致：
interface Component {
  render(width: number): string[]  // 返回每一行的字符串
}

// 框架负责：
// 1. 对比上一帧和这一帧的 string[]
// 2. 只向终端输出变化的行
// 3. 用 CSI 2026 包裹确保原子更新（消除闪烁）
```

#### 8.8.2 vitamin 的融合实现

```typescript
// packages/tui/src/renderer.ts

/**
 * 差异渲染引擎
 *
 * 来自 pi-mono 的核心 TUI 设计：
 * - 每个组件返回 string[] (每行一个字符串)
 * - 框架对比前后两帧，只更新变化的行
 * - CSI 2026 (\x1b[?2026h) 包裹确保原子更新
 *
 * 3 种渲染策略：
 * 1. 首次渲染：全量输出
 * 2. 宽度变化：全量输出（终端 resize）
 * 3. 正常更新：差异输出（只更新变化的行）
 */
export class DiffRenderer {
  private previousFrame: string[] = []
  private width: number = 0
  private height: number = 0

  constructor(
    private terminal: Terminal,
    private rootComponent: Component
  ) {}

  /**
   * 渲染一帧
   */
  render(): void {
    const currentWidth = this.terminal.columns
    const currentHeight = this.terminal.rows
    const widthChanged = currentWidth !== this.width
    this.width = currentWidth
    this.height = currentHeight

    // 组件返回新的一帧
    const newFrame = this.rootComponent.render(this.width)

    if (this.previousFrame.length === 0 || widthChanged) {
      // 策略 1 & 2：全量渲染
      this.fullRender(newFrame)
    } else {
      // 策略 3：差异渲染
      this.diffRender(this.previousFrame, newFrame)
    }

    this.previousFrame = newFrame
  }

  /**
   * 差异渲染 — 只更新变化的行
   */
  private diffRender(oldFrame: string[], newFrame: string[]): void {
    const output: string[] = []

    // ── CSI 2026 Begin Synchronized Update ──
    // 终端会缓冲所有后续输出，直到 End 标记
    // 然后一次性刷新，消除闪烁
    output.push("\x1b[?2026h")

    const maxLines = Math.max(oldFrame.length, newFrame.length)

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldFrame[i] ?? ""
      const newLine = newFrame[i] ?? ""

      if (oldLine !== newLine) {
        // 移动到第 i 行，清除该行，写入新内容
        output.push(`\x1b[${i + 1};1H`)   // 移动光标
        output.push("\x1b[2K")             // 清除整行
        output.push(newLine)
      }
    }

    // 如果新帧比旧帧短，清除多余的行
    if (newFrame.length < oldFrame.length) {
      for (let i = newFrame.length; i < oldFrame.length; i++) {
        output.push(`\x1b[${i + 1};1H\x1b[2K`)
      }
    }

    // ── CSI 2026 End Synchronized Update ──
    output.push("\x1b[?2026l")

    this.terminal.write(output.join(""))
  }

  private fullRender(frame: string[]): void {
    const output = ["\x1b[?2026h", "\x1b[2J", "\x1b[H"]  // 同步开始 + 清屏 + 光标归位
    output.push(frame.join("\n"))
    output.push("\x1b[?2026l")
    this.terminal.write(output.join(""))
  }
}

/**
 * 组件接口 — 来自 pi-mono 的极简设计
 *
 * 对比 React/Ink 的虚拟 DOM：
 * - Ink: JSX → VDOM → reconcile → diff → terminal output
 * - vitamin/tui: render(width) → string[] → diff → terminal output
 *
 * 更简单、更快、Extension 更容易实现自定义组件
 */
export interface Component {
  /**
   * 渲染组件，返回每行的字符串
   *
   * @param width 可用宽度（终端列数）
   * @returns 每一行的文本（可包含 ANSI 颜色码）
   */
  render(width: number): string[]
}
```

**为什么不直接用 Ink (React for CLI)**：

| 维度 | Ink (React) | vitamin/tui (pi-mono 方案) |
|------|-------------|---------------------------|
| 渲染 | 全量 reconcile | 行级 diff |
| 开销 | React reconciler + VDOM | 0 依赖，纯字符串比较 |
| 闪烁 | 大输出时明显 | CSI 2026 原子更新，无闪烁 |
| Extension UI | 需要用 React 写组件 | `render(width): string[]` |
| 图片 | 不支持 | Kitty/iTerm2 内联图片 |
| IME | 不支持 | CJK 输入法精确定位 |
| 组件复杂度 | JSX + hooks + state | 纯函数 → string[] |

---

### 8.9 融合效果总结：端到端流程演示

下面演示一个完整场景，展示 7 个融合点如何协同工作：

```
用户：vitamin "Refactor the auth module to use JWT"

┌─── 融合点 1（分层包设计）─────────────────────────────────────┐
│ @vitamin/coding-agent 启动                                    │
│   ├── @vitamin/config 加载 .vitamin/config.jsonc              │
│   ├── @vitamin/ai ModelRegistry.init()                        │
│   ├── @vitamin/tools ToolRegistry.init("standard")            │
│   ├── @vitamin/hooks HookEngine.init()                        │
│   ├── @vitamin/orchestrator AgentRegistry.init()              │
│   ├── @vitamin/session SessionManager.init()                  │
│   ├── @vitamin/extension ExtensionRunner.init()               │
│   └── @vitamin/tui 启动交互界面                               │
└───────────────────────────────────────────────────────────────┘
         │
         ▼
┌─── 融合点 7（差异渲染 TUI）──────────────────────────────────┐
│ TUI 渲染首帧（CSI 2026 原子更新）                             │
│ ┌────────────────────────────────────────────────────┐        │
│ │ vitamin v0.1.0 | claude-opus-4-6 | $0.00           │ header │
│ │────────────────────────────────────────────────────│        │
│ │ > Refactor the auth module to use JWT              │        │
│ │                                                    │        │
│ │ [Agent thinking...]                                │        │
│ │────────────────────────────────────────────────────│        │
│ │ [Enter] Send  [Ctrl+P] Plan  [Ctrl+C] Cancel      │ footer │
│ └────────────────────────────────────────────────────┘        │
└───────────────────────────────────────────────────────────────┘
         │
         ▼
┌─── 融合点 2（极简 Agent 运行时）─────────────────────────────┐
│ Sisyphus (主编排器) Intent Gate:                              │
│   → 检测到 "refactor" → 复杂任务 → 委派给 Metis 预分析      │
│                                                               │
│ Agent Loop (pi-mono 双层循环):                                │
│   1. transformContext() → 注入项目上下文                      │
│   2. convertToLlm() → 自定义消息 → LLM 格式                  │
│   3. stream(claude-opus-4-6, context) → 流式输出              │
│   4. 工具调用: task(subagent: "metis", ...)                   │
└───────────────────────────────────────────────────────────────┘
         │
         ▼  [30 秒后，Agent 正在执行 explore 搜索代码库]
┌─── 融合点 3（Steering/FollowUp 队列）───────────────────────┐
│ 用户输入: "Don't change the token format, other deps need it" │
│   → agent.steer(message) → 进入 Steering 队列                │
│   → Agent 在 explore 工具完成后检查队列                       │
│   → 发现 Steering 消息 → 跳过后续工具                        │
│   → 注入用户补充信息 → LLM 重新规划                          │
│                                                               │
│ 用户输入: "After this, also add rate limiting"                │
│   → agent.followUp(message) → 进入 FollowUp 队列             │
│   → Auth 重构完成后自动续接 rate limiting 任务                │
└───────────────────────────────────────────────────────────────┘
         │
         ▼
┌─── 融合点 5（Extension UI 控制）─────────────────────────────┐
│ plan-mode Extension 被触发:                                   │
│                                                               │
│ TUI 更新（差异渲染，只更新变化的行）:                         │
│ ┌────────────────────────────────────────────────────┐        │
│ │ vitamin | Plan Mode - Analyzing | $0.15            │ header │
│ │────────────────────────────────────────────────────│        │
│ │ Plan: auth-jwt-refactor                            │ widget │
│ │ Progress: 2/5                                      │        │
│ │   [x] Analyze current auth module                  │        │
│ │   [x] Design JWT token structure                   │        │
│ │   [>] Implement token generation                   │        │
│ │   [ ] Update middleware                            │        │
│ │   [ ] Add tests                                    │        │
│ │────────────────────────────────────────────────────│        │
│ │ Implementing token generation...                   │ output │
│ │ Reading src/auth/token.ts...                       │        │
│ │────────────────────────────────────────────────────│        │
│ │ [Enter] Send  [Ctrl+C] Cancel  [/tree] Branches   │ footer │
│ └────────────────────────────────────────────────────┘        │
└───────────────────────────────────────────────────────────────┘
         │
         ▼
┌─── 融合点 4（Session 树）────────────────────────────────────┐
│ 用户发现 Step 3 方向不对，想换方案:                           │
│                                                               │
│ > /fork                                                       │
│   → SessionManager.fork("entry-id-step-2-completed")          │
│   → 从 Step 2 完成点创建新分支                                │
│   → 原分支 A 保留，新分支 B 开始探索                          │
│                                                               │
│ > /tree                                                       │
│   → 显示:                                                     │
│     root → msg1 → msg2 → step1 → step2 ─┬─ step3a (分支 A)  │
│                                           └─ [当前] (分支 B)   │
│                                                               │
│ JSONL 文件内容（单文件包含所有分支）：                         │
│ {"id":"e1","parentId":null,...}                                │
│ {"id":"e2","parentId":"e1",...}                                │
│ {"id":"e3","parentId":"e2",...}   ← step 1                    │
│ {"id":"e4","parentId":"e3",...}   ← step 2                    │
│ {"id":"e5","parentId":"e4",...}   ← step 3 (分支 A)           │
│ {"id":"e6","parentId":"e4",...}   ← 分支 B 起点 (fork)        │
└───────────────────────────────────────────────────────────────┘
         │
         ▼
┌─── 融合点 6（SDK 多前端支持）────────────────────────────────┐
│ 同样的编排逻辑，可以在其他前端运行:                            │
│                                                               │
│ // Web 后端                                                   │
│ import { createVitaminAgent } from "@vitamin/sdk"             │
│ app.post("/chat", async (req, res) => {                       │
│   const stream = vitamin.prompt(req.body.message)             │
│   for await (const event of stream) {                         │
│     res.write(JSON.stringify(event) + "\n")                   │
│   }                                                           │
│ })                                                            │
│                                                               │
│ // CI/CD                                                      │
│ $ vitamin --json -p "Fix lint errors" | jq '.result'          │
│                                                               │
│ // Slack Bot                                                  │
│ slackBot.onMessage(async (msg) => {                           │
│   const result = await vitamin.prompt(msg.text).result()      │
│   await slackBot.reply(msg, result.text)                      │
│ })                                                            │
└───────────────────────────────────────────────────────────────┘
```

### 8.10 融合决策总表

| 融合点 | 从 pi-mono 取什么 | 解决 oh-my-opencode 什么问题 | vitamin 额外增强 |
|--------|-------------------|-----------------------------|-----------------| 
| 分层包设计 | 7 包 monorepo 架构 | 143k LOC 单体插件无法复用 | 13 包，更细粒度拆分 |
| Agent 运行时 | 5 文件 Agent Loop | Agent 循环是 OpenCode 黑盒 | 增加 Hook 集成点 + 多 Agent 感知 |
| Steering/FollowUp | 双队列 + 工具间隙中断 | 用户无法中途补充信息 | 队列模式可配置 (all / one-at-a-time) |
| Session 树 | JSONL 树 + /tree + /fork | 线性会话无法回溯分支 | 增量压缩节点 + SQLite 可选 |
| Extension UI | ExtensionUIContext 全套 | 插件无法操作 UI | 与 Hook 统一为单一 ExtensionAPI |
| SDK/RPC | 4 种运行模式 + SDK | 只能作为 CLI 插件 | 与 oh-my-opencode 编排引擎深度集成 |
| 差异渲染 TUI | 行级 diff + CSI 2026 | 依赖 OpenCode 的 TUI，无法定制 | 组件模型更简单，Extension 更易写 |

---

## 第九部分：云端部署——数据持久化与缓存

> 本章讨论 vitamin-coding-agent 部署到**云端服务器**时，如何处理对话数据持久化、日志收集与缓存策略。弹性伸缩暂不纳入本阶段设计范围。

### 9.1 部署架构总览

#### 9.1.1 从单机到云端的核心矛盾

vitamin 的单机模式下，一切很简单：

```
单机模式:
  SessionManager → JSONL 文件 → 本地磁盘
  Agent Loop     → 单进程执行
  日志           → pino → /tmp/vitamin.log
  配置           → .vitamin/config.jsonc
```

但在云端服务器（多用户、多实例），问题立刻出现：

| 问题 | 单机 | 云端 |
|------|------|------|
| 对话数据 | JSONL 文件在本地磁盘 | 容器销毁后数据丢失 |
| 日志 | 写到 `/tmp/` | 容器销毁后日志丢失 |
| 配置 | 本地文件 | 服务端配置如何管理？ |
| 工具沙箱 | 信任本地环境 | 多用户共享时如何隔离？ |

#### 9.1.2 云端部署架构（单实例）

```
                      ┌──────────────────┐
                      │   API Gateway    │
                      │   (HTTP/WebSocket)│
                      └────────┬─────────┘
                               │
                      ┌────────▼─────────┐
                      │  vitamin Server  │
                      │                  │
                      │  Agent Loop      │
                      │  Extension       │
                      │  Hook Engine     │
                      └──┬──────┬──────┬─┘
                         │      │      │
              ┌──────────▼──┐ ┌─▼──────▼──────┐
              │    Redis    │ │  PostgreSQL   │
              │             │ │               │
              │ - 会话缓存  │ │ - Session     │
              │ - Agent状态 │ │   持久化      │
              │             │ │ - 用户数据    │
              └──────┬──────┘ │ - 审计日志    │
                     │        └───────┬───────┘
              ┌──────▼────────────────▼───────┐
              │       日志基础设施              │
              │ Server → stdout (JSON)         │
              │        → Loki / Elasticsearch   │
              │ Grafana / Kibana 查询面板       │
              └────────────────────────────────┘
```

**关键设计决策**：vitamin 的云端架构基于**存储抽象层**——同一套 `SessionManager` / `Logger` / `ConfigLoader` 接口，通过 Storage Backend 切换实现本地/云端双模式，**不修改任何业务代码**。当前阶段聚焦单实例部署下的数据持久化与缓存，后续如需多实例扩容可在此基础上叠加分布式锁和负载均衡。

---

### 9.2 Storage Backend 抽象层

#### 9.2.1 为什么需要存储抽象

当前 `@vitamin/session` 的 `SessionManager` 直接依赖 `JsonlStorage`：

```typescript
// 当前设计 — 紧耦合本地文件
import { JsonlStorage } from "./storage/jsonl-storage"

export class SessionManager {
  private storage: JsonlStorage  // ← 直接绑定 JSONL
  constructor(sessionsDir: string) {
    this.storage = new JsonlStorage(sessionsDir)
  }
}
```

云端需要替换为 PostgreSQL / Redis，但 `SessionManager` 的业务逻辑（树构建、分支、导航、压缩）不应该改动。

#### 9.2.2 Storage Interface 设计

```typescript
// packages/session/src/storage/storage-interface.ts

/**
 * 会话存储抽象接口
 *
 * 所有持久化操作通过此接口，具体实现可以是：
 * - JsonlStorage: 本地 JSONL 文件（单机默认）
 * - SqliteStorage: 本地 SQLite（大型会话）
 * - PostgresStorage: PostgreSQL（云端多实例）
 * - RedisStorage: Redis（纯缓存层，需要搭配持久化后端）
 */
export interface SessionStorage {
  // ── 会话 CRUD ──
  createSession(sessionId: string, name: string, metadata?: Record<string, unknown>): Promise<void>
  deleteSession(sessionId: string): Promise<void>
  listSessions(filter?: SessionFilter): Promise<SessionInfo[]>
  getSessionInfo(sessionId: string): Promise<SessionInfo | null>

  // ── 条目操作 ──
  appendEntry(sessionId: string, entry: SessionEntry): Promise<void>
  appendEntries(sessionId: string, entries: SessionEntry[]): Promise<void>
  readAllEntries(sessionId: string): Promise<SessionEntry[]>

  // ── 查询 ──
  getEntry(sessionId: string, entryId: string): Promise<SessionEntry | null>
  getChildren(sessionId: string, parentId: string): Promise<SessionEntry[]>
  getPathToRoot(sessionId: string, entryId: string): Promise<SessionEntry[]>
  getLeafEntries(sessionId: string): Promise<SessionEntry[]>

  // ── 压缩 ──
  appendCompaction(sessionId: string, compaction: CompactionRecord): Promise<void>
  getLatestCompaction(sessionId: string): Promise<CompactionRecord | null>

  // ── 元数据 ──
  updateSessionMetadata(sessionId: string, metadata: Record<string, unknown>): Promise<void>

  // ── 生命周期 ──
  close(): Promise<void>
  healthCheck(): Promise<boolean>
}

export interface SessionFilter {
  userId?: string
  labels?: string[]
  createdAfter?: number
  createdBefore?: number
  limit?: number
  offset?: number
}
```

#### 9.2.3 改造后的 SessionManager

```typescript
// packages/session/src/session-manager.ts（云端改造）

import type { SessionStorage } from "./storage/storage-interface"
import type { SessionEntry, SessionNode, SessionInfo } from "./types"
import { buildTree, getPathToRoot, getLeafNodes } from "./session-tree"

export class SessionManager {
  private currentSessionId: string | null = null
  private currentEntryId: string | null = null

  /**
   * 通过构造函数注入存储后端
   * 
   * 单机: new SessionManager(new JsonlStorage(dir))
   * 云端: new SessionManager(new PostgresStorage(pool))
   * 测试: new SessionManager(new InMemoryStorage())
   */
  constructor(private storage: SessionStorage) {}

  async create(name?: string): Promise<SessionInfo> {
    const sessionId = generateSessionId()
    const sessionName = name ?? `session-${new Date().toISOString().slice(0, 10)}`
    await this.storage.createSession(sessionId, sessionName)
    this.currentSessionId = sessionId
    this.currentEntryId = null
    return this.storage.getSessionInfo(sessionId) as Promise<SessionInfo>
  }

  async append(content: AgentMessage, type: SessionEntry["type"] = "message"): Promise<SessionEntry> {
    const entry: SessionEntry = {
      id: generateEntryId(),
      parentId: this.currentEntryId,
      type,
      content,
      timestamp: Date.now(),
    }
    await this.storage.appendEntry(this.currentSessionId!, entry)
    this.currentEntryId = entry.id
    return entry
  }

  async getCurrentPath(): Promise<SessionEntry[]> {
    if (!this.currentEntryId) return []
    // 存储后端可以优化为 SQL 递归 CTE 查询，而不是加载全量再遍历
    return this.storage.getPathToRoot(this.currentSessionId!, this.currentEntryId)
  }

  async fork(fromEntryId?: string): Promise<void> {
    const targetId = fromEntryId ?? this.currentEntryId
    if (!targetId) throw new Error("No entry to fork from")
    this.currentEntryId = targetId
    await this.storage.appendEntry(this.currentSessionId!, {
      id: generateEntryId(),
      parentId: targetId,
      type: "branch_point",
      content: { type: "fork", fromEntryId: targetId, timestamp: Date.now() },
      timestamp: Date.now(),
    })
  }

  async getTree(): Promise<SessionNode> {
    const entries = await this.storage.readAllEntries(this.currentSessionId!)
    return buildTree(entries)
  }

  // ... 其他方法不变，全部通过 this.storage 调用
}
```

**零业务代码修改**：`SessionManager` 的所有方法（`fork`、`getTree`、`navigateTo`、`compact`）不做任何改动，只是底层 `storage` 从 JSONL 换成了 PostgreSQL。

---

### 9.3 PostgreSQL 存储实现

#### 9.3.1 数据库 Schema

```sql
-- 会话表
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  labels      TEXT[] DEFAULT '{}',
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  message_count INT DEFAULT 0,
  branch_count  INT DEFAULT 0
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_updated ON sessions(updated_at DESC);

-- 会话条目表（树结构的核心）
CREATE TABLE session_entries (
  id          TEXT NOT NULL,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  parent_id   TEXT,  -- NULL = 根节点
  type        TEXT NOT NULL CHECK (type IN ('message', 'system', 'compaction', 'branch_point')),
  content     JSONB NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, id)
);

-- 树查询关键索引
CREATE INDEX idx_entries_parent ON session_entries(session_id, parent_id);
CREATE INDEX idx_entries_type ON session_entries(session_id, type);

-- 压缩记录表
CREATE TABLE compaction_records (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  summary     TEXT NOT NULL,
  compressed_entry_ids TEXT[] NOT NULL,
  token_count INT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_compaction_session ON compaction_records(session_id, created_at DESC);

-- 审计日志表
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL,
  session_id  TEXT,
  action      TEXT NOT NULL,  -- 'tool_execute', 'file_write', 'bash_command', etc.
  detail      JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_session ON audit_logs(session_id, created_at DESC);
```

#### 9.3.2 PostgresStorage 实现

```typescript
// packages/session/src/storage/postgres-storage.ts

import type { Pool } from "pg"
import type { SessionStorage, SessionFilter, SessionEntry, SessionInfo, CompactionRecord } from "./storage-interface"

export class PostgresStorage implements SessionStorage {
  constructor(private pool: Pool) {}

  async createSession(sessionId: string, name: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.pool.query(
      `INSERT INTO sessions (id, user_id, name, metadata) VALUES ($1, $2, $3, $4)`,
      [sessionId, metadata?.userId ?? "default", name, JSON.stringify(metadata ?? {})]
    )
  }

  async appendEntry(sessionId: string, entry: SessionEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO session_entries (id, session_id, parent_id, type, content, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [entry.id, sessionId, entry.parentId, entry.type, JSON.stringify(entry.content), JSON.stringify(entry.metadata ?? {})]
    )
    // 更新会话统计
    await this.pool.query(
      `UPDATE sessions SET updated_at = NOW(), message_count = message_count + 1 WHERE id = $1`,
      [sessionId]
    )
  }

  async appendEntries(sessionId: string, entries: SessionEntry[]): Promise<void> {
    // 批量插入优化
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      for (const entry of entries) {
        await client.query(
          `INSERT INTO session_entries (id, session_id, parent_id, type, content, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [entry.id, sessionId, entry.parentId, entry.type, JSON.stringify(entry.content), JSON.stringify(entry.metadata ?? {})]
        )
      }
      await client.query(
        `UPDATE sessions SET updated_at = NOW(), message_count = message_count + $1 WHERE id = $2`,
        [entries.length, sessionId]
      )
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * 树路径查询 — 使用 PostgreSQL 递归 CTE
   * 
   * 这是云端存储的核心优势：
   * - JSONL: 必须加载全量数据到内存，然后遍历
   * - PostgreSQL: 数据库端递归查询，只返回路径上的条目
   * 
   * 对于有 10000+ 条目的大型会话，性能差异巨大。
   */
  async getPathToRoot(sessionId: string, entryId: string): Promise<SessionEntry[]> {
    const result = await this.pool.query(
      `WITH RECURSIVE path AS (
        SELECT id, parent_id, type, content, metadata, created_at
        FROM session_entries
        WHERE session_id = $1 AND id = $2

        UNION ALL

        SELECT e.id, e.parent_id, e.type, e.content, e.metadata, e.created_at
        FROM session_entries e
        JOIN path p ON e.id = p.parent_id AND e.session_id = $1
      )
      SELECT * FROM path ORDER BY created_at ASC`,
      [sessionId, entryId]
    )
    return result.rows.map(this.rowToEntry)
  }

  async getLeafEntries(sessionId: string): Promise<SessionEntry[]> {
    const result = await this.pool.query(
      `SELECT e.*
       FROM session_entries e
       LEFT JOIN session_entries child ON child.parent_id = e.id AND child.session_id = e.session_id
       WHERE e.session_id = $1 AND child.id IS NULL`,
      [sessionId]
    )
    return result.rows.map(this.rowToEntry)
  }

  async getChildren(sessionId: string, parentId: string): Promise<SessionEntry[]> {
    const result = await this.pool.query(
      `SELECT * FROM session_entries WHERE session_id = $1 AND parent_id = $2 ORDER BY created_at ASC`,
      [sessionId, parentId]
    )
    return result.rows.map(this.rowToEntry)
  }

  async readAllEntries(sessionId: string): Promise<SessionEntry[]> {
    const result = await this.pool.query(
      `SELECT * FROM session_entries WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    )
    return result.rows.map(this.rowToEntry)
  }

  async listSessions(filter?: SessionFilter): Promise<SessionInfo[]> {
    const conditions: string[] = ["1=1"]
    const params: unknown[] = []
    let paramIndex = 1

    if (filter?.userId) {
      conditions.push(`user_id = $${paramIndex++}`)
      params.push(filter.userId)
    }
    if (filter?.labels?.length) {
      conditions.push(`labels && $${paramIndex++}`)
      params.push(filter.labels)
    }
    if (filter?.createdAfter) {
      conditions.push(`created_at >= to_timestamp($${paramIndex++})`) 
      params.push(filter.createdAfter / 1000)
    }

    const limit = filter?.limit ?? 50
    const offset = filter?.offset ?? 0

    const result = await this.pool.query(
      `SELECT * FROM sessions WHERE ${conditions.join(" AND ")}
       ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    )
    return result.rows.map(this.rowToSessionInfo)
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1")
      return true
    } catch {
      return false
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  private rowToEntry(row: any): SessionEntry {
    return {
      id: row.id,
      parentId: row.parent_id,
      type: row.type,
      content: row.content,
      timestamp: new Date(row.created_at).getTime(),
      metadata: row.metadata,
    }
  }

  private rowToSessionInfo(row: any): SessionInfo {
    return {
      id: row.id,
      name: row.name,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      messageCount: row.message_count,
      branchCount: row.branch_count,
      labels: row.labels,
    }
  }
}
```

---

### 9.4 Redis 缓存层

#### 9.4.1 缓存策略

PostgreSQL 负责持久化，Redis 负责**热数据缓存和实时状态**：

```
读取路径:
  SessionManager.getCurrentPath()
    → Redis 缓存命中？ → 返回
    → 缓存未命中 → PostgreSQL 查询 → 写入 Redis → 返回

写入路径:
  SessionManager.append()
    → PostgreSQL 写入（持久化）
    → Redis 缓存失效 + 更新（一致性）
    → Redis Pub/Sub 通知其他实例（多实例同步）
```

| Redis Key | 用途 | TTL | 失效策略 |
|-----------|------|-----|----------|
| `session:{id}:path:{entryId}` | 当前路径缓存 | 10min | 写时失效 |
| `session:{id}:tree` | 完整树缓存 | 5min | 写时失效 |
| `session:{id}:info` | 会话元数据 | 30min | 写时更新 |
| `agent:{instanceId}:state` | Agent 运行时状态 | 自动过期 | 心跳续期 |
| `lock:session:{id}` | 分布式写锁 | 30s | 自动释放 |
| `user:{id}:sessions` | 用户会话列表 | 5min | 写时失效 |

#### 9.4.2 CachedStorage 缓存包装器

```typescript
// packages/session/src/storage/cached-storage.ts

import type { SessionStorage, SessionEntry, SessionInfo, SessionFilter } from "./storage-interface"
import type { Redis } from "ioredis"

/**
 * 缓存包装器 — 装饰器模式
 * 
 * 包装任何 SessionStorage 实现，添加 Redis 缓存层。
 * 使用场景：new CachedStorage(new PostgresStorage(pool), redis)
 */
export class CachedStorage implements SessionStorage {
  constructor(
    private backend: SessionStorage,
    private redis: Redis,
    private config: CacheConfig = DEFAULT_CACHE_CONFIG
  ) {}

  async appendEntry(sessionId: string, entry: SessionEntry): Promise<void> {
    // 1. 写入持久化后端
    await this.backend.appendEntry(sessionId, entry)

    // 2. 失效相关缓存
    await this.invalidateSessionCache(sessionId)

    // 3. 通知其他实例
    await this.redis.publish("session:updated", JSON.stringify({
      sessionId,
      entryId: entry.id,
      type: entry.type,
    }))
  }

  async getPathToRoot(sessionId: string, entryId: string): Promise<SessionEntry[]> {
    const cacheKey = `session:${sessionId}:path:${entryId}`

    // 尝试缓存
    const cached = await this.redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    // 缓存未命中 → 查询后端
    const path = await this.backend.getPathToRoot(sessionId, entryId)

    // 写入缓存
    await this.redis.setex(cacheKey, this.config.pathTtlSeconds, JSON.stringify(path))

    return path
  }

  async readAllEntries(sessionId: string): Promise<SessionEntry[]> {
    const cacheKey = `session:${sessionId}:tree`

    const cached = await this.redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const entries = await this.backend.readAllEntries(sessionId)
    await this.redis.setex(cacheKey, this.config.treeTtlSeconds, JSON.stringify(entries))

    return entries
  }

  async listSessions(filter?: SessionFilter): Promise<SessionInfo[]> {
    // 列表查询不缓存（变化频繁，且有分页/过滤条件）
    return this.backend.listSessions(filter)
  }

  // ── 缓存失效 ──

  private async invalidateSessionCache(sessionId: string): Promise<void> {
    const keys = await this.redis.keys(`session:${sessionId}:*`)
    if (keys.length > 0) {
      await this.redis.del(...keys)
    }
  }

  // ── 其他方法直接代理 ──

  createSession(id: string, name: string, meta?: Record<string, unknown>) {
    return this.backend.createSession(id, name, meta)
  }
  deleteSession(id: string) { return this.backend.deleteSession(id) }
  getSessionInfo(id: string) { return this.backend.getSessionInfo(id) }
  appendEntries(id: string, entries: SessionEntry[]) {
    return this.backend.appendEntries(id, entries).then(() => this.invalidateSessionCache(id))
  }
  getEntry(sid: string, eid: string) { return this.backend.getEntry(sid, eid) }
  getChildren(sid: string, pid: string) { return this.backend.getChildren(sid, pid) }
  getLeafEntries(sid: string) { return this.backend.getLeafEntries(sid) }
  appendCompaction(sid: string, c: CompactionRecord) {
    return this.backend.appendCompaction(sid, c).then(() => this.invalidateSessionCache(sid))
  }
  getLatestCompaction(sid: string) { return this.backend.getLatestCompaction(sid) }
  updateSessionMetadata(sid: string, m: Record<string, unknown>) {
    return this.backend.updateSessionMetadata(sid, m)
  }
  close() { return this.backend.close() }
  healthCheck() { return this.backend.healthCheck() }
}

interface CacheConfig {
  pathTtlSeconds: number
  treeTtlSeconds: number
  infoTtlSeconds: number
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  pathTtlSeconds: 600,   // 10 分钟
  treeTtlSeconds: 300,   // 5 分钟
  infoTtlSeconds: 1800,  // 30 分钟
}
```

---

### 9.5 日志持久化与收集

#### 9.5.1 日志分层设计

vitamin 的日志分为 3 层，每层有不同的持久化策略：

```
┌────────────────────────────────────────────────────────────────┐
│ 第 1 层：结构化运行日志                                         │
│ 来源：pino logger                                              │
│ 内容：Agent 状态变化、工具调用、LLM 请求/响应、Extension 事件    │
│ 格式：JSON Lines (每行一条 JSON)                                │
│ 输出：stdout（容器标准输出 → 日志收集器自动采集）               │
│ 持久化：Loki / Elasticsearch（通过日志收集器）                  │
│ 保留：30 天                                                    │
├────────────────────────────────────────────────────────────────┤
│ 第 2 层：审计日志                                               │
│ 来源：工具执行 Hook                                             │
│ 内容：所有文件修改、bash 命令执行、外部 API 调用                │
│ 格式：PostgreSQL audit_logs 表                                  │
│ 输出：直接写数据库                                              │
│ 持久化：PostgreSQL                                              │
│ 保留：1 年                                                     │
├────────────────────────────────────────────────────────────────┤
│ 第 3 层：对话数据                                               │
│ 来源：SessionManager                                           │
│ 内容：完整对话树（用户消息、Agent 回复、工具结果、压缩记录）    │
│ 格式：PostgreSQL session_entries 表                              │
│ 输出：通过 SessionStorage 接口写入                              │
│ 持久化：PostgreSQL + S3 归档                                    │
│ 保留：永久（活跃）/ S3 归档（冷数据）                          │
└────────────────────────────────────────────────────────────────┘
```

#### 9.5.2 结构化日志实现

```typescript
// packages/shared/src/logger.ts

import pino from "pino"

export interface LoggerConfig {
  /** 日志级别 */
  level: "debug" | "info" | "warn" | "error"
  /** 部署模式 */
  mode: "local" | "cloud"
  /** 本地模式：日志文件路径 */
  filePath?: string
  /** 云端模式：是否添加 trace context */
  traceEnabled?: boolean
}

export function createLogger(config: LoggerConfig): pino.Logger {
  if (config.mode === "local") {
    // 本地模式：写文件 + pretty print
    return pino({
      level: config.level,
      transport: {
        targets: [
          // 文件输出（machine-readable）
          {
            target: "pino/file",
            options: { destination: config.filePath ?? "/tmp/vitamin.log" },
            level: config.level,
          },
          // 终端输出（human-readable，仅 warn+）
          {
            target: "pino-pretty",
            options: { colorize: true },
            level: "warn",
          },
        ],
      },
    })
  }

  // 云端模式：JSON 到 stdout（让容器日志收集器采集）
  return pino({
    level: config.level,
    // 添加容器/trace 元数据
    mixin() {
      return {
        service: "vitamin-agent",
        instance: process.env.HOSTNAME ?? "unknown",
        version: process.env.VITAMIN_VERSION ?? "dev",
        // OpenTelemetry trace context（如果启用）
        ...(config.traceEnabled ? getTraceContext() : {}),
      }
    },
    // 序列化规则：避免敏感信息泄漏
    redact: {
      paths: ["apiKey", "authorization", "password", "secret", "token"],
      censor: "[REDACTED]",
    },
  })
}

/**
 * Agent 运行时日志示例（云端模式 stdout 输出）:
 *
 * {"level":30,"time":1740700000000,"service":"vitamin-agent","instance":"worker-3","msg":"tool_execute","tool":"bash","args":{"command":"npm test"},"duration":12400}
 * {"level":30,"time":1740700012000,"service":"vitamin-agent","instance":"worker-3","msg":"llm_request","model":"claude-opus-4-6","inputTokens":8500,"outputTokens":1200}
 * {"level":40,"time":1740700013000,"service":"vitamin-agent","instance":"worker-3","msg":"steering_injected","sessionId":"s-abc","messageCount":1}
 */
```

#### 9.5.3 审计日志 Hook

```typescript
// packages/hooks/src/builtin/audit-logger.ts

import type { HookRegistration } from "../types"
import type { Pool } from "pg"

/**
 * 审计日志 Hook — 记录所有工具执行到 PostgreSQL
 *
 * 云端场景必须有审计日志：
 * - 合规要求：谁在什么时候让 Agent 执行了什么命令
 * - 安全回溯：Agent 修改了哪些文件，执行了什么 bash 命令
 * - 费用追踪：每次 LLM 调用的 token 消耗
 */
export function createAuditLoggerHook(pool: Pool, userId: string): HookRegistration {
  return {
    name: "cloud:audit-logger",
    timing: "tool.execute.after",
    priority: 10,  // 最高优先级，确保日志不丢失
    disableable: false,  // 不可禁用

    async handler(input, output) {
      const { tool, args, result, duration } = input

      // 异步写入，不阻塞工具执行
      pool.query(
        `INSERT INTO audit_logs (user_id, session_id, action, detail)
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          input.sessionId,
          `tool:${tool}`,
          JSON.stringify({
            tool,
            args: sanitizeArgs(args),  // 移除敏感参数
            resultLength: JSON.stringify(result).length,
            isError: result.isError ?? false,
            duration,
          }),
        ]
      ).catch((error) => {
        // 审计日志写入失败不应影响主流程
        logger.error({ error, tool }, "audit log write failed")
      })
    },
  }
}

/** 移除敏感参数 */
function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...args }
  for (const key of ["apiKey", "password", "secret", "token", "authorization"]) {
    if (key in sanitized) sanitized[key] = "[REDACTED]"
  }
  // bash 命令：记录完整命令（审计需要），但截断超长输出
  if (typeof sanitized.command === "string" && sanitized.command.length > 10000) {
    sanitized.command = sanitized.command.slice(0, 10000) + "... [truncated]"
  }
  return sanitized
}
```

#### 9.5.4 日志收集架构（容器端）

```yaml
# docker-compose.cloud.yml — 日志基础设施

services:
  vitamin-worker:
    image: vitamin-agent:latest
    environment:
      - VITAMIN_MODE=cloud
      - VITAMIN_LOG_LEVEL=info
      - DATABASE_URL=postgres://user:pass@postgres:5432/vitamin
      - REDIS_URL=redis://redis:6379
    logging:
      driver: "json-file"    # Docker 默认日志驱动
      options:
        max-size: "100m"
        max-file: "5"
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 2G
          cpus: '2'

  # 日志收集器：采集容器 stdout → 发送到 Loki
  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/config.yml
    # Promtail 配置：自动发现容器、解析 JSON 日志、按 service/instance 标签分类

  # 日志存储
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    # 支持 S3 后端存储，长期归档

  # 日志查询面板
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    # 预配置 Loki 数据源 + vitamin 日志 Dashboard
```

---

### 9.6 Storage Backend 初始化工厂

#### 9.6.1 根据环境自动选择存储后端

```typescript
// packages/session/src/storage/create-storage.ts

import type { SessionStorage } from "./storage-interface"

export interface StorageConfig {
  /** 存储后端类型 */
  backend: "jsonl" | "sqlite" | "postgres"
  /** JSONL / SQLite: 本地目录 */
  dir?: string
  /** PostgreSQL: 连接字符串 */
  databaseUrl?: string
  /** Redis: 连接字符串（启用缓存层） */
  redisUrl?: string
}

/**
 * 存储后端工厂
 *
 * 根据配置自动选择合适的存储后端：
 * - 本地开发: JSONL（零依赖，文件即数据）
 * - 本地大型项目: SQLite（快速查询）
 * - 云端部署: PostgreSQL + Redis 缓存
 */
export async function createStorage(config: StorageConfig): Promise<SessionStorage> {
  switch (config.backend) {
    case "jsonl": {
      const { JsonlStorage } = await import("./jsonl-storage")
      return new JsonlStorage(config.dir!)
    }
    case "sqlite": {
      const { SqliteStorage } = await import("./sqlite-storage")
      return new SqliteStorage(config.dir!)
    }
    case "postgres": {
      const { Pool } = await import("pg")
      const { PostgresStorage } = await import("./postgres-storage")
      const pool = new Pool({ connectionString: config.databaseUrl })

      // 自动执行数据库迁移
      await runMigrations(pool)

      const pgStorage = new PostgresStorage(pool)

      // 如果配置了 Redis，包装缓存层
      if (config.redisUrl) {
        const Redis = (await import("ioredis")).default
        const { CachedStorage } = await import("./cached-storage")
        const redis = new Redis(config.redisUrl)
        return new CachedStorage(pgStorage, redis)
      }

      return pgStorage
    }
  }
}

/**
 * 从环境变量自动推断存储配置
 *
 * 云端容器通常通过环境变量配置：
 *   DATABASE_URL=postgres://... → 自动选择 postgres backend
 *   REDIS_URL=redis://...       → 自动启用缓存层
 *   两者都没有                  → 本地 JSONL
 */
export function inferStorageConfig(projectDir: string): StorageConfig {
  if (process.env.DATABASE_URL) {
    return {
      backend: "postgres",
      databaseUrl: process.env.DATABASE_URL,
      redisUrl: process.env.REDIS_URL,
    }
  }

  return {
    backend: "jsonl",
    dir: `${projectDir}/.vitamin/sessions`,
  }
}
```

#### 9.6.2 SDK 集成（对使用者透明）

```typescript
// 用户代码完全不需要关心存储后端

// ── 本地使用（自动 JSONL）──
const agent = await createVitaminAgent({
  projectDir: "./my-project",
})
// → inferStorageConfig() 发现没有 DATABASE_URL → 使用 JSONL

// ── 云端使用（自动 PostgreSQL + Redis）──
// 只需要设置环境变量：
//   DATABASE_URL=postgres://user:pass@db:5432/vitamin
//   REDIS_URL=redis://cache:6379
const agent = await createVitaminAgent({
  projectDir: "/workspace/user-123/session-456",
})
// → inferStorageConfig() 发现 DATABASE_URL → 使用 PostgreSQL + Redis

// ── 显式指定 ──
const agent = await createVitaminAgent({
  projectDir: "./",
  config: {
    session: {
      storage_backend: "postgres",
      database_url: "postgres://...",
      redis_url: "redis://...",
    },
  },
})
```

---

### 9.7 数据生命周期管理

#### 9.7.1 分层存储策略

```
数据温度:

  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │   Hot    │     │   Warm   │     │   Cold   │
  │ (Redis)  │ ──→ │ (PG)     │ ──→ │ (S3)     │
  │          │     │          │     │          │
  │ 当前活跃 │     │ 近 30 天 │     │ 30 天+   │
  │ 会话缓存 │     │ 可查询   │     │ 归档     │
  └──────────┘     └──────────┘     └──────────┘
       ↑                ↑                ↑
    TTL 自动过期     定时归档任务      永久保留
    (分钟级)        (每日 cron)      (或按策略删除)
```

#### 9.7.2 归档任务

```typescript
// packages/cloud/src/archiver.ts

/**
 * 冷数据归档任务
 *
 * 定期将不活跃的会话数据从 PostgreSQL 迁移到 S3/MinIO。
 * 保留元数据索引在 PostgreSQL（可搜索），对话内容移到对象存储（廉价）。
 */
export class SessionArchiver {
  constructor(
    private pool: Pool,
    private s3: S3Client,
    private config: ArchiveConfig
  ) {}

  /**
   * 归档不活跃会话
   *
   * 策略：超过 archiveAfterDays 天未更新的会话
   *       → 导出完整 JSONL 到 S3
   *       → 删除 PostgreSQL 中的 session_entries
   *       → 在 sessions 表标记为 archived + s3_path
   */
  async archiveInactiveSessions(): Promise<ArchiveResult> {
    const cutoff = new Date(Date.now() - this.config.archiveAfterDays * 86400_000)

    // 查找待归档会话
    const { rows: candidates } = await this.pool.query(
      `SELECT id, name, user_id FROM sessions
       WHERE updated_at < $1 AND metadata->>'archived' IS NULL
       LIMIT $2`,
      [cutoff, this.config.batchSize]
    )

    let archived = 0
    for (const session of candidates) {
      try {
        // 1. 导出为 JSONL
        const entries = await this.pool.query(
          `SELECT * FROM session_entries WHERE session_id = $1 ORDER BY created_at`,
          [session.id]
        )
        const jsonl = entries.rows.map(r => JSON.stringify(r)).join("\n")

        // 2. 上传到 S3
        const s3Key = `archives/${session.user_id}/${session.id}.jsonl.gz`
        await this.s3.send(new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: s3Key,
          Body: await gzip(jsonl),
          ContentType: "application/x-ndjson",
          ContentEncoding: "gzip",
        }))

        // 3. 删除 PostgreSQL 中的条目
        await this.pool.query(
          `DELETE FROM session_entries WHERE session_id = $1`,
          [session.id]
        )

        // 4. 标记为已归档
        await this.pool.query(
          `UPDATE sessions SET metadata = metadata || $1 WHERE id = $2`,
          [JSON.stringify({ archived: true, s3_path: s3Key, archived_at: new Date().toISOString() }), session.id]
        )

        archived++
      } catch (error) {
        logger.error({ sessionId: session.id, error }, "archive failed")
      }
    }

    return { candidateCount: candidates.length, archivedCount: archived }
  }

  /**
   * 恢复归档会话
   *
   * 当用户需要查看历史会话时，从 S3 恢复到 PostgreSQL。
   */
  async restoreSession(sessionId: string): Promise<void> {
    const { rows } = await this.pool.query(
      `SELECT metadata FROM sessions WHERE id = $1`,
      [sessionId]
    )
    const s3Path = rows[0]?.metadata?.s3_path
    if (!s3Path) throw new Error("Session is not archived or not found")

    // 从 S3 下载
    const response = await this.s3.send(new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: s3Path,
    }))
    const jsonl = await gunzip(await response.Body!.transformToByteArray())
    const entries = jsonl.toString().split("\n").filter(Boolean).map(JSON.parse)

    // 批量写回 PostgreSQL
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      for (const entry of entries) {
        await client.query(
          `INSERT INTO session_entries (id, session_id, parent_id, type, content, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
          [entry.id, entry.session_id, entry.parent_id, entry.type, entry.content, entry.metadata, entry.created_at]
        )
      }
      // 取消归档标记
      await client.query(
        `UPDATE sessions SET metadata = metadata - 'archived' - 's3_path' - 'archived_at' WHERE id = $1`,
        [sessionId]
      )
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }
}

interface ArchiveConfig {
  archiveAfterDays: number   // 多少天不活跃后归档（默认 30）
  bucket: string             // S3 桶名
  batchSize: number          // 每次归档批量大小（默认 100）
}
```

---

### 9.8 Sandbox 抽象接口与多后端实现

#### 9.8.1 设计动机

沙箱执行环境不止一种：

| 后端 | 运行位置 | 隔离机制 | 典型场景 |
|------|----------|----------|----------|
| **OS-native** | Linux 服务器 | cgroups + seccomp + chroot | 传统云端部署，完整开发工作负载 |
| **Server Wasm** | 服务器 (Wasmtime / WasmEdge) | Wasm 线性内存沙箱 + WASI 能力白名单 | 轻量级服务端隔离，冷启动 <10ms |
| **Browser Wasm** | 浏览器 (BrowserPod / WebVM) | 浏览器 Wasm 沙箱 + 虚拟文件系统 | Web 前端模式，零服务器成本 |

它们隔离强度、性能特征、平台约束各不相同，但 Agent 循环不关心——Agent 只需要 "执行命令、读写文件、获取结果"。因此需要一个**统一抽象接口**，让沙箱后端可插拔。

#### 9.8.2 Sandbox 抽象接口

```typescript
// packages/sandbox/src/sandbox-interface.ts

/**
 * 沙箱执行结果
 */
export interface SandboxExecResult {
  stdout: string
  stderr: string
  exitCode: number
  /** 实际执行时长（ms） */
  durationMs: number
  /** 是否因超时被终止 */
  timedOut: boolean
}

/**
 * 沙箱文件系统接口
 *
 * Agent 工具（file_read、file_write、list_dir）统一通过此接口操作文件，
 * 无需关心底层是真实磁盘、Wasm 虚拟文件系统还是 IndexedDB。
 */
export interface SandboxFileSystem {
  readFile(path: string, encoding?: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  readdir(path: string): Promise<string[]>
  stat(path: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number }>
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
  rm(path: string, options?: { recursive?: boolean }): Promise<void>
  exists(path: string): Promise<boolean>
}

/**
 * 沙箱资源限制
 */
export interface SandboxLimits {
  /** CPU 限制（核数） */
  cpuLimit: number
  /** 内存限制（MB） */
  memoryLimitMb: number
  /** 单命令超时（ms） */
  commandTimeoutMs: number
  /** 磁盘配额（MB），可选 */
  diskQuotaMb?: number
  /** 允许访问的网络地址（白名单），为空表示禁止所有网络 */
  networkAllowList?: string[]
  /** 禁止的命令前缀 */
  blockedCommands?: string[]
}

/**
 * Sandbox 统一抽象接口
 *
 * 所有沙箱后端（OS-native、Server Wasm、Browser Wasm）均实现此接口。
 * Agent 工具通过此接口执行命令和操作文件，完全屏蔽底层实现。
 *
 * 设计原则：
 * - 最小接口：只暴露 Agent 工具链需要的能力
 * - 生命周期管理：initialize → exec/fs → destroy
 * - 资源约束：所有后端统一遵守 limits
 */
export interface Sandbox {
  /** 沙箱类型标识 */
  readonly type: "os-native" | "server-wasm" | "browser-wasm"

  /** 工作目录根路径（对沙箱内进程可见） */
  readonly workDir: string

  /** 文件系统操作 */
  readonly fs: SandboxFileSystem

  /** 当前资源限制 */
  readonly limits: SandboxLimits

  /**
   * MCP 代理通道（可选）
   *
   * 沙箱内的 Agent 可能需要调用 MCP 工具（如 websearch、fetch_webpage），
   * 但沙箱隔离了网络和进程。此通道作为代理桥接：
   * - OS-native: 通过 unix socket/named pipe 暴露 MCP proxy
   * - Server Wasm: 通过 WASI 能力注入或宿主函数回调
   * - Browser Wasm: 通过 postMessage 与宿主通信
   *
   * 如果 MCP 通道不可用（undefined），Agent 在沙箱内无法调用 MCP 工具。
   */
  readonly mcp?: SandboxMcpProxy

  /**
   * 初始化沙箱
   *
   * OS-native: 创建 cgroup、挂载 chroot
   * Server Wasm: 实例化 Wasm 模块、挂载 WASI 虚拟目录
   * Browser Wasm: 初始化 BrowserPod、加载磁盘镜像
   */
  initialize(): Promise<void>

  /**
   * 执行命令
   *
   * 所有后端的统一执行入口。命令字符串由 Agent 的 bash 工具生成。
   */
  exec(command: string, options?: ExecOptions): Promise<SandboxExecResult>

  /**
   * 健康检查
   */
  healthCheck(): Promise<boolean>

  /**
   * 销毁沙箱，释放所有资源
   */
  destroy(): Promise<void>
}

export interface ExecOptions {
  /** 覆盖工作目录 */
  cwd?: string
  /** 环境变量 */
  env?: Record<string, string>
  /** 超时覆盖（ms） */
  timeout?: number
  /** 中止信号 */
  signal?: AbortSignal
  /** stdin 输入 */
  stdin?: string
}

/**
 * Sandbox MCP 代理接口
 *
 * 为沙箱内的 Agent 提供 MCP 工具调用能力，
 * 实际请求由宿主环境的 MCP 客户端代理执行。
 */
export interface SandboxMcpProxy {
  /** 调用 MCP 工具（代理到宿主 MCP 客户端） */
  callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<unknown>
  /** 列出当前可用的 MCP 工具（由宿主白名单控制） */
  listTools(): Promise<Array<{ server: string; tool: string }>>
}
```

#### 9.8.3 OS-native 后端（cgroups + seccomp）

传统 Linux 服务器沙箱，适合完整开发工作负载：

```typescript
// packages/sandbox/src/backends/os-native-sandbox.ts

import type { Sandbox, SandboxExecResult, SandboxFileSystem, SandboxLimits, ExecOptions } from "../sandbox-interface"
import { spawn } from "node:child_process"
import * as fs from "node:fs/promises"
import * as path from "node:path"

export class OsNativeSandbox implements Sandbox {
  readonly type = "os-native" as const
  readonly fs: SandboxFileSystem

  constructor(
    readonly workDir: string,
    readonly limits: SandboxLimits,
    private cgroupPath?: string,
  ) {
    this.fs = new NativeFileSystem(workDir)
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.workDir, { recursive: true })

    if (this.limits.cpuLimit || this.limits.memoryLimitMb) {
      this.cgroupPath = `/sys/fs/cgroup/vitamin-${process.pid}-${Date.now()}`
      await this.setupCgroup()
    }
  }

  async exec(command: string, options?: ExecOptions): Promise<SandboxExecResult> {
    // 对命令做标准化处理（trim + 解析首 token），防止前导空格、绝对路径、间接执行绕过
    const normalized = command.trim()
    const tokens = normalized.split(/\s+/)
    const executable = tokens[0]?.replace(/^.*\//, "")  // 去掉绝对路径前缀
    const blockedCommands = this.limits.blockedCommands ?? DEFAULT_BLOCKED
    for (const blocked of blockedCommands) {
      if (normalized.startsWith(blocked)
        || tokens.includes(blocked.split(/\s+/)[0])
        || (executable && blocked.startsWith(executable))) {
        return { stdout: "", stderr: `Command blocked: ${blocked}`, exitCode: 1, durationMs: 0, timedOut: false }
      }
    }
    // 拦截常见间接执行中继（bash -c, sh -c, eval 等）
    if (/\b(bash|sh|zsh|eval)\s+(-c\s+)?['"]/.test(normalized)) {
      for (const blocked of blockedCommands) {
        if (normalized.includes(blocked)) {
          return { stdout: "", stderr: `Command blocked (indirect execution): ${blocked}`, exitCode: 1, durationMs: 0, timedOut: false }
        }
      }
    }

    const timeout = options?.timeout ?? this.limits.commandTimeoutMs
    const cwd = options?.cwd ?? this.workDir
    const start = Date.now()

    return new Promise<SandboxExecResult>((resolve) => {
      const child = spawn("sh", ["-c", command], {
        cwd,
        env: { ...process.env, ...options?.env },
        timeout,
      })

      let stdout = ""
      let stderr = ""
      let timedOut = false

      child.stdout.on("data", (data) => { stdout += data.toString() })
      child.stderr.on("data", (data) => { stderr += data.toString() })

      const timer = setTimeout(() => {
        timedOut = true
        child.kill("SIGKILL")
      }, timeout)

      options?.signal?.addEventListener("abort", () => child.kill("SIGTERM"))

      child.on("close", (code) => {
        clearTimeout(timer)
        resolve({ stdout, stderr, exitCode: code ?? 1, durationMs: Date.now() - start, timedOut })
      })
    })
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.exec("echo ok", { timeout: 5000 })
      return result.exitCode === 0
    } catch {
      return false
    }
  }

  async destroy(): Promise<void> {
    if (this.cgroupPath) {
      await fs.rm(this.cgroupPath, { recursive: true }).catch(() => {})
    }
  }

  private async setupCgroup(): Promise<void> {
    await fs.mkdir(this.cgroupPath!, { recursive: true })
    if (this.limits.memoryLimitMb) {
      await fs.writeFile(
        path.join(this.cgroupPath!, "memory.max"),
        String(this.limits.memoryLimitMb * 1024 * 1024)
      )
    }
    if (this.limits.cpuLimit) {
      await fs.writeFile(
        path.join(this.cgroupPath!, "cpu.max"),
        `${this.limits.cpuLimit * 100000} 100000`
      )
    }
  }
}

class NativeFileSystem implements SandboxFileSystem {
  constructor(private root: string) {}

  private resolve(p: string): string {
    const resolved = path.resolve(this.root, p)
    if (!resolved.startsWith(this.root)) throw new Error(`Path escape: ${p}`)
    return resolved
  }

  async readFile(p: string, encoding = "utf-8") { return fs.readFile(this.resolve(p), encoding as BufferEncoding) }
  async writeFile(p: string, content: string) { await fs.writeFile(this.resolve(p), content) }
  async readdir(p: string) { return fs.readdir(this.resolve(p)) }
  async stat(p: string) {
    const s = await fs.stat(this.resolve(p))
    return { isFile: s.isFile(), isDirectory: s.isDirectory(), size: s.size }
  }
  async mkdir(p: string, opts?: { recursive?: boolean }) { await fs.mkdir(this.resolve(p), opts) }
  async rm(p: string, opts?: { recursive?: boolean }) { await fs.rm(this.resolve(p), opts) }
  async exists(p: string) { return fs.access(this.resolve(p)).then(() => true).catch(() => false) }
}

const DEFAULT_BLOCKED = [
  "rm -rf /",
  "dd if=",
  ":(){ :|:& };:",
  "chmod 777 /",
  "curl | bash",
  "wget | bash",
]
```

#### 9.8.4 Server Wasm 后端（Wasmtime / WasmEdge）

服务器端同样可以使用 Wasm 做沙箱——通过 WASI（WebAssembly System Interface）提供受控的文件系统和进程能力，**无需 Linux cgroup/seccomp 权限**，任何操作系统均可运行：

```
┌─────────────────────────────────────────────────────────┐
│                  vitamin Server                         │
│                                                         │
│  Agent Loop ──→ Sandbox.exec("npm test")                │
│                      │                                  │
│              ┌───────▼────────┐                         │
│              │  Wasm Runtime  │                         │
│              │  (Wasmtime)    │                         │
│              │                │                         │
│              │  ┌───────────┐ │                         │
│              │  │ WASI 层   │ │                         │
│              │  │           │ │                         │
│              │  │ fs: 仅    │ │  ← 能力白名单:          │
│              │  │  /work/   │ │    fs: /workspace/{uid} │
│              │  │ net: deny │ │    net: 仅允许白名单     │
│              │  │ env: 受控 │ │    env: 过滤后注入       │
│              │  └───────────┘ │                         │
│              │                │                         │
│              │  线性内存沙箱  │  ← 无法访问宿主内存      │
│              │  无法调用任意  │  ← 无法执行宿主命令      │
│              │  系统调用      │                         │
│              └────────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

**Server Wasm vs OS-native 对比**：

| 维度 | OS-native (cgroups) | Server Wasm (Wasmtime/WasmEdge) |
|------|--------------------|---------------------------------|
| **平台** | 仅 Linux | Linux / macOS / Windows |
| **权限** | 需要 root / cgroup 权限 | 无特殊权限 |
| **隔离粒度** | 进程级 | 函数调用级（Wasm 线性内存） |
| **冷启动** | ~50-200ms（chroot 挂载） | **<10ms**（Wasm 模块实例化） |
| **性能** | 接近原生 | 接近原生（AOT 编译后 ~90%） |
| **文件系统** | 真实文件系统（chroot） | WASI 虚拟目录映射 |
| **网络** | iptables / seccomp 过滤 | WASI 能力白名单（默认无网络） |
| **安全逃逸面** | 内核漏洞可能逃逸 | Wasm 沙箱逃逸面极小 |
| **工具生态** | 直接运行宿主 CLI 工具 | 需要 WASI 编译的工具或 shell 组件 |
| **适用场景** | 需要运行任意原生二进制 | 可控工具集 + 最高安全要求 |

```typescript
// packages/sandbox/src/backends/server-wasm-sandbox.ts

import type { Sandbox, SandboxExecResult, SandboxFileSystem, SandboxLimits, ExecOptions } from "../sandbox-interface"
import * as fs from "node:fs/promises"
import * as path from "node:path"

/**
 * 服务器端 Wasm 沙箱
 *
 * 使用 Wasmtime / WasmEdge 在服务器端运行 Wasm 模块，
 * 通过 WASI 能力模型提供文件系统和进程控制。
 *
 * 优势：
 * - 无需 Linux cgroup 权限，macOS/Windows 亦可运行
 * - 冷启动 <10ms（vs chroot ~200ms）
 * - Wasm 线性内存隔离，比 cgroups 更难逃逸
 * - 能力白名单模型：默认拒绝所有，显式授予 fs/net 权限
 *
 * 限制：
 * - 工具需要 WASI 兼容（或通过 shell 组件转发）
 * - 复杂 shell 管道链兼容性待验证
 */
export class ServerWasmSandbox implements Sandbox {
  readonly type = "server-wasm" as const
  readonly fs: SandboxFileSystem
  private runtime: WasiRuntime | null = null

  constructor(
    readonly workDir: string,
    readonly limits: SandboxLimits,
    private runtimeType: "wasmtime" | "wasmedge" = "wasmtime",
  ) {
    this.fs = new WasiFileSystem(workDir)
  }

  async initialize(): Promise<void> {
    this.runtime = await createWasiRuntime(this.runtimeType, {
      // WASI 能力白名单
      preopens: {
        "/workspace": this.workDir,  // 仅映射工作目录
      },
      env: this.buildSafeEnv(),
      // Wasmtime fuel 机制：每条 Wasm 指令消耗 1 fuel，用于 CPU 限制
      fuelLimit: this.cpuToFuel(this.limits.cpuLimit),
      memoryLimitPages: Math.ceil(this.limits.memoryLimitMb / 64),  // Wasm 页 = 64KB
      networkAccess: this.limits.networkAllowList?.length
        ? { type: "allowlist", hosts: this.limits.networkAllowList }
        : { type: "deny" },
    })
  }

  async exec(command: string, options?: ExecOptions): Promise<SandboxExecResult> {
    if (!this.runtime) throw new Error("Sandbox not initialized")

    for (const blocked of this.limits.blockedCommands ?? []) {
      if (command.startsWith(blocked)) {
        return { stdout: "", stderr: `Command blocked: ${blocked}`, exitCode: 1, durationMs: 0, timedOut: false }
      }
    }

    const timeout = options?.timeout ?? this.limits.commandTimeoutMs
    const start = Date.now()

    try {
      const result = await this.runtime.exec(command, {
        cwd: options?.cwd ?? "/workspace",
        env: options?.env,
        stdin: options?.stdin,
        timeout,
        signal: options?.signal,
      })

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs: Date.now() - start,
        timedOut: false,
      }
    } catch (error: unknown) {
      const isTimeout = error instanceof Error && error.message.includes("fuel")
      return {
        stdout: "",
        stderr: isTimeout ? "Execution timed out (fuel exhausted)" : String(error),
        exitCode: 1,
        durationMs: Date.now() - start,
        timedOut: isTimeout,
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.exec("echo ok", { timeout: 5000 })
      return result.exitCode === 0
    } catch {
      return false
    }
  }

  async destroy(): Promise<void> {
    this.runtime?.dispose()
    this.runtime = null
  }

  private cpuToFuel(cpuLimit: number): bigint {
    return 1_000_000_000n * BigInt(cpuLimit)
  }

  private buildSafeEnv(): Record<string, string> {
    return {
      HOME: "/workspace",
      PATH: "/usr/local/bin:/usr/bin:/bin",
      TERM: "xterm-256color",
      NODE_ENV: "production",
    }
  }
}

/** WasiFileSystem 使用 ESM 顶层导入，避免每个方法重复 require() */
class WasiFileSystem implements SandboxFileSystem {
  constructor(private hostRoot: string) {}

  private toHostPath(wasmPath: string): string {
    const p = wasmPath.replace(/^\/workspace\/?/, "")
    const resolved = path.resolve(this.hostRoot, p)
    if (!resolved.startsWith(this.hostRoot)) throw new Error(`Path escape: ${wasmPath}`)
    return resolved
  }

  async readFile(p: string, encoding = "utf-8") {
    return fs.readFile(this.toHostPath(p), encoding as BufferEncoding)
  }
  async writeFile(p: string, content: string) {
    await fs.writeFile(this.toHostPath(p), content)
  }
  async readdir(p: string) {
    return fs.readdir(this.toHostPath(p))
  }
  async stat(p: string) {
    const s = await fs.stat(this.toHostPath(p))
    return { isFile: s.isFile(), isDirectory: s.isDirectory(), size: s.size }
  }
  async mkdir(p: string, opts?: { recursive?: boolean }) {
    await fs.mkdir(this.toHostPath(p), opts)
  }
  async rm(p: string, opts?: { recursive?: boolean }) {
    await fs.rm(this.toHostPath(p), opts)
  }
  async exists(p: string) {
    return fs.access(this.toHostPath(p)).then(() => true).catch(() => false)
  }
}

// -- 类型占位（实际由 Wasm 运行时 SDK 提供）--
interface WasiRuntime {
  exec(command: string, options: Record<string, unknown>): Promise<{ stdout: string; stderr: string; exitCode: number }>
  dispose(): void
}
declare function createWasiRuntime(type: string, config: Record<string, unknown>): Promise<WasiRuntime>
```

#### 9.8.5 Browser Wasm 后端（BrowserPod / WebVM）

浏览器内 Wasm 虚拟机沙箱，适合 Web 前端模式（参见 [WebVM](https://webvm.io/)、[BrowserPod](https://browserpod.io/)）：

```typescript
// packages/sandbox/src/backends/browser-wasm-sandbox.ts

import type { Sandbox, SandboxExecResult, SandboxFileSystem, SandboxLimits, ExecOptions } from "../sandbox-interface"

/**
 * 浏览器 Wasm 沙箱
 *
 * 使用 BrowserPod SDK 或 CheerpX (WebVM) JavaScript API
 * 在浏览器内运行完整 Linux 环境。
 *
 * 优势：
 * - 零服务器成本（工具执行完全在客户端）
 * - 浏览器 Wasm 沙箱是硬件级隔离
 * - 用户代码从未离开浏览器，无数据主权风险
 *
 * 限制：
 * - 浏览器内存上限 2-4GB
 * - 网络能力受限（需 Portals / 代理）
 * - 后台标签页可能被节流
 */
export class BrowserWasmSandbox implements Sandbox {
  readonly type = "browser-wasm" as const
  readonly fs: SandboxFileSystem

  constructor(
    readonly workDir: string,
    readonly limits: SandboxLimits,
    private pod: BrowserPod,
  ) {
    this.fs = new BrowserPodFileSystem(pod)
  }

  async initialize(): Promise<void> {
    await this.pod.boot()
    await this.pod.fs.mkdir(this.workDir, { recursive: true })
  }

  async exec(command: string, options?: ExecOptions): Promise<SandboxExecResult> {
    const timeout = options?.timeout ?? this.limits.commandTimeoutMs
    const start = Date.now()

    try {
      const result = await this.pod.exec(command, {
        cwd: options?.cwd ?? this.workDir,
        env: options?.env,
        timeout,
        signal: options?.signal,
      })

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs: Date.now() - start,
        timedOut: false,
      }
    } catch (error: unknown) {
      return {
        stdout: "",
        stderr: String(error),
        exitCode: 1,
        durationMs: Date.now() - start,
        timedOut: Date.now() - start >= timeout,
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.exec("echo ok", { timeout: 5000 })
      return result.exitCode === 0
    } catch {
      return false
    }
  }

  async destroy(): Promise<void> {
    await this.pod.shutdown()
  }
}

class BrowserPodFileSystem implements SandboxFileSystem {
  constructor(private pod: BrowserPod) {}

  async readFile(p: string, encoding = "utf-8") { return this.pod.fs.readFile(p, encoding) }
  async writeFile(p: string, content: string) { await this.pod.fs.writeFile(p, content) }
  async readdir(p: string) { return this.pod.fs.readdir(p) }
  async stat(p: string) { return this.pod.fs.stat(p) }
  async mkdir(p: string, opts?: { recursive?: boolean }) { await this.pod.fs.mkdir(p, opts) }
  async rm(p: string, opts?: { recursive?: boolean }) { await this.pod.fs.rm(p, opts) }
  async exists(p: string) { return this.pod.fs.exists(p) }
}

// -- 类型占位（实际由 BrowserPod SDK 提供）--
interface BrowserPod {
  boot(): Promise<void>
  exec(command: string, options: Record<string, unknown>): Promise<{ stdout: string; stderr: string; exitCode: number }>
  shutdown(): Promise<void>
  fs: SandboxFileSystem
}
```

#### 9.8.6 Sandbox 工厂与自动选择

```typescript
// packages/sandbox/src/create-sandbox.ts

import type { Sandbox, SandboxLimits } from "./sandbox-interface"

export type SandboxBackend = "os-native" | "server-wasm" | "browser-wasm" | "auto"

export interface SandboxFactoryConfig {
  /** 沙箱后端类型，"auto" 表示自动检测 */
  backend: SandboxBackend
  /** 工作目录 */
  workDir: string
  /** 资源限制 */
  limits: SandboxLimits
  /** Server Wasm: 运行时选择 */
  wasmRuntime?: "wasmtime" | "wasmedge"
  /** Browser Wasm: BrowserPod 实例（由外部传入） */
  browserPod?: BrowserPod
}

/**
 * 沙箱工厂
 *
 * 自动选择逻辑：
 * 1. 如果传入 browserPod → browser-wasm
 * 2. 如果服务器端可检测到 wasmtime/wasmedge → server-wasm
 * 3. 如果 Linux + 有 cgroup 权限 → os-native
 * 4. 兜底：server-wasm（无需特殊权限）
 */
export async function createSandbox(config: SandboxFactoryConfig): Promise<Sandbox> {
  const backend = config.backend === "auto"
    ? await detectBestBackend(config)
    : config.backend

  switch (backend) {
    case "os-native": {
      const { OsNativeSandbox } = await import("./backends/os-native-sandbox")
      const sandbox = new OsNativeSandbox(config.workDir, config.limits)
      await sandbox.initialize()
      return sandbox
    }
    case "server-wasm": {
      const { ServerWasmSandbox } = await import("./backends/server-wasm-sandbox")
      const sandbox = new ServerWasmSandbox(config.workDir, config.limits, config.wasmRuntime)
      await sandbox.initialize()
      return sandbox
    }
    case "browser-wasm": {
      const { BrowserWasmSandbox } = await import("./backends/browser-wasm-sandbox")
      const sandbox = new BrowserWasmSandbox(config.workDir, config.limits, config.browserPod!)
      await sandbox.initialize()
      return sandbox
    }
  }
}

async function detectBestBackend(config: SandboxFactoryConfig): Promise<Exclude<SandboxBackend, "auto">> {
  if (config.browserPod) return "browser-wasm"
  if (typeof globalThis.window !== "undefined"
    && typeof globalThis.document !== "undefined"
    && typeof globalThis.SharedArrayBuffer !== "undefined") return "browser-wasm"
  if (await isWasmRuntimeAvailable()) return "server-wasm"
  if (process.platform === "linux" && await hasCgroupAccess()) return "os-native"
  return "server-wasm"
}

async function isWasmRuntimeAvailable(): Promise<boolean> {
  try {
    const { execSync } = await import("node:child_process")
    execSync("wasmtime --version", { stdio: "ignore" })
    return true
  } catch {
    try {
      const { execSync } = await import("node:child_process")
      execSync("wasmedge --version", { stdio: "ignore" })
      return true
    } catch {
      return false
    }
  }
}

async function hasCgroupAccess(): Promise<boolean> {
  try {
    const fs = await import("node:fs/promises")
    await fs.access("/sys/fs/cgroup", (await import("node:fs")).constants.W_OK)
    return true
  } catch {
    return false
  }
}
```

#### 9.8.7 创建统一沙箱工具

```typescript
// packages/sandbox/src/create-sandboxed-tools.ts

import type { Sandbox } from "./sandbox-interface"

/**
 * 基于 Sandbox 抽象接口创建 Agent 工具
 *
 * 不论底层是 OS-native、Server Wasm 还是 Browser Wasm，
 * Agent 看到的工具接口完全一致。
 */
export function createSandboxedTools(sandbox: Sandbox) {
  return {
    bash: {
      name: "bash",
      async execute(id: string, args: { command: string }, signal: AbortSignal) {
        const result = await sandbox.exec(args.command, { signal })
        return {
          content: [{ type: "text", text: result.stdout + result.stderr }],
          isError: result.exitCode !== 0,
        }
      },
    },

    file_read: {
      name: "file_read",
      async execute(id: string, args: { file_path: string }) {
        try {
          const content = await sandbox.fs.readFile(args.file_path)
          return { content: [{ type: "text", text: content }] }
        } catch (error) {
          return { content: [{ type: "text", text: String(error) }], isError: true }
        }
      },
    },

    file_write: {
      name: "file_write",
      async execute(id: string, args: { file_path: string; content: string }) {
        try {
          await sandbox.fs.writeFile(args.file_path, args.content)
          return { content: [{ type: "text", text: `Written to ${args.file_path}` }] }
        } catch (error) {
          return { content: [{ type: "text", text: String(error) }], isError: true }
        }
      },
    },

    list_dir: {
      name: "list_dir",
      async execute(id: string, args: { path: string }) {
        try {
          const entries = await sandbox.fs.readdir(args.path)
          return { content: [{ type: "text", text: entries.join("\n") }] }
        } catch (error) {
          return { content: [{ type: "text", text: String(error) }], isError: true }
        }
      },
    },
  }
}
```

#### 9.8.8 三后端对照总表

| 维度 | OS-native | Server Wasm | Browser Wasm |
|------|-----------|-------------|--------------|
| **运行位置** | Linux 服务器 | 任意服务器 | 浏览器 |
| **平台要求** | Linux + cgroup 权限 | 安装 wasmtime/wasmedge | 现代浏览器 + SharedArrayBuffer |
| **隔离强度** | 强（内核级） | **极强**（Wasm 沙箱） | **极强**（浏览器 + Wasm 双重沙箱） |
| **逃逸面** | 内核漏洞 | Wasm 运行时漏洞（极罕见） | 浏览器漏洞（极罕见） |
| **冷启动** | ~50-200ms | **<10ms** | ~2s 首次 / <500ms 后续 |
| **执行性能** | **原生** | ~90% 原生（AOT） | ~40-60% 原生（JIT） |
| **文件系统** | 真实 chroot | WASI 虚拟目录映射 | IndexedDB 虚拟 FS |
| **网络** | iptables 过滤 | WASI 能力白名单 | Portals 受控出入口 |
| **工具兼容性** | **任意原生二进制** | WASI 兼容工具 | BrowserPod 引擎支持的语言 |
| **服务器成本** | 需要计算资源 | 需要计算资源 | **零**（客户端执行） |
| **隐私** | 代码在服务器 | 代码在服务器 | **代码不出浏览器** |
| **适合场景** | 完整开发任务 | 受控工具集 + 跨平台 | Web IDE / 教育 / 隐私敏感 |

```
Sandbox 后端选择决策树:

  需要运行任意原生 CLI 工具？
    ├── 是 → OS-native (cgroups + seccomp)
    └── 否
         │
         运行在浏览器中？
         ├── 是 → Browser Wasm (BrowserPod / WebVM)
         └── 否
              │
              有 Linux cgroup 权限？
              ├── 否 → Server Wasm (Wasmtime / WasmEdge)
              └── 是
                   │
                   需要最高安全隔离？
                   ├── 是 → Server Wasm
                   └── 否 → OS-native（性能最优）
```
---

### 9.9 云端部署配置总览

```typescript
// packages/config/src/schema/cloud.ts

import { z } from "zod/v4"

export const CloudConfigSchema = z.object({
  /** 存储后端 */
  storage_backend: z.enum(["jsonl", "sqlite", "postgres"]).default("jsonl"),

  /** PostgreSQL 连接 */
  database_url: z.string().optional(),

  /** Redis 连接 */
  redis_url: z.string().optional(),

  /** S3 归档配置 */
  archive: z.object({
    enabled: z.boolean().default(false),
    bucket: z.string().default("vitamin-archives"),
    archive_after_days: z.number().default(30),
    region: z.string().default("us-east-1"),
  }).optional(),

  /** 沙箱配置 */
  sandbox: z.object({
    enabled: z.boolean().default(false),
    /** 沙箱后端："auto" 按环境自动选择 */
    backend: z.enum(["os-native", "server-wasm", "browser-wasm", "auto"]).default("auto"),
    /** Server Wasm 运行时（仅 backend 为 server-wasm / auto 时生效） */
    wasm_runtime: z.enum(["wasmtime", "wasmedge"]).optional(),
    cpu_limit: z.number().default(2),
    memory_limit_mb: z.number().default(1024),
    command_timeout_ms: z.number().default(300_000),
    blocked_commands: z.array(z.string()).optional(),
    network_allow_list: z.array(z.string()).optional(),
  }).optional(),

  /** 审计日志 */
  audit: z.object({
    enabled: z.boolean().default(true),
    retention_days: z.number().default(365),
  }).optional(),

  /** 日志配置 */
  logging: z.object({
    level: z.enum(["debug", "info", "warn", "error"]).default("info"),
    trace_enabled: z.boolean().default(false),
    redact_sensitive: z.boolean().default(true),
  }).optional(),
})
```

### 9.10 云端 vs 单机对照表

| 维度 | 单机 CLI | 云端部署 |
|------|---------|----------|
| **Session 存储** | JSONL 文件 | PostgreSQL + Redis 缓存 |
| **日志** | pino → `/tmp/vitamin.log` | pino → stdout → Loki/ES |
| **审计** | 无 | PostgreSQL `audit_logs` 表 |
| **配置** | `.vitamin/config.jsonc` | 环境变量 |
| **工具隔离** | 信任本地 | Sandbox 抽象接口 (OS-native / Server Wasm / Browser Wasm) |
| **数据归档** | 手动删除 | S3 自动归档 + 恢复 |
| **多用户** | 单用户 | userId 隔离 |
| **代码改动** | - | **零业务代码改动**（仅切换 Storage Backend） |

---

## 第十部分：试验性特性讨论

### 10.0 文档治理：分册与阅读导航

Part 10 体量持续增长后（尤其 10.6.16 + 10.8/10.9/10.10），建议采用“主文 + 分册”治理模式，降低审查和维护成本。

建议拆分方式：

| 文档 | 覆盖范围 | 目标读者 |
|------|----------|----------|
| 主提案（本文件） | 10.1~10.6 的概要设计 + 关键接口 | 架构评审、研发负责人 |
| 分册索引：[part10-booklets/README.md](part10-booklets/README.md) | Part 10 拆分导航与迁移规则 | 全体维护者 |
| 分册 A：[part10-booklets/10a-inspector-breakpoints.md](part10-booklets/10a-inspector-breakpoints.md) | 10.2 + 10.3 + 10.4 完整实现细节 | 平台开发、前端调试工具开发 |
| 分册 B：[part10-booklets/10b-dynamic-agents-escalation.md](part10-booklets/10b-dynamic-agents-escalation.md) | 10.5 + 10.6 完整实现细节 | 编排引擎、Agent Runtime 开发 |
| 分册 C：[part10-booklets/10c-validation-testing-slo.md](part10-booklets/10c-validation-testing-slo.md) | 10.8 + 10.9 + 10.10 指标/测试/错误路径 | 测试工程、SRE |

维护原则：

1. 主提案只保留“架构决策 + 最小示例”，避免堆叠完整实现代码
2. 分册承载“完整代码草案 + 细节流程图 + 边界条件”
3. 跨分册引用统一使用“节编号 + 文档名”双锚点，避免断链
4. 每次 PR 优先更新分册，再回填主提案摘要

### 10.1 三模式编排：圆桌脑暴 / Plan / Build

#### 10.1.1 问题提出

当前方案（第四部分 4.2 节）采用 **Plan / Build 二元模式**：

```
Plan 模式: Metis 预分析 → Prometheus 规划 → Momus 审查 → 输出计划文件
Build 模式: Atlas 按计划并行执行 → 收集结果
```

这是 oh-my-opencode 的经典流程，但对比人类工作协作模式，存在一个缺失环节——**在形成明确需求之前，团队往往先进行开放式讨论**。

考察人类团队的真实工作流：

| 阶段 | 人类行为 | 当前 Agent 映射 | 缺失？ |
|------|---------|----------------|--------|
| **头脑风暴** | 白板讨论、自由发散、多视角碰撞、淘汰坏点子 | ❌ 无对应 | **是** |
| **需求规划** | 将讨论结论结构化为需求文档、拆分任务、确定优先级 | Prometheus 规划 | 否 |
| **执行** | 按计划分工实现、测试、交付 | Atlas 并行执行 | 否 |

现有 Plan 模式将 "发散讨论" 和 "收敛规划" 合并在 Prometheus 的 Interview 阶段。但这种合并有明显局限：

1. **Prometheus 目标是生成计划**，它的 Interview 是为了"验证计划前提"，而非"探索可能性空间"
2. **单 Agent 视角**：Prometheus 独自采访用户，缺乏多 Agent 在同一上下文中的视角碰撞
3. **过早收敛**：用户说"重构认证系统"，Prometheus 直接开始规划 JWT 方案——但也许团队讨论后会发现 Session+Redis 方案更适合当前阶段

#### 10.1.2 三模式提案

```
┌──────────────────────────────────────────────────────────────────┐
│                     vitamin 三模式编排                            │
│                                                                  │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐             │
│  │  圆桌脑暴  │ ─→ │   Plan     │ ─→ │   Build    │             │
│  │ Roundtable │    │  Planning  │    │ Execution  │             │
│  │            │    │            │    │            │             │
│  │ 自由讨论   │    │ 结构化规划 │    │ 并行执行   │             │
│  │ 多角色碰撞 │    │ 需求文档化 │    │ 产出交付   │             │
│  │ 发散探索   │    │ 任务拆分   │    │ 报告验收   │             │
│  └────────────┘    └────────────┘    └────────────┘             │
│                                                                  │
│  用户可在任意阶段进入：                                          │
│  - "帮我想想怎么做" → 圆桌脑暴                                  │
│  - "帮我制定计划"   → Plan                                       │
│  - "按这个计划执行" → Build                                      │
│  - "帮我重构认证"   → 意图检测 → 自动选择入口                   │
└──────────────────────────────────────────────────────────────────┘
```

##### 模式一：圆桌脑暴（Roundtable）

**核心理念**：模拟人类团队头脑风暴——多位"角色"在同一个讨论桌上自由发言、质疑、补充。

```typescript
// packages/orchestrator/src/roundtable/roundtable-session.ts

export interface RoundtableConfig {
  /** 话题（用户的原始请求） */
  topic: string
  /** 参与角色（每个角色由一个 Agent 扮演） */
  participants: RoundtableParticipant[]
  /** 用户是否参与讨论（默认参与） */
  userParticipates: boolean
  /** 最大讨论轮数 */
  maxRounds: number
  /** 主持人（引导讨论走向，默认 Sisyphus） */
  moderator: string
}

export interface RoundtableParticipant {
  /** 角色名称 */
  name: string
  /** 扮演此角色的 Agent */
  agent: string
  /** 角色视角描述（注入 system prompt） */
  perspective: string
}

export interface RoundtableMessage {
  role: "participant" | "moderator" | "user"
  participant?: string
  content: string
  /** 标记为关键观点（由主持人或用户标记） */
  highlight?: boolean
}

/**
 * 圆桌讨论会话
 *
 * 与 Plan 模式的关键区别：
 * - Plan: 单 Agent (Prometheus) 主导，目标是生成结构化计划
 * - 圆桌: 多 Agent 平等参与，目标是发散探索可能性空间
 *
 * 讨论结束后输出"讨论纪要"，可直接作为 Plan 模式的输入。
 */
export class RoundtableSession {
  private messages: RoundtableMessage[] = []
  private round = 0

  constructor(
    private config: RoundtableConfig,
    private dispatch: TaskDispatcher,
  ) {}

  async start(): Promise<RoundtableResult> {
    // 主持人开场：明确话题、介绍参与角色
    const opening = await this.moderatorSpeak(
      `话题: ${this.config.topic}\n参与角色: ${this.config.participants.map(p => p.name).join(", ")}\n请各位从各自角度发表看法。`
    )
    this.messages.push(opening)

    // 多轮讨论
    while (this.round < this.config.maxRounds) {
      this.round++

      // 每轮：所有参与者依次发言
      for (const participant of this.config.participants) {
        const response = await this.participantSpeak(participant)
        this.messages.push(response)
      }

      // 用户可插话
      if (this.config.userParticipates) {
        const userInput = await this.waitForUserInput()
        if (userInput) {
          this.messages.push({ role: "user", content: userInput })
        }
        // 用户可随时输入 "/conclude" 结束讨论
        if (userInput?.includes("/conclude")) break
      }

      // 主持人总结本轮、决定是否继续
      const summary = await this.moderatorSummarize()
      this.messages.push(summary)

      if (summary.content.includes("[CONSENSUS_REACHED]")) break
    }

    // 生成讨论纪要
    return this.generateMinutes()
  }

  private async participantSpeak(participant: RoundtableParticipant): Promise<RoundtableMessage> {
    const result = await this.dispatch({
      subagent: participant.agent,
      prompt: this.buildParticipantPrompt(participant),
      mode: "sync",
    })

    return {
      role: "participant",
      participant: participant.name,
      content: result.output,
    }
  }

  private buildParticipantPrompt(participant: RoundtableParticipant): string {
    const history = this.messages
      .map(m => `[${m.participant ?? m.role}]: ${m.content}`)
      .join("\n\n")

    return [
      `你是"${participant.name}"，${participant.perspective}`,
      ``,
      `当前话题: ${this.config.topic}`,
      ``,
      `讨论历史:`,
      history,
      ``,
      `请从你的角色视角发表观点。可以提出新想法、质疑前面的观点、或补充细节。`,
      `保持简洁（200字内），聚焦最有价值的一个观点。`,
    ].join("\n")
  }

  private async generateMinutes(): Promise<RoundtableResult> {
    const minutesPrompt = [
      `请将以下圆桌讨论整理为"讨论纪要"：`,
      ``,
      ...this.messages.map(m => `[${m.participant ?? m.role}]: ${m.content}`),
      ``,
      `纪要格式：`,
      `## 讨论纪要`,
      `### 话题`,
      `### 关键观点（按角色整理）`,
      `### 共识`,
      `### 分歧`,
      `### 建议方向`,
    ].join("\n")

    const result = await this.dispatch({
      subagent: this.config.moderator,
      prompt: minutesPrompt,
      mode: "sync",
    })

    return {
      minutes: result.output,
      messages: this.messages,
      roundCount: this.round,
      consensusReached: this.messages.some(m => m.content.includes("[CONSENSUS_REACHED]")),
    }
  }

  private async moderatorSpeak(prompt: string): Promise<RoundtableMessage> {
    const result = await this.dispatch({
      subagent: this.config.moderator,
      prompt,
      mode: "sync",
    })
    return { role: "moderator", content: result.output }
  }

  private async moderatorSummarize(): Promise<RoundtableMessage> {
    return this.moderatorSpeak(
      `总结第 ${this.round} 轮讨论要点，判断是否达成共识。如已达成，在回复中包含 [CONSENSUS_REACHED]。`
    )
  }

  /**
   * 等待用户输入
   *
   * 抽象接口——由 TUI 层或 SDK 层覆写实现。
   * 默认实现返回 null（跳过用户参与），实际使用时通过注入或子类重写。
   *
   * @example
   * ```typescript
   * // TUI 层实现
   * session.waitForUserInput = async () => {
   *   return await tuiPrompt("Enter input (or press Enter to skip):")
   * }
   * ```
   */
  private async waitForUserInput(): Promise<string | null> {
    return null
  }
}

export interface RoundtableResult {
  minutes: string
  messages: RoundtableMessage[]
  roundCount: number
  consensusReached: boolean
}
```

##### 默认角色配置

圆桌讨论不要求固定角色组合，但提供默认适配：

```typescript
// packages/orchestrator/src/roundtable/default-participants.ts

import type { RoundtableParticipant } from "./roundtable-session"

/**
 * 默认圆桌角色
 *
 * 基于 oh-my-opencode 已有 Agent 的能力特征映射为讨论角色。
 * 用户可在配置中覆盖角色或添加自定义角色。
 */
export const DEFAULT_ROUNDTABLE_PARTICIPANTS: RoundtableParticipant[] = [
  {
    name: "架构师",
    agent: "oracle",
    perspective: "关注系统架构、技术选型、依赖管理、可扩展性。倾向于从全局视角审视方案，警惕过度设计。",
  },
  {
    name: "实现者",
    agent: "hephaestus",
    perspective: "关注代码实现可行性、工程复杂度、开发效率。倾向于务实的最小方案，警惕理论过于美好。",
  },
  {
    name: "审查者",
    agent: "momus",
    perspective: "关注风险、边界情况、兼容性、安全性。倾向于找出方案的漏洞和潜在问题。",
  },
  {
    name: "研究员",
    agent: "librarian",
    perspective: "关注业界最佳实践、最新技术趋势、相关论文/文档。带来外部知识视角。",
  },
]
```

##### 模式二：Plan（结构化规划）

沿用现有 Prometheus 规划流程，但增加**可选的圆桌纪要输入**：

```typescript
// packages/orchestrator/src/plan-build/plan-pipeline.ts（改动部分）

export interface PlanPipelineInput {
  userRequest: string
  /** 圆桌讨论纪要（如有） */
  roundtableMinutes?: string
}

export async function runPlanPipeline(input: PlanPipelineInput): Promise<PlanResult> {
  // 1. Metis 预分析（注入圆桌纪要作为上下文）
  const metisPrompt = input.roundtableMinutes
    ? `圆桌讨论纪要:\n${input.roundtableMinutes}\n\n用户请求: ${input.userRequest}`
    : input.userRequest

  const analysis = await dispatch({ subagent: "metis", prompt: metisPrompt, mode: "sync" })

  // 2. Prometheus 规划（有圆桌纪要时可跳过 Interview 阶段）
  const prometheusPrompt = input.roundtableMinutes
    ? `基于以下讨论共识直接生成计划（跳过需求访谈）:\n${analysis.output}`
    : analysis.output

  const plan = await dispatch({ subagent: "prometheus", prompt: prometheusPrompt, mode: "sync" })

  // 3. Momus 审查
  const review = await dispatch({ subagent: "momus", prompt: plan.output, mode: "sync" })

  return { plan: plan.output, review: review.output }
}
```

##### 模式三：Build（执行）

不变，沿用 Atlas 并行执行引擎。

#### 10.1.3 三模式 vs 二模式对比

| 维度 | 二模式 (Plan / Build) | 三模式 (圆桌 / Plan / Build) |
|------|----------------------|------------------------------|
| **进入复杂任务的路径** | 直接 Plan | 可选先圆桌讨论，再 Plan |
| **多视角碰撞** | Prometheus 独自分析 | 多 Agent 在同一上下文中对话 |
| **用户参与时机** | Plan 阶段的 Interview 环节 | 圆桌阶段即可深度参与 |
| **方向判断** | 隐含在 Prometheus 的规划中 | 显式在圆桌中探索和排除 |
| **Plan 阶段耗时** | 需要 Interview（用户来回 ~3-5 轮） | 如有圆桌纪要可跳过 Interview |
| **总延迟** | 较短（直接规划） | 可能更长（多一个讨论阶段） |
| **适合场景** | 需求清晰的任务 | 需求模糊、有多种可行方向的任务 |
| **Agent token 消耗** | 较低 | 较高（多角色发言） |
| **实现复杂度** | 较低 | 中等（新增圆桌引擎） |

#### 10.1.4 流程衔接设计

```
用户输入
  │
  ▼
Sisyphus Intent Gate
  │
  ├── 检测到需求明确的复杂任务 ──────────────→ Plan 模式
  │   (例: "用 JWT 替换 Session 认证")
  │
  ├── 检测到需求模糊的开放任务 ──────────────→ 圆桌脑暴
  │   (例: "帮我想想怎么优化用户体验")
  │   (例: "认证系统需要改进，有什么建议")
  │
  ├── 用户显式命令 /roundtable ──────────────→ 圆桌脑暴
  │   用户显式命令 /plan ────────────────────→ Plan 模式
  │   用户显式命令 /build ───────────────────→ Build 模式
  │
  └── 简单任务 ──────────────────────────────→ 直接执行

圆桌脑暴完成后:
  │
  ├── 自动流转 → Plan 模式（注入讨论纪要）
  │   └── 如讨论已达共识 → Prometheus 跳过 Interview，直接规划
  │
  └── 用户拿走纪要手动处理
      └── 后续可 /plan --minutes={file} 手动注入

Plan 完成后:
  │
  ├── 用户确认 → Build 模式 (/start-work)
  └── 用户修改 → 回到 Plan 或圆桌
```

#### 10.1.5 关键词触发与意图检测

```typescript
// packages/orchestrator/src/roundtable/intent-keywords.ts

/** 圆桌模式触发词 */
export const ROUNDTABLE_TRIGGER_PATTERNS = [
  /\b(讨论|brainstorm|头脑风暴|想想|思考一下|商量|探讨)\b/i,
  /\b(有什么建议|什么方案好|怎么做比较好|哪种方式|有哪些选择)\b/i,
  /\b(利弊|权衡|tradeoff|trade-off|pros.?cons)\b/i,
  /\b(discuss|think about|consider|what.?if|options?)\b/i,
]

/** Plan 模式触发词（现有） */
export const PLAN_TRIGGER_PATTERNS = [
  /\b(plan|规划|制定计划|refactor|redesign|architect)\b/i,
  /\b(重构|重新设计|迁移|migration)\b/i,
]

/**
 * 判断是否应进入圆桌而非直接 Plan
 *
 * 启发式规则：
 * 1. 匹配圆桌触发词 → 圆桌
 * 2. 匹配 Plan 触发词但请求中包含不确定性表达 → 圆桌
 * 3. 匹配 Plan 触发词且需求明确 → Plan
 * 4. 都不匹配 → 直接执行
 */
export function detectMode(input: string): "roundtable" | "plan" | "direct" {
  const hasRoundtable = ROUNDTABLE_TRIGGER_PATTERNS.some(p => p.test(input))
  const hasPlan = PLAN_TRIGGER_PATTERNS.some(p => p.test(input))
  const hasUncertainty = /不确定|不太清楚|maybe|not sure|还没想好|看看/.test(input)
  /** 否定词排除——"不想讨论"、"不用讨论"、"别讨论了" 不应触发圆桌 */
  const hasNegation = /不想|不用|不要|别|不需要|don'?t|no need/.test(input)

  if (hasRoundtable && !hasNegation) return "roundtable"
  if (hasPlan && hasUncertainty) return "roundtable"
  if (hasPlan) return "plan"
  return "direct"
}
```

#### 10.1.6 实现路径评估

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| **Phase A** | `RoundtableSession` 核心引擎 + 默认角色 | ~3 天 |
| **Phase B** | `/roundtable` 命令 + 意图检测集成 | ~2 天 |
| **Phase C** | 纪要→Plan 流转 + Prometheus Interview 跳过逻辑 | ~2 天 |
| **Phase D** | TUI 圆桌讨论 UI（多角色气泡、高亮标记） | ~3 天 |
| **Phase E** | 配置化（自定义角色、轮数、触发词） | ~1 天 |
| **合计** | | ~11 天 |

**风险与开放问题**：

1. **Token 成本控制**：每轮 4 个角色 × 200 字 × N 轮——3 轮讨论约消耗 ~15k token，可接受；10 轮可能 ~50k，需要控制
2. **讨论质量**：LLM 扮演不同角色时是否真能产生有价值的视角碰撞？需要实测。风险是退化为"同一模型换四种语气说同一句话"
3. **用户耐心**：用户可能不愿等待多轮 AI 互相讨论——需要良好的 UI 提示和随时中断能力
4. **与 Metis 的重叠**：Metis 已有"预分析"职能，圆桌是否让 Metis 变得多余？建议：Metis 仍负责信息收集（代码搜索/文档检索），圆桌负责方向讨论。两者互补而非替代
5. **多模型混合**：如果不同角色使用不同模型（如架构师用 Claude Opus、实现者用 GPT-5.3），视角差异可能更真实——但延迟和成本也更高

**结论**：三模式方案是**值得实验的增强**，建议作为 Extension 实现（而非核心模块），在 Phase 5 或更后期的里程碑中试验。路径依赖为零——即使圆桌模式效果不佳，Plan/Build 仍完全可用。

### 10.2~10.4 详细设计已迁移至 A 分册

为降低主提案长度并提高维护效率，以下章节的完整实现细节已迁移：

- 10.2 实时日志推送系统
- 10.3 开发调试可视化界面（DevTools Inspector）
- 10.4 Agent 断点与步进调试系统

请参考分册文档：

- [10A 分册：Inspector 与断点系统](part10-booklets/10a-inspector-breakpoints.md)

主提案仅保留架构决策与跨模块关系，详细接口、流程图、示例代码以分册为准。

### 10.5~10.6 详细设计已迁移至 B 分册

为降低主提案长度并提高维护效率，以下章节的完整实现细节已迁移：

- 10.5 自主 Agent 合成：需求驱动的动态 Agent 创建与编排
- 10.5.15 试验性特性的配置 Schema
- 10.6 单向数据流与上行反馈：Agent 的异常冒泡与重规划机制（含 10.6.16 协商）

请参考分册文档：

- [10B 分册：动态 Agent 与上行反馈](part10-booklets/10b-dynamic-agents-escalation.md)

主提案仅保留架构决策与跨模块关系，详细接口、流程图、示例代码以分册为准。

### 10.8~10.10 详细设计已迁移至 C 分册

为降低主提案长度并提高维护效率，以下章节的完整实现细节已迁移：

- 10.8 性能基准指标
- 10.9 试验性特性的测试策略
- 10.10 Part 4 核心流程的错误与重试路径

请参考分册文档：

- [10C 分册：验证、测试与 SLO](part10-booklets/10c-validation-testing-slo.md)

主提案仅保留架构决策与跨模块关系，详细接口、流程图、示例代码以分册为准。


---

## 总结

vitamin-coding-agent 的核心设计思路是：

1. **架构借鉴 pi-mono**：分层包设计确保每层可独立使用，极简 Agent 核心保持清晰
2. **功能继承 oh-my-opencode**：11 Agent 矩阵、Plan/Build、Category→Model、46 Hook、26 工具、三层 MCP——全部保留
3. **独创性整合**：
   - 统一调度总线（Task Dispatcher）统一 category/subagent/background 三种路由
   - 双模式扩展系统（Hook 数据流拦截 + Extension UI 控制）合二为一
   - 增量压缩策略（保留近期原文 + 增量摘要旧消息）
   - Session 树 + 依赖拓扑并行执行
   - SDK-first 设计（CLI/Web/RPC 多前端）

最终目标：**像 pi-mono 一样轻量可组合，像 oh-my-opencode 一样开箱即用**。
