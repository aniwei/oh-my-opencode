# 10C 分册：验证、测试与 SLO

> **来源**：从主提案 `README.md` Part 10 迁移  
> **范围**：10.8 性能基准指标 · 10.9 测试策略 · 10.10 错误与重试路径  
> **返回主提案**：[← 主提案 10.0 导航](10-experimental.md)

---

### 10.8 性能基准指标

试验性特性需要定义 P95 性能基线，确保不会拖慢核心路径：

| 指标 | P95 目标值 | 测量方法 | 回退策略 |
|------|-----------|---------|---------|
| checkpoint() 无断点时延 | < 0.1ms | 循环内 `performance.now()` 差值 | 断点引擎禁用时 checkpoint 为 no-op |
| checkpoint() 断点匹配（10 个断点） | < 1ms | 同上 | 减少活跃断点数 |
| Sandbox OS-native 冷启动 | < 200ms | `initialize()` 耗时 | 沙箱预热池（预创建 N 个） |
| Sandbox Server-Wasm 冷启动 | < 10ms | `initialize()` 耗时 | Wasm 模块预编译缓存 |
| Sandbox Browser-Wasm 冷启动 | < 2s | `initialize()` 耗时 | 磁盘镜像 diff 增量加载 |
| Inspector API 响应时间 | < 50ms | HTTP 往返延迟 | 降级为 SSE-only 推送 |
| Escalation 单层路由延迟 | < 5ms（不含 LLM） | `handle()` 非 LLM 部分耗时 | 减少冒泡层数 |
| Escalation 完整冒泡（3 层） | < 30s（含 LLM） | 端到端冒泡+决策时间 | 设置冒泡深度上限 |
| LogBroadcastHub 吞吐量 | > 10K events/s | 批量 publish + subscribe 基准测试 | 批量发布（100ms 窗口） |

**验证方式**：纳入 CI 性能回归测试（`vitest bench`），每个 PR 自动对比性能指标。

### 10.9 试验性特性的测试策略

Part 6 覆盖了核心功能的测试策略。以下补充 Part 10 试验性特性的专项测试方案：

#### 10.9.1 断点引擎测试

```typescript
// 并发断点测试：多 Agent 同时命中断点
describe("BreakpointEngine concurrent", () => {
  it("should support multiple agents paused simultaneously", async () => {
    const engine = new BreakpointEngine()
    engine.addBreakpoint({ id: "bp-1", type: "turn", timing: "before_turn", enabled: true, agentFilter: "*" })

    // 模拟 3 个 Agent 同时命中断点
    const [pause1, pause2, pause3] = await Promise.all([
      engine.checkpoint(buildContext({ agentId: "agent-1" })),
      engine.checkpoint(buildContext({ agentId: "agent-2" })),
      engine.checkpoint(buildContext({ agentId: "agent-3" })),
    ])

    expect(engine.pendingPauses.size).toBe(3)
  })
})
```

#### 10.9.2 Escalation 集成测试

```typescript
// 冒泡链测试：子 Agent → Atlas → Sisyphus → 用户
describe("Escalation bubble chain", () => {
  it("should bubble through 3 layers when not intercepted", async () => {
    const events: string[] = []
    // 注册各层 handler，记录事件
    atlasHandler.on("escalation", (e) => { events.push(`atlas:${e.type}`) })
    sisyphusHandler.on("escalation", (e) => { events.push(`sisyphus:${e.type}`) })

    // 子 Agent 发起 capability escalation
    await childAgent.escalate({ type: "capability", reason: "cannot handle binary files" })

    expect(events).toEqual([
      "atlas:capability",
      "sisyphus:capability",
    ])
  })
})
```

#### 10.9.3 临时圆桌超时/降级测试

