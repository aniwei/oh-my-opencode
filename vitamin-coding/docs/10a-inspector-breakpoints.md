# 10A 分册：Inspector 与断点系统

> **来源**：从主提案迁移  
> **范围**：10.2 日志推送 · 10.3 Inspector · 10.4 断点  
> **返回主提案**：[← 主提案 10.0 导航](10-experimental.md)

---

## 范围

- 10.2 实时日志推送系统
- 10.3 DevTools Inspector
- 10.4 Agent 断点与步进调试

## 已迁移正文（来源：主提案 10.2~10.4）

> 说明：以下内容从主提案迁移而来，作为 A 分册的实施细节基线。后续以本分册为细节维护主入口。

### 10.2 实时日志推送系统

#### 10.2.1 当前方案的日志缺口

第九部分（9.5 节）设计了完整的**日志生产与收集存储**链路：

```
Agent 循环 → pino JSON → stdout → Promtail → Loki → Grafana 查询
                                                         ↑
                                             只有 pull（拉取查询），没有 push（推送）
```

缺失的关键环节是**实时日志消费**——Web 前端、SDK 客户端、调试面板如何实时收到 Agent 正在发生的事情？Grafana 是运维查询工具，不适合做终端用户的实时日志推送。

#### 10.2.2 实时日志通道设计

```
┌────────────────────────────────────────────────────────────────────┐
│                    vitamin Server                                  │
│                                                                    │
│  Agent Loop ──→ AgentEvent 事件流                                  │
│       │                │                                           │
│       │         ┌──────▼───────┐                                   │
│       │         │ LogBroadcast │ ← 接收所有 AgentEvent + pino 日志 │
│       │         │    Hub       │                                   │
│       │         └──┬───────┬───┘                                   │
│       │            │       │                                       │
│       │    ┌───────▼──┐ ┌──▼──────────┐                            │
│       │    │  按 session│ │  按 userId  │   ← 隔离 + 过滤           │
│       │    │  分发通道  │ │  分发通道   │                            │
│       │    └───┬───┬──┘ └──┬──────────┘                            │
│       │        │   │       │                                       │
│  ┌────▼────┐   │   │   ┌───▼────┐                                  │
│  │  pino   │   │   │   │ Redis  │  ← Pub/Sub 频道                  │
│  │→stdout  │   │   │   │Pub/Sub │    (跨进程广播，未来扩容预留)      │
│  └─────────┘   │   │   └────────┘                                  │
│                │   │                                               │
└────────────────┼───┼───────────────────────────────────────────────┘
                 │   │
          ┌──────▼┐ ┌▼───────┐
          │  SSE  │ │WebSocket│    ← 客户端选择传输协议
          │端点   │ │端点     │
          └───────┘ └────────┘
```

#### 10.2.3 LogBroadcastHub 核心实现

```typescript
// packages/server/src/log-broadcast-hub.ts

import { EventEmitter } from "node:events"
import type { AgentEvent } from "@vitamin/agent"

/**
 * 日志广播中枢
 *
 * 汇集 Agent 运行时事件和 pino 日志，按 session/user 分发给订阅者。
 * 单实例模式下直接内存广播；未来多实例可接入 Redis Pub/Sub。
 */
export class LogBroadcastHub {
  private emitter = new EventEmitter()
  /** 活跃订阅者计数（监控用） */
  private subscriberCount = 0

  constructor(private maxListeners = 1000) {
    this.emitter.setMaxListeners(maxListeners)
  }

  /**
   * 发布事件（由 Agent 循环调用）
   */
  publish(event: LogEvent): void {
    // 全局频道
    this.emitter.emit("log:*", event)
    // 按 session 频道
    if (event.sessionId) {
      this.emitter.emit(`log:session:${event.sessionId}`, event)
    }
    // 按 user 频道
    if (event.userId) {
      this.emitter.emit(`log:user:${event.userId}`, event)
    }
  }

  /**
   * 订阅指定 session 的日志流
   */
  subscribe(filter: LogFilter): LogSubscription {
    const channel = filter.sessionId
      ? `log:session:${filter.sessionId}`
      : filter.userId
        ? `log:user:${filter.userId}`
        : "log:*"

    const listeners: Array<(event: LogEvent) => void> = []
    this.subscriberCount++
    let subscriberActive = true

    // 闭包捕获——避免 generator 内 this 指向返回对象而非 LogBroadcastHub
    const emitter = this.emitter
    const decrementSubscribers = () => {
      if (!subscriberActive) return
      subscriberActive = false
      this.subscriberCount--
    }

    return {
      /** 异步迭代器——适配 SSE/WebSocket 推送 */
      async *[Symbol.asyncIterator]() {
        const queue: LogEvent[] = []
        let resolve: (() => void) | null = null

        const handler = (event: LogEvent) => {
          if (matchesFilter(event, filter)) {
            queue.push(event)
            resolve?.()
          }
        }

        emitter.on(channel, handler)
        listeners.push(handler)

        try {
          while (true) {
            if (queue.length > 0) {
              yield queue.shift()!
            } else {
              await new Promise<void>(r => { resolve = r })
            }
          }
        } finally {
          emitter.off(channel, handler)
          decrementSubscribers()
        }
      },

      unsubscribe: () => {
        for (const handler of listeners) {
          emitter.off(channel, handler)
        }
        decrementSubscribers()
      },
    }
  }

  get activeSubscribers(): number {
    return this.subscriberCount
  }
}

export interface LogEvent {
  timestamp: number
  sessionId?: string
  userId?: string
  /** 事件来源 */
  source: "agent" | "tool" | "hook" | "extension" | "system"
  /** 日志级别 */
  level: "debug" | "info" | "warn" | "error"
  /** Agent 事件（如有） */
  agentEvent?: AgentEvent
  /** 结构化日志内容 */
  message: string
  /** 附加数据 */
  data?: Record<string, unknown>
}

export interface LogFilter {
  sessionId?: string
  userId?: string
  /** 最低日志级别 */
  minLevel?: "debug" | "info" | "warn" | "error"
  /** 只看特定来源 */
  sources?: LogEvent["source"][]
}

export interface LogSubscription {
  [Symbol.asyncIterator](): AsyncIterableIterator<LogEvent>
  unsubscribe(): void
}

function matchesFilter(event: LogEvent, filter: LogFilter): boolean {
  const levels = ["debug", "info", "warn", "error"]
  if (filter.minLevel && levels.indexOf(event.level) < levels.indexOf(filter.minLevel)) {
    return false
  }
  if (filter.sources?.length && !filter.sources.includes(event.source)) {
    return false
  }
  return true
}
```

#### 10.2.4 SSE 端点

```typescript
// packages/server/src/routes/log-stream.ts

import type { Request, Response } from "express"
import type { LogBroadcastHub } from "../log-broadcast-hub"

/**
 * GET /api/sessions/:sessionId/logs/stream
 *
 * SSE 端点——实时推送指定 session 的日志事件。
 * 选择 SSE 而非 WebSocket：
 * - SSE 天然适合"服务器到客户端单向推送"
 * - 自动重连（EventSource 规范）
 * - HTTP/2 下多路复用，无需额外端口
 * - WebSocket 做双向通道已有（对话消息），日志用 SSE 职责更清晰
 */
export function createLogStreamRoute(hub: LogBroadcastHub) {
  return async (req: Request, res: Response) => {
    const { sessionId } = req.params
    const userId = req.user?.id  // 从认证中间件获取
    const minLevel = (req.query.level as string) ?? "info"
    const sources = req.query.sources
      ? (req.query.sources as string).split(",") as LogEvent["source"][]
      : undefined

    // 权限校验：只能查看自己 session 的日志
    if (!await verifySessionAccess(userId, sessionId)) {
      return res.status(403).json({ error: "Forbidden" })
    }

    // SSE 头
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.setHeader("X-Accel-Buffering", "no")  // Nginx 禁用缓冲
    res.flushHeaders()

    const subscription = hub.subscribe({
      sessionId,
      userId,
      minLevel: minLevel as LogFilter["minLevel"],
      sources,
    })

    // 推送事件
    const iterator = subscription[Symbol.asyncIterator]()
    const pump = async () => {
      try {
        while (true) {
          const { value, done } = await iterator.next()
          if (done) break
          res.write(`event: log\ndata: ${JSON.stringify(value)}\n\n`)
        }
      } catch {
        // 连接关闭
      }
    }

    pump()

    // 客户端断开时清理
    req.on("close", () => {
      subscription.unsubscribe()
    })
  }
}
```

