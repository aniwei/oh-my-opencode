> [← 返回目录](README.md)

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