```typescript
// 超时测试：圆桌在 maxRounds 轮后自动降级
describe("AdHocRoundtable timeout", () => {
  it("should use fallback strategy when maxRounds exhausted without agreement", async () => {
    const roundtable = new AdHocRoundtable({
      ...defaultConfig,
      maxRounds: 1,  // 强制 1 轮后结束
    }, mockDispatch)

    const agreement = await roundtable.negotiate()
    expect(agreement.unresolvedDisputes).toBeDefined()
    expect(agreement.unresolvedDisputes!.length).toBeGreaterThan(0)
  })
})
```

#### 10.9.4 Agent 合成流水线测试

```typescript
// 失败策略测试：依赖 Agent 失败时的快速失败
describe("SynthesisOrchestrator failure policy", () => {
  it("should propagate failure with abort_all policy", () => {
    const orch = new SynthesisOrchestrator()
    orch.addAgent("researcher", blueprint1, 1, [], [], "abort_all")
    orch.addAgent("analyzer", blueprint2, 2, ["researcher"], ["researcher"], "abort_all")
    orch.recordFailure("researcher", new Error("network timeout"))

    const batches = orch.computeExecutionBatches()
    const analyzerState = orch.getAgentState("analyzer")
    expect(analyzerState?.status).toBe("failed")
  })
})
```

### 10.10 Part 4 核心流程的错误与重试路径

Part 4 的四个核心流程描述了 happy path。以下补充错误处理和重试策略：

#### 10.10.1 LLM API 调用失败的重试策略

```typescript
/**
 * LLM 调用重试策略
 *
 * @vitamin/ai 层面的自动重试，对上层 Agent 循环透明。
 */
interface LlmRetryPolicy {
  /** 最大重试次数 */
  maxRetries: number         // 默认: 3
  /** 退避策略 */
  backoff: "exponential" | "linear" | "fixed"
  /** 初始等待时间（ms） */
  initialDelayMs: number     // 默认: 1000
  /** 最大等待时间（ms） */
  maxDelayMs: number         // 默认: 30000
  /** 可重试的错误类型 */
  retryableErrors: Array<
    | "rate_limit"           // 429 Too Many Requests
    | "server_error"         // 5xx
    | "network_error"        // ECONNRESET, ETIMEDOUT
    | "overloaded"           // 529 Overloaded (Anthropic)
  >
  /** 不可重试的错误（立即失败） */
  nonRetryableErrors: Array<
    | "invalid_api_key"      // 401
    | "insufficient_quota"   // 402
    | "content_filter"       // 400 Content Policy
    | "context_too_long"     // 400 Context Length
  >
}
```

**重试流程**：

```
LLM API 调用
  │
  ├── 成功 → 返回结果
  │
  └── 失败
      ├── 不可重试错误 → 立即抛出（Agent 循环捕获并报告）
      │
      └── 可重试错误
          ├── 重试次数 < maxRetries
          │   └── 等待 backoff(attempt) ms → 重试
          │       └── 如果是 rate_limit → 使用 Retry-After header 的值
          │
          └── 重试次数 >= maxRetries
              └── 尝试 fallback 模型（如果配置了 fallback chain）
                  ├── fallback 成功 → 返回结果（标注使用了 fallback）
                  └── fallback 也失败 → 抛出最终错误
```

#### 10.10.2 工具执行超时处理

```
Agent 调用工具（bash / write_file / edit_file 等）
  │
  ├── 正常完成 → 返回结果（纳入 messages）
  │
  └── 超时（commandTimeoutMs）
      │
      ├── 沙箱内执行 → 沙箱强制终止进程
      │   └── 返回 { timedOut: true, stderr: "timeout" }
      │       └── Agent 循环将超时信息作为工具结果纳入上下文
      │           └── LLM 看到超时后自主决策：重试 / 换方案 / 报告
      │
      └── 非沙箱执行 → AbortSignal 触发中止
          └── 同上流程
```

#### 10.10.3 Agent 循环异常退出善后

