# vitamin-coding-agent 开发计划

> 版本：v1.4 | 日期：2026-03-02  
> 基于技术方案 Part 2（架构）、Part 3（包设计）、Part 7（路线图）、Part 9（云端部署）、Part 10（试验性特性）、Part 12（Web UI）制定  
> 总工期：49 周（理想） / 56 周（保守）  
> 其中 Phase 0-5 为 v0.1.0 核心交付（15 周），Phase 6-7 为 v0.2.0 试验性迭代（18 周），Phase 8 为 v0.3.0 云端部署（8 周），Phase 9 为 v0.4.0 Web UI（8 周）  
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
- [Phase 6：试验性特性 — 开发者工具与调试（Week 16-25）](#phase-6试验性特性--开发者工具与调试week-16-25)
- [Phase 7：试验性特性 — 自主编排与反馈（Week 26-33）](#phase-7试验性特性--自主编排与反馈week-26-33)
- [Phase 8：云端部署 — 存储抽象与沙箱（Week 34-41）](#phase-8云端部署--存储抽象与沙箱week-34-41)
- [Phase 9：Web UI — 浏览器端交互界面（Week 42-49）](#phase-9web-ui--浏览器端交互界面week-42-49)
- [里程碑与交付物](#里程碑与交付物)
- [风险登记簿](#风险登记簿)
- [排除范围（v0.4.0 不包含）](#排除范围v040-不包含)
- [附录：模块依赖快查表](#附录模块依赖快查表)

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
| `providers/openai-completions.ts` | OpenAI Chat Completions 适配器（同时作为 OpenAI-compatible 通用适配器，支持 xAI / Groq / OpenRouter 等兼容服务） |
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

#### 1.1A 对标 OpenCode 的 Provider 专项（并行设计流）

> **设计文档**：[13-model-provider-opencode-alignment.md](13-model-provider-opencode-alignment.md)
> **实现规范锚点**：[DEVELOPMENT-SPEC.md §S3.7-S3.9](DEVELOPMENT-SPEC.md#s37-provider-runtime-view三层合并模型)

| 任务 | 说明 |
|------|------|
| Provider Runtime View | 引入 catalog/config/auth 三层合并视图（内部实现） |
| Auth/Config 解耦 | `install`/`doctor` 只管凭据，provider 行为配置留在配置文件 |
| Copilot 专项语义 | `github-copilot` transport + token 优先级 + 401/403 认证提示 |
| 可诊断性增强 | provider/model not found 返回候选建议（fuzzy suggestions） |

**阶段验收（专项）**：

- P1：`github-copilot/...` 在 `coding-agent`/`sdk` 占位模型推导正确。
- P2：`api-key-resolver` 输出 `{ token, source }` 并保留 env 最高优先级。
- P3：Provider/Model 查找失败返回建议列表，错误信息可直接指导修复。

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
| 1.1.14 | 完成 OpenCode 对标 Provider 技术设计并挂接计划 | 文档存在 + README 索引 + 本章节专项任务存在 |

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
>  
> **对标专题**：[14-tui-opencode-alignment.md](14-tui-opencode-alignment.md)

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

#### 4.1A 对标 OpenCode 的 TUI 专项（并行实现流）

> 实现规范锚点：[DEVELOPMENT-SPEC.md §S11.3](DEVELOPMENT-SPEC.md#s113-tui-事件循环与输入规范opencode-对齐点)

- 打通 terminal 生命周期：`startListening()` / `stopListening()` 与 raw mode 配对。  
- 建立语义键分发链：`sequenceToKeyId` → `keyBindings.handle` → 页面输入处理。  
- 统一 Enter/Shift+Tab 键语义，保证页面切换与设置编辑可触达。  
- resize 时同步 renderer 与页面宽度，避免切页后布局异常。

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
| 4.1.11 | TUI 输入监听生命周期完整（启动/退出） | 单测：interactive start 调用监听，cleanup 停止监听 |

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

- **7 步初始化序列**（强制顺序）：parseCLI → loadConfig → createSubsystems(7 并行) → createAgentSession → selectMode → loadResources → enterMainLoop（参考 §S12.1）
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

#### 4.2A `coding-agent` 接入 TUI 专项（并行实现流）

> 实现规范锚点：[DEVELOPMENT-SPEC.md §S12.4](DEVELOPMENT-SPEC.md#s124-interactive-模式与-tui-接入契约)

- interactive 模式优先走全局快捷键（Ctrl+C/Ctrl+D/Ctrl+L/Tab/Shift+Tab）。  
- 全局快捷键未命中时回落到当前页面输入处理。  
- 会话页与设置页统一支持 `enter` 触发动作。

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
| 4.2.12 | 全局快捷键与页面输入链路按优先级执行 | 单测：快捷键命中则页面不消费；未命中回落页面 |

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

## Phase 6：试验性特性 — 开发者工具与调试（Week 16-25）

> **来源**：技术方案 Part 10（10.1-10.4, 10.8, 10.10）+ 分册 A/C  
> **前置条件**：Phase 5 / v0.1.0 已发布  
> **目标**：开发者调试工具链（Inspector + 断点）、圆桌脑暴引擎、性能基准体系  
> **新增包**：`@vitamin/server`（14 号包）

### 6.1 @vitamin/server — HTTP/WebSocket 服务基座（新包）

| 项目 | 说明 |
|------|------|
| **工期** | Week 16-17（8 天） |
| **依赖** | Phase 5 完成（v0.1.0 已发布） |
| **来源** | 10.2 实时日志推送系统 + 10.3 DevTools Inspector（后端部分） |

**交付物**：

| 文件 | 职责 |
|------|------|
| `packages/server/src/http-server.ts` | HTTP 服务启动/关闭、端口管理、CORS |
| `packages/server/src/websocket-hub.ts` | WebSocket 连接管理、房间隔离 |
| `packages/server/src/log-broadcast-hub.ts` | `LogBroadcastHub` — 日志广播（SSE + WebSocket 双通道） |
| `packages/server/src/api/sessions.ts` | Session 列表 / 详情 API |
| `packages/server/src/api/agents.ts` | Agent 状态 / 消息流 API |
| `packages/server/src/api/logs.ts` | 日志查询 + 回放 API |
| `packages/server/src/middleware/` | 认证中间件（Bearer token）、请求限速 |

**实现约束**：

- **`--inspect` 启动模式**（强制）：Server 仅在 `--inspect` 或 `--inspect=<port>` 标志下启动，默认端口 `9229`（致敬 Node.js）
- **零生产开销**（强制）：未启用 `--inspect` 时，`LogBroadcastHub.publish()` 为 no-op，无 socket 绑定
- **SSE 日志推送格式**：`event: log\ndata: { level, source, timestamp, payload }\n\n`（与 10.2.3 一致）
- **日志回放 API**：`GET /api/logs?session={id}&since={ts}` 支持增量拉取
- **连接生命周期**：WebSocket 心跳 30s，断线自动清理，日志 buffer 上限 10K 条

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 6.1.1 | `--inspect` 启动 HTTP + WebSocket 服务 | 集成测试：启动 → `curl http://localhost:9229/api/sessions` 返回 200 |
| 6.1.2 | SSE 日志推送实时可用 | 集成测试：订阅 `/api/logs/stream` → Agent 执行 → 收到日志事件 |
| 6.1.3 | WebSocket 连接管理正常 | 单测：连接 → 心跳 → 主动断开 → 服务端清理 |
| 6.1.4 | 未启用 `--inspect` 时零开销 | 单测：不传 flag → `LogBroadcastHub.publish()` no-op → 无端口绑定 |
| 6.1.5 | 日志吞吐量 > 10K events/s（P95） | 性能测试：批量 publish + subscribe 基准 |
| 6.1.6 | 日志回放 API 支持增量拉取 | 单测：写入 100 条 → `since=50` → 返回后 50 条 |

---

### 6.2 DevTools Inspector 前端

| 项目 | 说明 |
|------|------|
| **工期** | Week 18-20（10 天） |
| **依赖** | 6.1 @vitamin/server |
| **来源** | 10.3 DevTools Inspector（前端 6 面板） |

**交付物**：

| 文件 | 职责 |
|------|------|
| `packages/server/inspector/session-explorer.tsx` | 会话树浏览器（树形展开、搜索过滤） |
| `packages/server/inspector/agent-monitor.tsx` | Agent 状态实时面板（状态机 + 消息计数 + 工具调用追踪） |
| `packages/server/inspector/message-inspector.tsx` | 消息详情查看器（system/user/assistant/tool 四色高亮） |
| `packages/server/inspector/thinking-log.tsx` | Thinking Block 实时流查看器 |
| `packages/server/inspector/tools-timeline.tsx` | 工具调用时间线（甘特图样式） |
| `packages/server/inspector/logs-console.tsx` | 日志控制台（级别过滤 + 全文搜索 + 自动滚动） |
| `packages/server/inspector/app.tsx` | Inspector 主框架（标签页布局 + 路由） |

**实现约束**：

- **前端技术栈**：React + Vite，构建产物内嵌到 `@vitamin/server` 包（`dist/inspector/`），由 HTTP 服务静态托管
- **6 面板架构**（10.3.3）：Session Explorer / Agent Monitor / Message Inspector / Thinking Log / Tools Timeline / Logs Console
- **实时数据流**：Agent Monitor + Logs Console 通过 SSE 订阅实时更新；Message Inspector 支持历史消息回放
- **零外部依赖运行**：`http://localhost:9229` 即可访问完整 Inspector，无需安装浏览器扩展
- **响应时间**：Inspector API 响应 < 50ms（P95）

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 6.2.1 | `--inspect` 启动后浏览器可访问 Inspector 页面 | `http://localhost:9229` 返回完整 SPA |
| 6.2.2 | Session Explorer 展示会话树结构 | 手动测试：创建会话 + fork → 树正确展示 |
| 6.2.3 | Agent Monitor 实时展示 Agent 状态变化 | 手动测试：Agent 执行中 → 页面实时更新状态标签 |
| 6.2.4 | Message Inspector 四色消息高亮 | 手动测试：查看历史消息 → system/user/assistant/tool 颜色区分 |
| 6.2.5 | Tools Timeline 甘特图展示工具调用 | 手动测试：多工具调用 → 时间线正确展示并行/串行关系 |
| 6.2.6 | Logs Console 支持级别过滤和搜索 | 手动测试：输入关键词 → 过滤结果正确 |

---

### 6.3 三模式编排：圆桌脑暴引擎

| 项目 | 说明 |
|------|------|
| **工期** | Week 18-20（11 天，与 6.2 并行） |
| **依赖** | Phase 2 orchestrator + Phase 5 Plan/Build |
| **来源** | 10.1 三模式编排：圆桌脑暴 / Plan / Build |

**交付物**：

| 文件 | 职责 |
|------|------|
| `roundtable/roundtable-session.ts` | `RoundtableSession` — 讨论会话管理（参与者注册、发言轮次、协议达成） |
| `roundtable/roundtable-participants.ts` | 默认参与者定义（Architect / Devil's Advocate / Pragmatist / User Proxy） |
| `roundtable/roundtable-protocol.ts` | 讨论协议（3 轮默认、共识检测、早期中断） |
| `roundtable/intent-detector.ts` | 三模式意图检测（圆桌关键词 / Plan 关键词 / 直接执行） |
| `roundtable/roundtable-to-plan.ts` | 圆桌结论 → Plan 输入转换器 |
| `commands/roundtable.ts` | `/roundtable` 命令注册 |
| `extensions/roundtable-mode/` | 圆桌模式 Extension（可禁用） |

**实现约束**：

- **Extension 形态**（强制）：圆桌模式作为内置 Extension 实现（ADR-012），禁用后 Plan/Build 完全不受影响
- **默认参与者**（10.1.3）：4 个角色（Architect / Devil's Advocate / Pragmatist / User Proxy），可配置追加自定义角色
- **Token 预算**：3 轮 × 4 角色 ≈ 15K token，提供早期中断（共识达成时提前结束）
- **共识检测**（10.1.4）：每轮结束后评估共识度 ≥ 80% 即终止，否则进入下一轮
- **模式切换**：圆桌结论自动转换为 Plan 输入（`roundtable-to-plan.ts`），支持"圆桌→Plan→Build"完整链路
- **意图检测**：关键词匹配 + LLM 兜底（"讨论一下"/"头脑风暴"/"需要不同角度" → 圆桌；"规划"/"制定方案" → Plan；其他 → Build）

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 6.3.1 | `/roundtable` 触发圆桌讨论 | E2E：`/roundtable "选择数据库方案"` → 多角色讨论输出 |
| 6.3.2 | 4 个默认角色各自发言内容有差异性 | 集成测试：3 轮讨论 → 各角色立场可区分 |
| 6.3.3 | 共识达成后提前终止 | 单测：mock 共识度 90% → 第 2 轮即终止 |
| 6.3.4 | Token 消耗在预算内 | 单测：3 轮 × 4 角色 → 总 token < 20K |
| 6.3.5 | 圆桌结论可转换为 Plan 输入 | 单测：圆桌输出 → `roundtable-to-plan` → 有效 Plan 输入结构 |
| 6.3.6 | 圆桌 Extension 禁用后 Plan/Build 不受影响 | 单测：`disabled_extensions: ["roundtable-mode"]` → Plan 正常工作 |
| 6.3.7 | 意图检测正确路由三种模式 | 单测：10 条输入 → 正确分类到圆桌/Plan/Build |

---

### 6.4 Agent 断点与步进调试

| 项目 | 说明 |
|------|------|
| **工期** | Week 21-23（12 天） |
| **依赖** | 6.1 @vitamin/server + 6.2 Inspector（Agent Monitor 面板） |
| **来源** | 10.4 Agent 断点与步进调试（分册 A） |

**交付物**：

| 文件 | 职责 |
|------|------|
| `breakpoint/breakpoint-engine.ts` | `BreakpointEngine` — 断点注册、匹配、挂起/恢复管理 |
| `breakpoint/breakpoint-types.ts` | 6 种断点类型定义（turn / tool / agent / message / condition / error） |
| `breakpoint/checkpoint-injector.ts` | 7 个检查点注入位置（Agent 循环入口/出口、工具执行前/后等） |
| `breakpoint/resume-actions.ts` | 4 种恢复策略（continue / skip_tool / modify_and_continue / abort） |
| `breakpoint/pending-pause.ts` | `PendingPause` — Promise 挂起状态管理（支持多 Agent 并行暂停） |
| `server/api/breakpoints.ts` | 断点 CRUD REST API（Inspector 面板调用） |
| `server/ws/breakpoint-events.ts` | WebSocket 断点事件推送（paused / resumed / hit） |

**实现约束**：

- **Promise 挂起模式**（ADR-014）：`await checkpoint()` 自然暂停异步流程，无需异常机制，恢复时 `resolve()` 继续执行
- **无断点时零开销**：`checkpoint()` 仅遍历 `Map<id, Breakpoint>` 做条件匹配，P95 < 0.1ms
- **6 种断点类型**（10.4.3）：
  - `turn` — Agent 循环每轮前/后暂停
  - `tool` — 特定工具调用前/后（支持工具名通配符）
  - `agent` — 特定 Agent 启动/退出时
  - `message` — 消息内容匹配（正则）
  - `condition` — 自定义条件表达式（`turnCount > 5 && toolName === "bash"`）
  - `error` — 错误发生时自动暂停
- **7 个检查点注入位置**（10.4.5）：Agent 循环入口 / LLM 调用前 / LLM 返回后 / 工具调用前 / 工具返回后 / 消息追加后 / Agent 循环出口
- **Inspector 集成**：暂停时 Agent Monitor 面板高亮显示暂停位置 + 上下文变量；恢复操作通过 Inspector 面板或 WebSocket 命令触发
- **并发支持**：`Map<agentId, PendingPause>` 支持多 Agent 同时命中断点并行暂停

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 6.4.1 | 6 种断点类型均可正确触发暂停 | 单测：逐一设置各类型断点 → Agent 执行 → 暂停在正确位置 |
| 6.4.2 | 4 种恢复策略工作正常 | 单测：暂停后分别执行 continue/skip/modify/abort → 行为正确 |
| 6.4.3 | 无断点时 checkpoint() 延迟 < 0.1ms（P95） | 性能测试：循环调用 10K 次 → 统计 P95 |
| 6.4.4 | Inspector 面板可设置/删除断点 | 集成测试：通过 REST API 增删断点 → 生效 |
| 6.4.5 | 多 Agent 并行暂停 | 单测：3 个 Agent 同时命中断点 → `pendingPauses.size === 3` |
| 6.4.6 | WebSocket 实时推送断点事件 | 集成测试：订阅 ws → 命中断点 → 收到 `paused` 事件 |
| 6.4.7 | condition 断点支持复合表达式 | 单测：`turnCount > 3 && agentId === "oracle"` → 第 4 轮 Oracle 暂停 |

---

### 6.5 性能基准 + 错误路径强化

| 项目 | 说明 |
|------|------|
| **工期** | Week 24-25（8 天） |
| **依赖** | Phase 5 + 6.1（Inspector 性能指标采集） |
| **来源** | 10.8 性能基准指标 + 10.10 核心流程错误与重试路径 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `benchmarks/checkpoint-bench.ts` | checkpoint() 无断点/有断点延迟基准 |
| `benchmarks/log-hub-bench.ts` | LogBroadcastHub 吞吐量基准 |
| `benchmarks/inspector-api-bench.ts` | Inspector API 响应时间基准 |
| `benchmarks/escalation-bench.ts` | Escalation 路由延迟基准（为 Phase 7 预备） |
| `packages/ai/src/retry/llm-retry-policy.ts` | LLM API 调用重试策略（指数退避 + Retry-After + fallback chain） |
| `packages/ai/src/retry/retryable-errors.ts` | 可重试/不可重试错误分类（429/5xx/网络 vs 401/402/内容策略） |
| `packages/agent/src/error/agent-loop-recovery.ts` | Agent 循环异常退出善后（状态保存 + interrupted 标记 + `/resume` 命令） |
| `packages/tools/src/error/tool-timeout-handler.ts` | 工具执行超时处理（AbortSignal + 超时结果注入上下文） |

**实现约束**：

- **CI 回归测试**（强制）：性能基准纳入 CI（`vitest bench`），每个 PR 自动对比，回归 > 20% 阻断合并
- **P95 目标值**（10.8）：
  - `checkpoint()` 无断点 < 0.1ms
  - `checkpoint()` 10 个断点 < 1ms
  - Inspector API 响应 < 50ms
  - LogBroadcastHub 吞吐 > 10K events/s
- **LLM 重试策略**（10.10.1）：`maxRetries: 3`，指数退避（initial 1s, max 30s），429 使用 `Retry-After` header，超限后尝试 fallback 模型
- **不可重试错误立即失败**：401（invalid key）、402（insufficient quota）、400（content filter / context too long）
- **Agent 循环善后**（10.10.3）：子 Agent 异常 → 向父返回 `TaskResult { status: "failed" }` → 父决策重试/跳过/上报；主 Agent 异常 → 状态标记 `interrupted` + 提示 `/resume`

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 6.5.1 | 性能基准测试全部通过 P95 目标 | `vitest bench` 输出全部绿色 |
| 6.5.2 | CI 性能回归检测可用 | PR 中引入性能退步 → CI 报告差异并阻断 |
| 6.5.3 | LLM 重试策略对 429 正确退避 | 单测：mock 429 + Retry-After → 等待指定时间后重试 |
| 6.5.4 | LLM 不可重试错误立即失败 | 单测：mock 401 → 不重试，直接抛出 |
| 6.5.5 | fallback 模型切换正常 | 单测：主模型 3 次失败 → 切换 fallback → 成功 |
| 6.5.6 | 工具超时后结果注入上下文 | 单测：bash 超时 → Agent 收到 `{ timedOut: true }` → 可自主决策 |
| 6.5.7 | Agent 异常退出状态保存 | 单测：模拟崩溃 → session 标记 interrupted → `/resume` 可恢复 |

---

### 里程碑 M6 验收（Week 25 末）

> **开发者工具链完整可用：Inspector + 断点调试 + 圆桌脑暴 + 性能基准**

| # | 端到端验收标准 | 验证方式 |
|---|--------------|---------|
| M6.1 | `--inspect` 启动 Inspector，浏览器可访问 6 面板 | 手动测试 |
| M6.2 | 在 Inspector 中设置断点 → Agent 执行暂停 → 查看上下文 → 恢复执行 | 手动测试 |
| M6.3 | `/roundtable` 触发多角色讨论 → 讨论结论可转为 Plan | 手动测试 |
| M6.4 | 性能基准 CI 可运行且全部达标 | `vitest bench` 绿灯 |
| M6.5 | LLM 重试 + fallback + Agent 善后全链路可工作 | 集成测试 |
| M6.6 | 14 个包全部构建通过（含新增 @vitamin/server） | `pnpm build` 零错误 |

---

## Phase 7：试验性特性 — 自主编排与反馈（Week 26-33）

> **来源**：技术方案 Part 10（10.5-10.6, 10.9）+ 分册 B/C  
> **前置条件**：Phase 6 / M6 验收通过  
> **目标**：动态 Agent 合成、上行反馈冒泡、同级协商、试验性特性综合测试

### 7.1 自主 Agent 合成

| 项目 | 说明 |
|------|------|
| **工期** | Week 26-29（14 天，核心路径） |
| **依赖** | Phase 2 orchestrator + Phase 5 Agent 矩阵 |
| **来源** | 10.5 自主 Agent 合成（分册 B） |

**交付物**：

| 文件 | 职责 |
|------|------|
| `synthesis/requirement-analysis.ts` | `RequirementAnalysis` — 需求分析（识别现有 Agent 无法覆盖的能力缺口） |
| `synthesis/agent-blueprint.ts` | `AgentBlueprint` — 结构化蓝图（角色定义、工具集、token 预算、依赖关系） |
| `synthesis/synthesize-agent.ts` | `synthesizeAgent()` — 蓝图 → AgentConfig 合成引擎（安全检查 + 工具白名单） |
| `synthesis/synthesis-orchestrator.ts` | `SynthesisOrchestrator` — 合成 Agent 编排执行（依赖拓扑、并行分批、失败策略） |
| `synthesis/cached-blueprint.ts` | `CachedBlueprint` — 蓝图缓存与复用（相似需求命中历史蓝图） |
| `synthesis/blueprint-validator.ts` | 蓝图验证器（工具白名单、资源上限、角色合规性检查） |
| `synthesis/synthesis-config-schema.ts` | 试验性特性配置 Schema（10.5.15） |

**实现约束**：

- **Blueprint 模式**（ADR-015）：Sisyphus 生成结构化 `AgentBlueprint` → 引擎合成 → Orchestrator 编排，非元 LLM 直接编排
- **安全边界**（强制）：`synthesizeAgent()` 强制执行工具白名单 + 资源上限（max token budget / max turns / max concurrent），LLM 生成的配置不直接执行
- **用户确认环节**：合成 Agent 前展示 Blueprint 摘要（角色 + 工具 + 预算），用户可审查/修改后确认
- **蓝图缓存**（10.5.12）：相似需求（余弦相似度 > 0.85）命中已有 CachedBlueprint，跳过 LLM 生成环节
- **失败策略**（10.5.9）：`abort_all`（任一失败全部取消）/ `continue`（跳过失败继续）/ `retry`（自动重试 N 次）
- **Inspector 集成**：合成 Agent 的 Blueprint + 依赖拓扑在 Inspector 的 Agent Monitor 中可视化展示

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 7.1.1 | 需求分析正确识别能力缺口 | 集成测试：提供超出预定义 Agent 的需求 → 输出缺失能力列表 |
| 7.1.2 | Blueprint 结构完整且通过验证 | 单测：生成 Blueprint → `blueprintValidator.validate()` 通过 |
| 7.1.3 | synthesizeAgent() 拒绝非法工具请求 | 单测：Blueprint 含非白名单工具 → 合成失败 + 错误信息 |
| 7.1.4 | SynthesisOrchestrator 按拓扑并行执行 | 单测：3 Agent（A→B, A→C, B+C→D）→ 批次正确 |
| 7.1.5 | abort_all 策略正确传播失败 | 单测：Agent A 失败 → 依赖 A 的所有后续 Agent 标记 failed |
| 7.1.6 | 蓝图缓存命中复用 | 单测：相似需求（余弦 > 0.85）→ 使用缓存 Blueprint → 跳过 LLM |
| 7.1.7 | 用户确认环节展示 Blueprint 摘要 | 集成测试：合成前 → 输出可读摘要等待确认 |

---

### 7.2 上行反馈与异常冒泡

| 项目 | 说明 |
|------|------|
| **工期** | Week 30-32（12 天，核心路径） |
| **依赖** | 7.1 Agent 合成（合成 Agent 需要冒泡能力） |
| **来源** | 10.6 上行反馈与异常冒泡（分册 B） |

**交付物**：

| 文件 | 职责 |
|------|------|
| `escalation/escalation-signal.ts` | `EscalationSignal` — 6 种结构化信号类型（capability / resource / permission / ambiguity / conflict / failure） |
| `escalation/escalation-engine.ts` | `EscalationEngine` — 信号路由（匹配处理器、冒泡策略、超时兜底） |
| `escalation/escalation-handlers.ts` | 分层处理器（自动解决 / Atlas 拦截 / Sisyphus 决策 / 用户上报） |
| `escalation/escalate-tool.ts` | `escalate` 工具 — 子 Agent 发起上行反馈的 tool 接口 |
| `escalation/bubble-policy.ts` | 冒泡策略（intercept / bubble / transform）+ 冒泡深度上限 |
| `escalation/cascade-replanner.ts` | 级联重规划 — 上行反馈触发 Plan 部分修订（与 Plan/Build 集成） |
| `escalation/escalation-dashboard.ts` | Inspector Escalation 面板（冒泡路径可视化） |

**实现约束**：

- **Promise 挂起模式**（ADR-016）：子 Agent `await escalate()` → Promise 挂起 → 父 Agent 决策 → `resolve()` 恢复，与断点引擎使用同一模式
- **6 种信号类型**（10.6.3）：
  - `capability` — 能力不足（"我无法处理二进制文件"）
  - `resource` — 资源耗尽（token 预算 / 轮次上限）
  - `permission` — 需要授权（文件写入 / 网络访问）
  - `ambiguity` — 需求模糊（无法确定最佳方案）
  - `conflict` — 与其他 Agent 冲突（同时修改同一文件）
  - `failure` — 执行失败（工具报错 / LLM 拒绝）
- **三级冒泡路径**（10.6.5）：子 Agent → Atlas（中间层拦截尝试解决）→ Sisyphus（顶层决策 + 人类上报）
- **自动解决优先**：`capability` 冒泡前先匹配预定义 Agent 矩阵（是否有其他 Agent 能处理）；`resource` 自动扩大预算（在上限范围内）
- **Escalation 延迟**（10.8）：单层路由 < 5ms（不含 LLM），完整 3 层冒泡 < 30s（含 LLM 决策）
- **级联重规划**：上行反馈导致 Plan 步骤不可行时，触发 Prometheus 局部修订（仅修改受影响步骤，保留已完成进度）

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 7.2.1 | 6 种信号类型均可正确发送和路由 | 单测：逐一发送各类型 → EscalationEngine 路由到正确处理器 |
| 7.2.2 | 三级冒泡链完整可工作 | 集成测试：子 Agent escalate → Atlas 不拦截 → Sisyphus 接收 |
| 7.2.3 | Atlas 正确拦截可自行解决的 escalation | 单测：`capability` + 矩阵中存在合适 Agent → Atlas 重新分派 |
| 7.2.4 | escalate 工具 Agent 可正确调用 | 集成测试：Agent system prompt 含 escalate → Agent 主动调用 |
| 7.2.5 | 单层路由延迟 < 5ms（不含 LLM） | 性能测试：`handle()` 非 LLM 部分计时 |
| 7.2.6 | 级联重规划触发正确 | 集成测试：步骤 3 失败 → escalation → Plan 步骤 3-5 修订 → 步骤 1-2 保留 |
| 7.2.7 | 冒泡深度上限防止无限冒泡 | 单测：设置 `maxBubbleDepth: 3` → 第 4 层强制终止 |

---

### 7.3 同级协商与运行时临时圆桌

| 项目 | 说明 |
|------|------|
| **工期** | Week 32-33（5 天） |
| **依赖** | 6.3 圆桌引擎 + 7.2 Escalation |
| **来源** | 10.6.16 同级协商与运行时临时圆桌（分册 B） |

**交付物**：

| 文件 | 职责 |
|------|------|
| `roundtable/adhoc-roundtable.ts` | `AdHocRoundtable` — 运行时临时圆桌（Agent 间冲突时自动召集） |
| `roundtable/negotiation-protocol.ts` | 协商协议（提案→反驳→折中→共识，最多 N 轮） |
| `roundtable/conflict-detector.ts` | 冲突检测器（同一文件并发修改、方案矛盾等） |

**实现约束**：

- **触发条件**：Escalation 信号类型为 `conflict` 且涉及 ≥ 2 个 Agent → 自动创建 AdHocRoundtable
- **超时降级**：`maxRounds` 轮后未达成共识 → 使用降级策略（优先级高的 Agent 方案优先 / 请求用户裁决）
- **复用圆桌基础设施**：继承 6.3 的 `RoundtableSession`，但参与者为运行时 Agent 而非预定义角色

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 7.3.1 | conflict 类型 escalation 自动触发临时圆桌 | 集成测试：两 Agent 冲突 → AdHocRoundtable 创建 |
| 7.3.2 | 协商在 maxRounds 内达成共识 | 单测：mock 共识 → 提前终止 |
| 7.3.3 | 超时降级策略生效 | 单测：maxRounds=1 → 未共识 → 降级方案输出含 `unresolvedDisputes` |

---

### 7.4 试验性特性测试 + 集成验证

| 项目 | 说明 |
|------|------|
| **工期** | Week 33（5 天） |
| **依赖** | Phase 6 + 7.1-7.3 全部完成 |
| **来源** | 10.9 试验性特性测试策略（分册 C） |

**交付物**：

| 文件 | 职责 |
|------|------|
| `tests/breakpoint/concurrent-breakpoint.test.ts` | 并发断点测试（多 Agent 同时命中） |
| `tests/escalation/bubble-chain.test.ts` | 冒泡链集成测试（子 → Atlas → Sisyphus → 用户） |
| `tests/roundtable/adhoc-timeout.test.ts` | 临时圆桌超时降级测试 |
| `tests/synthesis/failure-policy.test.ts` | Agent 合成失败策略测试（abort_all / continue / retry） |
| `tests/e2e/experimental-features.test.ts` | 试验性特性 E2E 集成测试套件 |
| `docs/experimental-features.md` | 试验性特性使用指南（Inspector / 断点 / 圆桌 / Agent 合成 / Escalation） |

**实现约束**：

- **测试策略**（10.9）：每个试验性特性至少 1 个并发测试 + 1 个超时/降级测试 + 1 个错误路径测试
- **E2E 覆盖**：完整链路测试 — "需求→Agent 合成→执行→Escalation→圆桌协商→恢复" 端到端
- **性能回归**：10.8 定义的所有 P95 指标纳入 CI 持续监控

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 7.4.1 | 试验性特性专项测试全部通过 | `vitest run tests/breakpoint tests/escalation tests/roundtable tests/synthesis` |
| 7.4.2 | E2E 覆盖完整链路（合成→执行→冒泡→协商） | E2E 测试通过 |
| 7.4.3 | 性能基准 CI 无回归 | `vitest bench` 与 M6 基线对比 < 20% 退步 |
| 7.4.4 | 试验性特性文档完整 | 文档包含 5 个特性的使用指南 + 配置说明 |

---

### 里程碑 M7 / v0.2.0 验收（Week 33 末）

> **试验性特性完整可用：Agent 合成 + Escalation + 同级协商 + Inspector + 断点 + 圆桌**

| # | 端到端验收标准 | 验证方式 |
|---|--------------|---------|
| M7.1 | 自主 Agent 合成完整流程：需求→Blueprint→确认→合成→执行 | 手动测试 |
| M7.2 | Agent Escalation 三级冒泡链完整工作 | 集成测试 |
| M7.3 | 同级协商临时圆桌由 conflict 信号自动触发 | 集成测试 |
| M7.4 | Inspector 可视化断点 + Agent 合成拓扑 + Escalation 冒泡路径 | 手动测试 |
| M7.5 | 全量测试（含试验性特性）通过率 ≥ 95% | `pnpm test` |
| M7.6 | 性能基准 10.8 全部 P95 达标 | `vitest bench` |
| M7.7 | 14 个包全部发布到 npm（含 @vitamin/server） | npm registry 验证 |
| M7.8 | 试验性特性文档 + 升级指南完整 | 文档审查 |

---

## Phase 8：云端部署 — 存储抽象与沙箱（Week 34-41）

> **来源**：技术方案 Part 9（09-cloud-deployment.md，1985 行完整设计）  
> **前置条件**：Phase 5 / v0.1.0 已发布（存储抽象不依赖试验性特性，可与 Phase 6-7 并行推进）  
> **目标**：存储后端可插拔（JSONL→PostgreSQL→S3）、Redis 缓存层、工具沙箱隔离（3 后端）、审计日志、数据生命周期管理  
> **新增包**：`@vitamin/sandbox`（15 号包）；`@vitamin/cloud`（16 号包，归档/工厂/配置）

### 8.1 SessionStorage 抽象层 + PostgreSQL 实现

| 项目 | 说明 |
|------|------|
| **工期** | Week 34-35（8 天） |
| **依赖** | Phase 3 session（`@vitamin/session` 已稳定） |
| **来源** | 09-cloud-deployment.md §9.2 + §9.3 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `packages/session/src/storage/storage-interface.ts` | `SessionStorage` 抽象接口（CRUD + 查询 + 压缩 + 生命周期） |
| `packages/session/src/storage/in-memory-storage.ts` | `InMemoryStorage` — 测试用內存实现 |
| `packages/cloud/src/storage/postgres-storage.ts` | `PostgresStorage` — PostgreSQL 实现（递归 CTE 树查询） |
| `packages/cloud/src/storage/pg-schema.sql` | 数据库 Schema（sessions + session_entries + audit_logs + 索引） |
| `packages/cloud/src/storage/pg-migrations/` | 数据库迁移脚本 |
| `packages/session/src/session-manager.ts` | **改造**：构造函数接受 `SessionStorage` 接口注入 |

**实现约束**：

- **零业务代码修改**（强制）：`SessionManager` 所有方法（fork / getTree / navigateTo / compact）不改动任何逻辑，仅将底层 `JsonlStorage` 替换为注入的 `SessionStorage`
- **构造函数注入**：`new SessionManager(new JsonlStorage(dir))`（单机）/ `new SessionManager(new PostgresStorage(pool))`（云端）/ `new SessionManager(new InMemoryStorage())`（测试）
- **PostgreSQL 递归 CTE**（§9.3.2）：`getPathToRoot()` 使用 `WITH RECURSIVE` 替代内存遍历，大型会话树查询性能 O(depth) vs O(N)
- **审计日志表**（§9.3.1）：`audit_logs` 表 + 按月分区 + userId 索引 + JSONB detail 字段
- **数据库 Schema 版本管理**：迁移脚本按版本号顺序执行，每个迁移幂等可重入

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 8.1.1 | SessionManager 通过 `InMemoryStorage` 全部原有单测不变 | 替换 storage → 全部 Phase 3 会话单测通过 |
| 8.1.2 | PostgresStorage 实现 SessionStorage 全部方法 | 集成测试：Docker PostgreSQL → CRUD + 树查询 |
| 8.1.3 | 递归 CTE `getPathToRoot()` 结果正确 | 单测：5 层树 → getPathToRoot(叶节点) → 返回 5 个节点 |
| 8.1.4 | 审计日志写入 + 查询 | 集成测试：写入 100 条 → 按 userId + 时间范围查询 |
| 8.1.5 | 数据库迁移脚本幂等 | 集成测试：同一迁移执行 2 次 → 无错误 |
| 8.1.6 | JsonlStorage 仍为默认（零配置即可用） | `createStorageBackend()` 无参数 → 返回 JsonlStorage |

---

### 8.2 Redis 缓存层

| 项目 | 说明 |
|------|------|
| **工期** | Week 35-36（5 天） |
| **依赖** | 8.1 SessionStorage 抽象 |
| **来源** | 09-cloud-deployment.md §9.4 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `packages/cloud/src/cache/cached-storage.ts` | `CachedStorage` — 装饰器模式包装任意 `SessionStorage` + Redis 缓存 |
| `packages/cloud/src/cache/cache-keys.ts` | 缓存 Key 命名规范（`session:{id}:path:{entryId}`、`session:{id}:tree` 等） |
| `packages/cloud/src/cache/invalidation.ts` | 写时失效策略（write → invalidate cache → update） |

**实现约束**：

- **Write-Through + TTL**（ADR-011）：PostgreSQL 始终有最新数据，Redis 仅加速读取；TTL 兜底防内存泄漏
- **缓存 Key TTL**（§9.4.1）：
  - `session:{id}:path:{entryId}` → 10min
  - `session:{id}:tree` → 5min
  - `session:{id}:info` → 30min
  - `agent:{instanceId}:state` → 心跳续期
- **装饰器模式**：`new CachedStorage(new PostgresStorage(pool), redis)`，读路径优先查 Redis，写路径先写 PG 后失效缓存
- **Redis 不可用降级**：Redis 连接失败 → 自动降级为直接查 PostgreSQL，不阻断服务

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 8.2.1 | 缓存命中时不查 PostgreSQL | 单测：mock PG + 预热缓存 → read → PG 零调用 |
| 8.2.2 | 缓存未命中时查 PG 并回写缓存 | 单测：空缓存 → read → PG 调用 1 次 → 再 read → PG 零调用 |
| 8.2.3 | 写操作正确失效缓存 | 单测：write → 对应 key 被删除 → 下次 read 走 PG |
| 8.2.4 | Redis 不可用时降级到直接 PG | 单测：mock Redis 断开 → read/write 正常（走 PG） |
| 8.2.5 | TTL 过期后自动重查 | 单测：设 TTL=100ms → 等待 150ms → read → 走 PG |

---

### 8.3 @vitamin/sandbox — 工具沙箱隔离

| 项目 | 说明 |
|------|------|
| **工期** | Week 36-39（15 天） |
| **依赖** | Phase 1 tools（工具接口） |
| **来源** | 09-cloud-deployment.md §9.8（完整设计含 3 后端 + 工厂 + 沙箱化工具） |

**交付物**：

| 文件 | 职责 |
|------|------|
| `packages/sandbox/src/sandbox-interface.ts` | `Sandbox` 统一抽象接口（exec + fs + limits + mcp proxy） |
| `packages/sandbox/src/sandbox-fs.ts` | `SandboxFileSystem` 文件系统接口 |
| `packages/sandbox/src/sandbox-limits.ts` | `SandboxLimits` 资源限制定义（CPU / 内存 / 超时 / 网络白名单 / 命令黑名单） |
| `packages/sandbox/src/backends/os-native-sandbox.ts` | **OS-native**：cgroups v2 + seccomp + chroot 隔离（仅 Linux） |
| `packages/sandbox/src/backends/server-wasm-sandbox.ts` | **Server Wasm**：Wasmtime/WasmEdge WASI 沙箱（跨平台，冷启动 < 10ms） |
| `packages/sandbox/src/backends/browser-wasm-sandbox.ts` | **Browser Wasm**：BrowserPod/WebVM 浏览器沙箱（零服务器成本） |
| `packages/sandbox/src/create-sandbox.ts` | 沙箱工厂 + 自动检测最佳后端（`"auto"` 模式） |
| `packages/sandbox/src/create-sandboxed-tools.ts` | 沙箱化工具创建器（bash / file_read / file_write / list_dir） |
| `packages/sandbox/src/mcp-proxy.ts` | `SandboxMcpProxy` — 沙箱内 MCP 工具代理桥接 |

**实现约束**：

- **统一抽象接口**（§9.8.2）：所有后端实现 `Sandbox` 接口（`initialize() → exec() → fs → destroy()`），Agent 循环完全屏蔽底层
- **OS-native**（§9.8.3）：Linux cgroups v2 CPU/内存限制 + chroot 文件隔离 + 命令黑名单（`rm -rf /`、`dd if=`、fork bomb 等）
- **Server Wasm**（§9.8.4）：WASI 能力白名单模型（默认拒绝所有，显式授予 fs/net），Wasmtime fuel 机制做 CPU 限制，线性内存隔离
- **Browser Wasm**（§9.8.5）：BrowserPod SDK 集成，IndexedDB 虚拟文件系统，通过 postMessage 与宿主通信
- **自动选择逻辑**（§9.8.6）：browserPod 存在 → browser-wasm；wasmtime/wasmedge 可用 → server-wasm；Linux + cgroup → os-native；兜底 → server-wasm
- **路径逃逸防护**（强制）：所有 `SandboxFileSystem` 实现必须校验 `resolve()` 不逃逸 `workDir`
- **MCP 代理**（§9.8.2）：沙箱内 Agent 通过 `SandboxMcpProxy` 调用宿主 MCP 工具，宿主控制白名单

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 8.3.1 | OS-native：命令执行 + 结果返回 | 集成测试（Linux CI）：`exec("echo hello")` → stdout="hello" |
| 8.3.2 | OS-native：命令黑名单阻止危险命令 | 单测：`exec("rm -rf /")` → exitCode=1 + stderr 含 "blocked" |
| 8.3.3 | OS-native：内存限制生效 | 集成测试：设 256MB → 执行内存分配 512MB → OOM killed |
| 8.3.4 | Server Wasm：WASI 冷启动 < 10ms（P95） | 性能测试：100 次 initialize() → P95 < 10ms |
| 8.3.5 | Server Wasm：文件隔离仅 /workspace 可写 | 单测：`fs.writeFile("/etc/passwd", ...)` → 抛出路径逃逸错误 |
| 8.3.6 | Browser Wasm：基本执行可用 | 集成测试（浏览器环境）：`exec("ls")` → 返回文件列表 |
| 8.3.7 | 工厂 `"auto"` 模式正确检测后端 | 单测：mock 环境 → 返回正确后端类型 |
| 8.3.8 | 沙箱化工具与 Agent 集成 | 集成测试：createSandboxedTools → bash/file_read/file_write/list_dir 均可用 |
| 8.3.9 | 路径逃逸防护对所有后端生效 | 单测：3 个后端 × `fs.readFile("../../etc/passwd")` → 全部拒绝 |
| 8.3.10 | MCP 代理桥接可用 | 集成测试：沙箱内 callTool → 宿主 MCP 执行 → 结果返回沙箱 |

---

### 8.4 审计日志 + 日志持久化

| 项目 | 说明 |
|------|------|
| **工期** | Week 39-40（5 天） |
| **依赖** | 8.1 PostgresStorage + Phase 2 hooks |
| **来源** | 09-cloud-deployment.md §9.5 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `packages/cloud/src/hooks/audit-logger.ts` | `cloud:audit-logger` Hook — 记录所有工具执行到 PostgreSQL（不可禁用） |
| `packages/shared/src/logger.ts` | **改造**：`createLogger()` 支持 `mode: "cloud"` → JSON stdout + trace context + redact |
| `packages/cloud/src/logging/trace-context.ts` | OpenTelemetry trace context 注入（可选） |
| `packages/cloud/src/logging/log-redactor.ts` | 敏感字段脱敏（apiKey / password / token → `[REDACTED]`） |
| `docker/docker-compose.cloud.yml` | 日志基础设施参考配置（Promtail → Loki → Grafana） |

**实现约束**：

- **审计日志三层**（§9.5.1）：运行日志（pino → stdout → Loki）、审计日志（Hook → PostgreSQL audit_logs）、对话数据（SessionStorage → PG + S3）
- **审计 Hook 不可禁用**（强制）：`disableable: false`，最高优先级（priority: 10），异步写入不阻塞工具执行
- **敏感字段脱敏**（强制）：apiKey / password / secret / token / authorization → `[REDACTED]`
- **云端日志格式**：JSON Lines → stdout → 容器日志收集器自动采集，添加 service / instance / version 元数据

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 8.4.1 | 审计 Hook 记录工具执行到 PostgreSQL | 集成测试：执行 bash 工具 → audit_logs 表有记录 |
| 8.4.2 | 审计 Hook 不可被禁用 | 单测：`disabled_hooks: ["cloud:audit-logger"]` → Hook 仍生效 |
| 8.4.3 | 敏感字段正确脱敏 | 单测：含 apiKey 的参数 → 审计记录中为 `[REDACTED]` |
| 8.4.4 | 云端日志为 JSON Lines 格式 | 单测：`mode: "cloud"` → 输出每行可 `JSON.parse` |
| 8.4.5 | 本地日志模式不受影响 | 单测：`mode: "local"` → 仍写 `/tmp/vitamin.log` + pino-pretty |

---

### 8.5 数据生命周期 + Storage 工厂 + Cloud Config

| 项目 | 说明 |
|------|------|
| **工期** | Week 40-41（5 天） |
| **依赖** | 8.1 + 8.2 + 8.4 |
| **来源** | 09-cloud-deployment.md §9.6 + §9.7 + §9.9 + §9.10 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `packages/cloud/src/archiver.ts` | `SessionArchiver` — 冷数据归档（PG → S3 JSONL.gz）+ 恢复（S3 → PG） |
| `packages/cloud/src/create-storage-backend.ts` | `createStorageBackend()` 工厂 — 根据配置自动组装存储链（JSONL / PG / PG+Redis） |
| `packages/config/src/schema/cloud.ts` | `CloudConfigSchema` — Zod v4 云端部署配置（storage_backend / database_url / redis_url / sandbox / archive / audit / logging） |
| `packages/cloud/src/data-retention.ts` | 数据保留策略执行器（定时清理过期数据） |
| `packages/cloud/package.json` | 新包 `@vitamin/cloud` 配置 |

**实现约束**：

- **分层存储**（§9.7.1）：Hot（Redis，分钟级 TTL）→ Warm（PG，30 天可查询）→ Cold（S3，30 天+ 归档）
- **归档策略**（§9.7.2）：超过 `archiveAfterDays` 天未更新的会话 → 导出 JSONL.gz 到 S3 → 删除 PG 中条目 → 保留 sessions 元数据索引
- **恢复可用**：归档会话可按需从 S3 恢复到 PG，事务保证（BEGIN/COMMIT/ROLLBACK）
- **工厂自动组装**（§9.6）：`createStorageBackend(config)` 根据 `storage_backend` 字段自动选择：`"jsonl"` → JsonlStorage；`"postgres"` → PostgresStorage；`"postgres"` + `redis_url` → CachedStorage(PG, Redis)
- **Cloud Config Schema**（§9.9）：`storage_backend` / `database_url` / `redis_url` / `sandbox.*` / `archive.*` / `audit.*` / `logging.*`

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 8.5.1 | 归档：不活跃会话迁移到 S3 | 集成测试：30 天未更新会话 → archiver 执行 → S3 有文件 + PG entries 已删 |
| 8.5.2 | 恢复：从 S3 恢复归档会话 | 集成测试：恢复 → PG 条目回写 → SessionManager 可读 |
| 8.5.3 | 工厂：`"jsonl"` 返回 JsonlStorage | 单测：config.storage_backend="jsonl" → instanceof JsonlStorage |
| 8.5.4 | 工厂：`"postgres"` + redis_url 返回 CachedStorage | 单测：PG + Redis → CachedStorage wrapping PostgresStorage |
| 8.5.5 | CloudConfigSchema Zod 验证正确 | 单测：合法/非法配置 → 验证通过/报错 |
| 8.5.6 | 云端 vs 单机零代码差异 | 集成测试：同一 SessionManager 代码 → 切换 storage → 行为一致 |

---

### 里程碑 M8 / v0.3.0 验收（Week 41 末）

> **云端部署完整可用：存储可插拔 + 沙箱隔离 + 审计日志 + 数据归档**

| # | 端到端验收标准 | 验证方式 |
|---|--------------|---------|
| M8.1 | Docker Compose 一键启动云端环境（vitamin + PG + Redis） | `docker compose up` → 服务健康 |
| M8.2 | 会话数据持久化到 PostgreSQL，重启后可恢复 | 创建会话 → 重启容器 → 会话仍在 |
| M8.3 | Redis 缓存加速读取（命中率 > 80% 稳态） | 监控面板或日志统计 |
| M8.4 | 三种沙箱后端至少一种可在 CI 中通过 | OS-native（Linux CI）或 Server Wasm 全部测试通过 |
| M8.5 | 审计日志记录所有工具执行，可按用户/时间查询 | `SELECT * FROM audit_logs WHERE user_id=? AND created_at > ?` |
| M8.6 | 冷数据自动归档到 S3 + 可恢复 | 触发归档 → S3 有文件 → 恢复 → 会话可用 |
| M8.7 | 单机模式完全不受影响（零配置 JSONL 默认） | 无 DATABASE_URL/REDIS_URL → `pnpm start` 正常 |
| M8.8 | 16 个包全部构建通过 | `pnpm build` 零错误 |

---

## Phase 9：Web UI — 浏览器端交互界面（Week 42-49）

> **来源**：技术方案 Part 12（12-web-ui.md）  
> **前置条件**：Phase 6（@vitamin/server）+ Phase 8（@vitamin/cloud）已完成  
> **目标**：提供浏览器端完整交互界面，作为 TUI 的 Web 替代方案  
> **新增包**：`@vitamin/web-ui`（17 号包）  
> **技术栈**：React 19 + TypeScript + Vite 6 + Mantine v7

### 9.1 Server API 扩展 + 项目骨架

| 项目 | 说明 |
|------|------|
| **工期** | Week 42-43（8 天） |
| **依赖** | Phase 6.1 @vitamin/server |
| **来源** | 12-web-ui.md §12.5, §12.7 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `packages/server/src/api/web-ui.ts` | 消息发送（SSE 流式响应）、中断、分叉 API |
| `packages/server/src/api/files.ts` | 文件列表 / 内容 / diff API |
| `packages/server/src/api/models.ts` | 可用模型列表 API |
| `packages/server/src/api/config-client.ts` | 客户端配置 API |
| `packages/server/src/auth/` | Token 认证 + OAuth 认证中间件 |
| `packages/web-ui/package.json` | @vitamin/web-ui 包骨架 |
| `packages/web-ui/vite.config.ts` | Vite + React SWC + 代理配置 |
| `packages/web-ui/src/theme.ts` | Mantine 深色主题定制（参考 Kimi 风格） |
| `packages/web-ui/src/app.tsx` | App 根组件（Router + MantineProvider） |
| `packages/web-ui/src/services/` | API 客户端 + SSE/WebSocket 流客户端 |

**实现约束**：

- **API 向后兼容**：扩展端点不影响 Phase 6 已有的 Inspector API
- **双模部署**：开发用 Vite dev server（`localhost:5173`）+ 生产内嵌到 `@vitamin/server`（`/app` 路径）
- **认证可选**：`--web-ui --no-auth`（本地） / Token 认证（单人） / OAuth（团队）
- **深色主题优先**：默认 dark mode，配色参考 Kimi 深色风格（背景 `#1a1b1e`，低对比度层次）

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|------|
| 9.1.1 | `POST /api/sessions/:id/messages` 返回 SSE 流式响应 | 集成测试：发送消息 → 收到 text_delta + done 事件 |
| 9.1.2 | `POST /api/sessions/:id/messages/:mid/stop` 中断 Agent | 集成测试：执行中 → 调用 stop → Agent 停止 |
| 9.1.3 | 文件 API 返回会话关联文件列表 + diff | 单测：mock 文件 → API 返回正确结构 |
| 9.1.4 | Token 认证中间件可拦截未授权请求 | 单测：无 token → 401；有效 token → 通过 |
| 9.1.5 | Vite dev server 代理到 @vitamin/server 正常工作 | 手动测试：`pnpm dev` → API 请求代理成功 |
| 9.1.6 | Mantine 深色主题加载无报错 | 单测：MantineProvider + theme → render 成功 |

---

### 9.2 左侧栏 + 主对话区

| 项目 | 说明 |
|------|------|
| **工期** | Week 43-45（12 天） |
| **依赖** | 9.1 骨架 |
| **来源** | 12-web-ui.md §12.3.1, §12.3.2, §12.3.3 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `src/components/sidebar/` | 会话列表（虚拟滚动 + 搜索 + 分组 + 右键菜单） |
| `src/components/chat/chat-container.tsx` | 对话容器（自动滚动 + 虚拟列表） |
| `src/components/chat/assistant-message.tsx` | Assistant 消息（流式渲染 + Thinking 折叠） |
| `src/components/chat/code-block.tsx` | 代码块（Shiki 语法高亮 + 复制 + 行号） |
| `src/components/chat/tool-call-card.tsx` | 工具调用卡片（状态实时更新） |
| `src/components/chat/markdown-renderer.tsx` | Markdown 渲染（GFM + KaTeX + Mermaid） |
| `src/components/chat/progress-indicator.tsx` | 多步骤进度展示（Kimi 风格勾选列表） |
| `src/components/input/` | 输入区（自适应高度 + 命令面板 + 文件上传） |
| `src/hooks/use-chat.ts` | 对话核心 Hook（发送/流式接收/中断） |
| `src/hooks/use-sessions.ts` | 会话 CRUD（TanStack Query） |
| `src/hooks/use-stream.ts` | SSE/WebSocket 流式数据 Hook |
| `src/stores/ui-store.ts` | UI 状态管理（Zustand） |

**实现约束**：

- **流式渲染**：逐 token 追加，`requestAnimationFrame` 节流，避免频繁 DOM 更新
- **虚拟滚动**：会话列表与消息列表均使用 `@tanstack/react-virtual`，支持 1000+ 消息无卡顿
- **Thinking Block**：默认折叠显示"正在思考..."动画，展开后实时流式追加
- **工具卡片**：左侧彩色竖条标识状态（蓝=运行中/绿=成功/红=失败）+ 工具名 + 耗时
- **进度指示器**：带数字的步骤列表 + 完成勾选动画（参考 Kimi "当前进度 10/10" 样式）
- **代码块**：Shiki WASM + Web Worker 异步高亮，避免阻塞主线程

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|------|
| 9.2.1 | 会话列表按日期分组 + 搜索过滤可用 | 组件测试：渲染 20 条会话 → 分组正确 + 搜索命中 |
| 9.2.2 | 消息流式渲染无明显卡顿（60fps） | Playwright + CPU throttle → 无掉帧 |
| 9.2.3 | Thinking Block 折叠/展开交互正确 | 组件测试：点击展开 → 内容可见 → 再点折叠 |
| 9.2.4 | 代码块语法高亮 + 复制按钮 | 组件测试：渲染 TypeScript 代码 → 高亮正确 + 复制到剪贴板 |
| 9.2.5 | 工具调用卡片实时状态更新 | 组件测试：mock 状态变化 → 卡片颜色/图标/耗时更新 |
| 9.2.6 | 输入框 `/` 触发命令面板 | 组件测试：输入 `/` → 命令列表弹出 → 选择 → 填入 |
| 9.2.7 | 文件拖放上传为附件 | 组件测试：模拟 drop → 附件预览条显示 |
| 9.2.8 | 1000 条消息滚动流畅 | 性能测试：虚拟列表渲染 1000 条 → 滚动帧率 ≥ 55fps |

---

### 9.3 右侧面板 + 响应式布局

| 项目 | 说明 |
|------|------|
| **工期** | Week 45-46（5 天） |
| **依赖** | 9.2 主对话区 |
| **来源** | 12-web-ui.md §12.3.4, §12.2.2 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `src/components/panel/file-panel.tsx` | 文件面板（文件树 + diff 查看器 + 批量下载） |
| `src/components/panel/agent-panel.tsx` | Agent 状态面板（运行状态 + 工具历史 + Token 统计） |
| `src/components/layout/app-shell.tsx` | 三栏布局外壳（响应式断点切换） |
| `src/components/layout/header.tsx` | 顶部栏（Logo + 模型选择 + 设置） |
| `src/components/layout/status-bar.tsx` | 状态栏（Token 统计 + 模型信息 + 连接状态） |
| `src/hooks/use-responsive.ts` | 响应式断点检测 Hook |
| `src/hooks/use-agent-status.ts` | Agent 实时状态订阅 |

**实现约束**：

- **三级响应式**：Desktop ≥ 1200px（三栏）/ Tablet 768-1199px（左侧栏可折叠）/ Mobile < 768px（仅主区域）
- **面板标签页**：右侧面板通过标签切换文件/Agent 两个子面板
- **Diff 查看器**：Unified diff 格式，增删行红绿高亮
- **Token 统计**：本次对话 / 累计使用 / 费用估算，实时更新

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|------|
| 9.3.1 | Desktop 三栏布局正确 | 截图对比：≥ 1200px → 三栏均可见 |
| 9.3.2 | Tablet 尺寸左侧栏可折叠 | 组件测试：768px → 汉堡按钮可见 → 点击展开侧栏 |
| 9.3.3 | Mobile 尺寸仅显示主对话区 | 组件测试：< 768px → 侧栏隐藏 → 菜单触发 |
| 9.3.4 | 文件 diff 查看器正确渲染 unified diff | 组件测试：mock diff → 增删行高亮 |
| 9.3.5 | Token 统计实时更新 | 组件测试：mock 流式事件 → 数字递增 |

---

### 9.4 设置页 + 内嵌部署 + 测试

| 项目 | 说明 |
|------|------|
| **工期** | Week 47-48（8 天） |
| **依赖** | 9.3 布局完成 |
| **来源** | 12-web-ui.md §12.4.3, §12.8, §12.10 |

**交付物**：

| 文件 | 职责 |
|------|------|
| `src/routes/settings.tsx` | 设置页（模型配置 + 主题切换 + 快捷键方案） |
| `src/routes/settings-models.tsx` | 模型管理页（Provider + API Key 配置） |
| `src/routes/settings-agents.tsx` | Agent 管理页（列表 + 自定义 Agent） |
| `scripts/build-embed.ts` | 构建脚本：Vite 构建 → 复制到 `@vitamin/server/dist/web-ui/` |
| `@vitamin/server` 侧集成 | 检测 `dist/web-ui/` → 注册 `/app` 静态路由 + SPA fallback |
| `tests/components/` | 核心组件测试（Vitest + Testing Library） |
| `tests/hooks/` | Hook 测试（useChat / useStream / useSessions） |
| `tests/e2e/` | E2E 测试（Playwright：完整对话流） |

**实现约束**：

- **内嵌构建**：`pnpm --filter @vitamin/web-ui build:embed` 产出复制到 server 包，生产环境 `http://localhost:9229/app` 访问
- **SPA fallback**：`/app/*` 所有未匹配路由返回 `index.html`
- **API Key 安全**：设置页的 API Key 输入仅显示掩码，不回传明文
- **主题持久化**：主题偏好存储在 `localStorage`，刷新后保留

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|------|
| 9.4.1 | 设置页模型配置可保存 + 生效 | E2E：修改默认模型 → 新对话使用新模型 |
| 9.4.2 | 深色/浅色主题切换正常 | E2E：切换主题 → 刷新 → 主题保持 |
| 9.4.3 | 内嵌模式 `/app` 路径可访问完整 SPA | 集成测试：`pnpm build:embed` → `curl /app` → HTML 返回 |
| 9.4.4 | 组件单测覆盖率 ≥ 80% | `vitest run --coverage` |
| 9.4.5 | E2E 完整对话流（发送→流式→工具→完成） | Playwright：模拟完整对话 → 消息正确渲染 |
| 9.4.6 | SPA 路由刷新不 404 | E2E：直接访问 `/app/chat/xxx` → 页面正常加载 |

---

### 9.5 性能优化 + 视觉回归 + 文档

| 项目 | 说明 |
|------|------|
| **工期** | Week 48-49（5 天） |
| **依赖** | 9.4 功能完成 |
| **来源** | 12-web-ui.md §12.9, §12.10 |

**交付物**：

| 交付物 | 说明 |
|--------|------|
| 性能优化 | 代码分割 + lazy load + Shiki Web Worker + 构建产物 < 500KB gzip |
| 视觉回归测试 | Playwright 截图对比（深色/浅色 × Desktop/Tablet/Mobile = 6 组基线） |
| Lighthouse CI | 集成到 CI：LCP < 1.5s / CLS < 0.1 |
| Web UI 用户指南 | `docs/guide/web-ui.md` — 使用说明 + 部署配置 |
| Web UI 开发指南 | `docs/guide/web-ui-development.md` — 组件开发 + API 对接规范 |

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|------|
| 9.5.1 | 构建产物初始加载 < 500KB（gzip） | `vite build` → 检查产物大小 |
| 9.5.2 | LCP < 1.5s | Lighthouse CI 报告 |
| 9.5.3 | 6 组视觉回归基线建立 | Playwright 截图 → CI 对比零差异 |
| 9.5.4 | 用户指南覆盖安装/配置/使用全流程 | 文档审查 |
| 9.5.5 | Dev HMR < 200ms | 手动测试：修改组件 → 浏览器热更新耗时 |

---

### 里程碑 M9 / v0.4.0 验收（Week 49 末）

> **Web UI 完整可用：浏览器端 AI 对话 + 文件管理 + 响应式布局**

| # | 端到端验收标准 | 验证方式 |
|---|--------------|---------|
| M9.1 | 浏览器访问 `/app` 显示完整 Web UI | `http://localhost:9229/app` → SPA 加载 |
| M9.2 | 完整对话流程可工作（发送→流式→Thinking→工具→完成） | E2E：Playwright 全流程 |
| M9.3 | 会话管理可用（创建/搜索/删除/归档） | E2E：CRUD 操作全部通过 |
| M9.4 | 三种屏幕尺寸响应式布局正确 | 视觉回归：6 组截图零差异 |
| M9.5 | 代码块语法高亮 + Markdown 渲染（含公式/流程图） | E2E：渲染含代码/公式/Mermaid 的回复 → 正确展示 |
| M9.6 | 深色/浅色主题切换正常 | E2E：切换 → 刷新 → 主题保持 |
| M9.7 | 性能达标（LCP < 1.5s / 1000 消息 60fps） | Lighthouse + 性能测试 |
| M9.8 | 17 个包全部构建通过 | `pnpm build` 零错误 |

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

Week 25 ──── M6: 开发者工具链
             ├── @vitamin/server (HTTP/WebSocket + Inspector)
             ├── DevTools Inspector (6 面板)
             ├── Agent 断点与步进调试 (6 类型 + 7 检查点)
             ├── 三模式编排：圆桌脑暴引擎
             ├── 性能基准体系 (P95 CI 回归)
             └── LLM 重试 + Agent 善后强化

Week 33 ──── M7/v0.2.0: 试验性特性发布
             ├── 自主 Agent 合成 (Blueprint + Orchestrator)
             ├── 上行反馈与异常冒泡 (6 信号 + 3 级冒泡)
             ├── 同级协商与运行时临时圆桌
             ├── 试验性特性综合测试 + 文档
             └── npm 14 个包发布

Week 41 ──── M8/v0.3.0: 云端部署发布
             ├── SessionStorage 抽象层 + PostgreSQL 实现
             ├── Redis 缓存层 (CachedStorage 装饰器)
             ├── @vitamin/sandbox (OS-native + Server Wasm + Browser Wasm)
             ├── 审计日志 + 日志持久化 (Loki/ES)
             ├── 数据生命周期管理 (S3 归档/恢复)
             └── npm 16 个包发布
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
| R11 | 圆桌多角色讨论质量退化 | "同模型换语气"无实质差异 | 中 | 角色 prompt 强差异化 + 共识度阈值 + 早期中断机制 + 效果数据收集后决定是否内置 |
| R12 | Agent 合成 LLM 成本 | Blueprint 生成 token 消耗大 | 中 | 蓝图缓存（相似度 > 0.85 复用）+ token 预算上限 + 用户确认环节 |
| R13 | Escalation 风暴 | 大量 Agent 同时冒泡导致决策延迟 | 低 | 冒泡深度上限 + 批量合并相似 escalation + 自动解决优先 |
| R14 | Inspector 前端维护负担 | React + Vite 技术栈增加构建复杂度 | 低 | 前端产物预构建内嵌到 @vitamin/server，主构建流程不受影响 |
| R15 | PostgreSQL 运维复杂度 | 云端部署门槛提高 | 中 | JSONL 仍为默认，PG 仅云端启用；提供 Docker Compose 一键启动 + 迁移脚本 |
| R16 | Wasm 运行时兼容性 | Server Wasm 后端工具生态受限 | 中 | OS-native 作为完整工作负载备选；Server Wasm 用于可控工具集场景 |
| R17 | Browser Wasm 性能与内存限制 | 浏览器 2-4GB 内存上限 | 中 | 视为轻量场景（Web IDE / 教育），复杂任务引导转 Server 端 |
| R18 | S3 归档数据亏损 | 归档后 PG 数据已删 | 低 | 归档前验证 S3 上传成功；恢复操作事务保护 |
| R19 | Web UI 构建体积膨胀 | Mantine + Shiki + KaTeX 拉大初始包 | 中 | 严格 code-split + lazy load + Shiki WASM 按需加载 |
| R20 | 前后端 API 版本不一致 | 前端升级但 server 未更新 | 低 | API 版本头 + 兼容性检测 + 启动时版本校验 |
| R21 | SSE 长连接稳定性 | 网络抖动导致流式中断 | 中 | 自动重连 + 断点续传 + 指数退避 |

---

## 排除范围（v0.4.0 不包含）

以下特性在技术方案中有设计但推迟到 v0.5.0+：

| 特性 | 来源 | 推迟原因 |
|------|------|---------|
| SQLite 存储后端 | 03-package-design.md §3.7.1 `sqlite-storage.ts` | JSONL + PostgreSQL 已覆盖单机/云端，SQLite 为中间方案优先级低 |
| Gist 导出 | 03-package-design.md §3.7.1 `gist-export.ts` | 低优先级 |
| xAI / Groq / OpenRouter / DeepSeek Provider | 03-package-design.md §3.1.1 | 通过 OpenAI-compatible 模式间接支持 |
| Extension marketplace / Git 来源 | 05-extension-system.md §5.2 | npm + local 先行 |
| 生产环境 Human-in-the-Loop（持久化断点） | ADR-014 权衡 | 断点引擎仅用于开发调试，生产场景另行设计 |
| 多实例弹性伸缩（分布式锁 + 负载均衡） | 09-cloud-deployment.md §9.1.2 备注 | v0.3.0 聚焦单实例部署，多实例叠加分布式锁 |
| Web UI 国际化（i18n） | 12-web-ui.md | v0.4.0 仅支持中文/英文，多语言后续扩展 |
| Web UI 自定义主题编辑器 | 12-web-ui.md §12.6 | 深色/浅色两套足够，自定义主题编辑器延后 |
| 移动端原生应用（React Native） | — | Web 响应式覆盖移动端基础需求 |

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
| @vitamin/server | shared, agent, session, hooks | 6 | M6 |
| @vitamin/sandbox | shared, tools | 8 | M8 |
| @vitamin/cloud | session, config, shared, sandbox | 8 | M8 |
| @vitamin/web-ui | server (HTTP API) | 9 | M9 |
