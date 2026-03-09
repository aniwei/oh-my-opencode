# Vitamin-Coding 系统架构与调用流程

> **生成日期**: 2026-03-09 | **基于分支**: dev

## 一、分层架构总览

Vitamin-Coding 采用 L0–L5 六层分层设计，共 15 个 `@vitamin/*` 包。层间依赖严格向下，同层包之间可横向依赖。

```
L0  @vitamin/shared           ← 零依赖基础层（Logger、Error 层次、事件总线、FS 工具）
      │
L1  @vitamin/config           ← 6 层配置合并 + Zod v4 校验 + 热更新
    @vitamin/ai               ← 统一 LLM API（多 Provider、流式、Fallback、Cost）
      │
L2  @vitamin/agent            ← Agent 状态机 + 双层循环（外循环 FollowUp / 内循环 Tool）
    @vitamin/tools            ← 工具注册表 + 26 内置工具 + 3 级预设（minimal/standard/full）
    @vitamin/hooks            ← Hook 引擎 + 18 个 Timing + 17 个内置 Hook
    @vitamin/session          ← JSONL 会话存储 + 树分支 + 3 策略压缩
      │
L3  @vitamin/orchestrator     ← 多 Agent 编排 + 任务分发 + Plan/Build 流水线
    @vitamin/extension        ← 5 来源扩展加载 + 隔离 API + 20+ 事件
    @vitamin/mcp              ← 3 传输协议 + 3 层优先级 + OAuth
      │
L4  @vitamin/coding-agent     ← CLI 产品入口（Ink TUI / Print / JSON / RPC 四模式）
      │
L5  @vitamin/sdk              ← 嵌入式 SDK（createVitaminAgent + AgentStream + RPC）
    @vitamin/server           ← HTTP API + WebSocket + Inspector
    @vitamin/web-ui           ← 浏览器 SPA（React + Vite）
    @vitamin/ui-kit           ← 共享 UI 组件库（React 19 + Mantine 7）
```

---

## 二、包职责与依赖关系

### 2.1 包清单

| # | 包名 | 层级 | 核心导出 | 职责 |
|---|------|------|---------|------|
| 1 | `@vitamin/shared` | L0 | `Logger`, `VitaminError`, `TypedEventEmitter`, `Disposable`, `parseJsonc`, `spawnProcess` | 日志（pino）、错误层次、事件系统、FS/进程工具 |
| 2 | `@vitamin/config` | L1 | `loadConfig`, `mergeConfigs`, `VitaminConfigSchema`, `ConfigWatcher` | JSONC 解析、6 层合并、Zod v4 校验、配置迁移、文件热更新 |
| 3 | `@vitamin/ai` | L1 | `stream`, `complete`, `streamWithFallback`, `ModelRegistry`, `ProviderRegistry`, `CostTracker` | 统一 LLM 接口层，多 Provider（Anthropic/OpenAI/Google/Bedrock/Ollama）、流式、Fallback 链、成本追踪 |
| 4 | `@vitamin/agent` | L2 | `Agent`, `createAgent`, `agentLoop`, `ToolExecutor`, `MemoryManager` | Agent 状态机、双层循环引擎、Steering/FollowUp 消息队列 |
| 5 | `@vitamin/tools` | L2 | `ToolRegistry`, `registerBuiltinTools`, 26 个 `createXxxTool()` 工厂 | 工具注册表、预设分级（minimal/standard/full）、内置工具实现 |
| 6 | `@vitamin/hooks` | L2 | `HookEngine`, `createHookEngine`, 17 个内置 Hook 工厂 | 生命周期 Hook 引擎、18 个 Timing、优先级排序、安全隔离执行 |
| 7 | `@vitamin/session` | L2 | `SessionManager`, `SessionTree`, `JsonlStorage`, `Compactor` | JSONL 会话存储、树分支、3 策略压缩（Summary/SlidingWindow/Incremental） |
| 8 | `@vitamin/orchestrator` | L3 | `AgentRegistry`, `TaskDispatcher`, `CategoryResolver`, `BackgroundManager`, `executePlanPipeline` | 13 Agent 注册、任务分发（subagent/category 双路径）、后台执行、Plan/Build DAG 流水线 |
| 9 | `@vitamin/extension` | L3 | `ExtensionRunner`, `ExtensionLoader`, `buildExtensionApi` | 5 来源发现、隔离 API、20+ 事件总线、资源追踪 dispose |
| 10 | `@vitamin/mcp` | L3 | `McpClient`, `McpRegistry`, `OAuthManager`, 3 Transport | MCP 协议支持、3 传输（Stdio/HTTP/SSE）、3 层优先级、OAuth 令牌管理 |
| 11 | `@vitamin/coding-agent` | L4 | `main`, `createAgentSession`, `parseCLI`, `buildSystemPrompt` | CLI 产品入口、4 运行模式、Ink TUI、斜杠命令、键绑定 |
| 12 | `@vitamin/sdk` | L5 | `createVitaminAgent`, `AgentStream`, `createRpcServer`, `createRpcClient` | 嵌入式 SDK、AsyncIterable 流、JSON-RPC 2.0 远程控制 |
| 13 | `@vitamin/server` | L5 | `HttpServer`, `WebSocketHub`, `LogBroadcastHub`, `TokenAuth` | Express HTTP API、WebSocket 实时推送、日志广播、鉴权 |
| 14 | `@vitamin/ui-kit` | L5 | React 组件, Mantine 集成 | 共享 UI 组件库（设计令牌、可复用组件） |
| 15 | `@vitamin/web-ui` | L5 | Vite SPA, Chat 界面, Session 浏览器 | 浏览器前端（React Router、TanStack Query、Zustand、Shiki、KaTeX、Mermaid） |