```
Agent 循环异常退出（未捕获错误、OOM、进程崩溃）
  │
  ├── 已有 session → 保存当前状态到 JSONL 树
  │   └── 状态标记为 "interrupted"（可恢复）
  │
  ├── 是子 Agent（被 task() 调度）
  │   └── 向父 Agent（Atlas/Sisyphus）返回 TaskResult { status: "failed" }
  │       └── 父 Agent 决策：重试 / 跳过 / 重规划 / Escalation 上报
  │
  └── 是主 Agent（Sisyphus / 直接执行）
      └── 向用户报告错误摘要
          └── 提供 "恢复" 命令：/resume --session={id}
```

---

## 附录：设计决策记录

### ADR-001: 选择 pnpm + Turborepo 而非 npm workspaces + Nx

**决策**：pnpm + Turborepo

**理由**：
- pnpm 严格依赖隔离（phantom dependency 问题在 npm workspaces 中常见）
- Turborepo 增量构建 + 远程缓存（CI 加速明显）
- pnpm 是用户显式要求

### ADR-002: 选择 tsup 而非 tsc 直接构建

**决策**：tsup (esbuild)

**理由**：
- esbuild 构建速度比 tsc 快 100x+
- 天然支持 ESM + CJS 双输出
- tree-shaking 减小产物体积
- 保留 tsc 仅用于 typecheck

### ADR-003: 选用 Zod v4 而非 TypeBox

**决策**：Zod v4（与 oh-my-opencode 一致）

**理由**：
- oh-my-opencode 已用 Zod v4 验证 22+ Schema 文件，移植成本最低
- Zod v4 支持 JSON Schema 导出（用于文档/IDE 补全）
- TypeBox 在 pi-mono 中用于工具参数，但 Zod 生态更大且类型推导更优
- 工具参数定义统一使用 Zod，减少概念碎片

### ADR-004: Agent 运行时选用 pi-mono 的极简模式还是自研

**决策**：基于 pi-mono 的 Agent Loop 设计，但扩展为多 Agent 感知

**理由**：
- pi-mono 的 Agent Loop 已验证（5 个文件，逻辑清晰）
- Steering/FollowUp 消息队列是优秀设计
- 额外需求：多 Agent 状态隔离、子会话管理——这些在 `@vitamin/orchestrator` 层处理，不污染 Agent 核心

### ADR-005: 扩展系统统一 vs 分离

**决策**：统一 ExtensionAPI（合并 oh-my-opencode Hook + pi-mono Extension）

**理由**：
- 开发者只需学习一套 API
- Hook 本质上是 Extension 事件监听的子集
- 内置功能可以表达为"内置 Extension"（可卸载）
- 统一 API 让 pi-mono Extension 生态可以低成本迁移

### ADR-006: TUI 框架自研 vs 使用 Ink

**决策**：自研（基于 pi-mono 的差异渲染方案）

**理由**：
- Ink 使用 React reconciler，对终端场景过重
- pi-mono 已验证差异渲染 + CSI 2026 方案的可行性和性能
- Extension 需要深度 UI 控制（替换编辑器、自定义 overlay），Ink 难以支持
- 自研保证了对终端 I/O 的完全控制

### ADR-007: Session 存储选用 JSONL vs SQLite

**决策**：JSONL 为默认，SQLite 为可选

**理由**：
- JSONL 无二进制依赖，追加写入性能好
- 树结构在 JSONL 中通过 parentId 自然表达
- SQLite 作为可选后端支持大型会话的快速查询
- pi-mono 已验证 JSONL 树结构的可行性

### ADR-008: Plan/Build 作为内置 vs Extension

**决策**：作为**内置 Extension**（默认启用，可卸载）

**理由**：
- Plan/Build 是 vitamin 的核心差异化功能，应开箱即用
- 但作为 Extension 实现，保持架构一致性
- 用户可通过 `disabled_extensions: ["plan-mode"]` 禁用
- Extension 形式也方便社区贡献替代实现

### ADR-009: Node.js 22 vs Bun

**决策**：Node.js 22+