#### 10.2.5 日志回放接口

```typescript
// packages/server/src/routes/log-replay.ts

/**
 * GET /api/sessions/:sessionId/logs?from=&to=&level=&limit=
 *
 * 从 Loki / PostgreSQL 查询历史日志（非实时）。
 * 用途：
 * - 调试面板加载时拉取"错过的"日志
 * - 事后分析某次 Agent 执行的完整日志
 */
export interface LogReplayQuery {
  sessionId: string
  from?: Date
  to?: Date
  level?: "debug" | "info" | "warn" | "error"
  sources?: string[]
  limit?: number       // 默认 500
  cursor?: string      // 分页游标
}

export interface LogReplayResult {
  logs: LogEvent[]
  nextCursor?: string
  totalEstimate?: number
}
```

#### 10.2.6 pino 接入 LogBroadcastHub

```typescript
// packages/shared/src/logger.ts（新增 transport）

import pino from "pino"
import type { LogBroadcastHub, LogEvent } from "@vitamin/server"

/**
 * 创建 pino → LogBroadcastHub 的桥接 transport
 *
 * 让所有 pino.info() / pino.error() 的日志同时：
 * 1. 输出到 stdout（容器日志收集）
 * 2. 推送到 LogBroadcastHub（实时推送给客户端）
 */
export function createBroadcastTransport(hub: LogBroadcastHub, sessionId?: string, userId?: string) {
  return pino.transport({
    targets: [
      // stdout（默认）
      { target: "pino/file", options: { destination: 1 } },
      // LogBroadcastHub（自定义 transport）
      {
        target: "./pino-broadcast-transport",
        options: { hub, sessionId, userId },
      },
    ],
  })
}
```

### 10.3 开发调试可视化界面（DevTools Inspector）

#### 10.3.1 设计动机

开发和调试 Agent 应用时，开发者需要观察的数据远超普通 Web 应用：

| 调试需求 | 传统 Web 应用 | Agent 应用 |
|---------|-------------|-----------|
| 请求/响应 | HTTP 单次请求 | **多轮对话 + 流式输出 + 工具调用链** |
| 状态 | React/Vue state | **Agent 状态机 × N 个 Agent 并行** |
| 日志 | console.log | **结构化日志 + 思考日志 + 工具输出** |
| 性能 | Network timing | **Token 消耗 + 模型延迟 + 工具执行耗时** |
| 上下文 | 无 | **System Prompt + 消息历史 + 压缩记录** |

现有调试方式是看 `/tmp/vitamin.log` 文件或 Grafana 面板——效率低下且缺乏实时性。需要一个**类似 Chrome DevTools 的专用调试界面**。

#### 10.3.2 Inspector 架构总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DevTools Inspector (Web UI)                      │
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Session  │ │  Agent   │ │ Message  │ │  Tools   │ │  Logs    │     │
│  │ Explorer │ │ Monitor  │ │ Inspector│ │ Timeline │ │ Console  │     │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘     │
│       │            │            │            │            │             │
│       └────────────┴────────────┴────────────┴────────────┘             │
│                                    │                                    │
│                           ┌────────▼────────┐                           │
│                           │  InspectorStore  │ ← 前端状态管理           │
│                           └────────┬────────┘                           │
│                                    │                                    │
│                           SSE (日志) + WebSocket (双向)                  │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────┐
│                        vitamin Server                                   │
│                                    │                                    │
│                           ┌────────▼────────┐                           │
│                           │ Inspector API   │                           │
│                           │ (HTTP + WS)     │                           │
│                           └────────┬────────┘                           │
│                                    │                                    │
│    ┌───────────┬───────────┬───────┴──────┬───────────┬──────────┐     │
│    │ Session   │ Agent     │ Log          │ Tool      │ System   │     │
│    │ Storage   │ Registry  │ Broadcast    │ Registry  │ Prompt   │     │
│    │           │           │ Hub          │           │ Store    │     │
│    └───────────┴───────────┴──────────────┴───────────┴──────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 10.3.3 Inspector API 端点

```typescript
// packages/server/src/inspector/inspector-api.ts

/**
 * DevTools Inspector 后端 API
 *
 * 设计原则：
 * - 只读为主（不修改 Agent 运行状态，避免调试干扰执行）
 * - 少量写操作（发送 steer 消息、调整日志级别）标记为 "dangerous"
 * - 仅在开发模式（NODE_ENV !== "production"）启用
 * - 可通过配置 inspector.enabled: false 完全禁用
 */

// ── Session 观察 ──

/** GET /api/inspector/sessions — 列出所有活跃 session */
interface ListSessionsResponse {
  sessions: SessionSummary[]
}
interface SessionSummary {
  id: string
  userId: string
  createdAt: number
  /** 当前活跃 Agent 数量 */
  activeAgentCount: number
  /** 消息总数 */
  messageCount: number
  /** 当前状态 */
  status: "active" | "idle" | "completed" | "error"
  /** 最后活动时间 */
  lastActivityAt: number
}

/** GET /api/inspector/sessions/:id — 完整 session 详情 */
interface SessionDetailResponse {
  session: SessionSummary
  /** 完整对话历史（含系统消息） */
  messages: InspectorMessage[]
  /** Session 树结构（分支信息） */
  tree: SessionTree
  /** 已执行的压缩记录 */
  compactions: CompactionRecord[]
}

interface InspectorMessage {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  /** 思考日志（extended thinking） */
  thinking?: string
  /** 如果是助手消息，包含工具调用 */
  toolCalls?: ToolCallDetail[]
  /** 如果是工具结果，关联的工具调用 ID */
  toolCallId?: string
  timestamp: number
  /** Token 使用 */
  tokenUsage?: { input: number; output: number; cacheRead: number }
  /** 所属 Agent */
  agentId?: string
}

// ── Agent 观察 ──

/** GET /api/inspector/sessions/:id/agents — 当前 session 中所有 Agent */
interface ListAgentsResponse {
  agents: AgentSnapshot[]
}
interface AgentSnapshot {
  id: string
  name: string
  /** Agent 类型 */
  type: "primary" | "subagent"
  /** 当前状态 */
  status: "idle" | "streaming" | "tool_executing" | "completed" | "error" | "aborted"
  /** 使用的模型 */
  model: { id: string; provider: string; name: string }
  /** Category */
  category: string
  /** 工具白名单 */
  enabledTools: string[]
  /** 累计 Token */
  tokenUsage: { input: number; output: number; cacheRead: number }
  /** 轮次计数 */
  turnCount: number
  /** 当前 system prompt（可能很长，按需展开） */
  systemPromptPreview: string
  /** 子 Agent 关系 */
  parentAgentId?: string
  childAgentIds: string[]
}

/** GET /api/inspector/sessions/:id/agents/:agentId — 单个 Agent 完整快照 */
interface AgentDetailResponse {
  agent: AgentSnapshot
  /** 完整 system prompt */
  systemPrompt: string
  /** 当前消息队列（含 steering/followUp） */
  pendingMessages: InspectorMessage[]
  /** Agent 配置 */
  config: {
    thinkingLevel: string
    maxTurns: number
    toolExecutionMode: "sequential" | "parallel"
    permissions: Record<string, boolean>
  }
  /** 运行时间线 */
  timeline: AgentTimelineEvent[]
}

interface AgentTimelineEvent {
  timestamp: number
  type: "turn_start" | "turn_end" | "tool_call" | "tool_result" | "steer" | "error" | "status_change"
  detail: Record<string, unknown>
  durationMs?: number
}

// ── System Prompt 观察 ──

/** GET /api/inspector/sessions/:id/agents/:agentId/system-prompt */
interface SystemPromptResponse {
  /** 最终组装的 system prompt */
  assembled: string
  /** 组成部分拆解 */
  parts: SystemPromptPart[]
}
interface SystemPromptPart {
  source: "base" | "agent-identity" | "tool-instructions" | "rules" | "hook-injection" | "skill" | "custom"
  label: string
  content: string
  /** 该部分占 prompt 总 token 的比例 */
  tokenRatio: number
}

// ── 工具执行观察 ──

/** GET /api/inspector/sessions/:id/tools — 工具执行历史 */
interface ToolExecutionHistory {
  executions: ToolExecution[]
  /** 工具调用统计 */
  stats: {
    totalCalls: number
    totalDurationMs: number
    byTool: Record<string, { calls: number; avgDurationMs: number; errors: number }>
  }
}
interface ToolExecution {
  id: string
  tool: string
  agentId: string
  args: Record<string, unknown>
  result: { content: string; isError: boolean }
  durationMs: number
  timestamp: number
  /** 被哪些 Hook 拦截/修改 */
  hookInterventions: Array<{ hook: string; action: "modified" | "blocked" | "passed" }>
}

// ── 思考日志 ──

/** GET /api/inspector/sessions/:id/thinking — 所有思考日志 */
interface ThinkingLogResponse {
  entries: ThinkingEntry[]
}
interface ThinkingEntry {
  agentId: string
  agentName: string
  turnIndex: number
  /** 完整思考内容（extended thinking） */
  thinking: string
  /** 思考 token 数 */
  thinkingTokens: number
  timestamp: number
}

// ── 实时日志（整合 10.2 的 LogBroadcastHub） ──

/**
 * GET /api/inspector/sessions/:id/logs/stream  → SSE
 * GET /api/inspector/sessions/:id/logs         → 历史回放
 *
 * （复用 10.2 节的 LogBroadcastHub + LogReplay）
 */

// ── 少量写操作（标记 dangerous） ──

/** POST /api/inspector/sessions/:id/agents/:agentId/steer — 注入 steering 消息 */
interface SteerRequest {
  message: string
}

/** PUT /api/inspector/sessions/:id/log-level — 动态调整日志级别 */
interface SetLogLevelRequest {
  level: "debug" | "info" | "warn" | "error"
}
```