### 2.2 依赖关系图

```
@vitamin/shared (L0)
  └──→ @vitamin/config (L1)
  └──→ @vitamin/ai (L1)
         └──→ @vitamin/agent (L2) ←── @vitamin/config
         │      └──→ @vitamin/tools (L2) ←── @vitamin/ai, @vitamin/hooks
         │      └──→ @vitamin/hooks (L2)
         │      └──→ @vitamin/session (L2) ←── @vitamin/ai
         │
         └──→ @vitamin/orchestrator (L3) ←── agent, hooks, tools
         └──→ @vitamin/extension (L3) ←── agent, hooks, tools
         └──→ @vitamin/mcp (L3) ←── agent, tools
                │
                └──→ @vitamin/coding-agent (L4) ←── 全部 L0-L3
                       │
                       ├──→ @vitamin/sdk (L5) ←── 全部 L0-L4
                       ├──→ @vitamin/server (L5) ←── agent, session, shared
                       └──→ @vitamin/web-ui (L5) ←── ui-kit
```

---

## 三、主启动流程（7 步引导序列）

```
main(cliOptions)
  │
  ├─ Step 1: parseCLI(argv)
  │    手动解析命令行参数: --model, --print, --rpc, --json, -i, --inspect
  │    识别子命令: run | doctor | install | config | auth
  │
  ├─ Step 2: loadVitaminConfig()
  │    6 层合并: CLI → ENV → Project(.vitamin/config.jsonc)
  │           → User(~/.config/vitamin/config.jsonc) → Extension → Defaults
  │    → migrateConfig() 自动版本迁移
  │    → Zod v4 schema 校验
  │
  ├─ Step 3: createSubsystems(config, options)
  │    ┌─ createDefaultProviderRegistry()   ← 注册 Anthropic/OpenAI/Google 等 Provider
  │    ├─ createToolRegistry()              ← 空工具注册表
  │    ├─ createHookEngine()                ← 空 Hook 引擎
  │    ├─ createAgentRegistry()             ← 空 Agent 注册表
  │    ├─ createBackgroundManager()         ← 后台任务管理器
  │    ├─ createCategoryResolver()          ← category → agent 映射表
  │    ├─ createSessionManager()            ← JSONL 会话管理
  │    ├─ createExtensionRunner()           ← 扩展加载器
  │    ├─ createMcpRegistry()               ← MCP 注册表
  │    ├─ registerBuiltinAgents()           ← 注册 13 个内置 Agent
  │    ├─ createTaskDispatcher()            ← 任务分发器（连接 registry + resolver）
  │    └─ registerBuiltinTools()            ← 注册 26 工具 + 绑定 taskDispatch 回调
  │
  ├─ Step 4: createAgentSession(subsystems, options)
  │    ├─ resolveInitialSessionId()         ← 继续已有 / 创建新会话
  │    ├─ resourceLoader.load()             ← 加载项目资源（AGENTS.md、.vitamin/ 等）
  │    ├─ buildSystemPrompt()               ← 组装系统提示词（Agent 元数据 + 工具列表 + 资源）
  │    └─ 构建 AgentSession 对象            ← 核心方法: prompt, abort, compact, switchModel
  │
  ├─ Step 5: selectMode(mode)
  │    interactive → createInteractiveMode()  ← Ink TUI (默认)
  │    print       → createPrintMode()        ← 流式文本输出
  │    json        → createJsonMode()         ← JSON 结构化输出
  │    rpc         → createRpcMode()          ← JSON-RPC 远程调用
  │
  ├─ Step 6-7: mode.run(session, options)      ← 进入主事件循环
  │
  └─ session.dispose()                         ← 清理: abort + unloadExtensions + cancelBackground
```