**理由**：
- 用户明确要求 Node.js
- Node.js 22 是 LTS，企业环境兼容性好
- `--experimental-strip-types` 可用于开发阶段直接运行 TS
- pnpm + Turborepo 在 Node.js 生态成熟度最高
- Bun 生态虽然对 oh-my-opencode 有利（原生 TypeScript），但 Node.js 的稳定性和兼容性更适合框架

### ADR-010: 云端存储选择 PostgreSQL 而非 MongoDB / DynamoDB

**决策**：PostgreSQL 作为云端主存储

**理由**：
- Session 树结构需要递归 CTE 查询（`WITH RECURSIVE`），PostgreSQL 原生支持
- JSONB 类型兼具关系型查询和文档灵活性，适合 session entry 的 content 字段
- 审计日志需要 ACID 事务保证
- PostgreSQL 运维成熟，Supabase / Neon / RDS 等托管服务丰富
- MongoDB 的 `$graphLookup` 性能不如 PostgreSQL CTE
- DynamoDB 不支持复杂查询，树操作需要多次 round trip

### ADR-011: 缓存策略选择 Write-Through + TTL 而非 Write-Behind

**决策**：写时失效（Cache Invalidation）+ TTL 自动过期

**理由**：
- Agent 执行是交互式的，延迟敏感但不是高并发场景
- Write-Behind（异步写）有数据丢失风险，对审计日志不可接受
- Write-Through 确保 PostgreSQL 始终有最新数据，Redis 只是加速读取
- TTL 兜底防止内存泄漏，即使失效逻辑有 bug 也不会导致缓存无限增长
- 会话数据的读写比约 3:1（Agent 循环中读上下文 > 写新消息），缓存收益显著

### ADR-012: 三模式编排(圆桌/Plan/Build) vs 二模式(Plan/Build)

**决策**：保留 Plan/Build 为核心，圆桌模式作为**试验性 Extension** 实现

**理由**：
- 人类团队协作中"头脑风暴→规划→执行"三阶段模式确实比"规划→执行"更完整
- 但 LLM 多角色讨论的实际质量需要实测验证——存在"同模型换语气"退化风险
- 作为 Extension 实现可保持零路径依赖：圆桌模式即使不启用，Plan/Build 完全不受影响
- Token 成本可控（3 轮 × 4 角色 ≈ 15k token），但需要提供早期中断机制
- 建议在 Phase 5+ 里程碑中实验，收集实际效果数据后决定是否内置

### ADR-013: DevTools Inspector 作为内嵌 vs 独立工具

**决策**：内嵌到 `@vitamin/server` 包，通过 `--inspect` 启动

**理由**：
- Agent 调试需要访问运行时内部状态（Agent 状态机、消息队列、system prompt），独立工具无法获取
- 致敬 Node.js `--inspect` 模式，开发者心智模型一致
- 前端产物（React + Vite）打包后内嵌到 server 包，零外部依赖
- 生产环境默认禁用，不增加攻击面
- SSE 日志推送复用 `LogBroadcastHub`，避免重复建设
- 工作量约 15 天，但对开发者体验的提升是量级性的——Agent 应用的调试复杂度远超传统 Web 应用

### ADR-014: 断点引擎采用 Promise 挂起 vs LangGraph 异常+重执行模式

**决策**：采用 Promise 挂起模式（`await pause()` → `resolve()` 恢复）

**备选方案**：
- LangGraph 模式：`interrupt()` 抛异常 → Checkpointer 序列化状态到数据库 → `Command(resume=...)` 从节点头重执行
- Chrome DevTools 协议模式：通过调试协议直接控制 V8 运行时（不适用于 Agent 循环）

**理由**：
- Agent 循环中 `await checkpoint()` 自然暂停异步流程，不需要异常机制，代码更清晰
- 状态保持在内存中，不需要 Checkpointer 持久化层——断点仅用于开发调试，不需要跨进程恢复
- 不重执行节点，完全消除了 LangGraph 的三条 interrupt 规则（幂等性、确定性顺序、无 try/except 包装）
- Inspector 仅在 `--inspect` 模式下激活，无断点时 `checkpoint()` 开销 < 0.1ms（仅 Map 遍历 + 条件匹配）
- ResumeAction 支持 4 种恢复策略（continue/skip_tool/modify_and_continue/abort），比 LangGraph 的单一 `resume` 值更灵活