#### 10.3.4 前端面板设计

```
┌─────────────────────────────────────────────────────────────────────────┐
│  vitamin DevTools Inspector                              [Session: a3f] │
├───────────┬─────────────────────────────────────────────────────────────┤
│           │                                                             │
│ Sessions  │  ┌─ Agent Monitor ───────────────────────────────────────┐  │
│           │  │                                                       │  │
│ ● a3f2... │  │  Sisyphus [streaming]    Model: claude-opus-4-6       │  │
│   active  │  │  ├─ Turn 3 / Token: 12.4k in, 3.2k out              │  │
│           │  │  │                                                    │  │
│ ○ b7c1... │  │  Hephaestus [idle]       Model: claude-sonnet-4-6    │  │
│   idle    │  │  ├─ Turn 1 / Token: 2.1k in, 0.8k out               │  │
│           │  │  │                                                    │  │
│ ◉ d9e5... │  │  Atlas [tool_executing]  Model: gpt-5.3-codex        │  │
│   completed│  │  ├─ Turn 5 / Token: 45.2k in, 12.1k out            │  │
│           │  │  │  └─ Running: bash ("npm test")                     │  │
│           │  │  │     Duration: 4.2s...                              │  │
│           │  └──────────────────────────────────────────────────────┘  │
│           │                                                             │
│           │  ┌─ Tabs ────────────────────────────────────────────────┐  │
│           │  │ [Messages] [System Prompt] [Tools] [Thinking] [Logs] │  │
│           │  ├───────────────────────────────────────────────────────┤  │
│           │  │                                                       │  │
│           │  │  [Messages 面板]                                      │  │
│           │  │                                                       │  │
│           │  │  User: "Refactor auth to use JWT"                     │  │
│           │  │  ─────────────────────────────────                    │  │
│           │  │  Assistant (Sisyphus): "I'll analyze the..."          │  │
│           │  │    🔧 tool_call: bash("grep -r 'passport'")          │  │
│           │  │    📎 result: "./src/auth/passport.ts:..."            │  │
│           │  │    💭 thinking: "The codebase uses Passport.js..."    │  │
│           │  │  ─────────────────────────────────                    │  │
│           │  │  Assistant (Sisyphus): "I'll delegate to..."          │  │
│           │  │    🔧 tool_call: task(subagent: "hephaestus")        │  │
│           │  │                                                       │  │
│           │  └───────────────────────────────────────────────────────┘  │
│           │                                                             │
│           │  ┌─ Logs Console (实时) ─────────────────────────────────┐  │
│           │  │ 14:23:01 [info] [agent] Sisyphus turn 3 started      │  │
│           │  │ 14:23:02 [info] [tool]  bash: grep -r 'passport'     │  │
│           │  │ 14:23:03 [debug][hook]  file-guard: passed           │  │
│           │  │ 14:23:03 [info] [tool]  bash completed (1.2s)        │  │
│           │  │ 14:23:05 [info] [agent] task delegated to hephaestus │  │
│           │  │ 14:23:06 [warn] [agent] token usage 78% of limit     │  │
│           │  │ █ (live)                                              │  │
│           │  └───────────────────────────────────────────────────────┘  │
└───────────┴─────────────────────────────────────────────────────────────┘
```

**五个核心面板**：

| 面板 | 数据来源 | 更新方式 |
|------|---------|---------|
| **Session Explorer** | `GET /inspector/sessions` | 轮询 3s |
| **Agent Monitor** | `GET /inspector/sessions/:id/agents` | WebSocket 实时推送 AgentEvent（status_change, turn_start/end） |
| **Message Inspector** | `GET /inspector/sessions/:id` | WebSocket 推送新消息 |
| **System Prompt** | `GET /inspector/sessions/:id/agents/:agentId/system-prompt` | 按需加载 + Agent 切换时刷新 |
| **Tools Timeline** | `GET /inspector/sessions/:id/tools` | WebSocket 推送 tool_call_start/end |
| **Thinking Log** | `GET /inspector/sessions/:id/thinking` | WebSocket 推送 thinking_delta |
| **Logs Console** | `GET /inspector/sessions/:id/logs/stream` (SSE) | SSE 实时推送 |

#### 10.3.5 启动方式与安全限制

```typescript
// packages/server/src/inspector/inspector-config.ts

export interface InspectorConfig {
  /** 是否启用 Inspector（默认：仅 NODE_ENV !== "production" 时启用） */
  enabled: boolean
  /** Inspector 端口（独立于主 API 端口，避免暴露） */
  port: number  // 默认 9229（致敬 Node.js --inspect 端口）
  /** 允许访问的 IP（默认仅 127.0.0.1） */
  allowedHosts: string[]
  /** 是否需要认证 token */
  authToken?: string
}
```

**启动命令**：

```bash
# 开发模式自动启用
vitamin --inspect                    # 在 9229 端口启动 Inspector
vitamin --inspect=0.0.0.0:9230       # 指定地址和端口（远程调试）
vitamin --inspect --inspect-token=xxx # 带认证 token

# 浏览器打开
# → http://localhost:9229
```