---

## 四、消息处理管线（8 阶段）

从用户输入到最终响应的完整处理路径：

```
session.prompt(input)
  │
  ├─ Stage 1: Slash Command 检查
  │    slashCommands.execute(input)
  │    命中 /compact, /model, /session 等 → 直接返回结果，跳过后续阶段
  │
  ├─ Stage 2: Extension Input 拦截
  │    extensionRunner.eventBus.emit('input', event)
  │    任意扩展可设置 event.cancelled = true → 终止管线
  │
  ├─ Stage 3: Skill / Template 展开
  │    expandSkillReferences(input, subsystems)
  │    将 @skill_name 引用展开为完整 Skill 上下文
  │
  ├─ Stage 4: Hook — chat.message.before
  │    hookEngine.execute('chat.message.before', input, output)
  │    ├─ FirstMessageVariant    ← 首消息特殊处理
  │    ├─ SessionRecovery        ← 会话状态恢复
  │    ├─ KeywordDetection       ← 关键词触发
  │    └─ output.cancelled → 终止管线
  │
  ├─ Stage 5: Agent 处理（核心）
  │    agentRegistry.find('central-secretariat')
  │    ├─ resolveModel(currentModel)               ← 创建 Model 对象
  │    ├─ toolRegistry.getAll()                    ← 获取全量工具定义
  │    ├─ registration.factory(model, tools, opts) ← 实例化 Agent
  │    └─ agentInstance.prompt(processedInput)     ← 进入 Agent 双层循环（见第五节）
  │
  ├─ Stage 6: Hook — chat.message.after
  │    hookEngine.execute('chat.message.after', assistantMessage)
  │
  ├─ Stage 7: 持久化
  │    sessionManager.appendMessage(sessionId, userMessage)
  │    sessionManager.appendMessage(sessionId, assistantMessage)
  │
  └─ Stage 8: 状态更新
       state.totalTokens += usage
       state.messageCount += 2
       返回 AgentSessionResult { response, cost, tokens, toolCalls, duration }
```

---

## 五、Agent 双层循环引擎

这是系统最核心的运行机制。外循环处理 FollowUp 消息，内循环处理 Tool 调用和 Steering 中断。

### 5.1 循环结构

```
agentLoop(options)
  │
  ╔═══ 外循环: FollowUp 驱动 ═══════════════════════════════════════════════╗
  ║                                                                          ║
  ║  ╔═══ 内循环: Tool-Steering 驱动 ═══════════════════════════════════╗   ║
  ║  ║                                                                    ║   ║
  ║  ║  ① 安全阀: toolTurnCount > maxToolTurns(25) → 抛出异常           ║   ║
  ║  ║                                                                    ║   ║
  ║  ║  ② 上下文转换: config.transformContext(messages)                  ║   ║
  ║  ║      → 触发 messages.transform Hook                               ║   ║
  ║  ║                                                                    ║   ║
  ║  ║  ③ 消息格式转换: config.convertToLlm(contextMessages)            ║   ║
  ║  ║                                                                    ║   ║
  ║  ║  ④ 构建工具定义: buildToolDefinitions(toolExecutor.getTools)     ║   ║
  ║  ║                                                                    ║   ║
  ║  ║  ⑤ 流式 LLM 调用: stream(streamContext, signal)                  ║   ║
  ║  ║      消费 StreamEvent {delta, thinking, tool_call_start, done}    ║   ║
  ║  ║      emit('stream_event', event) → 实时推送给 TUI                ║   ║
  ║  ║                                                                    ║   ║
  ║  ║  ⑥ 获取 AssistantMessage → push 到 messages 历史                 ║   ║
  ║  ║                                                                    ║   ║
  ║  ║  ⑦ 有 ToolCalls?                                                 ║   ║
  ║  ║     ├─ YES → 逐个执行:                                           ║   ║
  ║  ║     │   ├─ 检查 Steering 队列 → 有消息则中断工具、回到 LLM      ║   ║
  ║  ║     │   ├─ emit('tool_call_start')                                ║   ║
  ║  ║     │   ├─ toolExecutor.execute(toolCall)  ← 见第六节             ║   ║
  ║  ║     │   ├─ push ToolResultMessage → messages                      ║   ║
  ║  ║     │   └─ emit('tool_call_end', result)                          ║   ║
  ║  ║     │   → continue 内循环（工具结果送回 LLM）                    ║   ║
  ║  ║     │                                                              ║   ║
  ║  ║     └─ NO (end_turn / max_tokens) → break 内循环                 ║   ║
  ║  ║                                                                    ║   ║
  ║  ╚════════════════════════════════════════════════════════════════════╝   ║
  ║                                                                          ║
  ║  检查 FollowUp 队列:                                                    ║
  ║    ├─ 有消息 → push + emit('follow_up_start') → continue 外循环        ║
  ║    └─ 无消息 → break 外循环 → 返回最终 AssistantMessage                 ║
  ║                                                                          ║
  ╚══════════════════════════════════════════════════════════════════════════╝
```

