# vitamin-coding-agent 开发计划

> 版本：v1.1 | 日期：2026-02-28  
> 基于技术方案 Part 2（架构）、Part 3（包设计）、Part 7（路线图）制定  
> 总工期：15 周（理想） / 19 周（保守）  
> 验收标准按模块粒度定义，每个模块包含功能、质量、文档三类门槛
>
> **配套文档**：[DEVELOPMENT-SPEC.md](DEVELOPMENT-SPEC.md) — 实现规范（类型签名、状态机、算法伪码、错误处理模式）  
> **分析参考**：`analysis/` 目录 — oh-my-opencode 实现分析（Agent/Hook/Orchestrator/Session/MCP 等 12 篇）

---

## 目录

- [总览：依赖拓扑与交付顺序](#总览依赖拓扑与交付顺序)
- [Phase 0：基础设施（Week 1-2）](#phase-0基础设施week-1-2)
- [Phase 1：AI + Agent 核心（Week 3-5）](#phase-1ai--agent-核心week-3-5)
- [Phase 2：编排引擎（Week 6-8）](#phase-2编排引擎week-6-8)
- [Phase 3：会话 + 扩展（Week 9-11 前半）](#phase-3会话--扩展week-9-11-前半)
- [Phase 4：TUI + CLI（Week 11-13）](#phase-4tui--cliweek-11-13)
- [Phase 5：Plan/Build + 高级功能（Week 14-15）](#phase-5planbuild--高级功能week-14-15)
- [里程碑与交付物](#里程碑与交付物)
- [风险登记簿](#风险登记簿)

---

## 总览：依赖拓扑与交付顺序

```
Layer 0 (无依赖)     @vitamin/shared
                          │
Layer 1 (基础层)     ┌────┼────────┐
                     │    │        │
                @vitamin/ai  @vitamin/config  @vitamin/tui
                     │    │
Layer 2 (运行时)     │    │
                @vitamin/agent ◄───┘
                   │    │
Layer 3 (能力层)   │    ▼
                   │  @vitamin/hooks
                   │    │
                   ▼    ▼
              @vitamin/tools
                   │
Layer 4 (编排层)   ▼
            @vitamin/orchestrator
                   │
Layer 5 (集成层) ┌──┼──────┐
                 ▼  ▼      ▼
          @vitamin/ @vitamin/ @vitamin/
          session   mcp      extension
                 │  │        │
Layer 6 (产品层) └──┼────────┘
                    ▼
            @vitamin/coding-agent ──→ @vitamin/tui
                    │
Layer 7 (SDK层)     ▼
                @vitamin/sdk
```

**关键路径**：shared → ai → agent → tools → orchestrator → coding-agent

---

## Phase 0：基础设施（Week 1-2）

### 0.1 Monorepo 骨架

| 项目 | 说明 |
|------|------|
| **工期** | Week 1 前半（2 天） |
| **依赖** | 无 |
| **负责** | 基建 |

**交付物**：

- 初始化 pnpm monorepo + 配置 `pnpm-workspace.yaml`
- Turborepo 增量构建配置（`turbo.json`，6 个 task）
- tsup 子包构建模板（ESM + dts + sourcemap + target node22）
- vitest workspace 测试配置
- Biome lint/format 配置
- TypeScript `tsconfig.base.json`（严格模式全开）
- 创建全部 13 个包骨架（`package.json` + `tsconfig.json` + `src/index.ts`）
- CI pipeline（lint → typecheck → test → build）

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 0.1.1 | `pnpm install` 零错误 | `pnpm install --frozen-lockfile` exit 0 |
| 0.1.2 | `pnpm build` 全量构建成功，所有 13 个包产出 `dist/` | `turbo run build` exit 0 + 检查每个包有 `dist/index.js` + `dist/index.d.ts` |
| 0.1.3 | `pnpm test` 空测试套件通过 | `vitest run` exit 0 |
| 0.1.4 | `pnpm lint` 零 warning | `biome check .` exit 0 |
| 0.1.5 | `pnpm typecheck` 零 error | `turbo run typecheck` exit 0 |
| 0.1.6 | CI pipeline 绿灯 | GitHub Actions 全通过 |
| 0.1.7 | 包间依赖声明正确 | 拓扑构建顺序与设计一致（`turbo run build --dry` 输出验证） |

---

### 0.2 `@vitamin/shared` — 共享工具库

> **实现规范**：[DEVELOPMENT-SPEC.md §S1](DEVELOPMENT-SPEC.md#s1-vitaminshared-实现规范)

| 项目 | 说明 |
|------|------|
| **工期** | Week 1 后半 + Week 2 前半（3 天） |
| **依赖** | 0.1 骨架 |
| **来源** | 03-package-design.md §3.13 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `logger.ts` | pino 结构化日志（JSON → 文件 + 控制台 pretty） |
| `fs.ts` | 文件系统工具（异步读写、mkdirp、rimraf） |
| `path.ts` | 路径归一化、项目根检测 |
| `process.ts` | 子进程管理（spawn + 超时 + 信号转发） |
| `string.ts` | 截断、slug 化、Token 估算 |
| `json.ts` | JSONC 解析 + 安全 stringify |
| `error.ts` | 基础错误类型层级（VitaminError → 子类） |
| `types.ts` | 公共类型（Disposable, AsyncDisposable, Brand） |
| `event-emitter.ts` | 类型安全 EventEmitter（泛型事件映射） |
| `disposable.ts` | 资源清理协议（using 语义） |

**实现约束**（详见 [DEVELOPMENT-SPEC.md §S0-S1](DEVELOPMENT-SPEC.md#s0-全局约束)）：

- **错误层级**：`VitaminError` 基类 → `ConfigError` / `ProviderError` / `StreamError` / `AgentError` / `ToolError` / `HookError` / `SessionError` / `ExtensionError` / `McpError`，所有错误必须携带 `code` + `cause`
- **EventEmitter**：泛型事件映射 `TypedEventEmitter<TEvents>`，编译时拒绝错误事件名/载荷类型（参考 §S1.1）
- **Disposable**：必须支持 ECMAScript `using` / `await using` 语义（参考 §S1.2）
- **进程管理**：超时 → SIGTERM → 5s → SIGKILL，输出默认 60KB 截断（参考 §S1.3）
- **日志**：pino JSON Lines → `/tmp/vitamin.log`，控制台 pino-pretty
- **禁止**：`as any`, `@ts-ignore`, `@ts-expect-error`, 空 catch, >200 LOC 单文件

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 0.2.1 | 日志写入 `/tmp/vitamin.log` 且为合法 JSON Lines | 单测：写 10 条日志 → 逐行 JSON.parse |
| 0.2.2 | EventEmitter 泛型保证类型安全 | 单测：编译时拒绝错误事件名/载荷类型 |
| 0.2.3 | JSONC 解析支持注释和 trailing comma | 单测：含 `//`、`/* */`、尾逗号的输入 → 正确解析 |
| 0.2.4 | VitaminError 捕获栈、code、cause | 单测：throw → catch → 验证 stack/code/cause |
| 0.2.5 | Disposable 支持 `using` 语义 | 单测：`using resource = createDisposable()` → 作用域结束自动清理 |
| 0.2.6 | 单测覆盖率 ≥ 90%（行覆盖） | `vitest run --coverage` |
| 0.2.7 | 零外部运行时依赖（仅 pino） | `package.json` dependencies 仅含 pino |

---

### 0.3 `@vitamin/config` — 多级配置系统

> **实现规范**：[DEVELOPMENT-SPEC.md §S2](DEVELOPMENT-SPEC.md#s2-vitaminconfig-实现规范)

| 项目 | 说明 |
|------|------|
| **工期** | Week 2（3 天） |
| **依赖** | 0.2 shared |
| **来源** | 03-package-design.md §3.8 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `loader.ts` | 6 层配置加载（CLI → env → project → user → extension → default） |
| `parser.ts` | JSONC 解析 + 语法错误部分容错 |
| `merger.ts` | 深度合并策略（数组替换 vs 追加可配） |
| `migrator.ts` | 配置版本迁移（自动升级旧 key） |
| `watcher.ts` | 文件监听 + 事件发射 |
| `schema/*.ts` | Zod v4 完整 Schema（root + 9 子模块） |
| `defaults.ts` | 内置默认值 |

**实现约束**（详见 [DEVELOPMENT-SPEC.md §S2](DEVELOPMENT-SPEC.md#s2-vitaminconfig-实现规范)）：

- **6 层加载管线**：CLI > env > project > user > extension > default（参考 §S2.1 伪码）
- **Partial Parsing**：整体 JSONC 解析失败时按 top-level key 逐个尝试，失败 section 记录 warning 但不阻塞（参考 §S2.2）
- **合并策略**：对象字段 deepMerge，`disabled_*` 数组 Set 并集，标量高优先级覆盖
- **配置迁移**：迁移链 v0→v1→v2 按序执行，迁移不可回滚（参考 §S2.3）
- **格式要求**：JSONC（支持注释 + trailing comma），snake_case keys，Zod v4 校验
- **容错级别**：未知字段 → warning（不 reject），无效 section → 使用 default + warning

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 0.3.1 | 6 层合并优先级正确 | 单测：CLI > env > project > user > extension > default |
| 0.3.2 | JSONC 语法错误报出行号、列号 | 单测：故意错误 → 错误消息含 `line` + `column` |
| 0.3.3 | Zod 验证未知字段警告（不 reject） | 单测：额外字段 → 验证通过 + 控制台 warning |
| 0.3.4 | 迁移跑旧配置自动升级 | 单测：v0 配置 → migrator → v1 配置，key 正确映射 |
| 0.3.5 | watcher 检测文件变更并重新加载 | 单测：写配置文件 → 等 event → 新值生效 |
| 0.3.6 | Schema 导出 JSON Schema 文件 | 构建脚本：`zod-to-json-schema` → `vitamin.schema.json` |
| 0.3.7 | 单测覆盖率 ≥ 85% | `vitest run --coverage` |

---

## Phase 1：AI + Agent 核心（Week 3-5）

### 1.1 `@vitamin/ai` — 统一 LLM API 层

> **实现规范**：[DEVELOPMENT-SPEC.md §S3](DEVELOPMENT-SPEC.md#s3-vitaminai-实现规范)

| 项目 | 说明 |
|------|------|
| **工期** | Week 3-4（10 天） |
| **依赖** | 0.2 shared, 0.3 config |
| **来源** | 03-package-design.md §3.1 |

#### Week 3 交付物：类型系统 + 流式基础 + 前 2 个 Provider

| 文件 | 职责 |
|------|------|
| `types.ts` | 完整类型系统（Model, Message, StreamEvent, ToolDefinition, StreamContext 等 20+ 类型） |
| `stream.ts` | `stream()` / `complete()` / `streamSimple()` 三个入口 |
| `utils/event-stream.ts` | `EventStream<E, R>` 异步迭代器（for await + .result()） |
| `model-registry.ts` | 模型注册表 + 静态模型数据库 |
| `providers/anthropic-messages.ts` | Anthropic Messages API 适配器（流式 + thinking） |
| `providers/openai-completions.ts` | OpenAI Chat Completions 适配器 |
| `providers/openai-responses.ts` | OpenAI Responses API 适配器 |
| `utils/http-client.ts` | HTTP 客户端封装（代理 + 超时 + 重试） |

#### Week 4 交付物：剩余 Provider + Category + Fallback

| 文件 | 职责 |
|------|------|
| `providers/google-generative-ai.ts` | Google GenAI 适配器 |
| `providers/ollama.ts` | 本地 Ollama 适配器 |
| `providers/bedrock-converse.ts` | AWS Bedrock 适配器 |
| `providers/github-copilot.ts` | GitHub Copilot 适配器（OpenAI 兼容 + Copilot Token 鉴权） |
| `providers/registry.ts` | Provider 注册表（动态注册 + 查找） |
| `utils/token-counter.ts` | Token 计数/估算工具 |
| `model-resolver.ts` | Category→Model 三级 fallback 解析 |
| `cost-calculator.ts` | 费用精算（input/output/cache_read/cache_write） |
| `fallback-chain.ts` | Provider fallback 引擎（同提供商重试 + 跨提供商降级） |
| `api-key-resolver.ts` | 多策略 Key 解析（env + OAuth + 动态刷新） |

**实现约束**（详见 [DEVELOPMENT-SPEC.md §S3](DEVELOPMENT-SPEC.md#s3-vitaminai-实现规范)）：

- **Provider 接口**：每个 Provider 必须实现 `ProviderAdapter` 接口（`stream()` + 可选 `healthCheck()`），通过 `ProviderRegistry.register()` 注册（参考 §S3.1）
- **模型适配**（强制）：GPT → `reasoningEffort` + 不设 temperature；Claude → `thinking.budgetTokens`=32000（参考 §S3.2）
- **EventStream**：必须同时支持 `for await` + `.result()` 双模式，8 种事件类型严格遵循（参考 §S3.3）
- **Fallback 算法**：rate_limit/overloaded → 跨 Provider；server_error → 同 Provider 重试；context_overflow → 不重试，触发 compaction（参考 §S3.4）
- **Category 三级解析**：用户配置 > Category 默认 preferredModels > 系统 fallback 链（参考 §S3.5）
- **8 个内置 Category**：general/quick/deep/ui/search/writing/planning/review，各有 preferredModels 链（参考 §S3.6）

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 1.1.1 | Anthropic 流式对话含 thinking 块 | 集成测试：发送 prompt → 收到 thinking_delta + text_delta + done |
| 1.1.2 | OpenAI Completions 流式对话含工具调用 | 集成测试：发送含工具定义 → 收到 tool_call_start/end |
| 1.1.2a | OpenAI Responses API 流式可替代 Completions | 集成测试：同一 prompt 通过 Responses API 完成 |
| 1.1.3 | Google GenAI 基本流式对话 | 集成测试：发送 prompt → 收到完整响应 |
| 1.1.4 | Ollama 本地模型对话 | 集成测试：连接本地 Ollama → 完成对话 |
| 1.1.4a | GitHub Copilot 流式对话可通过 GITHUB_TOKEN 鉴权 | 集成测试：使用 Copilot API → 收到完整响应 |
| 1.1.4b | GitHub Copilot 适配器支持 Copilot Chat 扩展头 | 单测：请求携带 `Copilot-Integration-Id` + `Editor-Version` 等必要头 |
| 1.1.5 | EventStream 支持 `for await` + `.result()` | 单测：mock stream → 逐事件验证 → result 完整 |
| 1.1.6 | Category→Model 三级 fallback 正确 | 单测：用户覆盖 > Category 默认 > 系统 fallback |
| 1.1.7 | Fallback 链：rate_limit 触发跨 Provider 切换 | 单测：第一个 Provider 429 → 自动切到第二个 |
| 1.1.8 | Fallback 链：指数退避正确 | 单测：3 次重试间隔递增（100ms → 200ms → 400ms） |
| 1.1.9 | 费用计算精确到 cache_read/write 分类 | 单测：给定 usage → 计算费用 → 与手算结果对齐 |
| 1.1.10 | API Key 优先级：环境变量 > 配置文件 > OAuth | 单测：三种来源同时存在时取 env |
| 1.1.11 | 模型注册表含 ≥ 15 个模型定义 | 单测：registry.getAll().length >= 15 |
| 1.1.12 | 所有 Provider 适配器实现统一 `ProviderAdapter` 接口 | TypeScript 编译通过 + 每个适配器有独立单测 |
| 1.1.13 | 单测覆盖率 ≥ 80%（不含集成测试） | `vitest run --coverage` |

---

### 1.2 `@vitamin/agent` — 最小化 Agent 运行时

> **实现规范**：[DEVELOPMENT-SPEC.md §S4](DEVELOPMENT-SPEC.md#s4-vitaminagent-实现规范)

| 项目 | 说明 |
|------|------|
| **工期** | Week 4 后半 + Week 5（5 天） |
| **依赖** | 1.1 ai |
| **来源** | 03-package-design.md §3.2 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `types.ts` | AgentStatus, AgentEvent, AgentState, AgentLoopConfig, AgentTool, ToolResult |
| `agent.ts` | Agent 类（状态机 + Steering 队列 + FollowUp 队列 + 事件发射） |
| `agent-loop.ts` | 双层循环：外层 FollowUp / 内层 Tool+Steering |
| `tool-executor.ts` | 工具执行引擎（顺序模式 + 并行模式 + AbortSignal） |
| `agent-factory.ts` | `createAgent()` 工厂 |
| `errors.ts` | AgentError, ToolExecutionError, AbortError |

**实现约束**（详见 [DEVELOPMENT-SPEC.md §S4](DEVELOPMENT-SPEC.md#s4-vitaminagent-实现规范)）：

- **状态机**（强制）：idle → streaming → tool_executing → completed，必须严格遵循 §S4.1 状态转换图，任意状态可转 aborted/error
- **双层循环**（核心算法）：外层处理 FollowUp，内层处理 Tool+Steering，必须实现 maxToolTurns 安全阀（参考 §S4.2 完整伪码）
- **Steering 队列**：工具执行间隙检查，注入后中断剩余排队工具 → 携带 steering 消息回到 LLM（参考 §S4.3）
- **FollowUp 队列**：Agent 完成后自动续跑，优先级高于用户新输入（参考 §S4.4）
- **工具错误处理**：工具抛异常 → 包装为 `ToolResult { isError: true }` → 永远不让工具异常中断 Agent 循环（参考 §S4.5）

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 1.2.1 | 状态机转换完整：idle → streaming → tool_executing → completed | 单测：mock LLM → 验证每个状态转换 emit 正确事件 |
| 1.2.2 | `steer()` 在工具执行间注入消息并中断后续工具 | 单测：3 个工具排队 → 第 1 个执行后 steer → 第 2/3 跳过 |
| 1.2.3 | `followUp()` 在 Agent 完成后自动续跑 | 单测：Agent done → followUp 消息 → 自动进入新循环 |
| 1.2.4 | `abort()` 终止流式和工具执行 | 单测：agent.abort() → 状态变为 aborted → AbortSignal 触发 |
| 1.2.5 | maxToolTurns 限制生效 | 单测：设定 maxToolTurns=3 → 第 4 轮自动停止 |
| 1.2.6 | 工具并行执行模式正确 | 单测：同时执行 3 个工具 → 全部完成 → 合并结果 |
| 1.2.7 | ToolResult 包含 isError 时正确反馈 LLM | 单测：工具返回 isError=true → LLM 收到 tool_result + isError |
| 1.2.8 | Agent 事件完整（15 种事件类型全覆盖） | 单测：完整对话流程 → 验证事件序列 |
| 1.2.9 | 单测覆盖率 ≥ 85% | `vitest run --coverage` |

---

### 1.3 `@vitamin/tools`（基础工具集）

> **实现规范**：[DEVELOPMENT-SPEC.md §S5](DEVELOPMENT-SPEC.md#s5-vitamintools-实现规范)

| 项目 | 说明 |
|------|------|
| **工期** | Week 5 后半（3 天，Phase 1 仅 4 个基础工具） |
| **依赖** | 1.2 agent |
| **来源** | 03-package-design.md §3.4 |

**交付物**（Phase 1 范围：`minimal` 预设）：

| 文件 | 职责 |
|------|------|
| `tool-registry.ts` | 工具注册表（register/getAvailable/applyPreset） |
| `tool-validator.ts` | Zod 参数验证引擎 |
| `builtin/read.ts` | 文件读取（行范围 + 图片缩放） |
| `builtin/write.ts` | 文件创建/覆写 |
| `builtin/edit.ts` | 精确文本替换（oldString → newString） |
| `builtin/bash.ts` | Shell 命令执行（超时 + 信号转发） |

**实现约束**（详见 [DEVELOPMENT-SPEC.md §S5](DEVELOPMENT-SPEC.md#s5-vitamintools-实现规范)）：

- **工具执行管线**（强制）：before hooks → Zod 验证 → execute → after hooks，完整流程见 §S5.1
- **3 种预设**：minimal(4) / standard(10) / full(26+)（参考 §S5.2）
- **bash 安全约束**：超时后 SIGTERM → 5s → SIGKILL，输出默认 60KB 截断
- **edit 严格模式**：不匹配 → isError + “not found”；多匹配 → isError + “ambiguous”

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 1.3.1 | `read` 支持行范围 `startLine`/`endLine` | 单测：读 100 行文件的 10-20 行 → 验证行号 |
| 1.3.2 | `write` 自动创建中间目录 | 单测：写入 `a/b/c/file.txt` → 目录链自动创建 |
| 1.3.3 | `edit` 不匹配时返回 isError=true 且报错清晰 | 单测：oldString 不存在 → 返回 "not found" 错误 |
| 1.3.4 | `edit` 多匹配时拒绝，要求增加上下文 | 单测：oldString 匹配 3 处 → 返回 "ambiguous" 错误 |
| 1.3.5 | `bash` 超时后 kill 进程 + 返回部分输出 | 单测：`sleep 60` + timeout 1s → 输出截断 + isError |
| 1.3.6 | `bash` 60KB 输出自动截断 | 单测：输出 100KB → 截断到 60KB + 截断提示 |
| 1.3.7 | ToolRegistry `minimal` 预设仅含 4 个工具 | 单测：applyPreset("minimal") → getAvailable().size === 4 |
| 1.3.8 | Zod 参数验证拒绝非法输入并返回友好错误 | 单测：缺少 required 字段 → 验证错误消息含字段名 |
| 1.3.9 | 单测覆盖率 ≥ 90% | `vitest run --coverage` |

---

### 里程碑 M1 / MVP 验收（Week 5 末）

> **单 Agent CLI 可工作：LLM 对话 + 4 基础工具**

| # | 端到端验收标准 | 验证方式 |
|---|--------------|---------|
| MVP.1 | 可通过代码创建 Agent 实例并完成对话 | Demo 脚本：`createAgent() → prompt("Hello") → 收到回复` |
| MVP.2 | Agent 可使用 4 个工具完成文件编辑任务 | Demo：`prompt("Create a hello.ts file")` → 调用 write → 文件存在 |
| MVP.3 | Anthropic + OpenAI 两个 Provider 可工作 | Demo：分别用 Claude 和 GPT 完成同一任务 |
| MVP.4 | Category→Model 自动选择正确 | Demo：不指定模型 → 使用 category 默认模型 |
| MVP.5 | 全量构建 < 30s | `time pnpm build` |
| MVP.6 | 全量测试 < 60s | `time pnpm test` |

---

## Phase 2：编排引擎（Week 6-8）

### 2.1 `@vitamin/hooks` — 生命周期 Hook 引擎

> **实现规范**：[DEVELOPMENT-SPEC.md §S6](DEVELOPMENT-SPEC.md#s6-vitaminhooks-实现规范)

| 项目 | 说明 |
|------|------|
| **工期** | Week 6 前半（3 天） |
| **依赖** | 1.2 agent |
| **来源** | 03-package-design.md §3.5 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `hook-engine.ts` | Hook 注册 + 优先级排序 + 链式执行 |
| `safe-hook.ts` | 安全包装（单个 Hook 失败不影响其他 + 错误日志） |
| `types.ts` | 18 种 HookTiming + HookRegistration + HookHandler |
| `core/session/*.ts` | 4 个会话 Hook（first-message, recovery, history, keyword） |
| `core/tool-guard/*.ts` | 4 个工具守卫（file-guard, label-truncator, rules-injector, output-truncation） |
| `core/transform/*.ts` | 3 个消息变换（context-injector, thinking-validator, anthropic-effort） |
| `core/quality/*.ts` | 3 个质量 Hook（comment-checker, babysitting, ralph-loop） |

**实现约束**（详见 [DEVELOPMENT-SPEC.md §S6](DEVELOPMENT-SPEC.md#s6-vitaminhooks-实现规范)）：

- **双重守卫注册**（强制）：`isHookEnabled()` 配置检查 + `safeCreateHook()` 工厂异常不阻塞（参考 §S6.1）
- **执行引擎**：按 priority 排序，链式处理（前一个 output 作为后一个 input），单个 Hook 异常 → log + 跳过（参考 §S6.2）
- **文件守卫复用模式**：Agent 解析 → 工具分类 → 路径策略检查（参考 §S6.3）
- **14 核心 Hook 清单**：见 §S6.4 完整表格（含 timing/priority/功能）
- **错误处理**：Hook 永远不能阻塞主流程，异常只 log 不 throw

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 2.1.1 | Hook 按优先级排序执行（低数字先执行） | 单测：注册 priority=10, 5, 20 → 执行顺序 5→10→20 |
| 2.1.2 | 单个 Hook 抛异常不阻塞后续 Hook | 单测：Hook A throw → Hook B 仍执行 → 错误被日志 |
| 2.1.3 | 链式处理：前一个 Hook 输出作为后一个输入 | 单测：Hook A 修改 message → Hook B 收到修改后的 |
| 2.1.4 | `disable(name)` 运行时禁用指定 Hook | 单测：disable("file-guard") → 执行时跳过 |
| 2.1.5 | file-guard 阻止写入受保护路径 | 单测：write `/etc/passwd` → Hook 拒绝 |
| 2.1.6 | output-truncation 截断超长工具输出 | 单测：工具返回 200KB → 截断到配置上限 |
| 2.1.7 | keyword-detection 检测 plan/build 关键词 | 单测：消息含 "plan" → Hook 设置 metadata |
| 2.1.8 | 14 个核心 Hook 全部注册且可用 | 单测：getRegistered().length >= 14 |
| 2.1.9 | 单测覆盖率 ≥ 85% | `vitest run --coverage` |

> **补充说明**：§3.5 设计中的 ~37 个核心 Hook 在 Phase 2 仅交付 14 个高优先级 Hook。剩余核心 Hook、7 个 Continuation Hook（compaction-context, compaction-todo, continuation-prompt, background-notification 等）和 2 个 Skill Hook（skill-reminder, skill-auto-command）将在 Phase 3–5 随对应子系统一起交付。

---

### 2.2 `@vitamin/tools`（扩展工具集）

> **实现规范**：[DEVELOPMENT-SPEC.md §S5](DEVELOPMENT-SPEC.md#s5-vitamintools-实现规范)

| 项目 | 说明 |
|------|------|
| **工期** | Week 6 后半（2 天，补充 6 个搜索工具） |
| **依赖** | 1.3 tools 基础, 2.1 hooks |
| **来源** | 03-package-design.md §3.4 |

**交付物**（从 `minimal` 升级到 `standard` 预设）：

| 文件 | 职责 |
|------|------|
| `builtin/grep.ts` | 正则/文本搜索（ripgrep 风格） |
| `builtin/glob.ts` | 文件名 glob 匹配 |
| `builtin/find.ts` | 文件查找（按名称/类型/大小/修改时间） |
| `builtin/ls.ts` | 目录列表（递归可选） |
| `builtin/ast-grep.ts` | AST 结构化搜索（依赖 @ast-grep/napi） |
| `orchestration/delegate-task.ts` | task() 委派入口（占位，Phase 2 中接实现） |

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 2.2.1 | `grep` 支持正则 + 大小写选项 + maxResults | 单测：grep 已知文件 → 匹配行号正确 |
| 2.2.2 | `glob` 支持 `**/*.ts` 递归匹配 | 单测：workspace 下 glob → 结果与 fs 遍历一致 |
| 2.2.3 | `ast-grep` 可搜索 TypeScript AST 模式 | 单测：搜索 `function $NAME($$$)` → 匹配函数声明 |
| 2.2.4 | `standard` 预设含 10 个工具 | 单测：applyPreset("standard") → getAvailable().size === 10 |
| 2.2.5 | 所有搜索工具遵守输出截断限制 | 单测：大仓库搜索 → 输出 ≤ 60KB |

---

### 2.3 `@vitamin/orchestrator` — 多 Agent 编排引擎

> **实现规范**：[DEVELOPMENT-SPEC.md §S7](DEVELOPMENT-SPEC.md#s7-vitaminorchestrator-实现规范)

| 项目 | 说明 |
|------|------|
| **工期** | Week 7-8（10 天） |
| **依赖** | 2.1 hooks, 2.2 tools, 1.2 agent, 1.1 ai |
| **来源** | 03-package-design.md §3.3 |

#### Week 7 交付物：注册表 + 调度核心 + Category 映射

| 文件 | 职责 |
|------|------|
| `registry/agent-registry.ts` | Agent 注册/查找/热插拔/委派表生成 |
| `registry/agent-metadata.ts` | Agent Prompt 元数据（category/cost/triggers） |
| `delegation/task-dispatcher.ts` | `task()` 核心调度（category 路径 + subagent 路径） |
| `delegation/category-resolver.ts` | Category→Agent 映射 |
| `delegation/execution-modes.ts` | sync/background 执行模式 |
| `background/background-manager.ts` | 并发控制（5 per model/provider） + 生命周期 |

#### Week 8 交付物：5 个内置 Agent + 动态 Prompt

| 文件 | 职责 |
|------|------|
| `agents/sisyphus.ts` | 主编排器（Intent Gate + 委派路由） |
| `agents/hephaestus.ts` | 自主深度工作者 |
| `agents/explore.ts` | 代码库搜索（只读） |
| `agents/oracle.ts` | 战略顾问（只读） |
| `agents/librarian.ts` | 外部知识搜索（只读） |
| `agents/sisyphus-junior.ts` | Category 分类执行器（小任务快速执行） |
| `dynamic-prompt/prompt-builder.ts` | Agent 感知的 Prompt 动态生成 |
| `dynamic-prompt/agent-summaries.ts` | Agent 能力摘要 |

**实现约束**（详见 [DEVELOPMENT-SPEC.md §S7](DEVELOPMENT-SPEC.md#s7-vitaminorchestrator-实现规范)）：

- **task() 双路径调度**（核心算法）：`subagent` 路径 → 直接实例化；`category` 路径 → 创建 Sisyphus-Junior（参考 §S7.1 完整伪码）
- **Plan Family 反递归守卫**（强制）：`isPlanFamily()` 检查 prometheus/atlas/momus/metis 不能互相委派（参考 §S7.2）
- **并发控制**：默认 5 个并发 slot per `provider/model`（参考 §S7.3）
- **任务状态机**：pending → running → completed/error/cancelled（参考 §S7.4）
- **动态 Prompt 构建**：3 张表注入 Sisyphus system prompt（委派表 + 触发表 + 工具表），禁用的 Agent 不出现在表中（参考 §S7.6）
- **Sisyphus 4 阶段工作流**：Intent Gate → Codebase Assessment → Explore/Implement → Completion（参考 §S7.7）
- **Agent Fallback Chain**：每个 Agent 的模型优先级链必须与 §S7.8 数据对齐
- **工具限制**：explore/oracle/librarian 只读；atlas 禁止 write/edit/bash（参考 [DEVELOPMENT-SPEC.md §S5.3](DEVELOPMENT-SPEC.md#s53-agent-工具限制表强制)）

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 2.3.1 | AgentRegistry 注册 6 个内置 Agent | 单测：getAvailable().length === 6 |
| 2.3.2 | `task({ category: "quick" })` 路由到正确 Agent | 单测：quick → sisyphus-junior（或配置的默认执行器） |
| 2.3.3 | `task({ subagent: "explore" })` 直接实例化并执行 | 单测：mock LLM → explore agent 返回搜索结果 |
| 2.3.4 | 后台模式：task 返回后可查状态 | 单测：background task → result.status === "running" → 轮询 → completed |
| 2.3.5 | 并发限制：同时 6 个后台任务 → 第 6 个排队 | 单测：limit=5 → 前 5 个立即执行，第 6 个等待 |
| 2.3.6 | 动态 Prompt 注入委派表 | 单测：buildDelegationTable() 含所有可用 Agent 名称/触发条件 |
| 2.3.7 | Sisyphus Intent Gate 正确分类 | 单测：简单问题 → 直接执行；"refactor the auth" → 标记为复杂 |
| 2.3.8 | Agent 热插拔：disable("librarian") 后 Sisyphus 不委派给它 | 单测：disable → 委派表不含 librarian |
| 2.3.9 | explore Agent 工具限制：仅使用只读工具 | 单测：explore 的 toolSet 不含 write/edit/bash |
| 2.3.10 | 单测覆盖率 ≥ 80% | `vitest run --coverage` |

---

### 里程碑 M2 验收（Week 8 末）

> **多 Agent 编排可工作：task() 委派 + 6 Agent**

| # | 端到端验收标准 | 验证方式 |
|---|--------------|---------|
| M2.1 | Sisyphus 可将探索任务委派给 explore | Demo：`prompt("Find all auth-related files")` → explore 执行 → 返回文件列表 |
| M2.2 | Category 路由自动选择模型并创建 Agent 实例 | Demo：`task({ category: "quick", prompt: "..." })` → 使用 haiku 模型 |
| M2.3 | sisyphus-junior 可处理 quick category 任务 | Demo：`task({ category: "quick" })` → sisyphus-junior 执行 |
| M2.4 | 后台任务并行运行 | Demo：同时启动 3 个后台 task → 全部完成 |
| M2.5 | Hook 链在 Agent 循环中正确触发 | 日志验证：tool.execute.before → 工具执行 → tool.execute.after |

---

## Phase 3：会话 + 扩展（Week 9-11）

> **注意**：Phase 3 扩展至 Week 11 前半周（原 Week 9-10 过于紧凑），MCP 从 2 天调至 4 天，Session/Extension 时间线重叠优化。

### 3.1 `@vitamin/session` — 会话管理

> **实现规范**：[DEVELOPMENT-SPEC.md §S8](DEVELOPMENT-SPEC.md#s8-vitaminsession-实现规范)

| 项目 | 说明 |
|------|------|
| **工期** | Week 9（5 天） |
| **依赖** | 1.2 agent, 1.1 ai |
| **来源** | 03-package-design.md §3.7 |
| **范围说明** | SQLite 存储（`sqlite-storage.ts`）和 Gist 导出（`gist-export.ts`）推迟至 v0.2.0 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `session-manager.ts` | CRUD + 列表 + 恢复 |
| `session-tree.ts` | 树结构操作（fork, navigateTo, getTree） |
| `storage/jsonl-storage.ts` | JSONL 追加写入存储 |
| `compaction/compactor.ts` | 压缩引擎入口 |
| `compaction/strategies/summary.ts` | LLM 全量摘要策略 |
| `compaction/strategies/sliding-window.ts` | 滑动窗口策略 |
| `compaction/strategies/incremental.ts` | 增量压缩策略（vitamin 独创） |
| `compaction/todo-preserver.ts` | 压缩时 Todo 状态保留 |
| `export/html-export.ts` | HTML 会话导出 |

**实现约束**（详见 [DEVELOPMENT-SPEC.md §S8](DEVELOPMENT-SPEC.md#s8-vitaminsession-实现规范)）：

- **JSONL 存储**：每条消息一行 JSON，追加写入，每条 append 后 fsync（断电安全）（参考 §S8.1）
- **Session 树操作**：fork（从任意节点创建分支）、navigateTo（跳转到树中任意节点）、getTree（获取完整树结构）（参考 §S8.2）
- **增量压缩算法**（强制）：仅对“新过期”消息摘要，保留最近 N 条原文 + Todo 状态（参考 §S8.3 完整伪码）
- **Boulder State**：`.vitamin/boulder.json` 存储 Plan/Build 跨 Session 状态（active_plan/session_ids/progress），新 session 启动时自动恢复（参考 §S8.4）
- **存储格式**：SQLite 推迟到 v0.2.0，MVP 仅使用12 JSONL

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 3.1.1 | JSONL 追加写入不丢数据（断电安全） | 单测：写 50 条 → 每条后检查文件 → 全部可回读 |
| 3.1.2 | 会话树 fork 创建正确的分支结构 | 单测：线性 A→B→C → fork at B → 新分支 B→D → getTree 验证 |
| 3.1.3 | navigateTo 可跳转到树中任意节点 | 单测：4 个分支 → navigateTo 每个叶节点 → 消息历史正确 |
| 3.1.4 | 增量压缩保留最近 N 条原文 | 单测：retainRecent=5 → 30 条消息压缩 → 前 25 条摘要 + 后 5 条原文 |
| 3.1.5 | 增量压缩合并已有摘要（不重复摘要） | 单测：第一次压缩 → 5 条新消息 → 第二次压缩 → 仅摘要新增部分 |
| 3.1.6 | Todo 状态在压缩后保留 | 单测：消息含 todo list → 压缩 → todo 状态在上下文中可见 |
| 3.1.7 | 会话列表含创建时间、标签、消息数 | 单测：create 3 个 → list() → 全部返回且字段完整 |
| 3.1.8 | 会话恢复：打开时自动恢复上次会话 | 单测：create + persist → recover() → 返回相同会话 |
| 3.1.9 | HTML 导出含语法高亮 | 单测：导出含代码块的会话 → HTML 含 `<code>` 标签 |
| 3.1.10 | 单测覆盖率 ≥ 85% | `vitest run --coverage` |

---

### 3.2 `@vitamin/extension` — 扩展系统

> **实现规范**：[DEVELOPMENT-SPEC.md §S9](DEVELOPMENT-SPEC.md#s9-vitaminextension-实现规范)

| 项目 | 说明 |
|------|------|
| **工期** | Week 9 后半 + Week 10 前半（3 天） |
| **依赖** | 2.1 hooks, 2.3 orchestrator, 1.3 tools |
| **来源** | 03-package-design.md §3.6 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `types.ts` | ExtensionAPI + ExtensionUIContext（完整接口定义） |
| `extension-runner.ts` | 扩展运行器（发现 → 加载 → 注入 → 执行） |
| `extension-loader.ts` | 五源发现（内置/npm/local/git/config） |
| `tool-wrapper.ts` | 工具拦截包装器（Extension 可阻止/修改工具调用） |
| `api-builder.ts` | ExtensionAPI 构建器（组装 hooks/tools/agent 引用） |

**实现约束**（详见 [DEVELOPMENT-SPEC.md §S9](DEVELOPMENT-SPEC.md#s9-vitaminextension-实现规范)）：

- **加载流程**：discover → import() → apiBuilder.build() → extensionFactory(api) → 捕获异常 + 跳过（参考 §S9.1）
- **异常隔离**（强制）：Extension 永远不能影响主流程 — 注册/事件/工具拦截均独立 try-catch（参考 §S9.2）
- **事件清单**：20+ 事件类型（session/agent/message/tool/context/input/model/resources）（参考 §S9.3）
- **Git 来源推迟**：v0.1.0 仅支持 npm + local，Git 推迟到 v0.2.0

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 3.2.1 | Extension 可注册新工具，Agent 可调用 | 集成测试：扩展注册 `my_tool` → prompt 触发 → 工具执行 |
| 3.2.2 | Extension 可注册 /command 斜杠命令 | 单测：registerCommand("test") → 命令列表含 /test |
| 3.2.3 | Extension 通过 `on("tool.call")` 可阻止工具调用 | 单测：拦截 bash → 返回 preventDefault → 工具不执行 |
| 3.2.4 | Extension 通过 `on("tool.result")` 可修改结果 | 单测：修改 read 返回值 → Agent 收到修改后内容 |
| 3.2.5 | ExtensionLoader 从 5 种来源发现扩展 | 单测：mock 5 个来源 → discover() 返回全部 |
| 3.2.6 | Extension 异常不影响主流程 | 单测：Extension throw → Agent 正常继续 |
| 3.2.7 | Extension 间事件总线通信 | 单测：Ext A 发事件 → Ext B 收到 |
| 3.2.8 | 单测覆盖率 ≥ 80% | `vitest run --coverage` |

---

### 3.3 `@vitamin/mcp` — MCP 协议支持

> **实现规范**：[DEVELOPMENT-SPEC.md §S10](DEVELOPMENT-SPEC.md#s10-vitaminmcp-实现规范)

| 项目 | 说明 |
|------|------|
| **工期** | Week 10（4 天） |
| **依赖** | 3.2 extension, 1.3 tools |
| **来源** | 03-package-design.md §3.9 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `mcp-client.ts` | 统一 MCP 客户端（tool list / tool call） |
| `mcp-registry.ts` | MCP 服务注册表 |
| `mcp-loader.ts` | `.vitamin/mcp.json` 配置加载 + `${VAR}` 展开 |
| `transports/stdio.ts` | stdio 传输层 |
| `transports/http.ts` | HTTP/SSE 传输层 |
| `builtin/websearch.ts` | 内置 websearch MCP |
| `skill-mcp-manager.ts` | Skill 嵌入 MCP 管理器（生命周期 + 自动启停） |
| `oauth-manager.ts` | OAuth 令牌管理 |

**实现约束**（详见 [DEVELOPMENT-SPEC.md §S10](DEVELOPMENT-SPEC.md#s10-vitaminmcp-实现规范)）：

- **三层加载优先级**：内置 > 用户配置 > Skill 嵌入（参考 §S10.1）
- **工具命名空间**（强制）：`mcp__{mcpName}__{toolName}` 格式，Agent 通过前缀过滤（参考 §S10.2）
- **Skill MCP 生命周期**：Skill 激活 → start → tool/list → 注册；Skill 停用 → stop → 移除工具；崩溃 → 自动重启（最多 3 次）（参考 §S10.3）
- **环境变量展开**：`${VAR}` 语法，支持嵌套和默认值

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 3.3.1 | stdio 传输可启动子进程并通信 | 集成测试：启动 mock MCP server → tool/list → 返回工具 |
| 3.3.2 | HTTP 传输支持 SSE 流式 | 集成测试：连接 HTTP MCP → tool/call → 收到流式结果 |
| 3.3.3 | `${VAR}` 环境变量展开正确 | 单测：配置含 `${HOME}` → 展开为实际路径 |
| 3.3.4 | 三层 MCP 加载优先级正确 | 单测：内置 > 用户配置 > Skill 嵌入 |
| 3.3.5 | MCP 工具注册到 Agent 可用 | 集成测试：MCP 暴露 `search` 工具 → Agent 工具列表含 `mcp__search` |
| 3.3.6 | OAuth 令牌自动刷新 | 单测：mock 过期令牌 → 自动 refresh → 新令牌可用 |
| 3.3.7 | 单测覆盖率 ≥ 80% | `vitest run --coverage` |

---

### 里程碑 M3 验收（Week 11 前半末）

> **Extension 系统可用，Session 树可用**

| # | 端到端验收标准 | 验证方式 |
|---|--------------|---------|
| M3.1 | 创建会话 → 对话 → fork → 切换回主线 → 两个分支消息独立 | Demo 脚本 |
| M3.2 | 安装第三方 Extension（npm 包）→ Extension 工具可用 | 安装 mock ext → Agent 成功调用 |
| M3.3 | 连接外部 MCP server → MCP 工具在对话中可调用 | 连接 mock MCP → Agent 使用 MCP 工具 |
| M3.4 | 上下文压缩自动触发 → 对话继续不丢关键信息 | 100 条消息 → 压缩 → 后续对话仍知道之前内容 |

---

## Phase 4：TUI + CLI（Week 11-13）

### 4.1 `@vitamin/tui` — 终端 UI 框架

> **实现规范**：[DEVELOPMENT-SPEC.md §S11](DEVELOPMENT-SPEC.md#s11-vitamintui-实现规范)

| 项目 | 说明 |
|------|------|
| **工期** | Week 11-12（10 天） |
| **依赖** | 0.2 shared |
| **来源** | 03-package-design.md §3.10 |

#### Week 11 交付物：渲染引擎 + 基础组件

| 文件 | 职责 |
|------|------|
| `renderer.ts` | 差异渲染引擎（每帧 string[] → diff → 最小化 CSI 输出） |
| `terminal.ts` | 终端抽象（TTY I/O + 尺寸监听 + 原始模式） |
| `theme.ts` | 主题系统（颜色/样式/间距配置 + 热重载） |
| `components/text.ts` | 多行文本 + 自动折行 |
| `components/input.ts` | 单行输入（光标 + 历史） |
| `components/editor.ts` | 多行编辑器（Tab 补全 + 粘贴处理） |
| `components/markdown.ts` | Markdown 渲染（语法高亮） |
| `components/loader.ts` | 加载动画（spinner） |
| `input/key-parser.ts` | 按键解析（方向键/Ctrl+X/IME） |

#### Week 12 交付物：高级组件 + Overlay

| 文件 | 职责 |
|------|------|
| `components/select-list.ts` | 交互式选择列表（搜索过滤） |
| `components/image.ts` | 内联图片（Kitty/iTerm2 协议） |
| `components/box.ts` | 布局盒子（border + padding） |
| `overlays/overlay-manager.ts` | Overlay 管理器（z-index + 焦点） |
| `input/ime-handler.ts` | IME 输入法支持（CJK 双宽度） |
| `utils/measure.ts` | 字符宽度测量 |
| `utils/ansi.ts` | ANSI 颜色/样式工具 |

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 4.1.1 | 差异渲染：相同内容不产生终端输出 | 单测：相同 string[] 连续两帧 → 第二帧 CSI 输出为空 |
| 4.1.2 | 差异渲染：单行变更仅输出该行 | 单测：10 行中第 5 行变更 → 仅产生 1 行 CSI 输出 |
| 4.1.3 | CSI 2026 同步输出消除闪烁 | 单测：输出包含 CSI 2026 begin/end 序列 |
| 4.1.4 | Markdown 渲染含代码高亮 | 单测：\`\`\`ts 块 → 输出含 ANSI 颜色码 |
| 4.1.5 | 编辑器支持多行粘贴 | 单测：paste 5 行 → editor 内容正确 |
| 4.1.6 | CJK 字符双宽度测量正确 | 单测："你好" → width === 4 |
| 4.1.7 | SelectList 搜索过滤 | 单测：3 选项 → 输入 "ab" → 仅显示含 "ab" 的选项 |
| 4.1.8 | 终端尺寸变更触发重绘 | 单测：mock resize event → renderer 重新调用 |
| 4.1.9 | 主题热重载 | 单测：更新 theme 配置 → 组件颜色立即变更 |
| 4.1.10 | 单测覆盖率 ≥ 75% | `vitest run --coverage`（UI 组件覆盖率标准略低） |

---

### 4.2 `@vitamin/coding-agent` — 主产品 CLI

> **实现规范**：[DEVELOPMENT-SPEC.md §S12](DEVELOPMENT-SPEC.md#s12-vitamincoding-agent-实现规范)

| 项目 | 说明 |
|------|------|
| **工期** | Week 12-13（8 天） |
| **依赖** | 所有其他包 |
| **来源** | 03-package-design.md §3.11 |

#### Week 12 后半交付物：核心 + 非交互模式

| 文件 | 职责 |
|------|------|
| `cli.ts` | Commander.js CLI 定义（vitamin + 子命令） |
| `main.ts` | 启动流程（7 步初始化） |
| `core/agent-session.ts` | AgentSession（组装所有子系统） |
| `core/system-prompt.ts` | 系统提示构建（Agent 元数据 + 活跃工具 + 项目上下文） |
| `core/resource-loader.ts` | AGENTS.md / .vitamin/ 资源加载 |
| `modes/print/` | 非交互打印模式 |
| `modes/json/` | JSON 输出模式 |
| `commands/run.ts` | `vitamin run` 命令 |

**实现约束**（详见 [DEVELOPMENT-SPEC.md §S12](DEVELOPMENT-SPEC.md#s12-vitamincoding-agent-实现规范)）：

- **7 步初始化序列**（强制顺序）：parseCLI → loadConfig → initSubsystems(7 并行) → createAgentSession → selectMode → loadResources → enterMainLoop（参考 §S12.1）
- **System Prompt 6 层结构**：身份 + 委派表 + 工具列表 + 项目上下文 + Active Skills + Category 信息（参考 §S12.2）
- **Chat Loop 核心流程**：input → Extension 拦截 → 斜杠命令 → Skill 展开 → Hook:before → Agent.prompt() → Hook:after → persist → 费用统计（参考 §S12.3）
- **冷启动目标**：< 2s（到可输入状态）

#### Week 13 交付物：交互模式 + 剩余命令

| 文件 | 职责 |
|------|------|
| `modes/interactive/app.ts` | TUI 交互应用 |
| `modes/interactive/pages/` | 对话页、会话列表页、设置页 |
| `modes/interactive/widgets/` | 消息气泡、工具卡片、状态栏、成本面板 |
| `core/keybindings.ts` | 键绑定（Ctrl+C/D/Z/L、方向键、Tab） |
| `core/slash-commands.ts` | 斜杠命令 (/model, /session, /clear, /export, /compact) |
| `commands/doctor.ts` | `vitamin doctor` 健康检查 |
| `commands/install.ts` | `vitamin install` 交互式设置 |
| `commands/config.ts` | `vitamin config` 配置管理 |

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 4.2.1 | `vitamin "Fix the bug"` 非交互模式完成对话 | E2E：命令行运行 → 输出结果 → exit 0 |
| 4.2.2 | `vitamin` 进入 TUI 交互模式 | E2E：启动 → 看到输入框 + 状态栏 |
| 4.2.3 | `vitamin --json "query"` 输出合法 JSON | E2E：stdout 为合法 JSON → 含 messages 数组 |
| 4.2.4 | `/model claude-opus` 运行时切换模型 | 交互测试：切换后新对话使用新模型 |
| 4.2.5 | `/session list` 展示所有会话 | 交互测试：创建 3 个会话 → list 显示 3 个 |
| 4.2.6 | `/compact` 手动触发压缩 | 交互测试：执行后上下文 token 减少 |
| 4.2.7 | Ctrl+C 中断当前 Agent 运行 | 交互测试：Agent 流式中 → Ctrl+C → 停止 + 提示 |
| 4.2.8 | `vitamin doctor` 检查环境 | E2E：输出 Node.js 版本、API Key 状态、依赖状态 |
| 4.2.9 | `vitamin install` 引导设置 API Key | E2E：交互式输入 → 写入配置文件 |
| 4.2.10 | 启动到可输入 < 2s（冷启动） | 性能测试：`time vitamin --print "hello"` |
| 4.2.11 | 系统提示含项目上下文（AGENTS.md 内容） | 单测：项目下有 AGENTS.md → 系统提示包含其内容 |

---

### 4.3 `@vitamin/sdk` — 嵌入式 SDK

> **实现规范**：[DEVELOPMENT-SPEC.md §S13](DEVELOPMENT-SPEC.md#s13-vitaminsdk-实现规范)

| 项目 | 说明 |
|------|------|
| **工期** | Week 13 后半（2 天） |
| **依赖** | 4.2 coding-agent |
| **来源** | 03-package-design.md §3.12 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `index.ts` | `createVitaminAgent()` 工厂 |
| `agent-stream.ts` | AgentStream（asyncIterator + result()） |
| `rpc-server.ts` | JSON-RPC server（供外部进程调用） |
| `rpc-client.ts` | JSON-RPC client（对接 rpc-server） |

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 4.3.1 | `createVitaminAgent()` 返回可用实例 | 单测：创建 → prompt() → 收到回复 |
| 4.3.2 | AgentStream 支持 `for await` 逐事件消费 | 单测：流式迭代 → 收到 start/text_delta/done |
| 4.3.3 | SDK `steer()` / `abort()` 可控制 Agent | 单测：prompt → steer 中断 → 注入新消息 |
| 4.3.4 | RPC 模式：跨进程通信 | 集成测试：启动 rpc server → rpc client prompt → 收到结果 |
| 4.3.5 | SDK `dispose()` 清理所有资源 | 单测：dispose → 进程/文件句柄全部关闭 |
| 4.3.6 | npm 可发布（类型声明完整） | `npm pack --dry-run` + 检查 d.ts |

---

### 里程碑 M4 / GA 验收（Week 13 末）

> **完整 CLI 产品可用：多 Agent + Extension + TUI + SDK**

| # | 端到端验收标准 | 验证方式 |
|---|--------------|---------|
| GA.1 | 完整交互式对话：输入 → Agent 思考 → 工具调用 → 结果展示 | 手动测试 |
| GA.2 | 多 Agent 委派：复杂问题 → Sisyphus 委派 → 子 Agent 执行 → 结果汇总 | 手动测试 |
| GA.3 | 会话管理：创建 / fork / 切换 / 恢复 / 导出 | 手动测试 |
| GA.4 | Extension 安装并生效 | 安装 mock extension → 工具/命令可用 |
| GA.5 | MCP 连接并可用 | 连接外部 MCP server → 工具可用 |
| GA.6 | SDK 嵌入到 Node.js 应用 | Demo 应用使用 @vitamin/sdk |
| GA.7 | 三种模式均可工作（interactive/print/json） | 分别测试三种模式 |
| GA.8 | 全量测试 < 120s | `time pnpm test` |
| GA.9 | 全量构建 < 60s | `time pnpm build` |

---

## Phase 5：Plan/Build + 高级功能（Week 14-15）

### 5.1 高级 Agent + Plan/Build

> **实现规范**：[DEVELOPMENT-SPEC.md §S14](DEVELOPMENT-SPEC.md#s14-跨模块集成-spec)

| 项目 | 说明 |
|------|------|
| **工期** | Week 14（5 天） |
| **依赖** | Phase 4 全部完成 |
| **来源** | 03-package-design.md §3.3, 04-core-flows.md §4.2 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `agents/prometheus/` | 计划生成器（Interview → Plan Generation，6 个子文件） |
| `agents/momus.ts` | 计划审查员 |
| `agents/metis.ts` | 计划前分析师 |
| `agents/atlas/` | Todo 编排执行器（DAG 拓扑排序 + 并行分发） |
| `agents/multimodal-looker.ts` | 多模态查看器（截图/图片分析） |
| `plan-build/plan-pipeline.ts` | Metis→Prometheus→Momus 管线 |
| `plan-build/plan-executor.ts` | 计划执行引擎 |
| `plan-build/plan-storage.ts` | `.vitamin/plans/` 文件管理 |

**实现约束**（详见 [DEVELOPMENT-SPEC.md §S14](DEVELOPMENT-SPEC.md#s14-跨模块集成-spec)）：

- **6 步 Plan/Build 完整流程**（强制）：意图检测 → 预分析(Metis) → 规划(Prometheus) → 审查(Momus) → 执行(Atlas) → 完成（参考 §S14.1 完整伪码）
- **Prometheus Interview**：自动预研 + 用户提问（≥ 3 个问题），可写入路径受 prometheus-md-only hook 限制（仅 `.vitamin/plans/*.md`）
- **Momus 审查**：temperature=0.1，80% 通过偏好，拒绝时最多 3 条 issue，拒绝 → 反馈 Prometheus 修订（最多 2 轮）
- **Atlas DAG 执行**：提取 checkbox → 构建依赖拓扑 → 可并行步骤同时 task() → 失败时取消依赖步骤
- **Continuation Hook 触发链**：todo-continuation-enforcer + atlas-boulder-continuation + unstable-agent-babysitter（参考 §S14.2）
- **Thinking Block 校验**：空 thinking 移除 + 乱序重排 + 截断的 thinking 移除（参考 §S14.3）
- **Model Fallback 事件处理**：429 → 跨 Provider；500 → 同 Provider 重试；context_overflow → compaction；401 → 报告用户（参考 §S14.4）

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 5.1.1 | Prometheus Interview 模式可与用户交互 | 集成测试：提供需求 → 自动提出 ≥ 3 个澄清问题 |
| 5.1.2 | Prometheus 生成结构化计划（含步骤/依赖/估时） | 集成测试：输出含 steps[] + dependencies + estimates |
| 5.1.3 | Momus 审查通过/拒绝并给出理由 | 集成测试：好计划 → 通过；漏洞计划 → 拒绝 + 理由 |
| 5.1.4 | Atlas 按 DAG 拓扑并行执行 | 单测：3 步骤（A→B, A→C, B+C→D）→ A 先执行 → B/C 并行 → D 最后 |
| 5.1.5 | Atlas 步骤失败时正确回退 | 单测：步骤 B 失败 → 依赖 B 的步骤 D 取消 → 报告失败 |
| 5.1.6 | 计划文件持久化到 `.vitamin/plans/` | 集成测试：生成计划 → 文件存在且可重新加载 |
| 5.1.7 | `/plan` 命令触发完整 Plan 管线 | E2E：/plan "refactor auth" → 输出计划 |
| 5.1.8 | `/start-work` 命令执行已有计划 | E2E：/start-work plan-name → Atlas 执行 |

---

### 5.2 内置 Extension + 剩余工具

| 项目 | 说明 |
|------|------|
| **工期** | Week 14-15（4 天） |
| **依赖** | 5.1 Plan/Build, 3.2 extension |
| **来源** | 03-package-design.md §3.4, 05-extension-system.md |

**交付物**：

| 文件 | 职责 |
|------|------|
| `extensions/plan-mode/` | Plan/Build 模式 Extension |
| `extensions/skill-loader/` | Skill 系统 Extension |
| `extensions/git-master/` | Git 高级操作 Extension |
| `extensions/tmux-manager/` | Tmux 会话管理 Extension |
| `builtin/edit-diff.ts` | 差异编辑（模糊匹配） |
| `builtin/look-at.ts` | 多模态查看 |
| `builtin/interactive-bash.ts` | 交互式终端 |
| `builtin/hashline-edit.ts` | Hashline 编辑 |
| `orchestration/*.ts` | 完整编排工具（5 个） |
| `skill/*.ts` | Skill 工具（3 个） |
| `session/session-manager.ts` | 会话管理工具 |
| `task/*.ts` | 任务管理工具（task-create, task-get, task-list, task-update） |

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 5.2.1 | `full` 预设含 ≥ 26 个工具 | 单测：applyPreset("full") → getAvailable().size >= 26 |
| 5.2.2 | plan-mode Extension 注册 /plan + /start-work 命令 | 单测：加载 Extension → 命令列表含两个命令 |
| 5.2.3 | skill-loader 从 SKILL.md 加载并注入上下文 | 单测：mock SKILL.md → 加载 → 上下文含 skill 内容 |
| 5.2.4 | git-master 可执行 commit/push/branch 操作 | 集成测试：在 git repo 中使用 |
| 5.2.5 | tmux-manager 创建/管理 tmux session | 集成测试：创建 session → 列表 → 销毁 |
| 5.2.6 | edit-diff 模糊匹配打开时可编辑相似行 | 单测：oldString 有微小差异 → 仍能匹配并替换 |
| 5.2.7 | look-at 支持截图分析 | 集成测试：传入图片 → 返回多模态描述 |

---

### 5.3 E2E 测试 + 文档 + 发布

| 项目 | 说明 |
|------|------|
| **工期** | Week 15（5 天） |
| **依赖** | 5.1 + 5.2 |

**交付物**：

| 交付物 | 说明 |
|--------|------|
| `tests/e2e/` | 10+ E2E 测试用例（真实 LLM 调用 + 全链路） |
| `docs/` | API 文档 + 快速开始 + Extension 开发指南 |
| `CHANGELOG.md` | v0.1.0 变更日志 |
| npm publish | 13 个包发布到 npm |
| GitHub Release | v0.1.0 tag + release notes |

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 5.3.1 | E2E 覆盖核心场景（对话/工具/多 Agent/Plan/Session/MCP） | 至少 10 个 E2E 测试用例通过 |
| 5.3.2 | 文档站可访问 + 快速开始 < 5 分钟可跑通 | 人工验证 |
| 5.3.3 | Extension 开发指南完整（含 3 个示例） | 文档包含基础/高级/UI 三种 Extension 示例 |
| 5.3.4 | 13 个包全部发布到 npm | `npm view @vitamin/ai` 返回版本 |
| 5.3.5 | `npx @vitamin/coding-agent` 可直接运行 | 新机器测试 |
| 5.3.6 | `npx @vitamin/coding-agent doctor` 通过 | 新机器测试 |

---

### 里程碑 M5 / v0.1.0 验收（Week 15 末）

> **Plan/Build + 所有高级功能，v0.1.0 发布**

| # | 端到端验收标准 | 验证方式 |
|---|--------------|---------|
| v0.1.1 | 完整 Plan/Build 流程可工作 | `/plan` → 计划生成 → `/start-work` → 执行完成 |
| v0.1.2 | 26+ 工具全部可用（含 task 管理 + hashline-edit） | Agent 至少调用过每个工具类别 |
| v0.1.3 | 4 个内置 Extension 工作正常 | 手动验证每个 Extension |
| v0.1.4 | 10+ E2E 测试全部通过 | CI 绿灯 |
| v0.1.5 | 全量单测覆盖率 ≥ 80% | `vitest run --coverage` |
| v0.1.6 | 全量构建 < 60s | `time pnpm build` |
| v0.1.7 | 全量测试 < 180s | `time pnpm test` |
| v0.1.8 | 零 `as any` / `@ts-ignore` / `@ts-expect-error` | grep 全仓库 |
| v0.1.9 | npm 13 个包全部发布 | npm registry 验证 |

---

## 里程碑与交付物

```
Week  1 ──── M0: 基础设施就绪
             ├── Monorepo + CI/CD
             ├── @vitamin/shared
             └── @vitamin/config

Week  5 ──── M1/MVP: 单 Agent 可工作
             ├── @vitamin/ai (6 Provider + fallback)
             ├── @vitamin/agent (状态机 + 双层循环)
             └── @vitamin/tools (4 基础工具)

Week  8 ──── M2: 多 Agent 编排
             ├── @vitamin/hooks (14 核心 Hook)
             ├── @vitamin/tools (10 标准工具)
             └── @vitamin/orchestrator (6 Agent + task() 调度)

Week 11 ──── M3: 会话 + 扩展
             ├── @vitamin/session (树 + 增量压缩)
             ├── @vitamin/extension (ExtensionAPI)
             └── @vitamin/mcp (三层 MCP)

Week 13 ──── M4/GA: 完整产品
             ├── @vitamin/tui (差异渲染 + 11 组件)
             ├── @vitamin/coding-agent (CLI + 4 模式)
             └── @vitamin/sdk (嵌入式 + RPC)

Week 15 ──── M5/v0.1.0: 正式发布
             ├── Plan/Build (Prometheus + Momus + Atlas + multimodal-looker)
             ├── 4 内置 Extension
             ├── 26+ 工具（含 task 管理 + hashline-edit）
             ├── E2E + 文档
             └── npm 发布
```

---

## 风险登记簿

| # | 风险 | 影响 | 概率 | 缓解措施 |
|---|------|------|------|---------|
| R1 | LLM Provider API 变更 | 适配器失效 | 中 | 适配器隔离 + 版本锁定 + 监控 |
| R2 | @ast-grep/napi 平台兼容性 | ast-grep 工具不可用 | 低 | 标记为 optional + graceful fallback |
| R3 | TUI 差异渲染性能（大量输出） | 界面卡顿 | 中 | 虚拟滚动 + 帧率限制（30fps） |
| R4 | 增量压缩摘要质量 | 上下文丢失 | 中 | 保留 Todo/关键决策 + 人工可触发全量压缩 |
| R5 | Extension 沙箱安全 | 恶意 Extension | 低 | 文件系统隔离 + 资源限额 + 来源信任 |
| R6 | Monorepo 构建时间膨胀 | CI 变慢 | 中 | Turborepo 远程缓存 + 增量构建 |
| R7 | CJK 终端渲染问题 | 中文/日文乱版 | 中 | wcwidth + 手动调参 + IME 测试矩阵 |
| R8 | AWS SDK 体积与平台兼容 | Bedrock 适配器拉大包体积 | 低 | 标记为 optional peer dep + 懒加载 |
| R9 | E2E 测试 LLM 调用费用 | CI 费用失控 | 中 | CI 中 mock LLM + 仅 nightly 跑真实调用 |
| R10 | API Key 泄露 | 安全事件 | 低 | 内存中加密 + 日志脱敏 + .gitignore 强化 |

---

## 排除范围（v0.1.0 不包含）

以下特性在技术方案中有设计但推迟到 v0.2.0+：

| 特性 | 来源 | 推迟原因 |
|------|------|---------|
| Part 10 试验性特性（圆桌脑暴、Inspector、断点系统等） | 10-experimental.md + 分册 A/B/C | 试验性质，工期额外 ~18 周 |
| SQLite 存储后端 | 03-package-design.md §3.7.1 `sqlite-storage.ts` | JSONL 已满足 MVP 需求 |
| Gist 导出 | 03-package-design.md §3.7.1 `gist-export.ts` | 低优先级 |
| xAI / Groq / OpenRouter / DeepSeek Provider | 03-package-design.md §3.1.1 | 通过 OpenAI-compatible 模式间接支持 |
| Extension marketplace / Git 来源 | 05-extension-system.md §5.2 | npm + local 先行 |

---

## 附录：模块依赖快查表

| 模块 | 直接依赖 | Phase | 里程碑 |
|------|---------|-------|--------|
| @vitamin/shared | — | 0 | M0 |
| @vitamin/config | shared | 0 | M0 |
| @vitamin/ai | shared, config | 1 | M1 |
| @vitamin/agent | ai | 1 | M1 |
| @vitamin/tools | agent, hooks | 1-2 | M1(4)+M2(10) |
| @vitamin/hooks | agent | 2 | M2 |
| @vitamin/orchestrator | hooks, tools, agent, ai | 2 | M2 |
| @vitamin/session | agent, ai, shared | 3 | M3 |
| @vitamin/extension | hooks, orchestrator, tools | 3 | M3 |
| @vitamin/mcp | extension, tools | 3 | M3 |
| @vitamin/tui | shared | 4 | M4 |
| @vitamin/coding-agent | 全部 | 4 | M4 |
| @vitamin/sdk | coding-agent | 4 | M4 |