**安全措施**：

- 生产环境**默认禁用**（`NODE_ENV === "production"` 时不注册路由）
- 仅监听 `127.0.0.1`（除非显式指定其他地址）
- 可选认证 token（远程调试场景必须设置）
- Inspector API **只读为主**，写操作标记 `dangerous` 且需要二次确认
- System Prompt 展示时**自动脱敏**（隐藏 API Key 等敏感变量）

#### 10.3.6 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| **前端框架** | React + Vite | 生态成熟，DevTools 类工具普遍选择 |
| **状态管理** | Zustand | 轻量，适合频繁实时更新的数据流 |
| **日志虚拟列表** | @tanstack/virtual | 万级日志条目不卡顿 |
| **JSON 展示** | react-json-view-lite | 展示 Agent 状态、工具参数等嵌套结构 |
| **代码高亮** | Shiki (Wasm) | 在 System Prompt 中高亮代码片段 |
| **SSE 客户端** | EventSource (原生) | 日志流，自动重连 |
| **WebSocket** | 原生 WebSocket | 双向通道，Agent 事件 + steer 操作 |
| **构建** | Vite，产物内嵌到 server 包 | 零外部依赖，`--inspect` 即可用 |

#### 10.3.7 实现路径与工作量

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| **Phase A** | Inspector API 后端（session/agent/tool 只读端点） | ~3 天 |
| **Phase B** | LogBroadcastHub + SSE 端点（10.2 节） | ~2 天 |
| **Phase C** | 前端骨架（Session Explorer + Agent Monitor） | ~3 天 |
| **Phase D** | Message Inspector + Thinking Log 面板 | ~2 天 |
| **Phase E** | System Prompt 分段展示 + Tools Timeline | ~2 天 |
| **Phase F** | Logs Console（虚拟列表 + 过滤 + 搜索） | ~2 天 |
| **Phase G** | 打包内嵌 + `--inspect` 启动集成 | ~1 天 |
| **合计** | | **~15 天** |

#### 10.3.8 与现有方案的关系

```
现有调试手段                          Inspector 增强
─────────────────                    ──────────────────
pino → /tmp/vitamin.log              → Logs Console（实时 + 过滤 + 搜索）
Grafana 查询面板                     → 替代（开发阶段无需部署 Loki 栈）
SDK: agent.on("event")               → Agent Monitor 可视化
console.log 手动调试                 → Message Inspector + Thinking Log
手动 curl API 查询                   → Session Explorer 一览全貌
无法看到 system prompt               → System Prompt 分段展示 + token 占比
无法追踪工具调用链                    → Tools Timeline（Gantt 图式展示）
```

**结论**：DevTools Inspector 是**高价值的开发者体验投资**。Agent 应用的调试复杂度远超传统应用，一个可视化调试面板可以显著降低开发门槛。建议在 Phase 3（核心功能完成后）开始开发 Phase A-B，Phase 5 完成全部面板。作为可选的 `--inspect` 特性，不影响主线启动流程。

### 10.4 Agent 断点与步进调试系统

#### 10.4.1 设计动机：为什么 Agent 需要断点

Chrome DevTools 的断点调试已是前端开发者的肌肉记忆——在代码行上点一下，程序暂停，检查变量，逐步执行。Agent 应用也需要类似的能力，但断点的粒度不是"代码行"，而是 **Agent 生命周期中的关键节点**。

**业界方案参考**：

| 框架 | 断点机制 | 设计模式 |
|------|---------|---------|
| **LangGraph** (`interrupt()`) | 在图节点内调用 `interrupt()` 暂停执行，通过 `Command(resume=...)` 恢复。支持 `interrupt_before` / `interrupt_after` 静态断点 | 基于异常抛出暂停 + Checkpointer 持久化状态 + 恢复时从节点头重新执行 |
| **LangSmith Studio** | 在 UI 上设置 static interrupt（`interrupt_before`/`interrupt_after`），可视化图节点暂停 | 编译时声明断点位置，运行时使用 Checkpointer |
| **AutoGen** (`UserProxyAgent`) | 插入 `UserProxyAgent` 代理人，团队调度到它时阻塞等待用户输入 | 通过特殊 Agent 实现暂停，`max_turns` 控制步进 |
| **CrewAI** (`human_input=True`) | Agent 配置 `human_input=True` 后每个任务完成前等待人类确认 | 任务级暂停 |
| **Chrome DevTools** | 行断点、条件断点、DOM 断点、XHR 断点、事件监听断点 | 调试引擎在运行时拦截，支持 step over/into/out |

vitamin 的设计目标是**融合 LangGraph 的 `interrupt` 模型和 Chrome DevTools 的可视化断点体验**——在 Agent 循环的关键位置设置断点，暂停执行，在 Inspector UI 上可视化地选择断点位置、检查状态、决定恢复方式。

#### 10.4.2 Agent 断点类型体系

参考 Chrome 的多种断点类型，为 Agent 生命周期定义对应的断点类型：

```typescript
// packages/server/src/inspector/breakpoints/breakpoint-types.ts

/**
 * Agent 断点类型
 *
 * 类比 Chrome DevTools:
 * - Line Breakpoint     → Agent Turn Breakpoint（每轮暂停）
 * - Conditional BP      → Conditional Breakpoint（条件满足时暂停）
 * - XHR Breakpoint      → LLM Call Breakpoint（LLM API 调用前暂停）
 * - DOM Breakpoint       → Tool Call Breakpoint（工具调用前/后暂停）
 * - Event Listener BP   → Agent Event Breakpoint（特定事件触发时暂停）
 */
export type Breakpoint =
  | TurnBreakpoint
  | ToolCallBreakpoint
  | LLMCallBreakpoint
  | AgentEventBreakpoint
  | ConditionalBreakpoint
  | AgentTransitionBreakpoint

/** 1. Turn 断点——在指定 Agent 的指定轮次暂停 */
export interface TurnBreakpoint {
  type: "turn"
  id: string
  enabled: boolean
  /** 触发位置 */
  timing: "before_turn" | "after_turn"
  /** 目标 Agent（"*" = 所有 Agent） */
  agentFilter: string | "*"
  /** 目标轮次（undefined = 每轮） */
  turnIndex?: number
  /** 描述（显示在 UI 上） */
  label?: string
}

/** 2. 工具调用断点——在工具调用前/后暂停 */
export interface ToolCallBreakpoint {
  type: "tool_call"
  id: string
  enabled: boolean
  /** 触发时机 */
  timing: "before_execute" | "after_execute"
  /** 目标工具名（"*" = 所有工具） */
  toolFilter: string | "*"
  /** 特定工具参数匹配（如 bash 命令包含 "rm"） */
  argsPattern?: Record<string, string>
  label?: string
}

/** 3. LLM 调用断点——在 LLM API 请求前/后暂停 */
export interface LLMCallBreakpoint {
  type: "llm_call"
  id: string
  enabled: boolean
  timing: "before_request" | "after_response"
  /** 目标模型（"*" = 所有模型） */
  modelFilter: string | "*"
  /** 可检查/修改 system prompt 和 messages（before_request 时） */
  inspectPayload: boolean
  label?: string
}

/** 4. Agent 事件断点——在特定 AgentEvent 触发时暂停 */
export interface AgentEventBreakpoint {
  type: "agent_event"
  id: string
  enabled: boolean
  /** 监听的事件类型 */
  eventType: AgentEventType
  /** 目标 Agent */
  agentFilter: string | "*"
  label?: string
}

type AgentEventType =
  | "status_change"
  | "error"
  | "compaction_needed"
  | "steering_injected"
  | "follow_up_start"
  | "abort"

/** 5. 条件断点——当条件表达式为 true 时暂停 */
export interface ConditionalBreakpoint {
  type: "conditional"
  id: string
  enabled: boolean
  /**
   * 条件表达式（JavaScript 表达式，在安全沙箱内求值）
   *
   * 可用变量：
   * - agent: 当前 Agent 快照
   * - turn: 当前轮次号
   * - tokenUsage: { input, output, cacheRead }
   * - lastMessage: 最新消息
   * - toolCallCount: 工具调用总数
   *
   * 示例：
   * - "tokenUsage.input > 50000"       — token 超过 50k 时暂停
   * - "agent.status === 'error'"        — Agent 出错时暂停
   * - "turn > 10"                       — 超过 10 轮时暂停
   * - "lastMessage.content.includes('TERMINATE')" — 包含特定文本时暂停
   */
  condition: string
  label?: string
}

/** 6. Agent 切换断点——在 Agent 委派/切换时暂停 */
export interface AgentTransitionBreakpoint {
  type: "agent_transition"
  id: string
  enabled: boolean
  /** 委派方式 */
  transitionType: "delegate_to_subagent" | "return_to_parent" | "background_spawn" | "*"
  /** 来源 Agent */
  fromAgent?: string
  /** 目标 Agent */
  toAgent?: string
  label?: string
}
```