### 5.2 Agent 状态机

```
                    ┌──────────────────────────────────────────┐
                    │                                          ↓
idle ──→ streaming ──→ tool_executing ──→ streaming ──→ completed
  │          │              │                              │
  │          ├──→ completed │                              ├──→ streaming (FollowUp)
  │          ├──→ aborted   ├──→ aborted                   ├──→ idle
  └──→ error └──→ error     └──→ error                     └──→ aborted
```

合法状态转换由 `VALID_TRANSITIONS` 表约束，非法转换直接抛错。

### 5.3 Steering vs FollowUp

| 机制 | 检查时机 | 用途 | 效果 |
|------|---------|------|------|
| **Steering** | 每个工具调用之间 | 用户中断、优先级消息 | 中断剩余工具，立即回到 LLM |
| **FollowUp** | 内循环结束后 | 计划后续步骤、扩展注入 | 追加消息后重新进入外循环 |

---

## 六、工具执行管线

每次工具调用都经过 before/after Hook 包裹：

```
toolExecutor.execute(toolCall, signal)
  │
  ├─ ① Hook: tool.execute.before                ← 优先级排序执行
  │    ├─ FileGuard          阻止非法文件路径访问
  │    ├─ LabelTruncator     截断过长参数标签
  │    ├─ RulesInjector      注入安全规则到参数
  │    └─ beforeResult.cancelled → 返回 { isError: true }
  │
  ├─ ② 参数验证: tool.parameters.safeParse(args)
  │    └─ 失败 → 返回 { isError: true, content: 校验消息 }
  │
  ├─ ③ 执行工具: tool.execute(id, parsedArgs, signal)
  │    ├─ bash/read/write/edit/grep  → 本地文件/进程操作
  │    ├─ delegate-task              → TaskDispatcher → 子 Agent
  │    ├─ background-start/status    → BackgroundManager
  │    └─ mcp-*                      → McpClient.callTool()
  │
  ├─ ④ Hook: tool.execute.after                 ← 优先级排序执行
  │    ├─ OutputTruncation    截断超长输出
  │    ├─ CommentChecker      扫描 AI 生成的注释模式
  │    ├─ RalphLoop           迭代质量精炼
  │    └─ Babysitting         监控 & 验证工具结果
  │
  └─ 返回 ToolResult { content, isError?, metadata? }
```

### 工具并行/串行执行模式

| 模式 | 方法 | Steering 检查 | 适用场景 |
|------|------|:---:|---------|
| 串行 | `executeSequential()` | ✓ 每个工具间检查 | 默认模式 |
| 并行 | `executeParallel()` | ✗ | 独立工具批量执行 |

### 工具预设（3 级）

```
minimal ⊂ standard ⊂ full

minimal (4):  read, write, edit, bash
standard (6): + grep, glob, find, ls, ast-grep, delegate-task
full (12+):   + look-at, session 工具, background 工具, skill 工具, ...
```

---

## 七、LLM 调用流程（AI 包）

### 7.1 基础流式调用

