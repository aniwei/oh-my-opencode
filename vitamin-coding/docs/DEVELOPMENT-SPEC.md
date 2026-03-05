# vitamin-coding-agent 开发规范与流程 Spec

> 版本：v1.0 | 日期：2026-02-28
> 本文档是 [DEVELOPMENT-PLAN.md](DEVELOPMENT-PLAN.md) 的规范补充
> 约束来源：设计文档（03-package-design.md 等）+ 分析文档（analysis/01~11）
> 目的：以类型签名、状态机、算法伪码、错误处理模式约束实现，防止开发逻辑跑偏

---

## 目录

- [S0. 全局约束](#s0-全局约束)
- [S1. @vitamin/shared 实现规范](#s1-vitaminshared-实现规范)
- [S2. @vitamin/config 实现规范](#s2-vitaminconfig-实现规范)
- [S3. @vitamin/ai 实现规范](#s3-vitaminai-实现规范)
- [S4. @vitamin/agent 实现规范](#s4-vitaminagent-实现规范)
- [S5. @vitamin/tools 实现规范](#s5-vitamintools-实现规范)
- [S6. @vitamin/hooks 实现规范](#s6-vitaminhooks-实现规范)
- [S7. @vitamin/orchestrator 实现规范](#s7-vitaminorchestrator-实现规范)
- [S8. @vitamin/session 实现规范](#s8-vitaminsession-实现规范)
- [S9. @vitamin/extension 实现规范](#s9-vitaminextension-实现规范)
- [S10. @vitamin/mcp 实现规范](#s10-vitaminmcp-实现规范)
- [S11. @vitamin/tui 实现规范](#s11-vitamintui-实现规范)
- [S12. @vitamin/coding-agent 实现规范](#s12-vitamincoding-agent-实现规范)
- [S13. @vitamin/sdk 实现规范](#s13-vitaminsdk-实现规范)
- [S14. 跨模块集成 Spec](#s14-跨模块集成-spec)
- [附录 A: 分析文档参考索引](#附录-a-分析文档参考索引)

---

## S0. 全局约束

### S0.1 编码规范（强制）

| 规则 | 说明 | 来源 |
|------|------|------|
| 文件命名 | kebab-case（`agent-loop.ts`） | AGENTS.md |
| 配置 key | snake_case（`disabled_agents`） | analysis/05 |
| 工厂模式 | 所有组件 `createXxx()` 工厂函数 | AGENTS.md |
| 桶导出 | 每个包 `src/index.ts` 统一导出 | AGENTS.md |
| 单文件上限 | 200 LOC（soft limit） | AGENTS.md |
| 禁止 catch-all | 不允许 `utils.ts`, `helpers.ts`, `service.ts` | AGENTS.md |
| 字符串引号 | 优先使用单引号（`'`），仅在字符串含单引号时用双引号或模板字符串 | 项目约定 |
| 默认语言 | 文档、注释、提交说明、交互文案默认使用中文；仅在外部协议/标准字段要求时使用英文 | 团队约定 |
| 注释风格 | 统一使用中文 `//` 行注释，不使用 `/** JSDoc */` 块注释 | CONVENTIONS.md |
| 模块引入 | 相对路径不加 `.js` 后缀（源码强制，构建产物除外；`moduleResolution: bundler`） | CONVENTIONS.md |
| 引入排序 | 包名引入 → 相对路径引入 → 类型引入（类型内部同理：包名在前、相对在后） | CONVENTIONS.md |
| 测试位置 | 测试文件放在 `packages/<name>/tests/` 独立目录，不与源码混放 | CONVENTIONS.md |

### S0.1.1 模块引入排序规范

import 语句按以下顺序排列，组间用空行分隔：

```typescript
// 1. 包名引入（node: 内置 → 第三方包 → workspace 包）
import { join } from 'node:path'
import { z } from 'zod'
import { createLogger, readTextFile } from '@vitamin/shared'

// 2. 相对路径引入
import { DEFAULT_CONFIG } from './defaults'
import { mergeConfigLayers } from './merger'
import { parseConfigPartially } from './parser'

// 3. 类型引入（包名在前 → 相对路径在后）
import type { Logger } from '@vitamin/shared'
import type { LoadConfigOptions, LoadConfigResult } from './types'
```

规则说明：

| 顺序 | 类别 | 示例 |
|------|------|------|
| 1 | Node.js 内置模块 | `import { join } from 'node:path'` |
| 2 | 第三方包 | `import { z } from 'zod'` |
| 3 | workspace 包 | `import { createLogger } from '@vitamin/shared'` |
| 4 | 相对路径值引入 | `import { DEFAULT_CONFIG } from './defaults'` |
| 5 | 类型引入 — 包名 | `import type { Logger } from '@vitamin/shared'` |
| 6 | 类型引入 — 相对路径 | `import type { Config } from './types'` |

### S0.2 类型安全（强制）

```typescript
// 以下用法在 CI 中自动检测，违反则构建失败
// ❌ 禁止
as any
@ts-ignore
@ts-expect-error
catch(e) {}  // 空 catch
"double quotes"  // 禁止双引号（含单引号的字符串除外）
/** JSDoc 注释 */  // 禁止 JSDoc 块注释
import { foo } from './foo.js'  // 禁止 .js 后缀

// ✅ 要求
'single quotes'   // 字符串一律单引号
`template ${var}` // 含变量时用模板字符串
// 中文行注释          // 注释统一中文 + // 风格
import { foo } from './foo'  // 相对路径不加扩展名
// 所有 error 必须是 VitaminError 子类或明确处理
```

### S0.3 测试规范

```typescript
// 测试文件位置：packages/<name>/tests/<module>.test.ts
// 引入源码路径：from '../src/<module>'（不加 .js 后缀）

// 测试风格：given/when/then（嵌套 describe）
import { getAvailable } from '../src/tool-registry'

describe('ToolRegistry', () => {
  describe('#given minimal preset', () => {
    describe('#when getAvailable() is called', () => {
      it('#then returns exactly 4 tools', () => {
        // ...
      })
    })
  })
})

// 框架：vitest（globals: true）
// 覆盖率：见各模块验收标准（全局 80% 行覆盖率阈值）
// vitest include: packages/*/tests/**/*.test.ts

// ❌ 禁止使用 mock
// 不允许 vi.mock()、vi.spyOn()、vi.fn() 等任何 mock/spy 功能
// 测试应基于真实实现，通过依赖注入或构造参数控制行为
// 如需隔离外部依赖，使用接口抽象 + 手写 stub 对象
```

### S0.4 错误类型层级

```typescript
// packages/shared/src/error.ts
// 所有包共享的错误基类

export class VitaminError extends Error {
  readonly code: string
  readonly cause?: Error

  constructor(message: string, options: { code: string; cause?: Error })
}

// 各包扩展:
export class ConfigError extends VitaminError { code = 'CONFIG_*' }
export class ProviderError extends VitaminError { code = 'PROVIDER_*' }
export class StreamError extends VitaminError { code = 'STREAM_*' }
export class AgentError extends VitaminError { code = 'AGENT_*' }
export class ToolError extends VitaminError { code = 'TOOL_*' }
export class HookError extends VitaminError { code = 'HOOK_*' }
export class SessionError extends VitaminError { code = 'SESSION_*' }
export class ExtensionError extends VitaminError { code = 'EXTENSION_*' }
export class McpError extends VitaminError { code = 'MCP_*' }

// 错误传播规则:
// 1. Hook 内部错误 → log + 跳过（不阻塞后续 Hook）
// 2. Extension 错误 → log + 跳过（不影响主流程）
// 3. Tool 执行错误 → 包装为 ToolResult { isError: true }
// 4. Provider 错误 → 触发 fallback 链
// 5. Agent 循环错误 → emit('error') + 状态转 error
```

### S0.5 日志规范

```typescript
// 所有运行时模块使用 @vitamin/shared 的 pino 日志
import { createLogger } from '@vitamin/shared'

const log = createLogger('ai:stream')

// 输出到 /tmp/vitamin.log（JSON Lines 格式）
// 控制台输出使用 pino-pretty
// 日志级别: trace < debug < info < warn < error < fatal
```

---

## S1. @vitamin/shared 实现规范

> 来源：03-package-design.md §3.13, analysis/06

### S1.1 EventEmitter 类型安全实现

```typescript
// packages/shared/src/event-emitter.ts

// 必须实现泛型事件映射，编译时拒绝错误事件名/载荷
export class TypedEventEmitter<TEvents extends Record<string, (...args: any[]) => void>> {
  on<K extends keyof TEvents>(event: K, handler: TEvents[K]): () => void
  off<K extends keyof TEvents>(event: K, handler: TEvents[K]): void
  emit<K extends keyof TEvents>(event: K, ...args: Parameters<TEvents[K]>): void
  once<K extends keyof TEvents>(event: K, handler: TEvents[K]): () => void
}

// 使用示例:
interface AgentEvents {
  'status_change': (from: AgentStatus, to: AgentStatus) => void
  'error': (error: Error) => void
}
const emitter = new TypedEventEmitter<AgentEvents>()
emitter.emit('status_change', 'idle', 'streaming') // ✅
emitter.emit('status_change', 42) // ❌ 编译错误
```

### S1.2 Disposable 实现

```typescript
// packages/shared/src/disposable.ts

// 必须支持 ECMAScript Explicit Resource Management (using 语义)
export interface Disposable {
  [Symbol.dispose](): void
}

export interface AsyncDisposable {
  [Symbol.asyncDispose](): Promise<void>
}

// DisposableStack 管理多个资源
export class DisposableStack {
  use(resource: Disposable): void
  defer(cleanup: () => void): void
  [Symbol.dispose](): void
}
```

### S1.3 进程管理

```typescript
// packages/shared/src/process.ts

// 必须实现: 超时 + 信号转发 + 输出捕获
export interface SpawnOptions {
  command: string
  args?: string[]
  cwd?: string
  timeout?: number        // 超时后 SIGTERM → 等 5s → SIGKILL
  maxOutputSize?: number  // 默认 60KB，超过截断
  signal?: AbortSignal    // 外部取消
  env?: Record<string, string>
}

export interface SpawnResult {
  stdout: string
  stderr: string
  exitCode: number
  signal?: string
  truncated: boolean      // 是否被截断
  timedOut: boolean       // 是否超时
}
```

---

## S2. @vitamin/config 实现规范

> 来源：03-package-design.md §3.8, analysis/05, analysis/06

### S2.1 6 层配置加载管线

```
loadConfig(options: LoadConfigOptions): ResolvedConfig

  Step 1: CLI 参数解析
    → options.overrides (最高优先级)

  Step 2: 环境变量
    → VITAMIN_MODEL, VITAMIN_THEME, VITAMIN_LOG_LEVEL...
    → 命名规则: VITAMIN_{SNAKE_CASE_KEY}

  Step 3: 项目配置
    → {cwd}/.vitamin/config.jsonc
    → JSONC 解析 (支持注释 + trailing comma)
    → 语法错误: partial parsing (失败 section 跳过 + 逐 key 独立 parse)

  Step 4: 用户配置
    → ~/.config/vitamin/config.jsonc

  Step 5: Extension 默认值
    → Extension 注册的默认配置

  Step 6: 框架内置默认值
    → defaults.ts

  合并策略:
    ├─ 对象字段 (agents, categories): deepMerge
    ├─ disabled_* 数组: Set 并集
    └─ 标量字段: 高优先级覆盖
```

### S2.2 Partial Parsing 容错逻辑

```typescript
// packages/config/src/parser.ts

// 核心原则: 配置文件部分错误不应阻止整体加载
function parseConfigPartially(raw: string): {
  config: Partial<VitaminConfig>
  warnings: ConfigWarning[]
} {
  // 1. JSONC parse → 如果整体成功则直接返回
  // 2. 如果整体失败 → 按 top-level key 逐个尝试
  // 3. 每个 key 独立 Zod validate → 失败则 warning + 使用 default
  // 4. 未知字段: warning (不 reject)
}

// 错误消息必须包含:
interface ConfigWarning {
  key: string       // "agents.sisyphus.model"
  message: string   // "Invalid model identifier"
  line?: number     // JSONC 中的行号
  column?: number   // JSONC 中的列号
}
```

### S2.3 配置迁移规范

```typescript
// packages/config/src/migrator.ts

// 自动迁移旧配置到新版本
interface Migration {
  version: string           // 目标版本 "1.0.0"
  description: string
  migrate(config: unknown): unknown
}

// 迁移链: v0 → v1 → v2 → ... 按序执行
// 迁移记录: config._migrations = ['v0→v1', 'v1→v2']
// 迁移不可回滚 — 向前兼容

// 内置迁移示例:
// - agent 名称变更: "old-agent-name" → "new-agent-name"
// - model 版本: "claude-3.5-sonnet" → "claude-sonnet-4-6"
// - hook 名称变更: "old-hook" → "new-hook"
```

---

## S3. @vitamin/ai 实现规范

> 来源：03-package-design.md §3.1, analysis/08 (pi-mono 对比), analysis/11 (framework)

### S3.1 Provider 适配器接口

```typescript
// packages/ai/src/providers/types.ts

// 每个 Provider 必须实现此接口
export interface ProviderAdapter {
  readonly id: string                    // 'anthropic-messages'
  readonly displayName: string           // 'Anthropic'

  // 流式调用（核心）
  stream(
    model: Model,
    context: StreamContext,
    signal: AbortSignal,
  ): AsyncIterable<StreamEvent>

  // 平台健康检查
  healthCheck?(apiKey: string): Promise<boolean>
}

// 注册表:
// packages/ai/src/providers/registry.ts
export class ProviderRegistry {
  register(apiType: ApiType, factory: () => ProviderAdapter): void
  get(apiType: ApiType): ProviderAdapter
  list(): ApiType[]
}
```

### S3.2 模型适配逻辑（关键约束）

```typescript
// analysis/01-agents.md 核心规则:

// GPT family 适配:
if (isGptFamily(model)) {
  // 使用 reasoningEffort + textVerbosity 而非 thinking.budgetTokens
  streamOptions.reasoningEffort = variant ?? 'high'
  // 不设置 temperature（GPT 推理模型不支持）
}

// Claude family 适配:
if (isClaudeFamily(model) && requiresThinking) {
  streamOptions.thinking = {
    type: 'enabled',
    budgetTokens: config.thinkingBudget ?? 32000
  }
}

// 通用规则:
// - maxTokens 默认 64000 (Sisyphus/Hephaestus/Atlas)
// - temperature: 0.1 (Oracle/Momus), 0.2 (Roundtable), 0.3 (Metis)
// - thinking budgetTokens: 32000 (Claude 全系列)
```

### S3.3 EventStream 实现

```typescript
// packages/ai/src/utils/event-stream.ts

// 必须支持 for-await-of + .result() 双模式
export class EventStream<E, R> implements AsyncIterable<E> {
  // for await (const event of stream) { ... }
  [Symbol.asyncIterator](): AsyncIterator<E>

  // 等待完整结果
  result(): Promise<R>

  // 取消
  abort(): void
}

// 流式事件类型 (必须严格遵循):
export type StreamEvent =
  | { type: 'start'; partial: AssistantMessage }
  | { type: 'text_delta'; index: number; delta: string }
  | { type: 'thinking_delta'; index: number; delta: string }
  | { type: 'tool_call_start'; toolCall: ToolCall }
  | { type: 'tool_call_delta'; id: string; delta: string }
  | { type: 'tool_call_end'; id: string; toolCall: ToolCall }
  | { type: 'done'; message: AssistantMessage }
  | { type: 'error'; error: Error; partial?: AssistantMessage }
```

### S3.4 Fallback 链引擎算法

```
streamWithFallback(models, context, config):
  for i, model in models:
    retries = 0
    while retries < config.maxRetries:
      try:
        return stream(model, context)
      catch error:
        if error is rate_limit OR overloaded:
          if config.crossProviderFallback AND i < models.length - 1:
            emit { type: 'fallback', from: model.id, to: models[i+1].id }
            break  // → 下一个 model
          else:
            wait backoff(retries, config.backoff)
            retries++
        elif error is context_overflow:
          // 不重试 — 交给上层 compaction
          throw error
        elif error is server_error OR timeout:
          wait backoff(retries, config.backoff)
          retries++
        else:
          throw error  // 不可重试
    // 此 model 用尽重试 → 继续下一个

  throw new ProviderError('All providers exhausted')
```

### S3.5 Category→Model 三级解析

```typescript
// packages/ai/src/model-resolver.ts

function resolveModel(
  category: string,
  config: ResolverConfig,
  availableModels: Model[],
): Model {
  // Level 1: 用户配置覆盖
  // config.categories[category].model → 直接使用
  if (config.categories?.[category]?.model) {
    return findModel(config.categories[category]!.model, availableModels)
  }

  // Level 2: Category 默认 preferredModels
  // BUILTIN_CATEGORIES[category].preferredModels → 逐个尝试可用性
  const builtinCategory = BUILTIN_CATEGORIES[category]
  if (builtinCategory) {
    for (const modelId of builtinCategory.preferredModels) {
      const model = findModel(modelId, availableModels)
      if (model) return model
    }
  }

  // Level 3: 系统 fallback 链
  // Claude → OpenAI → Gemini → Copilot → Ollama
  for (const modelId of SYSTEM_FALLBACK_CHAIN) {
    const model = findModel(modelId, availableModels)
    if (model) return model
  }

  throw new ProviderError('No available model for category: ' + category)
}
```

### S3.6 内置 Category 定义

```typescript
// 来源: analysis/02, 03-package-design.md §3.1.5
// 8 个内置 Category (与 oh-my-opencode 对齐)

const BUILTIN_CATEGORIES = {
  general:  { preferredModels: ['anthropic/claude-opus-4-6', 'openai/gpt-5.3-codex'] },
  quick:    { preferredModels: ['anthropic/claude-haiku-4-5', 'openai/gpt-4.1-mini'] },
  deep:     { preferredModels: ['openai/gpt-5.3-codex', 'anthropic/claude-opus-4-6'] },
  ui:       { preferredModels: ['google/gemini-3.1-pro', 'anthropic/claude-sonnet-4-6'] },
  search:   { preferredModels: ['xai/grok-code-fast', 'deepseek/deepseek-chat'] },
  writing:  { preferredModels: ['moonshot/kimi-k2.5', 'anthropic/claude-sonnet-4-6'] },
  planning: { preferredModels: ['anthropic/claude-opus-4-6', 'openai/o3'] },
  review:   { preferredModels: ['openai/gpt-5.2', 'anthropic/claude-opus-4-6'] },
}
```

### S3.7 Provider Runtime View（三层合并模型）

```typescript
// 目标：对齐 OpenCode 的 provider 聚合思路
// 合并顺序：catalog <- config <- authRuntimePatch

export type ProviderRuntimeInfo = {
  id: string
  name: string
  source: 'catalog' | 'config' | 'auth'
  env: string[]
  options: Record<string, unknown>
  models: Record<string, Model>
}

export type ProviderRuntimePatch = {
  options?: Record<string, unknown>
  headers?: Record<string, string>
  key?: string
}

function buildProviderRuntimeView(
  catalog: Record<string, ProviderRuntimeInfo>,
  configProviders: Record<string, Partial<ProviderRuntimeInfo>>,
  authPatches: Record<string, ProviderRuntimePatch>,
): Record<string, ProviderRuntimeInfo> {
  const merged = deepMerge(catalog, configProviders)

  for (const [providerId, patch] of Object.entries(authPatches)) {
    if (!merged[providerId]) continue
    merged[providerId].options = deepMerge(merged[providerId].options, patch.options ?? {})
    if (patch.headers) {
      merged[providerId].options = deepMerge(merged[providerId].options, {
        headers: patch.headers,
      })
    }
  }

  return merged
}
```

强制约束：

- 认证层不得写入业务配置文件（Auth/Config 解耦）。
- `install`/`doctor` 只处理凭据检查，不直接变更 `provider.options/models`。
- runtime patch 仅在进程内生效，可复现且可追踪来源。

### S3.8 Copilot Provider 规范（首批基准实现）

```typescript
// packages/ai/src/providers/github-copilot.ts

const COPILOT_PROVIDER_ID = 'github-copilot'
const COPILOT_BASE_URL = 'https://api.githubcopilot.com'

type CopilotCredential = {
  token: string
  source: 'env' | 'config' | 'oauth'
}

function resolveCopilotCredential(): CopilotCredential {
  // 优先级：env > config > oauth
  if (process.env.GITHUB_TOKEN) {
    return { token: process.env.GITHUB_TOKEN, source: 'env' }
  }
  if (config.provider?.['github-copilot']?.options?.api_key) {
    return { token: String(config.provider['github-copilot'].options.api_key), source: 'config' }
  }
  const oauth = loadOAuthSession('github-copilot')
  if (oauth?.accessToken) {
    return { token: oauth.accessToken, source: 'oauth' }
  }
  throw new ProviderError('Missing GitHub Copilot credential', {
    code: 'PROVIDER_AUTH_MISSING',
  })
}

function inferCopilotApiMode(modelId: string): 'responses' | 'completions' {
  // 与 coding-agent 的占位推导保持一致，可按能力扩展
  return modelId.includes('gpt-5') ? 'responses' : 'completions'
}
```

请求头规范（最小集）：

- `Authorization: Bearer <token>`
- `User-Agent: vitamin-coding-agent/<version>`
- 预留 Copilot 扩展头注入位（如 editor/integration 标识）

### S3.9 Provider 可诊断错误规范（suggestions + 认证语义）

```typescript
export class ProviderModelNotFoundError extends ProviderError {
  constructor(
    readonly providerID: string,
    readonly modelID: string,
    readonly suggestions: string[] = [],
  ) {
    super(`Model not found: ${providerID}/${modelID}`, {
      code: 'PROVIDER_MODEL_NOT_FOUND',
    })
  }
}

function mapProviderAuthError(providerId: string, statusCode?: number): ProviderError {
  if (providerId === 'github-copilot' && (statusCode === 401 || statusCode === 403)) {
    return new ProviderError('GitHub Copilot authentication expired, please reconnect', {
      code: 'PROVIDER_AUTH_EXPIRED',
    })
  }

  return new ProviderError(`Provider auth failed: ${providerId}`, {
    code: 'PROVIDER_AUTH_FAILED',
  })
}
```

强制约束：

- provider/model 查找失败必须返回最多 3 条候选建议。
- 401/403 需区分“认证失效”与“普通请求失败”。
- 错误对象必须包含 `providerID`、`modelID`（若可用）和标准化 `code`。

---

## S4. @vitamin/agent 实现规范

> 来源：03-package-design.md §3.2, analysis/01, analysis/08 (pi-mono Agent Loop)

### S4.1 Agent 状态机（强制）

```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
                    ▼                                             │
              ┌──────────┐   prompt()    ┌──────────────┐        │
              │   idle    │ ──────────→  │  streaming    │        │
              └──────────┘               └──────┬───────┘        │
                    ▲                           │                 │
                    │                    tool_calls?               │
                    │                     ╱      ╲                │
                    │                   YES       NO              │
                    │                    ╲      ╱                 │
                    │              ┌──────▼───────┐              │
                    │              │tool_executing │              │
                    │              └──────┬───────┘              │
                    │                     │                       │
                    │            steering? OR more tools?         │
                    │              YES → 回到 streaming           │
                    │              NO  → stopReason?              │
                    │                     │                       │
                    │           ┌─────────┴─────────┐            │
                    │           │                    │            │
                    │       end_turn             tool_use         │
                    │           │                    │            │
                    │     followUp?           → 继续 streaming    │
                    │      YES → streaming                       │
                    │      NO  ↓                                 │
                    │    ┌───────────┐                           │
                    └────│ completed │                           │
                         └───────────┘                           │
                                                                 │
              abort() → 任意状态 → ┌──────────┐                  │
                                   │ aborted  │──────────────────┘
                                   └──────────┘  可通过 continue() 恢复

              error → 任意状态 → ┌──────────┐
                                 │  error   │
                                 └──────────┘
```

合法状态转换:

| From | To | 触发 |
|------|----|------|
| idle | streaming | prompt() / continue() |
| streaming | tool_executing | LLM 返回 tool_calls |
| streaming | completed | stopReason=end_turn + 无 followUp |
| streaming | streaming | stopReason=end_turn + 有 followUp |
| tool_executing | streaming | 工具执行完 OR steering 注入 |
| 任意 | aborted | abort() |
| 任意 | error | 未捕获异常 |
| aborted | streaming | continue() |

### S4.2 双层循环伪码（核心算法）

```
agentLoop(initialMessages, config, toolExecutor, signal, emit):

  messages = [...initialMessages]

  // ═══ 外循环: FollowUp 处理 ═══
  OUTER:
  while true:
    emit({ type: 'status_change', from: current, to: 'streaming' })

    // ═══ 内循环: 工具调用 + Steering ═══
    INNER:
    while true:
      toolTurnCount++
      if toolTurnCount > config.maxToolTurns:
        break INNER  // 安全阀

      emit({ type: 'turn_start', turnIndex })

      // 1. 上下文转换
      if config.transformContext:
        messages = await config.transformContext(messages, signal)

      // 2. 转换为 LLM 消息格式
      llmMessages = config.convertToLlm(messages)

      // 3. 流式调用 LLM
      response = stream(config.model, { systemPrompt, llmMessages, tools })
      for await event of response:
        emit({ type: 'stream_event', event })
        if signal.aborted: throw new AbortError()

      assistantMessage = await response.result()
      messages.push(assistantMessage)

      emit({ type: 'turn_end', turnIndex, message: assistantMessage })

      // 4. 处理工具调用
      if assistantMessage.hasToolCalls():
        emit({ type: 'status_change', to: 'tool_executing' })

        for toolCall in assistantMessage.toolCalls:
          // 检查 Steering 队列
          steeringMessages = await config.getSteeringMessages?.()
          if steeringMessages?.length > 0:
            messages.push(...steeringMessages)
            emit({ type: 'steering_injected', messages: steeringMessages })
            break  // 中断剩余工具，回到 LLM

          // 执行工具
          emit({ type: 'tool_call_start', toolCall })
          result = await toolExecutor.execute(toolCall, signal)
          messages.push(toolResultMessage(toolCall.id, result))
          emit({ type: 'tool_call_end', toolCall, result })

        continue INNER  // 有工具结果 → 继续让 LLM 响应

      // 5. 检查结束条件
      if assistantMessage.stopReason === 'end_turn':
        break INNER

    // ═══ 外循环: 检查 FollowUp ═══
    followUpMessages = await config.getFollowUpMessages?.()
    if followUpMessages?.length > 0:
      messages.push(...followUpMessages)
      emit({ type: 'follow_up_start', messages: followUpMessages })
      continue OUTER
    else:
      break OUTER  // 完全结束

  emit({ type: 'status_change', to: 'completed' })
```

### S4.3 Steering 队列规范

```typescript
// 来源: analysis/08 (pi-mono Steering Queue)

// Steering 消息在工具执行间隙检查
// 注入后: 中断剩余排队工具 → 携带 steering 消息回到 LLM
// 不触发 re-render (不同于 prompt())

class Agent {
  private steeringQueue: AgentMessage[] = []

  steer(message: AgentMessage): void {
    this.steeringQueue.push(message)
    // 不中断当前工具执行 — 等当前工具完成后检查
  }

  // 在 agentLoop 内部调用:
  private async getSteeringMessages(): Promise<AgentMessage[]> {
    const messages = [...this.steeringQueue]
    this.steeringQueue = []
    return messages
  }
}
```

### S4.4 FollowUp 队列规范

```typescript
// 来源: analysis/08 (pi-mono FollowUp Queue)

// FollowUp 在 Agent 完成后自动续跑
// 优先级高于用户新输入

class Agent {
  private followUpQueue: AgentMessage[] = []

  followUp(message: AgentMessage): void {
    this.followUpQueue.push(message)
  }

  // 在 agentLoop 外循环末尾检查:
  private async getFollowUpMessages(): Promise<AgentMessage[]> {
    const messages = [...this.followUpQueue]
    this.followUpQueue = []
    return messages
  }
}
```

### S4.5 工具执行器规范

```typescript
// packages/agent/src/tool-executor.ts

export interface ToolExecutor {
  // 顺序模式: 逐个执行
  executeSequential(
    toolCalls: ToolCall[],
    signal: AbortSignal,
    onResult: (toolCall: ToolCall, result: ToolResult) => void,
    checkSteering: () => Promise<AgentMessage[]>,
  ): Promise<void>

  // 并行模式: 同时执行（用于独立工具）
  executeParallel(
    toolCalls: ToolCall[],
    signal: AbortSignal,
  ): Promise<Map<string, ToolResult>>
}

// 工具错误处理:
// 工具抛异常 → 包装为 ToolResult { isError: true, content: error.message }
// 永远不让工具异常中断 Agent 循环
```

---

## S5. @vitamin/tools 实现规范

> 来源：03-package-design.md §3.4, analysis/04

### S5.1 工具执行管线（强制流程）

```
Agent 发起 tool_call
  │
  ▼
┌─ tool.execute.before Hooks (按 priority 排序) ─────────────┐
│  ├── file-guard: 检查文件路径是否受保护                       │
│  │     → /etc/*, node_modules/* → 拒绝                      │
│  ├── agent-specific-guard: Agent 特定守卫                     │
│  │     → Prometheus: 只能写 .vitamin/plans/*.md               │
│  │     → Atlas: 不能直接 write/edit 代码文件                  │
│  │     → Roundtable: 只能写 .vitamin/roundtable/*.md         │
│  ├── label-truncator: 截断过长的工具标签                      │
│  ├── rules-injector: 注入 .rules/*.md 内容到 args             │
│  │                                                            │
│  │  output.args 可被修改 (Hook 可改写工具参数)                │
│  │  Hook 抛异常 → 工具调用被拒绝 → 返回 isError=true         │
└───────────────────────────────────────────────────────────────┘
  │
  ▼
Tool.execute(validatedArgs, context)
  │ Zod 参数验证 → 非法输入 → isError=true + 友好错误消息
  │
  ▼
┌─ tool.execute.after Hooks (按 priority 排序) ──────────────┐
│  ├── output-truncation: 输出 > 60KB → 截断 + 截断提示       │
│  ├── metadata-store: 存储工具调用元数据                       │
│  ├── comment-checker: 检测 AI 风格注释 → 要求修正            │
│  ├── delegate-task-retry: task() 失败 → 自动重试             │
│  │                                                            │
│  │  output.result 可被修改 (Hook 可改写工具结果)              │
└───────────────────────────────────────────────────────────────┘
  │
  ▼
返回 ToolResult 给 Agent 循环
```

### S5.2 工具预设定义（强制）

```typescript
// packages/tools/src/tool-registry.ts

// 三种预设，对应 oh-my-opencode 的工具集分层
const PRESETS = {
  minimal: [
    'read', 'write', 'edit', 'bash'
  ],  // 4 个 — pi-mono 风格

  standard: [
    ...PRESETS.minimal,
    'grep', 'glob', 'find', 'ls', 'ast-grep', 'delegate-task'
  ],  // 10 个

  full: [
    ...PRESETS.standard,
    'edit-diff', 'look-at', 'interactive-bash', 'hashline-edit',
    'delegate-task', 'start-work', 'background-output', 'background-cancel', 'call-agent',
    'skill-executor', 'skill-mcp', 'skill-loader',
    'session-manager',
    'task-create', 'task-get', 'task-list', 'task-update',
  ],  // 26+ 个 — oh-my-opencode 风格
}
```

### S5.3 Agent 工具限制表（强制）

```typescript
// 来源: analysis/01, analysis/04

// 每个 Agent 有工具白名单 — 在 createXxxAgent() 中定义

const AGENT_TOOL_RESTRICTIONS: Record<string, {
  allowed: string[]    // 白名单 (undefined = 全部)
  denied?: string[]    // 黑名单
}> = {
  explore:   { allowed: ['read', 'grep', 'glob', 'find', 'ls', 'ast-grep'] },
  oracle:    { allowed: ['read', 'grep', 'glob', 'find', 'ls', 'ast-grep'] },
  librarian: { allowed: ['read', 'grep', 'glob', 'mcp:websearch:*', 'mcp:context7:*'] },
  atlas:     { denied: ['write', 'edit', 'edit-diff', 'bash'] },
  // Prometheus: 通过 file-guard hook 限制（只能写 .vitamin/plans/*.md）
  // Roundtable: 通过 file-guard hook 限制（只能写 .vitamin/roundtable/*.md）
  // Sisyphus, Hephaestus: 完全权限
}
```

---

## S6. @vitamin/hooks 实现规范

> 来源：03-package-design.md §3.5, analysis/04

### S6.1 Hook 注册双重守卫模式（强制）

```typescript
// 所有 Hook 必须通过双重守卫注册:

// Step 1: 检查配置是否禁用
if (isHookEnabled(hookName, config)) {
  // Step 2: 安全创建（工厂异常不阻塞）
  const hook = safeCreateHook(hookName, () => createXxxHook(ctx), {
    enabled: safeHookEnabled(hookName, config)
  })
  if (hook) hooks.push(hook)
}

// safeCreateHook 实现:
function safeCreateHook<T>(
  name: string,
  factory: () => T,
  options: { enabled: boolean },
): T | null {
  if (!options.enabled) return null
  try {
    return factory()
  } catch (error) {
    log.error(`Hook ${name} creation failed:`, error)  // 模板字符串含变量
    return null  // 不阻塞其他 Hook
  }
}
```

### S6.2 Hook 执行引擎规范

```typescript
// packages/hooks/src/hook-engine.ts

class HookEngine {
  // 执行 Hook 链:
  // 1. 按 priority 排序（低数字先执行）
  // 2. 链式处理: 前一个 Hook 的 output 作为后一个的 input
  // 3. 单个 Hook 抛异常 → log error → 跳过 → 执行下一个
  // 4. Hook 永远不能阻塞主流程

  async execute<T extends HookTiming>(
    timing: T,
    input: HookInput<T>,
    output: HookOutput<T>,
  ): Promise<void> {
    const hooks = this.getRegistered(timing)
      .sort((a, b) => a.priority - b.priority)

    for (const hook of hooks) {
      try {
        await hook.handler(input, output)
      } catch (error) {
        log.error(`Hook ${hook.name} failed:`, error)
        // 继续执行下一个 Hook
      }
    }
  }
}
```

### S6.3 文件守卫 Hook 复用模式

```typescript
// 来源: analysis/04
// prometheus-md-only, roundtable-md-only, atlas-write-edit-guard
// 共用同一套逻辑框架:

// 1. 从 session 解析当前 Agent 名称
const agentName = getAgentFromSession(sessionID)

// 2. 判断是否为目标 Agent
if (!isTargetAgent(agentName)) return  // 放行

// 3. 根据工具类型决定处理:
switch (toolCategory) {
  case 'TASK_TOOLS':      // delegate-task 等
    injectWarningPrompt() // 注入警告但不阻止
    break
  case 'BLOCKED_TOOLS':   // write, edit, bash
    if (!isAllowedPath(args.path, ALLOWED_PATTERNS)) {
      throw new ToolError(`${agentName} cannot write to ${args.path}`)  // 模板字符串含变量，合规
    }
    break
  default:
    break  // 只读工具放行
}
```

### S6.4 14 个核心 Hook Phase 2 清单

| # | Hook 名称 | Timing | Priority | 功能 |
|---|-----------|--------|----------|------|
| 1 | `first-message-variant` | chat.message.before | 10 | 首条消息特殊处理 |
| 2 | `session-recovery` | chat.message.before | 20 | 会话恢复注入上下文 |
| 3 | `keyword-detection` | chat.message.before | 30 | 检测 plan/build 关键词 |
| 4 | `session-history` | chat.message.before | 40 | 注入会话历史 |
| 5 | `file-guard` | tool.execute.before | 10 | 文件路径保护 |
| 6 | `label-truncator` | tool.execute.before | 20 | 截断过长标签 |
| 7 | `rules-injector` | tool.execute.before | 30 | .rules/*.md 注入 |
| 8 | `output-truncation` | tool.execute.after | 10 | 60KB 输出截断 |
| 9 | `context-injector` | messages.transform | 10 | 上下文注入 |
| 10 | `thinking-validator` | messages.transform | 20 | thinking block 校验 |
| 11 | `anthropic-effort` | chat.params | 10 | effort 级别调整 |
| 12 | `comment-checker` | tool.execute.after | 20 | AI 注释检测 |
| 13 | `babysitting` | tool.execute.after | 30 | Agent 异常检测 |
| 14 | `ralph-loop` | tool.execute.after | 40 | 循环检测 |

---

## S7. @vitamin/orchestrator 实现规范

> 来源：03-package-design.md §3.3, analysis/01, analysis/02, analysis/03

### S7.1 task() 双路径调度算法

```
task(args: TaskRequest):

  // ═══ 路径 A: subagent 路径 ═══
  if args.subagent:
    registration = registry.get(args.subagent)
    if !registration: throw 'Unknown subagent'

    // 反递归守卫 (Plan Family 不能互相委派)
    if isPlanFamily(currentAgent) AND isPlanFamily(args.subagent):
      throw 'Plan-family agents cannot delegate to other plan-family agents'

    model = resolveModel(registration, config, availableProviders)
    agent = registration.factory(model)
    → 执行

  // ═══ 路径 B: category 路径 ═══
  if args.category:
    model = categoryResolver.resolve(args.category, config)

    // 创建 Sisyphus-Junior:
    // - 继承 Sisyphus 的工具集
    // - Prompt 精简 (仅包含 category 相关指令)
    // - 临时 agent, 不注册到全局 registry
    agent = createSisyphusJunior(model, args.category)
    → 执行

  // ═══ 执行模式 ═══
  if args.mode === 'background':
    slot = await concurrencyManager.acquire(model.concurrencyKey)
    return backgroundManager.submit(agent, args)
  else:
    return await agent.prompt(args.prompt)
```

### S7.2 Plan Family 反递归守卫（强制）

```typescript
// 来源: analysis/02

const PLAN_FAMILY = ['prometheus', 'atlas', 'momus', 'metis'] as const

function isPlanFamily(agentName: string): boolean {
  return PLAN_FAMILY.includes(agentName as any)
}

// 在 TaskDispatcher.dispatch() 中强制检查:
if (isPlanFamily(currentAgent) && isPlanFamily(request.subagent)) {
  throw new AgentError(
    `Plan-family agent "${currentAgent}" cannot delegate to "${request.subagent}"`,
    { code: 'AGENT_PLAN_RECURSION' }
  )
}
```

### S7.3 并发控制模型

```typescript
// packages/orchestrator/src/background/background-manager.ts

// 来源: analysis/02
// 并发 key = "provider/model" (per model per provider)

class BackgroundManager {
  // 默认 5 个并发 slot per key
  // 调度优先级: config.modelConcurrency > config.providerConcurrency > default(5)

  async submit(task: BackgroundTask): Promise<TaskHandle> {
    const key = `${task.model.provider}/${task.model.id}`
    const slot = await this.acquireSlot(key) // 排队等待
    return this.execute(task, slot)
  }
}
```

### S7.4 任务状态机

```
pending → running → completed
                  → error → running (fallback retry)
                  → cancelled
```

### S7.5 Agent 注册表规范

```typescript
// packages/orchestrator/src/registry/agent-registry.ts

interface AgentRegistration {
  name: string
  factory: AgentFactory
  mode: AgentMode              // 'primary' | 'subagent' | 'all'
  metadata: AgentPromptMetadata
  disableable: boolean
}

// AgentPromptMetadata (来源: analysis/01):
interface AgentPromptMetadata {
  category: 'orchestrator' | 'specialist' | 'advisor' | 'utility' | 'exploration'
  cost: 'EXPENSIVE' | 'MODERATE' | 'CHEAP' | 'FREE'
  triggers: Array<{ domain: string; trigger: string }>
  useWhen?: string[]
  avoidWhen?: string[]
  executionMode: 'sync' | 'background' | 'both'
}
```

### S7.6 动态 Prompt 构建规范

```typescript
// packages/orchestrator/src/dynamic-prompt/prompt-builder.ts
// 来源: analysis/01

function buildDelegationTable(registrations: AgentRegistration[]): string {
  // 产出 3 张表注入 Sisyphus/Hephaestus system prompt:
  //
  // 1. Delegation Table:
  //    | Agent | Category | Cost | When to Use |
  //    |-------|----------|------|-------------|
  //
  // 2. Key Triggers:
  //    - "refactor|redesign" → prometheus
  //    - "find|search|locate" → explore
  //
  // 3. Tool Selection Table:
  //    | Tool | Description | Typical Agent |
  //    |------|-------------|---------------|
  //
  // 排除已禁用 Agent (registry.setEnabled(false) 后不出现在表中)
}
```

### S7.7 Sisyphus 4 阶段工作流（强制）

```
// 来源: analysis/01

Phase 1: Intent Gate
  输入: 用户消息
  输出: intent 分类 (code|architecture|usage|test|debug)
  决策: 简单 → 直接处理 / 复杂 → 委派

Phase 2: Codebase Assessment
  工具: grep_search, glob, ast_grep, read
  输出: 工作区理解 (结构, 依赖, 惯例)

Phase 3: Explore / Implement
  路径 A: 委派 (task + 子 Agent)
  路径 B: 直接编码 (edit, write, bash)
  路径 C: 并行后台 + 同步关键路径

Phase 4: Completion
  验证: test, typecheck, diagnostics
  汇报: 结果摘要
```

### S7.8 Agent Fallback Chain 数据（强制）

```typescript
// 来源: analysis/01, analysis/IMPLEMENTATION-CONSTRAINTS-REPORT.md 附录 B

const AGENT_MODEL_REQUIREMENTS = {
  sisyphus:    ['claude-opus-4-6', 'gpt-5.2', 'kimi-k2.5', 'gemini-3.1-pro'],
  hephaestus:  ['gpt-5.3-codex', 'claude-opus-4-6', 'gemini-3.1-pro', 'copilot-sonnet'],
  prometheus:  ['claude-opus-4-6', 'gpt-5.2', 'kimi-k2.5', 'gemini-3.1-pro'],
  oracle:      ['gpt-5.2(high)', 'claude-opus-4-6', 'gemini-3.1-pro'],
  momus:       ['gpt-5.2(low)', 'claude-sonnet-4-6', 'gemini-3-flash'],
  atlas:       ['kimi-k2.5', 'claude-sonnet-4-6', 'gemini-3-flash'],
  metis:       ['claude-opus-4-6', 'gpt-5.2', 'gemini-3.1-pro'],
  explore:     ['grok-code-fast(FREE)', 'gemini-3-flash', 'kimi-k2.5'],
  librarian:   ['gemini-3-flash', 'kimi-k2.5', 'copilot-sonnet', 'claude-sonnet'],
  roundtable:  ['claude-opus-4-6(max)', 'gpt-5.2(high)', 'kimi-k2.5', 'gemini-3.1-pro'],
  'multimodal-looker': ['claude-sonnet-4-6', 'gemini-3.1-pro', 'gpt-5.2'],
}
```

---

## S8. @vitamin/session 实现规范

> 来源：03-package-design.md §3.7, analysis/03, analysis/08

### S8.1 JSONL 存储格式

```typescript
// 每条消息一行 JSON，追加写入
// 断电安全: 每条 append 后 fsync

interface SessionEntry {
  id: string              // nanoid
  parentId: string | null // 树结构父节点
  type: 'message' | 'system' | 'compaction' | 'branch_point'
  content: AgentMessage | SystemEvent | CompactionRecord
  timestamp: number
  metadata?: Record<string, unknown>
}

// 文件路径: .vitamin/sessions/{sessionId}.jsonl
```

### S8.2 Session 树操作

```typescript
// packages/session/src/session-tree.ts

// fork: 从任意节点创建分支
fork(fromEntryId?: string): Session {
  // 1. 如果 fromEntryId 未指定，使用当前最新节点
  // 2. 创建 branch_point entry
  // 3. 后续 entry 的 parentId 指向 branch_point
  // 4. 新旧分支共享 branch_point 之前的消息
}

// navigateTo: 跳转到树中任意节点
navigateTo(entryId: string): void {
  // 1. 从根到 entryId 的路径 = 当前消息历史
  // 2. 更新 activeEntryId
  // 3. 后续对话从该节点继续
}

// getTree: 获取完整树结构
getTree(sessionId: string): SessionNode {
  // 1. 读取 JSONL 全部 entries
  // 2. 按 parentId 构建树
  // 3. 返回根节点（children 递归）
}
```

### S8.3 增量压缩算法

```
incrementalCompact(messages, existingSummary, config):

  recentCount = config.retainRecent  // 默认 5

  // 1. 分割消息
  oldMessages = messages[0 .. len-recentCount]
  recentMessages = messages[len-recentCount .. end]

  // 2. 增量摘要
  if existingSummary:
    // 仅对 "新过期" 消息摘要 (上次摘要之后 ~ 本次 retainRecent 窗口之前)
    newExpiredMessages = 上次 compact 后到本次 oldMessages 中的新消息
    updatedSummary = LLM.summarize(existingSummary + newExpiredMessages)
  else:
    updatedSummary = LLM.summarize(oldMessages)

  // 3. 保留 Todo 状态
  // 扫描 recentMessages 中的 todo list → 注入到 summary 末尾
  todoState = extractTodoState(recentMessages)
  if todoState:
    updatedSummary += '\n\n## Active Todos\n' + todoState

  // 4. 输出
  return {
    summary: updatedSummary,
    retainedMessages: recentMessages,
    compactionEntry: { type: 'compaction', content: updatedSummary }
  }

  // 结构: [摘要(v3)] + [原文 msg N-5] + ... + [原文 msg N]
```

### S8.4 Boulder State（Plan/Build 跨 Session 状态）

```typescript
// 来源: analysis/03

// 文件: .vitamin/boulder.json
interface BoulderState {
  active_plan: string       // 当前 plan 文件路径
  session_ids: string[]     // 关联的所有 session ID
  progress: {
    total: number           // plan 中 checkbox 总数
    completed: number       // 已勾选数
    percentage: number
  }
  created_at: string
  updated_at: string
}

// 跨 Session 恢复:
// 1. 新 session 启动 → 读取 boulder.json
// 2. 发现 active_plan 存在 → 读取 plan → 找到未完成 task
// 3. 自动注入续行 prompt
// 4. session_ids 追加当前 session ID
```

---

## S9. @vitamin/extension 实现规范

> 来源：03-package-design.md §3.6, analysis/08 (pi-mono Extension)

### S9.1 Extension 加载流程

```
ExtensionLoader.discover():
  1. 内置扩展: packages/coding-agent/src/extensions/
  2. npm 包: node_modules/@vitamin/ext-*
  3. 本地: .vitamin/extensions/
  4. 配置: config.extensions.paths[]
  (Git 来源推迟到 v0.2.0)

对每个发现的扩展:
  1. import() 动态加载
  2. apiBuilder.build(ext) → 构建独立的 ExtensionAPI 实例
  3. extensionFactory(api) → 执行 Extension 注册
  4. 捕获异常 → log + 跳过（不影响其他 Extension）
```

### S9.2 Extension 异常隔离规范

```typescript
// 核心原则: Extension 永远不能影响主流程

// 注册时:
try {
  await extensionFactory(api)
} catch (error) {
  log.error(`Extension ${name} failed to load:`, error)
  // 不中断启动流程
}

// 事件处理时:
for (const handler of extensionHandlers) {
  try {
    await handler(event)
  } catch (error) {
    log.error(`Extension handler failed:`, error)
    // 继续执行下一个 handler
  }
}

// 工具拦截时:
try {
  const result = await extensionToolWrapper(toolCall)
  if (result.preventDefault) return result.replacement
} catch (error) {
  log.error(`Extension tool wrapper failed:`, error)
  // fallthrough 到原始工具执行
}
```

### S9.3 ExtensionAPI 事件清单

```typescript
// 来源: 03-package-design.md §3.6.3, analysis/08

// 合并 pi-mono 26 事件 + oh-my-opencode 46 Hook 的统一事件模型:
type ExtensionEventName =
  // 会话事件
  | 'session.start' | 'session.switch' | 'session.fork'
  | 'session.end' | 'session.compacting'
  // Agent 事件
  | 'agent.start' | 'agent.end'
  | 'agent.turn.start' | 'agent.turn.end'
  // 消息事件
  | 'message.start' | 'message.update' | 'message.end'
  // 工具事件
  | 'tool.call' | 'tool.result'           // 可拦截
  | 'tool.execute.before' | 'tool.execute.after'
  // 变换事件
  | 'context.transform' | 'system.transform'
  // 输入事件
  | 'input'
  // 模型事件
  | 'model.select'
  // 资源事件
  | 'resources.discover'
```

---

## S10. @vitamin/mcp 实现规范

> 来源：03-package-design.md §3.9, analysis/05

### S10.1 三层 MCP 加载优先级

```
Priority (高 → 低):
  1. Built-in MCP (websearch, context7, grep_app)
  2. 用户配置 MCP (.vitamin/mcp.json)
  3. Skill 嵌入 MCP (SKILL.md YAML frontmatter)

加载流程:
  1. loadBuiltinMcps() → 3 个 remote HTTP
  2. loadUserMcps(configPath) → 解析 .vitamin/mcp.json
     → ${VAR} 环境变量展开
     → 每个 MCP: 创建传输 (stdio/http) + 连接 + tool/list
  3. loadSkillMcps(skillMcpManager) → 从活跃 Skill 中提取
     → SkillMcpManager 管理生命周期 (启动/重启/关闭)
```

### S10.2 MCP 工具命名空间（强制）

```typescript
// MCP 工具注册到全局 ToolRegistry 时的命名规则:
// 格式: mcp__{mcpName}__{toolName}

// 示例:
// websearch MCP 暴露 'webSearch' 工具 → 'mcp__websearch__webSearch'
// context7 MCP 暴露 'query' 工具 → 'mcp__context7__query'

// Agent 通过名称前缀过滤:
// librarian 的 allowed tools 包含 'mcp__websearch__*'
```

### S10.3 Skill MCP 生命周期

```
Skill 激活:
  1. 解析 SKILL.md YAML frontmatter → mcp 配置
  2. SkillMcpManager.start(skillName, mcpConfig)
  3. 启动 MCP 进程 (stdio) 或连接 (HTTP)
  4. tool/list → 注册工具到 ToolRegistry

Skill 停用:
  1. SkillMcpManager.stop(skillName)
  2. 移除已注册的工具
  3. 关闭 MCP 连接/进程

异常处理:
  - MCP 进程崩溃 → 自动重启 (最多 3 次)
  - 重启失败 → 标记不可用 + log warning
  - 不阻塞其他 Skill 或主流程
```

---

## S11. @vitamin/tui 实现规范

> 来源：03-package-design.md §3.10, analysis/08 (pi-mono pi-tui)

### S11.1 渲染模型

```typescript
// 不使用 React-like vdom
// 采用 pi-mono 验证过的 "每帧字符串数组" 模型:

interface Component {
  render(width: number): string[]  // 返回每行文本
}

// 渲染流程:
// 1. 收集所有组件的 render() 输出
// 2. 与前一帧 diff (逐行字符串比较)
// 3. 仅输出变更行 (最小化 CSI 写入)
// 4. CSI 2026 同步输出 (原子更新，消除闪烁)
```

### S11.2 CJK 字符处理

```typescript
// 来源: analysis/08

// 中文/日文/韩文字符占 2 个终端列宽
// 必须使用 wcwidth 或等效算法

function measureWidth(text: string): number {
  // 遍历每个 Unicode 代码点
  // CJK 统一表意文字 (U+4E00-U+9FFF): width = 2
  // CJK 兼容表意文字: width = 2
  // 全角标点: width = 2
  // 其他: width = 1
  // ANSI 转义序列: width = 0
}
```

### S11.3 TUI 事件循环与输入规范（OpenCode 对齐点）

```typescript
// 终端生命周期必须成对出现
start():
  terminal.enableRawMode()
  terminal.startListening()
  hideCursor()
  clearScreen()

cleanup():
  terminal.stopListening()
  showCursor()
  clearScreen()
  terminal.disableRawMode()

// 输入分发顺序（强制）
handleInput(raw):
  1) keyId = sequenceToKeyId(raw)
  2) if keyId 命中全局快捷键: 执行并 return
  3) parseKey(raw) -> ParsedKey
  4) currentPage.handleInput(parsed)
  5) renderCurrentPage()

// resize 同步要求
onResize(cols, rows):
  renderer.resize(cols, rows)
  allPages.resize(cols)
  renderCurrentPage()
```

约束：

- 全局快捷键优先于页面输入。  
- Enter 语义统一：页面至少支持 `enter`（可兼容 `return`）。  
- Tab 与 Shift+Tab 形成双向页面切换语义。

---

## S12. @vitamin/coding-agent 实现规范

> 来源：03-package-design.md §3.11, analysis/06, analysis/11

### S12.1 7 步初始化序列（强制顺序）

```
main(argv):
  1. parseCLI(argv)         → CLIOptions
  2. loadConfig(cliOptions) → VitaminConfig    (S2 规范)
  3. createSubsystems:
     ├── ModelRegistry.init()       // 加载模型数据库
     ├── ToolRegistry.init(preset)  // 注册工具 (S5 规范)
     ├── HookEngine.init()          // 注册 Hooks (S6 规范)
     ├── AgentRegistry.init()       // 注册 Agents (S7 规范)
     ├── SessionManager.init()      // 初始化会话 (S8 规范)
     ├── McpRegistry.init()         // 加载 MCP (S10 规范)
     └── ExtensionRunner.init()     // 加载 Extensions (S9 规范)
  4. createAgentSession()  → AgentSession
     ├── 绑定 Event Subscriptions
     ├── 构建 System Prompt (Agent 元数据 + 工具 + 项目上下文)
     └── 解析初始 Model
  5. selectMode(cliOptions):
     ├── interactive → TUIApp (S11 规范)
     ├── --print    → PrintMode
     ├── --json     → JSONMode
     └── --rpc      → RPCMode
  6. loadResources():
     ├── AGENTS.md → 注入系统提示
     ├── .vitamin/ → 配置 + plans + sessions
     └── .rules/*.md → 规则文件
  7. enterMainLoop()
```

### S12.2 系统 Prompt 构建（强制结构）

```
System Prompt = [
  // Layer 1: Agent 身份
  IDENTITY_PROMPT (角色描述 + 行为规则)

  // Layer 2: 动态委派表 (S7.6)
  buildDelegationTable(availableAgents)

  // Layer 3: 工具列表
  Available tools: [tool descriptions]

  // Layer 4: 项目上下文
  AGENTS.md content (如果存在)
  .rules/*.md content (如果存在)

  // Layer 5: Active Skills
  Skill names + descriptions

  // Layer 6: Category 信息
  Available categories + model mapping
]
```

### S12.3 Chat Loop（核心执行引擎）

```
// 来源: analysis/11, 04-core-flows.md §4.1

mainLoop(session: AgentSession):
  while true:
    input = await getInput(mode)  // 交互/非交互

    // 1. Extension 输入拦截
    intercepted = await extensionRunner.emitInput(input)
    if intercepted.cancelled: continue

    // 2. 斜杠命令检查
    if input.startsWith('/'):
      await handleSlashCommand(input)
      continue

    // 3. Skill/Template 展开
    input = await expandSkillsAndTemplates(input)

    // 4. Hook: chat.message.before
await hookEngine.execute('chat.message.before', { message: input })

    // 5. Agent.prompt(input)
    //    → 进入 S4.2 双层循环
    await agent.prompt([userMessage(input)])

    // 6. Hook: chat.message.after
    await hookEngine.execute('chat.message.after', { message: lastResponse })

    // 7. Session 持久化
    await sessionManager.persist(newEntries)

    // 8. 费用统计更新
    updateCostTracker(lastResponse.usage)
```

    ### S12.4 interactive 模式与 TUI 接入契约

    ```
    ModeRunner(interactive).run(session, options):
      app = new InteractiveApp(session, options)
      await app.start()

    InteractiveApp:
      - 负责 terminal/renderer/keybindings/page 路由编排
      - 不直接耦合 provider/transport 细节

    页面职责边界:
      - ConversationPage: 输入提交 + 对话渲染
      - SessionListPage: 会话列表浏览/选择
      - SettingsPage: 可编辑配置项（如 model）
    ```

    交互契约：

    - `Ctrl+C`：若 Agent 正在运行则中断；否则退出应用。  
    - `Ctrl+D`：退出应用。  
    - `Ctrl+L`：清屏并重绘当前页面。  
    - `Tab/Shift+Tab`：按顺序/逆序切换页面。  
    - 未命中全局快捷键时，按键事件下沉到当前页面。

---

## S13. @vitamin/sdk 实现规范

> 来源：03-package-design.md §3.12, analysis/08 (pi-mono SDK)

### S13.1 SDK 入口

```typescript
// packages/sdk/src/index.ts

export async function createVitaminAgent(options: {
  projectDir: string
  model?: string
  config?: Partial<VitaminConfig>
  extensions?: ExtensionFactory[]
}): Promise<VitaminAgent> {
  // 1. 加载配置 (S2)
  // 2. 初始化子系统 (S12.1 Step 3)
  // 3. 创建 AgentSession
  // 4. 绑定事件
  // 5. 返回 VitaminAgent 实例
}
```

### S13.2 RPC 协议

```typescript
// JSON-RPC 2.0 over Unix socket / TCP

// Server → Client 方法:
interface RPCServer {
  'prompt':     (text: string) => AgentStream
  'continue':   () => AgentStream
  'steer':      (message: string) => void
  'abort':      () => void
  'getState':   () => AgentState
  'dispose':    () => void
}

// Socket path: /tmp/vitamin-agent-{pid}.sock
```

---

## S14. 跨模块集成 Spec

### S14.1 Plan/Build 完整流程（Phase 5）

```
// 来源: analysis/03, 04-core-flows.md §4.2

Step 1: 意图检测
  用户: 'refactor the auth system'
  → Sisyphus Intent Gate → 标记为 "复杂任务"
  → keyword-detection hook 设置 metadata.isPlanCandidate=true

Step 2: 预分析 (Metis)
  → task({ subagent: 'metis', prompt: userRequest })
  → Metis: 并行 explore + librarian → 上下文摘要
  → 输出: { complexity: 'high', context: '...', recommendation: 'plan' }

Step 3: 规划 (Prometheus)
  → task({ subagent: 'prometheus', prompt: metisOutput + userRequest })
  → Prometheus Interview: 自动预研 + 用户提问 (≥3 个问题)
  → 写入 .vitamin/plans/{name}.md (含 checkbox 清单)
  → prometheus-md-only hook 确保只写 plans 目录

Step 4: 审查 (Momus)
  → task({ subagent: 'momus', prompt: planFile })
  → Momus: temperature=0.1, 80%通过偏好
  → 输出: "[OKAY]" | "[REJECT] + 最多 3 issues"
  → 拒绝 → 反馈给 Prometheus 修订 (最多 2 轮)

Step 5: 执行 (Atlas)
  → 用户 /start-work {name}
  → start-work hook → 创建 BoulderState
  → task({ subagent: 'atlas', prompt: planFile })
  → Atlas:
     ├── 读取 plan → 提取 checkbox
     ├── 构建 DAG (依赖拓扑)
     ├── 可并行步骤 → 同时 task()
     ├── 每步: task({ category: X, prompt: stepDetail })
     │   → Sisyphus-Junior 执行
     ├── 完成 → 更新 checkbox: - [x] done
     ├── 失败 → 取消依赖此步骤的后续步骤
     └── atlas-boulder-continuation hook → 自动续行

Step 6: 完成
  → 所有 checkbox ✅
  → BoulderState.progress = 100%
  → 向用户汇报
```

### S14.2 Continuation Hook 触发链

```
Session.idle 事件:
  │
  ├── todo-continuation-enforcer:
  │   读取 BoulderState
  │   → 未完成? → 注入 'Continue with next task' prompt
  │
  ├── atlas-boulder-continuation:
  │   Atlas 特化续行
  │   → 读取 plan → 找到下一个 [ ] → 注入执行 prompt
  │
  └── unstable-agent-babysitter:
      检测异常 (循环/卡死/重复操作)
      → 注入纠正 prompt
```

### S14.3 Thinking Block 校验规范

```typescript
// 来源: analysis/06

// experimental.chat.messages.transform 中执行:
// OpenCode/Anthropic 要求: thinking 必须在 text 之前

function validateThinkingBlocks(messages: Message[]): Message[] {
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue

    // 1. 空 thinking content → 移除
    msg.content = msg.content.filter(
      part => !(part.type === 'thinking' && !part.text?.trim())
    )

    // 2. 乱序 → 重排 (thinking → text → tool_use)
    msg.content.sort((a, b) => {
      const order = { thinking: 0, text: 1, tool_call: 2 }
      return (order[a.type] ?? 99) - (order[b.type] ?? 99)
    })

    // 3. 截断的 thinking → 移除 (避免 API 错误)
    // thinking block 必须有 signature 字段
  }
  return messages
}
```

### S14.4 Model Fallback 事件处理

```
Provider 返回错误:
  │
  ├── 429 rate_limit:
  │   → fallback-chain 指数退避
  │   → 跨 Provider 降级 (如果配置允许)
  │   → emit { type: 'fallback', from, to }
  │
  ├── 503 overloaded:
  │   → 同 429 处理
  │
  ├── 500 server_error:
  │   → 同 Provider 重试 (指数退避)
  │   → 不跨 Provider (可能是临时问题)
  │
  ├── context_overflow:
  │   → 不重试
  │   → 触发 compaction → 压缩后重试
  │
  └── 401/403 auth_error:
      → 不重试
      → 报告给用户
```

---

## 附录 A: 分析文档参考索引

| 文档 | 路径 | 关键内容 |
|------|------|---------|
| 系统概述 | `analysis/00-overview.md` | 整体架构、11 agent、26 tools、46 hooks |
| Agent 详解 | `analysis/01-agents.md` | Agent 矩阵、模型适配、Prompt 构建、Fallback 链 |
| 多 Agent 编排 | `analysis/02-multi-agent-orchestration.md` | task() 双路径、Category 系统、并发模型 |
| Plan/Build | `analysis/03-plan-build-mode.md` | Boulder State、5 步流程、Continuation |
| 工具与 Hook | `analysis/04-tools-and-hooks.md` | 工具管线、文件守卫、14 核心 Hook |
| 配置与 MCP | `analysis/05-config-features-mcp.md` | 3 级配置、3 层 MCP、Skill 发现 |
| 插件调用流 | `analysis/06-opencode-plugin-call-flow.md` | 6 阶段 Config Handler、初始化序列 |
| Plan/Build 实战 | `analysis/07-plan-build-practical-example.md` | 完整示例流程 |
| pi-mono 对比 | `analysis/08-pi-mono-analysis-and-comparison.md` | 7 包架构、Steering/FollowUp、Session 树 |
| Roundtable 实现 | `analysis/09-roundtable-module-implementation.md` | 993 行、8 角色、4 阶段协议 |
| Roundtable 流程 | `analysis/10-roundtable-discussion-flow.md` | 讨论协议详细流程 |
| 轻量框架设计 | `analysis/11-lightweight-agent-framework-design.md` | 4 层架构、核心接口、Chat Loop |
| 约束报告 | `analysis/IMPLEMENTATION-CONSTRAINTS-REPORT.md` | 全量提取的类型/算法/约束 |