#### 10.4.3 断点引擎核心实现

```typescript
// packages/server/src/inspector/breakpoints/breakpoint-engine.ts

import type { Breakpoint } from "./breakpoint-types"
import type { AgentEvent } from "@vitamin/agent"
import * as vm from "node:vm"

/**
 * 断点引擎
 *
 * 设计思路参考：
 * - LangGraph: interrupt() 抛异常暂停 + Checkpointer 持久化
 * - Chrome DevTools: V8 调试协议，断点命中时暂停执行线程
 *
 * vitamin 采用 **Promise 挂起模式**（而非 LangGraph 的异常 + 重执行模式）:
 * - 断点命中时创建一个 pending Promise
 * - Agent 循环 await 这个 Promise（自然暂停，不抛异常）
 * - Inspector UI 发送 resume 指令时 resolve Promise
 * - 不需要重新执行节点，状态完全保持在内存中
 *
 * 优势：比 LangGraph 的 "异常 + 从头重执行节点" 模式更简洁，
 * 不需要处理幂等性问题（LangGraph 的 interrupt 规则里 3 条都是为了解决重执行副作用）
 */
export class BreakpointEngine {
  private breakpoints: Map<string, Breakpoint> = new Map()
  /** 支持多 Agent 并行暂停（key = agentId 或 sessionId） */
  private pendingPauses: Map<string, PendingPause> = new Map()
  private stepMode: StepMode = "continue"
  private listeners = new Set<BreakpointEventListener>()

  /** 注册断点 */
  addBreakpoint(bp: Breakpoint): void {
    this.breakpoints.set(bp.id, bp)
    this.notify({ type: "breakpoint_added", breakpoint: bp })
  }

  /** 移除断点 */
  removeBreakpoint(id: string): void {
    this.breakpoints.delete(id)
    this.notify({ type: "breakpoint_removed", id })
  }

  /** 启用/禁用断点 */
  toggleBreakpoint(id: string, enabled: boolean): void {
    const bp = this.breakpoints.get(id)
    if (bp) {
      bp.enabled = enabled
      this.notify({ type: "breakpoint_toggled", id, enabled })
    }
  }

  /**
   * 检查点——Agent 循环在关键位置调用此方法
   *
   * 如果有匹配的断点且处于启用状态，返回一个 Promise，
   * Agent 循环 await 它后自然暂停。Inspector UI resume 后 resolve。
   */
  async checkpoint(context: CheckpointContext): Promise<ResumeAction> {
    // 步进模式检查
    if (this.stepMode !== "continue") {
      if (this.shouldPauseForStep(context)) {
        return this.pause(context, { reason: "step", stepMode: this.stepMode })
      }
    }

    // 断点匹配
    for (const bp of this.breakpoints.values()) {
      if (!bp.enabled) continue
      if (this.matches(bp, context)) {
        return this.pause(context, { reason: "breakpoint", breakpoint: bp })
      }
    }

    return { action: "continue" }
  }

  /**
   * 暂停执行
   *
   * 创建一个 Promise 并返回给调用者。
   * 调用者 (Agent 循环) await 后自然挂起。
   * Inspector UI 调用 resume() 后 resolve 这个 Promise。
   */
  private pause(context: CheckpointContext, reason: PauseReason): Promise<ResumeAction> {
    return new Promise<ResumeAction>((resolve) => {
      const pauseKey = context.agentId ?? context.sessionId ?? `anon-${Date.now()}`
      const pendingPause: PendingPause = {
        context,
        reason,
        resolve,
        pausedAt: Date.now(),
      }
      this.pendingPauses.set(pauseKey, pendingPause)
      this.notify({
        type: "paused",
        context,
        reason,
        snapshot: this.captureSnapshot(context),
      })
    })
  }

  /**
   * 恢复执行——由 Inspector UI 调用
   */
  resume(action: ResumeAction, pauseKey?: string): void {
    if (this.pendingPauses.size === 0) return

    if (pauseKey) {
      const pendingPause = this.pendingPauses.get(pauseKey)
      if (!pendingPause) return
      this.pendingPauses.delete(pauseKey)
      this.notify({ type: "resumed", action })
      pendingPause.resolve(action)
      return
    }

    const firstEntry = this.pendingPauses.entries().next().value as [string, PendingPause] | undefined
    if (!firstEntry) return
    const [firstKey, firstPause] = firstEntry
    this.pendingPauses.delete(firstKey)
    this.notify({ type: "resumed", action })
    firstPause.resolve(action)
  }

  /** 步进模式设置 */
  setStepMode(mode: StepMode): void {
    this.stepMode = mode
    if (mode !== "continue" && this.pendingPauses.size > 0) {
      for (const [pauseKey, pendingPause] of this.pendingPauses) {
        this.pendingPauses.delete(pauseKey)
        pendingPause.resolve({ action: "continue" })
      }
    }
  }

  /** 当前是否暂停中 */
  get isPaused(): boolean {
    return this.pendingPauses.size > 0
  }

  /** 获取暂停快照 */
  get pauseSnapshot(): PauseSnapshot | null {
    const firstPause = this.pendingPauses.values().next().value as PendingPause | undefined
    if (!firstPause) return null
    return this.captureSnapshot(firstPause.context)
  }

  private matches(bp: Breakpoint, ctx: CheckpointContext): boolean {
    switch (bp.type) {
      case "turn":
        return ctx.phase === bp.timing
          && (bp.agentFilter === "*" || ctx.agentId === bp.agentFilter)
          && (bp.turnIndex === undefined || ctx.turnIndex === bp.turnIndex)

      case "tool_call":
        return (ctx.phase === "before_tool_execute" && bp.timing === "before_execute"
            || ctx.phase === "after_tool_execute" && bp.timing === "after_execute")
          && (bp.toolFilter === "*" || ctx.toolName === bp.toolFilter)
          && (!bp.argsPattern || this.matchArgs(ctx.toolArgs, bp.argsPattern))

      case "llm_call":
        return (ctx.phase === "before_llm_request" && bp.timing === "before_request"
            || ctx.phase === "after_llm_response" && bp.timing === "after_response")
          && (bp.modelFilter === "*" || ctx.modelId === bp.modelFilter)

      case "agent_event":
        return ctx.phase === "agent_event"
          && ctx.eventType === bp.eventType
          && (bp.agentFilter === "*" || ctx.agentId === bp.agentFilter)

      case "conditional":
        return this.evaluateCondition(bp.condition, ctx)

      case "agent_transition":
        return ctx.phase === "agent_transition"
          && (bp.transitionType === "*" || ctx.transitionType === bp.transitionType)
          && (!bp.fromAgent || ctx.agentId === bp.fromAgent)
          && (!bp.toAgent || ctx.targetAgentId === bp.toAgent)
    }
  }

  private evaluateCondition(condition: string, ctx: CheckpointContext): boolean {
    try {
      // 使用 vm.runInNewContext 替代 new Function，提供受限执行环境
      const sandbox = Object.freeze({
        agent: ctx.agentSnapshot,
        turn: ctx.turnIndex,
        tokenUsage: ctx.tokenUsage,
        lastMessage: ctx.lastMessage,
        toolCallCount: ctx.toolCallCount,
      })
      const result = vm.runInNewContext(
        `"use strict"; (${condition})`,
        sandbox,
        { timeout: 100 },  // 100ms 超时保护
      )
      return !!result
    } catch {
      return false
    }
  }

  private matchArgs(args: Record<string, unknown> | undefined, pattern: Record<string, string>): boolean {
    if (!args) return false
    return Object.entries(pattern).every(([key, regex]) => {
      const value = String(args[key] ?? "")
      return new RegExp(regex).test(value)
    })
  }

  private shouldPauseForStep(ctx: CheckpointContext): boolean {
    switch (this.stepMode) {
      case "step_turn":
        return ctx.phase === "before_turn"
      case "step_tool":
        return ctx.phase === "before_tool_execute"
      case "step_llm":
        return ctx.phase === "before_llm_request"
      case "step_any":
        return true
      default:
        return false
    }
  }

  private captureSnapshot(ctx: CheckpointContext): PauseSnapshot {
    return {
      agentId: ctx.agentId,
      agentName: ctx.agentName,
      agentStatus: ctx.agentSnapshot?.status,
      model: ctx.modelId,
      turnIndex: ctx.turnIndex,
      tokenUsage: ctx.tokenUsage,
      phase: ctx.phase,
      toolName: ctx.toolName,
      toolArgs: ctx.toolArgs,
      messageCount: ctx.messageCount,
      systemPromptTokens: ctx.systemPromptTokens,
      timestamp: Date.now(),
    }
  }

  /** 事件通知 */
  onEvent(listener: BreakpointEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(event: BreakpointEvent): void {
    for (const listener of this.listeners) listener(event)
  }
}

// ── 类型定义 ──

/** 检查点上下文——Agent 循环在每个关键位置传入 */
export interface CheckpointContext {
  phase: CheckpointPhase
  sessionId: string
  agentId: string
  agentName: string
  agentSnapshot?: { status: string; [key: string]: unknown }
  turnIndex: number
  tokenUsage?: { input: number; output: number; cacheRead: number }
  lastMessage?: { role: string; content: string }
  messageCount: number
  systemPromptTokens?: number
  modelId?: string
  toolName?: string
  toolArgs?: Record<string, unknown>
  toolResult?: { content: string; isError: boolean }
  eventType?: string
  transitionType?: string
  targetAgentId?: string
  toolCallCount: number
}

type CheckpointPhase =
  | "before_turn" | "after_turn"
  | "before_tool_execute" | "after_tool_execute"
  | "before_llm_request" | "after_llm_response"
  | "agent_event"
  | "agent_transition"

/** 步进模式 */
export type StepMode =
  | "continue"       // 正常运行（不步进）
  | "step_turn"      // 每轮暂停（类似 Step Over）
  | "step_tool"      // 每个工具调用暂停（类似 Step Into）
  | "step_llm"       // 每个 LLM 调用暂停
  | "step_any"       // 每个检查点都暂停（最细粒度）

/** 恢复动作 */
export interface ResumeAction {
  action: "continue" | "skip_tool" | "modify_and_continue" | "abort"
  /** 修改后的工具参数（仅 modify_and_continue + before_tool_execute 时有效） */
  modifiedToolArgs?: Record<string, unknown>
  /** 修改后的 LLM messages（仅 modify_and_continue + before_llm_request 时有效） */
  modifiedMessages?: unknown[]
  /** 注入用户消息（类似 steering） */
  injectMessage?: string
}

interface PendingPause {
  context: CheckpointContext
  reason: PauseReason
  resolve: (action: ResumeAction) => void
  pausedAt: number
}

type PauseReason =
  | { reason: "breakpoint"; breakpoint: Breakpoint }
  | { reason: "step"; stepMode: StepMode }

export interface PauseSnapshot {
  agentId: string
  agentName: string
  agentStatus?: string
  model?: string
  turnIndex: number
  tokenUsage?: { input: number; output: number; cacheRead: number }
  phase: CheckpointPhase
  toolName?: string
  toolArgs?: Record<string, unknown>
  messageCount: number
  systemPromptTokens?: number
  timestamp: number
}

type BreakpointEvent =
  | { type: "breakpoint_added"; breakpoint: Breakpoint }
  | { type: "breakpoint_removed"; id: string }
  | { type: "breakpoint_toggled"; id: string; enabled: boolean }
  | { type: "paused"; context: CheckpointContext; reason: PauseReason; snapshot: PauseSnapshot }
  | { type: "resumed"; action: ResumeAction }

type BreakpointEventListener = (event: BreakpointEvent) => void
```