```
stream(model, context, options)
  │
  ├─ ① API Key 解析（5 级优先级）
  │    explicit key → callback → static mapping → ENV 变量 → Copilot OAuth
  │
  │    ENV 映射:
  │    anthropic     → ANTHROPIC_API_KEY
  │    openai        → OPENAI_API_KEY
  │    google        → GOOGLE_API_KEY
  │    github-copilot → GITHUB_TOKEN | GH_TOKEN
  │
  ├─ ② 获取 Provider
  │    providerRegistry.get(model.api)
  │    ├─ 'anthropic-messages'  → AnthropicProvider
  │    ├─ 'openai-responses'    → OpenAIProvider
  │    ├─ 'google-generative'   → GoogleProvider
  │    ├─ 'bedrock-messages'    → BedrockProvider
  │    └─ 'ollama-chat'         → OllamaProvider
  │
  ├─ ③ 异步流启动 → 返回 EventStream<StreamEvent, AssistantMessage>
  │
  └─ 双消费模式:
       ├─ for await (event of stream) { ... }  ← 实时事件
       └─ await stream.result()                ← 最终完整消息
```

### 7.2 Fallback 链

```
streamWithFallback(models[], context, config, providerRegistry)
  │
  └─ 遍历 models[] (主 → 备 → 备):
       ├─ 尝试 stream() 最多 maxRetries(3) 次
       ├─ 可重试错误: rate_limit | overloaded | server_error | timeout
       │    → 指数退避: 100ms → 200ms → 400ms ... → max 10s
       ├─ 致命错误: 401 | 404 → 跳到下一 model
       └─ emit FallbackEvent { from: model1, to: model2 }
```

### 7.3 EventStream 模式

```typescript
class EventStream<E, R> implements AsyncIterable<E> {
  push(event: E): void        // 推送事件
  complete(result: R): void   // 完成
  fail(error: Error): void    // 失败
  abort(): void               // 中止
  result(): Promise<R>        // 等待最终结果
}
```

---

## 八、多 Agent 编排

### 8.1 任务分发双路径

```
taskDispatcher.dispatch(request)
  │
  ├─ 路径 A: request.subagent 指定
  │    直接实例化指定 Agent
  │    ├─ Plan Family 反递归守卫检查
  │    ├─ resolveModel(registration)
  │    ├─ resolveTools(registration)
  │    ├─ registration.factory(model, tools, opts) → Agent 实例
  │    └─ executeAgent(taskId, agent, request)
  │         ├─ mode='background' → backgroundManager.submit()
  │         └─ mode='sync' → agent.prompt() + error→running 重试
  │
  ├─ 路径 B: request.category 指定
  │    categoryResolver.resolve(category) → agent 名称
  │    → 同路径 A 流程
  │
  └─ 无指定: 默认 sisyphus-junior
```

### 8.2 Category → Agent 默认映射

| Category | Agent | 职责 |
|----------|-------|------|
| `general` | Central-Secretariat | 通用入口，默认主 Agent |
| `code` | Hephaestus | 代码编写、重构、Debug、测试 |
| `architecture` | Oracle | 架构分析和设计决策 |
| `search` | Explore | 代码探索和信息检索 |
| `knowledge` | Librarian | 知识管理和文档查询 |
| `quick` | Sisyphus-Junior | 轻量级快速任务 |
| `debug` | Hephaestus | 调试（复用 code Agent） |
| `test` | Hephaestus | 测试（复用 code Agent） |

### 8.3 13 个内置 Agent

| Agent | 角色 | 所属流水线 |
|-------|------|-----------|
| Central-Secretariat | 主调度入口 | 通用 |
| Hephaestus | 代码实现者 | 通用 + Plan/Build |
| Explore | 只读代码探索 | 通用 |
| Oracle | 架构决策 | 通用 + Plan/Build |
| Librarian | 知识文档 | 通用 |
| Sisyphus-Junior | 轻量快速 | 通用 |
| Metis | 预分析 | Plan/Build Phase 1 |
| Prometheus | 计划生成 | Plan/Build Phase 2 |
| Momus | 计划审查 | Plan/Build Phase 3 |
| Atlas | 依赖解析 | Plan/Build Phase 4 |
| Sisyphus | 高级任务执行 | 通用 |
| Multimodal-Looker | 多模态识别 | 通用 |
| Interview/DAG | DAG 工具 Agent | Plan/Build |

### 8.4 Plan/Build 流水线（6 阶段 DAG）

```
executePlanPipeline(userRequest, options)
  │
  ├─ Phase 1: Metis — 预分析
  │    分析用户请求，输出结构化上下文
  │
  ├─ Phase 2: Prometheus — 生成计划
  │    基于 Metis 输出生成 DAG 执行计划
  │
  ├─ Phase 3: Momus — 审查
  │    审查计划质量（最多 maxRevisions 轮）
  │    ├─ approved → Phase 4
  │    └─ rejected → 修订 → 重回 Phase 2
  │
  ├─ Phase 4: Atlas — 依赖解析
  │    解析任务间依赖关系
  │
  ├─ Phase 5: Hephaestus — 执行
  │    DAG 并行/串行执行具体编码任务
  │
  └─ Phase 6: Oracle — 验证
       验证最终结果完整性
```