**权衡**：
- 不适合生产环境 human-in-the-loop（无持久化 → 进程重启后状态丢失）——生产场景另行设计
- 并发多 Agent 时需改为 `Map<agentId, PendingPause>` 支持多断点并行暂停

### ADR-015: 自主 Agent 合成采用 Blueprint + Orchestrator vs 元 LLM 直接编排

**决策**：采用结构化 Blueprint 模式（Sisyphus 生成 `AgentBlueprint` → 引擎合成 `AgentConfig` → `SynthesisOrchestrator` 编排执行）

**备选方案**：
- 元 LLM 直接编排：让一个"超级 Agent"直接用自然语言指令调度临时 Agent，不经过结构化 Blueprint
- 模板库模式：预定义大量 Agent 模板（Zig Expert Template, WASM Expert Template...），需求来了选模板填参数

**理由**：
- Blueprint 是**可审查的结构化数据**——用户在确认环节可以看到每个 Agent 的工具集、token 预算、角色定义，而非黑盒式自然语言
- 引擎层（`synthesizeAgent`）执行**安全检查**（工具白名单、资源上限），将安全边界从 LLM 决策中隔离出来
- Orchestrator 的依赖拓扑图可以在 Inspector 中**可视化展示**，支持断点调试
- Blueprint 可以**缓存和复用**（`CachedBlueprint`），元 LLM 模式每次都从头生成
- Prompt 生成由 Sisyphus 的 LLM 完成（利用其理解能力），配置验证和执行由确定性代码完成（利用代码的可靠性）——"LLM 做创意，代码做约束"

**权衡**：
- Blueprint 结构需要 Sisyphus 学习一个新的 JSON schema（增加 prompt 复杂度）
- 比元 LLM 模式更僵硬，难以处理完全开放式的 Agent 行为定义（如"用你觉得合适的方式去研究"）
- 模板库模式的启动速度更快（不需要 LLM 生成 prompt），但覆盖面受限于模板数量

### ADR-016: 上行反馈采用 Promise 挂起 + 结构化信号 vs 异常冒泡 vs Session 消息轮询

**决策**：采用 Promise 挂起 + 结构化 `EscalationSignal` 模式（子 Agent `await escalate()` → Promise 挂起 → 父 Agent 决策 → `resolve`）

**备选方案**：
- 异常冒泡：子 Agent `throw EscalationError` → 框架捕获 → 序列化到父 → 父决策 → 重启子 Agent。类似 LangGraph 的 `interrupt()` 机制
- Session 消息轮询：子 Agent 在输出中以特定格式标记问题 → 父 Agent 轮询解析 → 发送 follow-up prompt。类似当前 Notepad 文件系统间接通信

**理由**：
- Promise 挂起与 10.4 断点引擎的 `checkpoint()` 使用相同模式，架构一致性高
- 结构化 `EscalationSignal`（6 种类型 + 优先级 + 上下文）比自然语言错误消息更可靠——父 Agent 和自动解决器都能精确匹配处理
- 不需要重启子 Agent（异常模式的问题），子 Agent 的执行状态完全保持
- 不依赖轮询（消息轮询模式的延迟高且不可靠——父 Agent 可能不识别格式化标记）
- 信号冒泡策略（intercept/bubble/transform）提供灵活的分层处理，中间层 Agent 可以拦截自己能处理的反馈

**权衡**：
- 需要子 Agent 学习 `escalate` 工具的使用规范（prompt 变长）
- Promise 挂起期间子 Agent 的资源（内存、连接）被占用
- 异常模式更简单（throw/catch 是编程通识），但重启子 Agent 丢失执行上下文