#### 10.4.4 Agent 循环集成

```typescript
// packages/agent/src/agent-loop.ts（断点集成部分）

import type { BreakpointEngine, CheckpointContext, ResumeAction } from "@vitamin/server/inspector"
import type { AgentEvent } from "./types"
import type { AiClient } from "@vitamin/ai"

/** Agent 循环配置（断点集成需要的部分） */
interface AgentLoopConfig {
  maxTurns: number
  model: string
  systemPrompt: string
  messages: unknown[]
  tools: unknown[]
}

/** Agent 循环运行状态（由外部注入或在循环开始时初始化） */
interface AgentLoopState {
  messages: unknown[]
  model: string
  systemPrompt: string
  tools: unknown[]
}

/** 依赖：AI 客户端和工具执行器由调用方注入 */
declare const state: AgentLoopState
declare const ai: AiClient
declare function buildContext(phase: string, params: Record<string, unknown>): CheckpointContext
declare function executeTool(name: string, args: Record<string, unknown>): Promise<unknown>

/**
 * Agent 循环中的断点检查点注入
 *
 * 在 Agent 循环的 6 个关键位置插入 checkpoint 调用：
 *
 *   Agent 循环:
 *     [1] checkpoint("before_turn")      ← 每轮开始前
 *         │
 *         ├─→ [2] checkpoint("before_llm_request")  ← LLM 调用前
 *         │        │
 *         │        └─ LLM 流式响应
 *         │
 *         ├─→ [3] checkpoint("after_llm_response")  ← LLM 返回后
 *         │
 *         ├─→ for each tool_call:
 *         │     [4] checkpoint("before_tool_execute") ← 工具执行前
 *         │          │
 *         │          └─ 执行工具
 *         │
 *         │     [5] checkpoint("after_tool_execute")  ← 工具执行后
 *         │
 *         └─→ [6] checkpoint("after_turn")            ← 每轮结束后
 *
 *   Agent 委派:
 *         [7] checkpoint("agent_transition")           ← Agent 切换时
 *
 * 每个 checkpoint 返回 ResumeAction，Agent 循环根据 action 决定：
 * - "continue"              → 继续正常执行
 * - "skip_tool"             → 跳过当前工具调用
 * - "modify_and_continue"   → 使用修改后的参数/消息继续
 * - "abort"                 → 中止当前 Agent
 */

async function agentLoopWithBreakpoints(
  config: AgentLoopConfig,
  breakpointEngine?: BreakpointEngine,
): AsyncGenerator<AgentEvent> {
  const bp = breakpointEngine

  for (let turn = 0; turn < config.maxTurns; turn++) {
    // [1] 轮次开始断点
    const turnAction = await bp?.checkpoint(buildContext("before_turn", { turn }))
    if (turnAction?.action === "abort") break

    // [2] LLM 请求前断点（可检查/修改 system prompt 和 messages）
    const llmAction = await bp?.checkpoint(buildContext("before_llm_request", { turn }))
    if (llmAction?.action === "abort") break

    const messages = llmAction?.modifiedMessages ?? state.messages

    // ── LLM 流式调用 ──
    const stream = ai.stream(state.model, {
      systemPrompt: state.systemPrompt,
      messages,
      tools: state.tools,
    })
    // ... stream processing ...

    // [3] LLM 响应后断点（可检查完整响应）
    await bp?.checkpoint(buildContext("after_llm_response", { turn }))

    // ── 工具调用 ──
    for (const toolCall of response.toolCalls) {
      // [4] 工具执行前断点（可检查/修改工具参数）
      const toolAction = await bp?.checkpoint(
        buildContext("before_tool_execute", { turn, toolName: toolCall.name, toolArgs: toolCall.args })
      )
      if (toolAction?.action === "skip_tool") continue
      if (toolAction?.action === "abort") break

      const args = toolAction?.modifiedToolArgs ?? toolCall.args

      // 执行工具
      const result = await executeTool(toolCall.name, args)

      // [5] 工具执行后断点（可检查结果）
      await bp?.checkpoint(
        buildContext("after_tool_execute", { turn, toolName: toolCall.name, toolResult: result })
      )
    }

    // [6] 轮次结束断点
    await bp?.checkpoint(buildContext("after_turn", { turn }))
  }
}
```