---

## 九、Hook 引擎

### 9.1 架构

```
HookEngine
  ├─ 18 个 HookTiming 桶（按类别分组）
  ├─ 每个 Timing 内按 priority 升序排列
  ├─ 两种分发模式:
  │   ├─ execute() — 链式转换（input → output 逐 Hook 传递修改）
  │   └─ emit()    — 通知型（仅 input，fire-and-forget）
  ├─ 运行时 disable/enable 控制
  └─ safeCreateHook() — 工厂失败不阻塞启动
```

### 9.2 18 个 Hook Timing

| 类别 | Timing | 分发模式 |
|------|--------|---------|
| Chat 消息 | `chat.message.before`, `chat.message.after` | execute (链式) |
| 工具守卫 | `tool.execute.before`, `tool.execute.after` | execute (链式) |
| 消息转换 | `messages.transform` | execute (链式) |
| 参数调整 | `chat.params` | execute (链式) |
| 会话事件 | `session.created`, `session.deleted`, `session.idle`, `session.error` | emit (通知) |
| 流事件 | `stream.start`, `stream.end` | emit (通知) |
| 压缩事件 | `compaction.before`, `compaction.after` | emit (通知) |
| 后台任务 | `background.start`, `background.end` | emit (通知) |
| 扩展事件 | `extension.loaded`, `extension.error` | emit (通知) |

### 9.3 17 个内置 Hook

**Session 类（6 个）** — `chat.message.before`:
- `FirstMessageVariant` — 首消息特殊处理
- `SessionRecovery` — 会话状态恢复
- `KeywordDetection` — 关键词触发行为
- `SessionHistory` — 维护消息历史
- `IdleContinuation` — 空闲后恢复
- `ErrorRecovery` — 错误重试恢复

**Tool Guard 类（4 个）**:
- `FileGuard` — `tool.execute.before` — 阻止未授权文件访问
- `LabelTruncator` — `tool.execute.before` — 截断过长标签
- `RulesInjector` — `tool.execute.before` — 注入安全规则
- `OutputTruncation` — `tool.execute.after` — 截断超长输出

**Transform 类（3 个）**:
- `ContextInjector` — `messages.transform` — 向消息注入上下文
- `ThinkingValidator` — `messages.transform` — 校验 thinking 块
- `AnthropicEffort` — `chat.params` — 调整 Anthropic effort 级别

**Quality 类（3 个）** — `tool.execute.after`:
- `CommentChecker` — 扫描 AI 生成的注释模式
- `RalphLoop` — 迭代质量精炼
- `Babysitting` — 监控 & 验证工具结果

---

## 十、会话管理

### 10.1 存储模型

```
SessionManager
  │
  ├─ 底层: JSONL 追加写入 + fsync（断电安全）
  │    每个 SessionEntry = { id, parentId, type, content, timestamp }
  │    Entry type: message | system | compaction | branch_point
  │
  ├─ create(title?) → SessionMetadata { id, title, createdAt }
  ├─ appendMessage(sessionId, message) → JSONL append + fsync
  ├─ list() → SessionMetadata[]
  ├─ remove(sessionId) → 删除 JSONL 文件
  └─ compact(sessionId, strategy?) → CompactionRecord
```

### 10.2 树分支

```
SessionTree
  ├─ buildTree()           ← 从 JSONL 重建 DAG 结构
  ├─ append(entry)         ← 自动设置 parentId (从 activeEntryId)
  ├─ fork(fromId?)         ← 创建 branch_point 系统事件
  ├─ navigateTo(targetId)  ← 返回从根到目标的路径
  └─ getLeafNodes()        ← 获取所有叶子节点
```

### 10.3 三策略压缩

| 策略 | 算法 | 适用场景 |
|------|------|---------|
| **Summary** | LLM 总结旧消息，保留最近 N 条 | 长会话、节省上下文 |
| **SlidingWindow** | 只保留最近 M 条，丢弃更早的 | 固定上下文窗口 |
| **Incremental** | 增量追加摘要（上下文积累） | 需要全局记忆的场景 |

---

## 十一、扩展系统