#### 10.4.5 Inspector 断点 API

```typescript
// packages/server/src/inspector/breakpoints/breakpoint-api.ts

// ── 断点 CRUD ──

/** GET /api/inspector/breakpoints — 列出所有断点 */
interface ListBreakpointsResponse {
  breakpoints: Breakpoint[]
}

/** POST /api/inspector/breakpoints — 创建断点 */
interface CreateBreakpointRequest {
  breakpoint: Omit<Breakpoint, "id">
}

/** PUT /api/inspector/breakpoints/:id — 更新断点 */
interface UpdateBreakpointRequest {
  breakpoint: Partial<Breakpoint>
}

/** DELETE /api/inspector/breakpoints/:id — 删除断点 */

/** PUT /api/inspector/breakpoints/:id/toggle — 启用/禁用 */
interface ToggleBreakpointRequest {
  enabled: boolean
}

// ── 执行控制 ──

/** POST /api/inspector/resume — 恢复执行 */
interface ResumeRequest {
  action: "continue" | "skip_tool" | "modify_and_continue" | "abort"
  modifiedToolArgs?: Record<string, unknown>
  modifiedMessages?: unknown[]
  injectMessage?: string
}

/** POST /api/inspector/step — 步进执行 */
interface StepRequest {
  mode: "step_turn" | "step_tool" | "step_llm" | "step_any"
}

/** GET /api/inspector/pause-state — 获取当前暂停状态 */
interface PauseStateResponse {
  isPaused: boolean
  snapshot?: PauseSnapshot
  reason?: PauseReason
  /** 暂停持续时间（ms） */
  pausedDurationMs?: number
}

// ── WebSocket 事件（实时推送断点状态变化） ──
type BreakpointWSEvent =
  | { type: "breakpoint:paused"; snapshot: PauseSnapshot; reason: PauseReason }
  | { type: "breakpoint:resumed"; action: ResumeAction }
  | { type: "breakpoint:added"; breakpoint: Breakpoint }
  | { type: "breakpoint:removed"; id: string }
```

#### 10.4.6 可视化断点选择界面

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  vitamin DevTools Inspector — Breakpoints                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ Agent 生命周期断点图 ──────────────────────────────────────────────┐     │
│  │                                                                     │     │
│  │          ┌───────────┐                                              │     │
│  │          │ Turn Start│ ← 🔴 点击设置断点                           │     │
│  │          └─────┬─────┘                                              │     │
│  │                │                                                    │     │
│  │          ┌─────▼─────┐                                              │     │
│  │          │ LLM Call  │ ← ⭕ 未设置                                 │     │
│  │          │ (Request) │                                              │     │
│  │          └─────┬─────┘                                              │     │
│  │                │                                                    │     │
│  │          ┌─────▼─────┐                                              │     │
│  │          │ LLM Call  │ ← 🔴 点击设置断点                           │     │
│  │          │ (Response)│                                              │     │
│  │          └─────┬─────┘                                              │     │
│  │                │                                                    │     │
│  │          ┌─────▼─────┐    ┌──────────────┐                          │     │
│  │          │ Tool Call │ ──→│ Tool Execute │ ← 🔴 bash("rm*") 条件  │     │
│  │          │ (Before)  │    │ (After)      │                          │     │
│  │          └─────┬─────┘    └──────────────┘                          │     │
│  │                │                                                    │     │
│  │          ┌─────▼─────┐                                              │     │
│  │          │ Turn End  │ ← ⭕ 未设置                                 │     │
│  │          └─────┬─────┘                                              │     │
│  │                │                                                    │     │
│  │          ┌─────▼──────────┐                                         │     │
│  │          │ Agent Delegate │ ← 🔴 → hephaestus 时暂停              │     │
│  │          └────────────────┘                                         │     │
│  │                                                                     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  ┌─ 断点列表 ──────────────────────────────────────────────────────────┐     │
│  │                                                                     │     │
│  │  ☑ 🔴 Turn Start — Agent: Sisyphus — 每轮暂停                     │     │
│  │  ☑ 🔴 LLM Response — Agent: * — 检查 LLM 返回                    │     │
│  │  ☑ 🔴 Tool Execute — bash — 参数匹配: command=/rm/               │     │
│  │  ☑ 🔴 Agent Transition — → hephaestus                            │     │
│  │  ☐ 🟡 Conditional — tokenUsage.input > 50000                      │     │
│  │  ☑ 🔴 Agent Event — error — Agent: *                             │     │
│  │                                                                     │     │
│  │  [+ 添加断点]  [全部禁用]  [全部清除]                              │     │
│  │                                                                     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  ┌─ 执行控制 ─────────────────────────────────────────────────────────┐     │
│  │                                                                     │     │
│  │  [▶ Resume]  [⏭ Step Turn]  [⏩ Step Tool]  [⏯ Step LLM]  [⏹ Abort]│     │
│  │                                                                     │     │
│  │  当前状态: ⏸ 已暂停于 Turn 3 / before_tool_execute                │     │
│  │  Agent: Sisyphus / Model: claude-opus-4-6                          │     │
│  │  Tool: bash / Args: { command: "npm test" }                         │     │
│  │  暂停时长: 12.3s                                                   │     │
│  │                                                                     │     │
│  │  ┌─ 暂停快照 ─────────────────────────────────────────┐            │     │
│  │  │ Agent Status: tool_executing                        │            │     │
│  │  │ Turn: 3 / Messages: 12                              │            │     │
│  │  │ Token Usage: 23.4k in, 8.2k out, 5.1k cache        │            │     │
│  │  │ System Prompt: 1.2k tokens                          │            │     │
│  │  │                                                     │            │     │
│  │  │ Tool Args (可编辑):                                 │            │     │
│  │  │ ┌─────────────────────────────────────────────┐     │            │     │
│  │  │ │ { "command": "npm test" }                   │ [✏] │            │     │
│  │  │ └─────────────────────────────────────────────┘     │            │     │
│  │  │                                                     │            │     │
│  │  │ [修改后继续]  [跳过此工具]  [注入消息]             │            │     │
│  │  └─────────────────────────────────────────────────────┘            │     │
│  │                                                                     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**界面三区域设计**：

| 区域 | 功能 | 交互方式 |
|------|------|---------|
| **Agent 生命周期图** | 可视化 Agent 循环流程，每个节点可点击切换断点 | 点击节点上的圆点（⭕/🔴）设置/移除断点，右键弹出配置面板 |
| **断点列表** | 所有已设置的断点，类似 Chrome 的 Breakpoints 面板 | 勾选框启用/禁用，双击编辑条件，右键删除 |
| **执行控制 + 暂停快照** | 命中断点后显示完整上下文，支持修改参数后继续 | 快捷键支持：F5(Resume) F10(Step Turn) F11(Step Tool) Shift+F11(Step LLM) |

#### 10.4.7 断点设置面板（右键弹出）

```
┌─ 设置断点 ──────────────────────────────────┐
│                                              │
│  断点类型: [Tool Call ▼]                     │
│                                              │
│  触发时机: ○ 执行前  ● 执行后               │
│                                              │
│  目标工具: [bash          ▼]                 │
│            ☐ 所有工具                        │
│                                              │
│  参数过滤 (正则):                            │
│  ┌────────────────────────────────────────┐  │
│  │ command: rm|sudo|chmod                 │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  目标 Agent: [Sisyphus     ▼]               │
│              ☐ 所有 Agent                    │
│                                              │
│  描述: [危险命令拦截___________________]     │
│                                              │
│  [确定]  [取消]                              │
└──────────────────────────────────────────────┘
```

```
┌─ 设置条件断点 ──────────────────────────────┐
│                                              │
│  断点类型: [Conditional ▼]                   │
│                                              │
│  条件表达式:                                 │
│  ┌────────────────────────────────────────┐  │
│  │ tokenUsage.input > 50000              │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  可用变量:                                   │
│  • agent   — Agent 快照 (status, name...)   │
│  • turn    — 当前轮次号                     │
│  • tokenUsage — { input, output, cacheRead }│
│  • lastMessage — 最新消息对象               │
│  • toolCallCount — 工具调用总数             │
│                                              │
│  预览: ✅ 表达式有效                         │
│                                              │
│  描述: [Token 超限预警____________]          │
│                                              │
│  [确定]  [取消]                              │
└──────────────────────────────────────────────┘
```

#### 10.4.8 与 Chrome DevTools 断点类型对照

| Chrome DevTools | vitamin Inspector | 映射说明 |
|----------------|------------------|---------|
| **Line Breakpoint** | Turn Breakpoint | 代码行 → Agent 轮次 |
| **Conditional BP** | Conditional Breakpoint | `if (x > 100)` → `tokenUsage.input > 50000` |
| **Logpoint** | — (使用 Logs Console 替代) | Chrome 的 Logpoint 不暂停只打印，vitamin 用实时日志替代 |
| **XHR/Fetch BP** | LLM Call Breakpoint | HTTP 请求 → LLM API 调用 |
| **DOM Breakpoint** | Tool Call Breakpoint | DOM 修改 → 文件/bash 操作 |
| **Event Listener BP** | Agent Event Breakpoint | DOM 事件 → Agent 事件 (error, abort, compaction) |
| **CSP Violation BP** | — (条件断点覆盖) | 安全策略 → 可通过条件表达式匹配 |
| **Exception BP** | Agent Event (error) | 未捕获异常 → Agent 错误 |
| **Step Over / Into / Out** | Step Turn / Step Tool / Step LLM | 代码步进粒度 → Agent 循环步进粒度 |

#### 10.4.9 与 LangGraph interrupt 的设计差异

| 维度 | LangGraph `interrupt()` | vitamin BreakpointEngine |
|------|------------------------|--------------------------|
| **暂停机制** | 抛异常 → Checkpointer 持久化 → 从节点头重新执行 | Promise 挂起 → 内存状态保持 → 原地恢复 |
| **状态持久化** | 必须 Checkpointer（数据库） | 内存中自然保持（Inspector 仅开发环境使用） |
| **副作用处理** | 节点重执行，需确保幂等性（3 条 interrupt 规则） | 不重执行，无幂等性要求 |
| **断点设置方式** | 代码中调用 `interrupt()` 或编译时 `interrupt_before`/`interrupt_after` | **UI 可视化设置**，无需修改代码 |
| **条件断点** | 代码中自行 `if (condition) interrupt()` | UI 配置条件表达式，支持实时预览 |
| **步进模式** | 通过 `max_turns=1` 模拟 | 原生 Step Turn/Tool/LLM/Any 四种粒度 |
| **恢复动作** | `Command(resume=value)` | `ResumeAction` 支持修改参数、跳过工具、注入消息等 |
| **多断点并行** | 需要 `interrupt_id → resume_map` 映射 | 按匹配优先级依次检查，一次只暂停在一个检查点 |
| **适用场景** | 生产环境 human-in-the-loop | **开发环境调试**（生产环境禁用） |

#### 10.4.10 快捷键设计

```
┌──────────────────────────────────────────────┐
│  快捷键     │  动作         │  Chrome 对应   │
├──────────────────────────────────────────────┤
│  F5         │  Resume       │  F8 (Resume)   │
│  F10        │  Step Turn    │  F10 (Step Over)│
│  F11        │  Step Tool    │  F11 (Step Into)│
│  Shift+F11  │  Step LLM     │  Shift+F11(Out)│
│  Ctrl+F5    │  Step Any     │  —             │
│  F9         │  Toggle BP    │  F9 (Toggle BP)│
│  Ctrl+Shift+F9 │ 移除所有 BP│  —             │
│  Esc        │  Abort        │  Esc           │
└──────────────────────────────────────────────┘
```

#### 10.4.11 实现路径与工作量

| 阶段 | 内容 | 工作量 | 依赖 |
|------|------|--------|------|
| **Phase A** | `BreakpointEngine` 核心 + 6 种断点类型 | ~3 天 | 无 |
| **Phase B** | Agent 循环 7 个 checkpoint 注入点 | ~2 天 | Phase A |
| **Phase C** | Inspector API 断点 CRUD + 执行控制端点 | ~2 天 | Phase A |
| **Phase D** | 前端：Agent 生命周期图 + 可视化断点设置 | ~4 天 | Phase C, 10.3 Phase C |
| **Phase E** | 前端：暂停快照面板 + 参数编辑器 | ~3 天 | Phase D |
| **Phase F** | 前端：执行控制栏 + 快捷键 | ~1 天 | Phase E |
| **Phase G** | WebSocket 实时断点事件推送 | ~1 天 | Phase C |
| **合计** | | **~16 天** | 依赖 10.3 Inspector 基础 |

**风险与开放问题**：

1. **性能影响**：7 个 checkpoint 在每轮循环中都会调用——无断点时需确保 `checkpoint()` 的开销 < 0.1ms（仅条件匹配，无 I/O）
2. **并发与竞态**：多个 Agent 并行执行时，断点引擎需要为每个 Agent 维护独立的暂停状态，当前设计的单 `pendingPause` 需要改为 `Map<agentId, PendingPause>`
3. **超时保护**：断点暂停后如果用户忘记 resume，需要设置最大暂停时间（默认 10 分钟），超时后自动 resume 并警告
4. **条件断点安全**：`new Function()` 求值有注入风险——需限制可访问的变量集，禁止 `require`/`import`/`process` 等
5. **步进粒度**：`step_any` 在工具密集场景下可能过于频繁——考虑是否需要"step N 次"选项

**结论**：断点系统是 Inspector 的**自然延伸**，将 Agent 调试从"被动观察"提升为"主动控制"。Promise 挂起模式相比 LangGraph 的异常+重执行模式更适合开发阶段调试——无需处理幂等性，状态完全保持。建议在 10.3 Inspector Phase C 完成后开始开发。

## 迁移完成状态

- [x] 10.2 全文迁移
- [x] 10.3 全文迁移
- [x] 10.4 全文迁移

## 交付出口

- 对应实现包：`@vitamin/server`、`@vitamin/agent`
- 对应测试：单测 + 集成测 + benchmark