```
ExtensionRunner
  │
  ├─ 5 来源发现
  │    ① Builtin      — 编译时内置
  │    ② NPM          — node_modules/@vitamin/ext-*
  │    ③ Local         — 文件系统目录扫描
  │    ④ Config        — .vitamin/extensions/ 配置
  │    ⑤ Git           — v0.2.0 (延迟)
  │
  ├─ loadOne(descriptor)
  │    ├─ 加载 factory 函数
  │    ├─ buildExtensionApi(descriptor) → 隔离 API 实例
  │    │    ├─ registerHook()     ← 自动前缀 ext:{name}:{hookName}
  │    │    ├─ registerTool()     ← 注册自定义工具
  │    │    ├─ registerCommand()  ← 注册斜杠命令
  │    │    ├─ registerMcp()      ← 注册 MCP 服务
  │    │    └─ on(event, handler) ← 20+ 类型事件订阅
  │    └─ factory(api) → 执行初始化（失败不阻塞启动：异常隔离）
  │
  └─ unloadAll() → 逆序 dispose 所有资源
```

### 20+ 扩展事件类型

| 分类 | 事件 |
|------|------|
| Session | `session.start`, `session.switch`, `session.fork`, `session.end`, `session.compacting` |
| Agent | `agent.*` |
| Message | `message.*` |
| Tool | `tool.call`, `tool.result`, `tool.execute.before`, `tool.execute.after` |
| Transform | `transform.*` |
| Input | `input` |
| Model | `model.select` |

---

## 十二、MCP 协议支持

### 12.1 三层优先级注册

```
McpRegistry
  ├─ builtin  (内置, 最高优先)
  ├─ user     (用户配置)
  └─ skill    (Skill 内嵌, 最低优先)
  
  同名工具 → 高优先级覆盖低优先级
```

### 12.2 三种传输协议

| 传输 | 机制 | 适用场景 |
|------|------|---------|
| **Stdio** | 子进程 stdin/stdout | 本地 MCP 服务器 |
| **HTTP** | StreamableHTTPClientTransport | 远程 REST 端点 |
| **SSE** | SSE 事件流 + HTTP POST | 实时流式场景 |

### 12.3 连接流程

```
McpConfigLoader
  │
  ├─ loadFromFile(path) → McpServerConfig[]
  │    expandEnvVars('${VAR}') → 递归展开环境变量
  │
  └─ 对每个 config:
       ├─ 创建 Transport (stdio | http | sse)
       ├─ OAuth 注入: oauthManager.getToken() → Authorization header
       │    令牌缓存 + 过期前 60s 自动刷新
       ├─ client.connect()
       ├─ client.listTools() → McpToolDefinition[]
       └─ 注册到 McpRegistry(priority)
```

---

## 十三、TUI 交互模式

```
createInteractiveMode()
  └─ render(<App />)         ← Ink (React for Terminal)
       └─ <ThemeProvider>
            └─ <AppLayout columns={...} rows={...}>
                 └─ <MemoryRouter>
                      └─ <AppProvider>  ← useReducer(uiReducer, initialState)
                           │
                           ├─ Route "/" → <HomePage>
                           │    └─ <Prompt onSubmit={...}>
                           │         ├─ "/" 前缀 → 斜杠命令自动完成
                           │         ├─ "@" 前缀 → Agent 选择自动完成
                           │         ├─ "!" 前缀 → Shell 命令直通
                           │         ├─ Ctrl+S   → 暂存当前输入
                           │         ├─ ↑/↓      → 历史浏览
                           │         └─ Enter     → onSubmit → navigate("/session/:id")
                           │
                           ├─ Route "/session/:id" → <SessionPage>
                           │    ├─ <MessageList>   ← 滚动消息流渲染
                           │    ├─ <ToolCallView>  ← 工具调用可视化
                           │    └─ <Prompt onSubmit={session.prompt}>
                           │
                           ├─ <DialogOverlay>      ← 对话框栈
                           └─ <Toast>              ← 通知提示
```

### UI 状态管理

```typescript
UIState {
  dialog: { stack: DialogEntry[], size: 'medium' }
  toast: ToastData | null
  sidebarOpen: boolean
  promptMode: 'normal' | 'shell'
  promptFocused: boolean
  scrollLocked: boolean
}
```

通过 `useReducer(uiReducer)` + `React.Context` 管理，Action 类型包括:
`dialog/push`, `dialog/pop`, `toast/show`, `toast/dismiss`, `prompt/setMode`, `prompt/setFocused`, `scroll/lock`

---

## 十四、SDK 嵌入使用

### 14.1 创建 Agent

```typescript
const agent = await createVitaminAgent({
  config: { model: 'anthropic/claude-opus-4-6' },
  tools: [customTool1],
})

const conv = agent.createConversation('session-1')
```

内部执行与 CLI 相同的 5 步初始化: `loadConfig → createSubsystems → loadExtensions → registerMcps → createAgentSession`

### 14.2 AgentStream 消费

```typescript
const stream = conv.getStream()
for await (const event of stream) {
  // event.type: 'delta' | 'thinking' | 'tool_call' | 'done' | 'error'
}
const result = await stream.result()  // AgentSessionResult
```

### 14.3 RPC 远程模式

```
Server 端:
  createRpcServer(agent, { socketPath }) → JSON-RPC 2.0 over Unix Socket

Client 端:
  createRpcClient({ socketPath }) → connect() → VitaminAgent 接口

RPC 方法:
  prompt(text) → { response, cost, tokens, duration }
  steer(message) → { ok }
  abort() → { ok }
  getState() → VitaminAgentState
  dispose() → { ok }
```

---

## 十五、配置系统

### 15.1 6 层合并优先级

```
最高 ← CLI overrides (loadConfig({ overrides }))
       Environment variables (VITAMIN_MODEL, VITAMIN_THEME, VITAMIN_LOG_LEVEL)
       Project config (.vitamin/config.jsonc)
       User config (~/.config/vitamin/config.jsonc)
       Extension defaults (loadConfig({ extensionDefaults }))
最低 ← Framework defaults (DEFAULT_CONFIG 常量)
```

### 15.2 合并规则

- `disabled_*` 数组字段 → Set 并集（两层都保留）
- 对象字段 → 深度递归合并
- 其他字段 → 高优先级覆盖低优先级

### 15.3 版本迁移

```
migrateConfig(config) → { config, applied[] }
  链式迁移: v0.1 → v1.0 → v1.1 → ...
  每个 Migration = { version, description, migrate(config) → config }
  自动记录 _migrations 数组
```

### 15.4 配置结构概览

```jsonc
{
  "$schema": "...",
  "config_version": "1.0.0",
  "log_level": "info",
  "model": "anthropic/claude-sonnet-4-20250514",
  "theme": "auto",
  "tool_preset": "standard",

  "agents": { /* 14 个可覆盖 Agent 配置 */ },
  "categories": { /* 8 个内置 + 自定义 Category */ },
  "extensions": { /* 扩展配置 */ },
  "mcp": { /* MCP 服务器配置 */ },
  "session": { /* 会话配置 */ },
  "tui": { /* TUI 配置 */ },
  "skills": { /* Skill 配置 */ },
  "compaction": { /* 压缩策略配置 */ },
  "background_task": { /* 后台任务配置 */ },
  "experimental": { /* 实验性功能 */ },

  "disabled_agents": [],
  "disabled_hooks": [],
  "disabled_mcps": [],
  "disabled_skills": [],
  "disabled_tools": []
}
```

---

## 十六、完整数据流总结

```
用户键入 → Prompt 组件 → session.prompt(input)
  │
  ├─ [Slash Command?] → 直接返回
  ├─ [Extension 拦截?] → 终止
  ├─ [Skill 展开]
  ├─ [Hook: chat.message.before]
  │
  ├─ Agent 实例化 (Central-Secretariat)
  │    └─ agentLoop()
  │         ├─ [Hook: messages.transform] → 上下文注入
  │         ├─ stream(model, context) → Provider → LLM API
  │         │    └─ [streamWithFallback?] → 多 Provider 降级
  │         │
  │         ├─ 流事件 → TUI / SDK / RPC 实时渲染
  │         │
  │         ├─ ToolCall?
  │         │    ├─ [Hook: tool.execute.before] → 安全守卫
  │         │    ├─ tool.execute(args)
  │         │    │    ├─ delegate-task → TaskDispatcher → 子 Agent
  │         │    │    ├─ bash/read/write/edit → 本地操作
  │         │    │    └─ mcp-* → McpClient.callTool()
  │         │    ├─ [Hook: tool.execute.after] → 质量检查
  │         │    └─ 结果回 LLM → 继续循环
  │         │
  │         └─ end_turn → 返回 AssistantMessage
  │
  ├─ [Hook: chat.message.after]
  ├─ sessionManager.appendMessage() × 2
  └─ 更新 state → 返回给消费端渲染
```
