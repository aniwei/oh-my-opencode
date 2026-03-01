# oh-my-opencode 实现约束与流程规范 — 综合报告

> **来源**: `analysis/` 目录下 15 份文档全量提取  
> **生成日期**: 2026-02-28  
> **范围**: 类型签名、状态机、算法伪码、配置值、约束条件、错误处理、性能指标、测试策略、必做/禁做规则

---

## 目录

1. [Agent 子系统](#1-agent-子系统)
2. [编排子系统 (Orchestrator)](#2-编排子系统-orchestrator)
3. [Hook 子系统](#3-hook-子系统)
4. [Tool 子系统](#4-tool-子系统)
5. [Session 与执行引擎](#5-session-与执行引擎)
6. [Config 子系统](#6-config-子系统)
7. [MCP 子系统](#7-mcp-子系统)
8. [Skill 子系统](#8-skill-子系统)
9. [Shared 基础设施](#9-shared-基础设施)
10. [Roundtable 模块](#10-roundtable-模块)
11. [Vitamin Coding 框架设计](#11-vitamin-coding-框架设计)
12. [pi-mono 对比参考](#12-pi-mono-对比参考)
13. [全局约束与反模式](#13-全局约束与反模式)

---

## 1. Agent 子系统

### 1.1 核心类型

```typescript
// src/agents/types.ts
type AgentMode = "primary" | "subagent" | "all"

interface AgentPromptMetadata {
  category: string              // "orchestrator" | "specialist" | "advisor" | "utility"
  cost: "EXPENSIVE" | "MODERATE" | "CHEAP" | "FREE"
  triggers: string[]            // 关键词触发列表
  useWhen: string[]             // 适用场景
  avoidWhen: string[]           // 不适用场景
  executionMode: string         // "sync" | "background" | "both"
  description: string
}

type BuiltinAgentName =
  | "sisyphus" | "hephaestus" | "oracle" | "librarian"
  | "explore" | "atlas" | "prometheus" | "metis"
  | "momus" | "multimodal-looker" | "roundtable"

interface AgentFactory {
  (model: string, categories?: Category[], skills?: Skill[]): AgentConfig
}
```

### 1.2 Agent 注册表

```typescript
// src/agents/builtin-agents.ts
const agentSources: Record<BuiltinAgentName, () => Promise<{ create: AgentFactory }>>
const agentMetadata: Partial<Record<BuiltinAgentName, AgentPromptMetadata>>
```

### 1.3 Agent 矩阵（11 内置 Agent）

| Agent | 行数 | Mode | 模型首选 | maxTokens | thinking | temperature | 核心约束 |
|-------|------|------|---------|-----------|----------|-------------|---------|
| **Sisyphus** | 598 | `all` | Claude Opus 4-6 | 64000 | 32000 | 默认 | 主编排器，4 阶段工作流 |
| **Hephaestus** | 539 | `subagent` | GPT-5.3-Codex | 64000 | — | 默认 | 自主深度工作，NEVER 问权限 |
| **Atlas** | 6 files | `subagent` | Kimi K2.5→Sonnet | 64000 | 32000 | 默认 | "Conductor not musician"，只 `task()` 不写代码 |
| **Prometheus** | 8 files | `subagent` | Claude Opus 4-6 | 64000 | 32000 | 默认 | 只写 `.sisyphus/plans/*.md`，hook 守卫 |
| **Metis** | — | `subagent` | Claude Opus 4-6 | — | 32000 | 0.3 | 只读预分析，6 类意图分类 |
| **Momus** | 244 | `subagent` | GPT-5.2 | — | — | 0.1 | Plan 审查，80%通过偏好，`[OKAY]`/`[REJECT]` |
| **Oracle** | 171 | `subagent` | GPT-5.2 (high) | — | — | 0.1 | 只读战略顾问，≤7 步行动 |
| **Explore** | 123 | `subagent` | Grok Code Fast | — | — | 默认 | 3+ 并行工具搜索，FREE |
| **Librarian** | 321 | `subagent` | Gemini 3 Flash | — | — | 默认 | 外部文档，4 类请求 |
| **Multimodal-Looker** | — | `subagent` | — | — | — | — | 视觉内容分析 |
| **Roundtable** | 4 files | `subagent` | Claude Opus 4-6 (max) | — | 32000 | 0.2 | 讨论主持，只写 `.sisyphus/roundtable/*.md` |

### 1.4 Sisyphus 4 阶段工作流

```
Phase 1: Intent Gate
  → 分析用户意图（code/architecture/usage/test/debug）
  → 决定直接处理 vs 委派

Phase 2: Codebase Assessment
  → 理解工作区（grep_search, glob, ast_grep）
  → 收集依赖、结构、惯例

Phase 3: Explore / Implement
  → 委派子 agent 或直接编码
  → 并行后台任务 + 同步关键路径

Phase 4: Completion
  → 验证（test, typecheck, diagnostics）
  → 汇报结果
```

### 1.5 动态 Prompt 构建

```typescript
// src/agents/dynamic-agent-prompt-builder.ts
function buildDynamicSisyphusPrompt(
  agents: AgentPromptMetadata[],
  tools: ToolMetadata[],
  skills: SkillSummary[],
  categories: Category[]
): string
// 产出 3 张表: Delegation Table, Key Triggers, Tool Selection Table
// 注入 Sisyphus/Hephaestus system prompt
```

### 1.6 模型适配逻辑

```typescript
// 在 createXXXAgent() 内部
if (isGptFamily(model)) {
  // GPT: reasoningEffort + textVerbosity
  config.reasoningEffort = "high"
  config.textVerbosity = "high"
} else {
  // Claude/其他: thinking.budgetTokens
  config.thinking = { type: "enabled", budgetTokens: 32000 }
}
```

### 1.7 Sisyphus-Junior（动态 Agent）

```
category → resolveCategoryExecution()
  → 创建临时 "sisyphus-junior" agent
  → 继承 Sisyphus 工具集但 prompt 精简
  → 仅在 delegate-task 内部使用，不注册为全局 agent
```

---

## 2. 编排子系统 (Orchestrator)

### 2.1 `task()` 工具双路径

```typescript
// src/tools/delegate-task/
interface DelegateTaskArgs {
  description: string
  prompt: string
  // 路径 A: Category 委派
  category?: CategoryName
  // 路径 B: Subagent 委派
  subagent_type?: BuiltinAgentName
  // 通用选项
  session_id?: string      // 继续已有 session（节省 70%+ tokens）
  background?: boolean     // 后台异步执行
}
```

**解析流程**:

```
task(args)
  │
  ├─ subagent_type? → resolveSubagentExecution()
  │   └─ 查找 agent → 解析模型 → 创建/复用 session
  │
  └─ category? → resolveCategoryExecution()
      └─ 查找 category → 解析模型 → 创建 Sisyphus-Junior
```

### 2.2 8 内置 Category

```typescript
// src/tools/delegate-task/constants.ts
const DEFAULT_CATEGORIES = [
  "visual-engineering",  // UI/前端
  "ultrabrain",          // 高级推理
  "deep",                // 深度编码
  "artistry",            // 创意
  "quick",               // 快速任务
  "unspecified-low",     // 低成本默认
  "unspecified-high",    // 高成本默认
  "writing",             // 文档写作
]

// Category → Model 映射
const CATEGORY_MODEL_REQUIREMENTS: Record<string, {
  fallbackChain: FallbackEntry[]
}>
```

### 2.3 Plan Family 反递归守卫

```typescript
// 严禁 plan agent 委派另一个 plan agent
function isPlanFamily(agent: string): boolean {
  return ["prometheus", "atlas", "momus"].includes(agent)
}

// delegate-task 内部:
if (isPlanFamily(currentAgent) && isPlanFamily(targetAgent)) {
  throw new Error("Plan-family agents cannot delegate to other plan-family agents")
}
```

### 2.4 后台任务并发模型

```typescript
// src/features/background-agent/concurrency-manager.ts
class ConcurrencyManager {
  // 单例，per model/provider 限流
  // key = "provider/model"

  // 优先级:
  //   1. config.modelConcurrency[model]     (用户指定)
  //   2. config.providerConcurrency[provider] (Provider 级)
  //   3. default = 5                         (系统默认)
}
```

### 2.5 任务状态机

```
          ┌─────────┐
          │ pending  │
          └────┬─────┘
               │ acquire slot
          ┌────▼─────┐
          │ running   │
          └──┬──┬──┬──┘
             │  │  │
    ┌────────┘  │  └────────┐
    ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌──────────┐
│completed│ │ error  │ │cancelled │
└────────┘ └───┬────┘ └──────────┘
               │ retry?
          ┌────▼─────┐
          │ running   │  (fallback model)
          └──────────┘
```

### 2.6 Session 继续机制

```
首次委派: task(prompt, category="deep")
  → 创建 session S1 → 执行 → 返回结果 + session_id

后续委派: task(prompt, session_id=S1)
  → 复用 session S1 → 节省 70%+ tokens
  → 保留完整上下文 (tool results, conversation)
```

---

## 3. Hook 子系统

### 3.1 三层架构

```
Layer 1: Core Hooks (37)
  ├── Session Hooks (23) — chat.message, event, chat.params
  ├── Tool Guard Hooks (10) — tool.execute.before/after
  └── Transform Hooks (4) — experimental.chat.messages.transform

Layer 2: Continuation Hooks (7) — session.idle 自动续行

Layer 3: Skill Hooks (2) — Skill 激活后的上下文注入
```

### 3.2 Hook 注册模式

```typescript
// 双重守卫模式 (所有 hook 统一)
if (isHookEnabled(hookName, config)) {
  hooks.push(
    safeCreateHook(hookName, () => createXXXHook(ctx), {
      enabled: safeHookEnabled(hookName, config)
    })
  )
}

// safeCreateHook: 捕获工厂异常 → log → 跳过（不阻塞其他 hook）
```

### 3.3 关键 Hook 详表

| Hook | 层级 | 生命周期位置 | 功能 |
|------|------|------------|------|
| `prometheus-md-only` | Guard | tool.execute.before | Prometheus 只能写 `.sisyphus/plans/*.md` |
| `roundtable-md-only` | Guard | tool.execute.before | Roundtable 只能写 `.sisyphus/roundtable/*.md` |
| `atlas-write-edit-guard` | Guard | tool.execute.before | Atlas 不直接写代码 |
| `todo-continuation-enforcer` | Continuation | session.idle | Boulder 未完成 → 注入续行 prompt |
| `unstable-agent-babysitter` | Continuation | session.idle | Agent 异常行为检测 → 纠正 |
| `model-fallback` | Session | event(error) | 模型错误 → 自动切换下一个 fallback |
| `context-window-monitor` | Session | chat.params | 监控 token 用量，接近上限时警告 |
| `comment-checker` | Guard | tool.execute.after | 检测 AI 风格注释 → 要求修正 |
| `rules-injector` | Transform | messages.transform | 注入 .rules/*.md 到上下文 |
| `delegate-task-retry` | Guard | tool.execute.after | task() 失败 → 自动重试 |
| `start-work` | Session | chat.message | 检测 `/start-work` → 启动 Build 阶段 |
| `atlas-boulder-continuation` | Continuation | session.idle | Atlas Boulder 自动续行 |

### 3.4 Hook 生命周期分布

```typescript
// 8 个 OpenCode Hook 接入点:
"config"                              // 6-phase 配置组装
"tool"                                // 26 工具注册
"chat.message"                        // 首消息变体、session 设置、关键词检测
"chat.params"                         // Anthropic effort 调整
"event"                               // session.created/deleted/idle/error
"tool.execute.before"                 // 文件守卫、label 截断、rules 注入
"tool.execute.after"                  // 输出截断、metadata 存储
"experimental.chat.messages.transform" // 上下文注入、thinking block 校验
```

### 3.5 文件守卫 Hook 通用模式

```typescript
// prometheus-md-only / roundtable-md-only 共用:
//   1. getAgentFromSession(sessionID) → agent name
//   2. isTargetAgent(name) → boolean
//   3. TASK_TOOLS → 注入 WARNING prompt
//   4. BLOCKED_TOOLS → isAllowedFile(path) check → throw if denied
//   5. 其他工具 → 放行（只读操作安全）

// 复用:
//   agent-resolution.ts → getAgentFromSession()
//   path-policy.ts → isAllowedFile()
```

---

## 4. Tool 子系统

### 4.1 26 工具分类

| 分类 | 工具 | 说明 |
|------|------|------|
| **Search** | `grep_search`, `glob`, `ast_grep` | 代码搜索 |
| **Orchestration** | `task`, `background_output`, `background_cancel`, `call_omo_agent` | 编排委派 |
| **Skills** | `skill`, `skill_mcp` | Skill 系统 |
| **LSP** | `diagnostics`, `hover`, `find_references`, `go_to_definition`, `rename` | 语言服务 |
| **Session** | (session management tools) | Session 管理 |
| **Editing** | `hashline_edit` | 行号编辑 |
| **Other** | `look_at`, `interactive_bash`, `slashcommand` | 辅助工具 |
| **Task CRUD** | `task_create`, `task_get`, `task_list`, `task_update` | 任务管理（实验性） |

### 4.2 工具注册模式

```typescript
// src/plugin/tool-registry.ts
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"

const myTool = tool({
  name: "my_tool",
  description: "...",
  args: z.object({
    query: z.string().describe("搜索查询"),
    limit: z.number().default(10),
  }),
  async execute(args, ctx) {
    // ctx.directory, ctx.client, ctx.session
    return "result string"
  },
})
```

### 4.3 工具执行管线

```
Agent 调用 tool
  │
  ▼
tool.execute.before hooks (顺序执行)
  ├─ 文件守卫 (prometheus-md-only, etc.)
  ├─ label 截断
  ├─ args 注入/修改 (output.args 可写)
  │
  ▼
Tool.execute(args, ctx)
  │
  ▼
tool.execute.after hooks (顺序执行)
  ├─ 输出截断 (防 context overflow)
  ├─ metadata 存储
  ├─ comment-checker (验证代码注释)
  ├─ delegate-task-retry (task 失败重试)
  │
  ▼
返回结果给 Agent
```

---

## 5. Session 与执行引擎

### 5.1 Boulder State（Plan/Build 核心状态）

```typescript
// src/features/boulder-state/
// 文件: .sisyphus/boulder.json

interface BoulderState {
  active_plan: string          // 当前活跃 plan 文件路径
  session_ids: string[]        // 关联 session（支持跨 session 恢复）
  progress: {                  // 通过 checkbox 解析计算
    total: number
    completed: number
    percentage: number
  }
  created_at: string
  updated_at: string
}
```

### 5.2 Plan/Build 完整流程

```
Step 1: 用户请求复杂任务
  → Sisyphus 检测需要规划
  → task(subagent_type="prometheus")

Step 2: Prometheus 执行
  ├─ Interview 阶段: 搜索代码库理解上下文
  ├─ Plan Generation: 产出 .sisyphus/plans/{name}.md
  │   (含 checkbox 清单: - [ ] Task 1\n- [ ] Task 2\n...)
  └─ High Accuracy: task(subagent_type="momus") 审查
      → Momus: [OKAY] (80% 偏好) 或 [REJECT] (最多 3 issues)

Step 3: /start-work 触发
  ├─ `start-work` hook 检测关键词
  ├─ 创建 BoulderState → .sisyphus/boulder.json
  └─ task(subagent_type="atlas") 执行 Plan

Step 4: Atlas 执行
  ├─ 读取 plan → 提取 checkbox 清单
  ├─ 对每个 task: task(category=X, prompt=task_detail)
  │   → Sisyphus-Junior 执行具体编码
  ├─ 完成后更新 checkbox: - [x] Task 1
  └─ 自动续行 (atlas-boulder-continuation hook)

Step 5: 完成
  ├─ 所有 checkbox ✅
  ├─ BoulderState.progress = 100%
  └─ 向用户汇报
```

### 5.3 自动续行机制（Continuation Hooks）

```
session.idle 事件触发
  │
  ├─ todo-continuation-enforcer:
  │   读取 BoulderState → 未完成? → 注入 "Continue with next task" prompt
  │
  ├─ atlas-boulder-continuation:
  │   Atlas 特化续行 → 读取 plan → 找到下一个 unchecked → 注入
  │
  └─ unstable-agent-babysitter:
      检测 agent 异常行为 (循环、卡死) → 注入纠正 prompt
```

### 5.4 跨 Session 恢复

```
Session S1 (Atlas): 执行 Task 1-3 → 中断
Session S2 (Atlas): 
  → 读取 boulder.json → session_ids=[S1]
  → 读取 plan → 发现 Task 4-6 未完成
  → 从 Task 4 继续执行
  → boulder.json.session_ids=[S1, S2]
```

### 5.5 Thinking Block 校验（Transform Hook）

```typescript
// experimental.chat.messages.transform
// 删除/修复不完整的 thinking block
// OpenCode 要求: thinking 必须在 text 之前
// 修复策略: 
//   1. 空 thinking content → 移除
//   2. 乱序 → 重新排列 (thinking → text → tool_use)
//   3. 截断的 thinking → 补全或移除
```

### 5.6 Compaction Hook

```typescript
// experimental.session.compacting
// 在 index.ts 直接定义（非 hooks/ 目录）
// 功能: session 历史过长时压缩
//   - 保留最近 N 条消息
//   - 压缩旧消息为摘要
//   - Model agnostic: 适配所有 LLM provider
```

---

## 6. Config 子系统

### 6.1 配置文件路径

```
Project: {cwd}/.opencode/oh-my-opencode.jsonc
User:    ~/.config/opencode/oh-my-opencode.jsonc
Default: 内置 Zod schema 默认值
```

### 6.2 3 级合并策略

```
Priority (高 → 低):
  1. Project config  (.opencode/oh-my-opencode.jsonc)
  2. User config     (~/.config/opencode/oh-my-opencode.jsonc)
  3. Framework defaults

Merge rules:
  ├─ agents, categories → deepMerge (对象级)
  ├─ disabled_* arrays → Set 并集
  └─ 标量字段 → 高优先级覆盖
```

### 6.3 根 Schema 结构

```typescript
// src/config/schema/ (22+ files)
const OhMyOpenCodeConfigSchema = z.object({
  agents: AgentsConfigSchema.optional(),         // 14 个可覆盖 agent
  categories: CategoriesConfigSchema.optional(), // 8 内置 + 自定义
  disabled_agents: z.array(z.string()).optional(),
  disabled_hooks: z.array(z.string()).optional(),
  disabled_mcps: z.array(z.string()).optional(),
  disabled_skills: z.array(z.string()).optional(),
  disabled_commands: z.array(z.string()).optional(),
  disabled_tools: z.array(z.string()).optional(),
  experimental: ExperimentalConfigSchema.optional(),
  background_task: BackgroundTaskConfigSchema.optional(),
  notification: NotificationConfigSchema.optional(),
  tmux: TmuxConfigSchema.optional(),
  skills: SkillsConfigSchema.optional(),
  // ... 19 个 feature 配置
}).strict()
```

### 6.4 Agent 覆盖 Schema（21 字段）

```typescript
const AgentOverrideSchema = z.object({
  model: z.string().optional(),           // "anthropic/claude-opus-4-6"
  variant: z.string().optional(),         // "max" | "high" | "low"
  temperature: z.number().optional(),
  max_tokens: z.number().optional(),
  thinking_budget: z.number().optional(),
  prompt_append: z.string().optional(),   // 追加到 system prompt
  prompt_prepend: z.string().optional(),  // 前置到 system prompt
  // ... 共 21 个可覆盖字段
})
```

### 6.5 6 阶段 Config Handler

```typescript
// src/plugin-handlers/config-handler.ts
async function handleConfig(ctx): Promise<OpenCodeConfig> {
  // Phase 1: Provider 配置
  // Phase 2: Plugin 组件（features, managers）
  // Phase 3: Agent 注册（11 内置 + 用户自定义）
  // Phase 4: Tool 注册（26 tools）
  // Phase 5: MCP 注册（3 层）
  // Phase 6: Command 注册
}
```

### 6.6 Partial Parsing

```typescript
// src/plugin-config.ts
function parseConfigPartially(raw: unknown): ResolvedConfig {
  // 策略: 无效 section 跳过，不阻塞整体解析
  // 每个 top-level key 独立 parse
  // 失败 → log warning → 使用 default
}
```

### 6.7 配置迁移

```typescript
// 自动运行: legacy key → new key
// 示例:
//   agent 名称变更: "old-agent-name" → "new-agent-name"
//   hook 名称变更: "old-hook" → "new-hook"
//   model 版本: "claude-3.5-sonnet" → "claude-sonnet-4-6"
```

---

## 7. MCP 子系统

### 7.1 三层 MCP 架构

| 层级 | 来源 | 传输 | 注册位置 |
|------|------|------|---------|
| Built-in | `src/mcp/` | Remote HTTP | `createBuiltinMcps()` |
| Claude Code | `.mcp.json` | stdio/HTTP | `claude-code-mcp-loader` |
| Skill-embedded | SKILL.md YAML | stdio/HTTP | `SkillMcpManager` |

### 7.2 3 个内置 MCP

```typescript
// src/mcp/index.ts
const builtinMcps = {
  websearch: { type: "remote", url: "..." },  // Exa/Tavily
  context7:  { type: "remote", url: "..." },  // Context7
  grep_app:  { type: "remote", url: "..." },  // Grep.app
}
```

### 7.3 环境变量展开

```jsonc
// .mcp.json
{
  "my-mcp": {
    "command": "node",
    "args": ["server.js"],
    "env": {
      "API_KEY": "${MY_API_KEY}"  // 运行时 ${VAR} → process.env.VAR
    }
  }
}
```

### 7.4 MCP 工具命名空间

```
MCP 工具注入到全局 ToolEngine:
  命名: mcp:{mcpName}:{toolName}
  示例: mcp:websearch:webSearch

Agent 通过 tools 白名单访问:
  { "mcp:websearch:webSearch": true }
```

---

## 8. Skill 子系统

### 8.1 6 路径并行发现

```
搜索优先级 (高 → 低):
  1. {project}/.opencode/skills/          (项目级 OpenCode)
  2. {project}/.claude/skills/            (项目级 Claude Code)
  3. {project}/.oh-my-opencode/skills/    (项目级 OMO)
  4. ~/.config/opencode/skills/           (用户级 OpenCode)
  5. ~/.claude/skills/                    (用户级 Claude Code)
  6. ~/.config/oh-my-opencode/skills/     (用户级 OMO)
```

### 8.2 Skill 格式

```markdown
---
name: my-skill
description: A helpful skill
model: anthropic/claude-sonnet-4-6
allowed-tools: [grep, glob]
mcp:
  websearch:
    type: remote
    url: https://...
---

Skill content here (Markdown)...
```

### 8.3 Skill 生命周期

```
discoverAllSkills() → 6 路径并行扫描
  → loadSkillsFromDir() × 6 → 解析 YAML front matter
  → mergeSkills() → 去重 (名称优先级: 项目 > 用户)
  → SkillMcpManager → 启动 Skill 内嵌 MCP
  → 注入到 Agent prompt (skill 名称 + 描述列表)
```

---

## 9. Shared 基础设施

### 9.1 Model Resolution（3 步管线）

```typescript
// src/shared/model-resolution.ts
function resolveModel(
  agentName: string,
  userConfig: AgentOverride | undefined,
  requirements: ModelRequirement,
  availableProviders: string[]
): ResolvedModel {
  // Step 1: 用户覆盖
  if (userConfig?.model) return parseModel(userConfig.model)

  // Step 2: Fallback Chain
  for (const entry of requirements.fallbackChain) {
    if (entry.providers.some(p => availableProviders.includes(p))) {
      return { provider: matchedProvider, model: entry.model, variant: entry.variant }
    }
  }

  // Step 3: 系统默认
  return SYSTEM_DEFAULT_MODEL
}
```

### 9.2 Fallback Chain 数据结构

```typescript
interface FallbackEntry {
  providers: string[]     // ["anthropic", "github-copilot", "opencode"]
  model: string           // "claude-opus-4-6"
  variant?: string        // "max" | "high" | "low"
}

interface ModelRequirement {
  fallbackChain: FallbackEntry[]
}

// 全局映射表:
const AGENT_MODEL_REQUIREMENTS: Record<BuiltinAgentName, ModelRequirement>
const CATEGORY_MODEL_REQUIREMENTS: Record<string, ModelRequirement>
```

### 9.3 Model Fallback 优先级链

```
Sisyphus:     Claude Opus 4-6 → GPT-5.2 → Kimi K2.5 → Gemini 3.1 Pro
Hephaestus:   GPT-5.3-Codex → Claude Opus 4-6 → Gemini → Copilot
Atlas:        Kimi K2.5 → Claude Sonnet 4-6 → Gemini Flash
Prometheus:   Claude Opus 4-6 → GPT-5.2 → Kimi → Gemini 3.1 Pro
Oracle:       GPT-5.2 (high) → Claude Opus 4-6 → Gemini 3.1 Pro
Momus:        GPT-5.2 (low) → Claude Sonnet 4-6 → Gemini Flash
Explore:      Grok Code Fast (FREE) → Gemini Flash → Kimi
Librarian:    Gemini 3 Flash → Kimi K2.5 → Copilot → Claude Sonnet
Roundtable:   Claude Opus 4-6 (max) → GPT-5.2 (high) → Kimi → Gemini 3.1 Pro
```

### 9.4 safeCreateHook 工具

```typescript
// src/shared/safe-create-hook.ts
function safeCreateHook<T>(
  name: string,
  factory: () => T,
  options: { enabled: boolean }
): T | null {
  if (!options.enabled) return null
  try {
    return factory()
  } catch (error) {
    log.error(`Hook ${name} failed to create:`, error)
    return null  // 不阻塞其他 hook
  }
}
```

### 9.5 其他 Shared 模块

| 模块 | 文件 | 功能 |
|------|------|------|
| `agent-display-names.ts` | 30 行 | Agent 显示名称映射 |
| `merge-categories.ts` | — | 用户 category 与内置 category 合并 |
| `permission-compat.ts` | — | OpenCode 权限系统兼容 |
| `server-auth.ts` | — | `injectServerAuthIntoClient` |

---

## 10. Roundtable 模块

### 10.1 文件结构（993 行总计）

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/agents/roundtable/index.ts` | 19 | 桶导出 |
| `src/agents/roundtable/agent.ts` | 82 | Agent 工厂 + Metadata |
| `src/agents/roundtable/system-prompt.ts` | 276 | 5 段模块化 System Prompt |
| `src/agents/roundtable/panelist-roles.ts` | 284 | 8 角色 + 选角 + Prompt 构建 |
| `src/agents/roundtable/agent.test.ts` | 209 | 20 个测试用例 |
| `src/hooks/roundtable-md-only/index.ts` | 1 | Hook 桶导出 |
| `src/hooks/roundtable-md-only/constants.ts` | 38 | 常量 + 警告文本 |
| `src/hooks/roundtable-md-only/hook.ts` | 84 | tool.execute.before 守卫 |

### 10.2 8 个 Panelist 角色

```typescript
const PANELIST_ROLES = [
  { name: "architect",  title: "System Architect",       focusAreas: "..." },
  { name: "backend",    title: "Backend Engineer",       focusAreas: "..." },
  { name: "frontend",   title: "Frontend Engineer",      focusAreas: "..." },
  { name: "qa",         title: "QA Engineer",            focusAreas: "..." },
  { name: "product",    title: "Product Manager",        focusAreas: "..." },
  { name: "security",   title: "Security Engineer",      focusAreas: "..." },
  { name: "devops",     title: "DevOps Engineer",        focusAreas: "..." },
  { name: "dx",         title: "Developer Experience",   focusAreas: "..." },
]
```

### 10.3 选角算法

```typescript
function selectPanelistsForTopic(topic: string): PanelistRole[] {
  // 关键词匹配表:
  //   "UI|frontend|CSS|component"     → frontend, dx
  //   "auth|security|encrypt|token"   → security, backend
  //   "API|REST|endpoint|route"       → backend, architect
  //   "deploy|CI|docker|kubernetes"   → devops, backend
  //   "test|coverage|quality"         → qa, dx
  //   通用                            → architect, backend, qa, product (默认 4 角色)

  // 返回 4-6 个 panelist (去重后)
}
```

### 10.4 4 阶段讨论协议

```
Phase 0: Topic Framing
  → 提取主题 → selectPanelistsForTopic() → 收集代码库上下文 (task(explore))

Phase 1: Parallel Perspectives
  → 对每个 panelist: task(prompt=buildPanelistPrompt(role, topic), background=true)
  → Hook 注入 DISCUSSION_CONSULT_WARNING → 所有 panelist READ-ONLY
  → 4-6 个并行后台任务

Phase 2: Synthesis
  → 收集所有回复 → 映射为 Consensus / Conflict / Gap

Phase 3: Focused Debate
  → 对 Conflict 项: 同步 task 深入辩论
  → Round 2 prompt 包含前轮摘要
  → 无法解决 → task(subagent_type="oracle") 仲裁
  → Oracle 也无法裁决 → "Unresolved — requires human decision"

Phase 4: Documentation
  → 写入 .sisyphus/roundtable/{topic-kebab-case}.md
  → 模板: Executive Summary → Consensus → Conflicts → Gaps → Recommendations → Open Questions
```

### 10.5 异常路径

| 场景 | 处理 |
|------|------|
| Panelist 超时 | 基于已收回复继续，文档标注缺失视角 |
| 全 fallback 不可用 | 降级到 session 主模型 → 不可用则报错 |
| 违规写入 | hook throw → agent 收到错误 → 纠正行为重试 |
| 全票通过无冲突 | 跳过 Phase 2-3 → 直接 Phase 4 |
| Oracle 仲裁失败 | 标记 "Unresolved — requires human decision" → 不阻塞输出 |

### 10.6 Prompt 分层

```
Layer 0: System Prompt (276 行)
  ├─ ROUNDTABLE_IDENTITY
  ├─ ROUNDTABLE_PROTOCOL
  ├─ buildPanelistRoleTable() (动态)
  ├─ categories (动态)
  ├─ ROUNDTABLE_DISCUSSION_FLOW
  ├─ ROUNDTABLE_OUTPUT_FORMAT
  └─ ROUNDTABLE_BEHAVIORAL_RULES

Layer 1: User Message (Sisyphus 传入的 task prompt)
Layer 2: Tool Results (panelist 回复累积)
Layer 3: Thinking Budget (32000 tokens)
```

---

## 11. Vitamin Coding 框架设计

### 11.1 4 层架构

```
┌─────────────────────────────┐
│    Application Layer         │  oh-my-opencode (Plugin), CLI, Web
├─────────────────────────────┤
│    Framework Layer           │  @vitamin-coding/core (~2500 LOC)
│    AgentEngine, ToolEngine,  │  HookEngine, SessionManager
├─────────────────────────────┤
│    Adapter Layer             │  LLM Adapters (Anthropic, OpenAI, Google)
├─────────────────────────────┤
│    Platform Layer            │  Node.js / Bun runtime
└─────────────────────────────┘
```

### 11.2 核心抽象接口

```typescript
// AgentEngine
interface AgentEngine {
  register(name: string, provider: AgentProvider): void
  resolve(name: string): Promise<ResolvedAgent | null>
  list(): AgentSummary[]
  delegate(input: DelegateInput): Promise<DelegateResult>
}

// ToolEngine
interface ToolEngine {
  register(name: string, definition: ToolDefinition): void
  execute(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<string>
  schema(): ToolSchema[]   // 给 LLM 的 JSON Schema
  list(): ToolSummary[]
}

// HookEngine
interface HookEngine {
  on<E extends keyof HookEvents>(event: E, handler: HookEvents[E], options?: HookOptions): void
  off<E extends keyof HookEvents>(event: E, handler: HookEvents[E]): void
  emit<E extends keyof HookEvents>(event: E, ...args: Parameters<HookEvents[E]>): Promise<void>
}

// SessionManager
interface SessionManager {
  create(options: CreateSessionOptions): Promise<Session>
  get(id: string): Promise<Session | null>
  prompt(id: string, message: string): Promise<void>
  close(id: string): Promise<void>
}

// ConcurrencyManager
interface ConcurrencyManager {
  submit(task: SubmitTaskInput): Promise<BackgroundTask>
  await(taskID: string): Promise<BackgroundTask>
  cancel(taskID: string): Promise<void>
  status(taskID: string): BackgroundTask | undefined
  byParent(parentSessionID: string): BackgroundTask[]
  stats(): QueueStats
}

// LLMAdapter
interface LLMAdapter {
  readonly id: string
  models(): Promise<ModelInfo[]>
  chat(input: ChatInput): Promise<ChatResponse>
  chatStream(input: ChatInput): AsyncIterable<ChatStreamEvent>
  healthCheck(): Promise<boolean>
}
```

### 11.3 Chat Loop 伪码

```
ExecutionEngine.run(session):
  loop:
    1. hooks.emit("chat.params", params)
    2. tools = toolEngine.schema()
    3. hooks.emit("messages.transform", messages)
    4. response = adapter.chat({ model, messages, tools, ...params })
    5. for part in response.parts:
       if part.type == "tool_use":
         hooks.emit("tool.execute.before", { tool, args })
         result = toolEngine.execute(tool, args)
         hooks.emit("tool.execute.after", { tool, result })
         messages.push(toolResult)
       elif part.type == "text":
         messages.push(assistantText)
    6. if response.stopReason == "end_turn":
         hooks.emit("session.idle", session)
         break
    7. if response.stopReason == "tool_use":
         continue  // 工具结果已加入消息，继续循环
```

### 11.4 初始化序列

```
createVitaminCoding(options)
  ├─① ConfigLoader.load()           → ResolvedConfig
  ├─② AdapterRegistry.init()         → 可用 Provider 集合  
  ├─③ AgentEngine.init()             → AgentRegistry
  ├─④ ToolEngine.init()              → ToolRegistry
  ├─⑤ SkillEngine.init() (async)    → SkillRegistry
  ├─⑥ HookEngine.init()             → HookRegistry
  ├─⑦ McpRegistry.init()            → MCP 工具注入
  └─⑧ FrameworkContext               → Framework 实例
```

### 11.5 双模式运行

```
Mode A: Standalone (独立)
  Node.js App → createVitaminCoding() → framework.run("task")

Mode B: OpenCode Bridge (兼容)
  const plugin: Plugin = async (ctx) => {
    const framework = await createVitaminCoding({ directory: ctx.directory })
    return createOpenCodeBridge(framework, ctx)
  }
```

### 11.6 云端扩展（Store Adapter）

```typescript
// 核心原则: 数据和配置入库，代码和逻辑留在代码中

interface SessionStore {
  create(session: Session): Promise<Session>
  get(id: string): Promise<Session | null>
  update(id: string, patch: Partial<Session>): Promise<void>
  list(filter?: SessionFilter): Promise<Session[]>
}

interface PromptStore {
  get(agentName: string, version?: string): Promise<PromptRecord | null>
  save(record: PromptRecord): Promise<PromptRecord>
  versions(agentName: string): Promise<PromptVersion[]>
  activate(agentName: string, version: string): Promise<void>
  getTenantOverride(agentName: string, tenantID: string): Promise<PromptRecord | null>
}

interface TaskStore {
  enqueue(task: BackgroundTask): Promise<void>
  dequeue(concurrencyKey: string): Promise<BackgroundTask | null>
  claim(taskID: string, workerID: string): Promise<boolean>  // 分布式锁
}
```

### 11.7 云端配置优先级（5 级）

```
1. 运行时参数         createVitaminCoding({ ... })
2. 租户级数据库配置    ConfigStore.get(tenantID)
3. 全局数据库配置      ConfigStore.get(null)
4. 项目 JSONC 文件    .vitamin-coding/config.jsonc (仅 CLI)
5. 用户 JSONC 文件    ~/.config/vitamin-coding/config.jsonc (仅 CLI)
6. 框架默认值
```

### 11.8 分阶段路线图

| Phase | 时间 | 交付 |
|-------|------|------|
| 1: 核心骨架 | 2 周 | createVitaminCoding(), Chat Loop, Agent/Tool/Hook Engine |
| 2: 适配器生态 | 2 周 | 4 个 LLM Adapter (Anthropic, OpenAI, Google, OpenRouter) |
| 3: MCP + Skill | 1 周 | MCP 连接, Skill 发现/加载/注入 |
| 4: 并发+委派 | 1 周 | ConcurrencyManager, TaskQueue, Fallback Retry |
| 5: OMO 迁移 | 3 周 | 11 Agent + 26 Tool + 46 Hook 全量迁移 |
| 6: DX + 文档 | 1 周 | CLI init/run/doctor, 文档 |
| 7: 云端部署 | 2 周 | PostgreSQL/Redis Store, 分布式任务, 多租户 |

### 11.9 可直接复用的 oh-my-opencode 模块

| 模块 | 复用度 | 改造量 |
|------|--------|--------|
| `FallbackResolver` | 90% | 移除 OpenCode 特定 provider |
| `safeCreateHook` | 100% | 直接复用 |
| `permission-compat` | 100% | 直接复用 |
| `ConfigLoader (JSONC)` | 70% | 移除 migration, 简化路径 |
| `SkillLoader` | 80% | 移除 Claude Code 特定逻辑 |
| `dynamic-agent-prompt-builder` | 90% | 移除 OpenCode 注入 |
| `ConcurrencyManager` | 85% | 移除 tmux 集成 |
| `agent-builder` | 90% | 移除 category prompt appends |
| 所有 Agent 工厂 | 95% | 仅更改导入路径 |
| 所有 Tool 工厂 | 80% | 替换 PluginInput → FrameworkContext |
| 所有 Hook 工厂 | 80% | 替换 PluginInput → FrameworkContext |

---

## 12. pi-mono 对比参考

### 12.1 pi-mono 架构（7 包）

```
@anthropic/pi-ai            # LLM 调用 (SDK 封装)
@anthropic/pi-agent-core    # Agent 循环核心
@anthropic/pi-coding-agent  # 编码 Agent (工具+权限+日志)
@anthropic/pi-tui           # Ink.js TUI
@anthropic/pi-sdk           # RPC Studio Server
@anthropic/pi-shared        # 共享工具
@anthropic/pi-web           # Web 适配
```

### 12.2 关键差异

| 维度 | oh-my-opencode | pi-mono |
|------|---------------|---------|
| 定位 | 宿主插件 | 独立产品 |
| Agent 数 | 11 内置 | 1 (单 Agent) |
| Hook 数 | 46 | 无 (无 hook 系统) |
| Tool 数 | 26 上层 + 宿主 | 15 核心 |
| Session | 线性 (通过 Boulder 跨 session) | 树形 (分支/导航) |
| TUI | 依赖 OpenCode | 自建 Ink.js |
| 扩展 | 无需 (是插件本身) | Extension 系统 (30+ 接口) |
| MCP | 3 层 | 内置 + Claude Code |
| Plan/Build | Prometheus + Atlas + Momus | 无 (单 agent 自处理) |

### 12.3 pi-mono 可借鉴的设计

| 特性 | 说明 |
|------|------|
| `Session 树` | 支持 fork/navigate，对话可分支 |
| `Steering Queue` | `addSteeringMessage()` 注入消息不触发 re-render |
| `FollowUp Queue` | `addFollowUp()` 自动续行，优先级高于 user 输入 |
| `Extension UI` | `ExtensionUIContext` 注册自定义 UI 组件 |
| `SDK/RPC` | `PiSDK.connect(socketPath)` 远程控制 |
| `差异渲染 TUI` | 自建 patcher (非 vdom) 满帧更新 |
| `Permission Model` | `ask()` / `allow()` / `deny()` 三态 |

---

## 13. 全局约束与反模式

### 13.1 MUST DO（必做）

- 所有文件名: **kebab-case**
- 所有 config key: **snake_case**
- 所有工具/Agent/Hook: **`createXXX()` 工厂函数**
- 模块结构: `index.ts` 桶导出
- 测试风格: **given/when/then** (nested describe with `#given`/`#when`/`#then`)
- 测试框架: **Bun test** (`bun:test`)
- Schema 校验: **Zod v4**
- 配置格式: **JSONC**
- Hook 注册: **双重守卫** (`isHookEnabled` + `safeCreateHook`)
- 错误处理: **始终处理** catch 内容
- 日志: 写入 `/tmp/oh-my-opencode.log`
- Agent 模型适配: **GPT family → reasoningEffort** / **其他 → thinking.budgetTokens**

### 13.2 MUST NOT（禁做）

- ❌ `as any`, `@ts-ignore`, `@ts-expect-error`
- ❌ 抑制 lint/type 错误
- ❌ 空 catch 块 `catch(e) {}`
- ❌ emojis (除非用户明确要求)
- ❌ 提交代码 (除非明确请求)
- ❌ Arrange-Act-Assert 注释 (用 given/when/then)
- ❌ AI 生成风格注释 (comment-checker hook 强制执行)
- ❌ 万能文件 (`utils.ts`, `helpers.ts`, `service.ts`)
- ❌ 单文件超 200 LOC (soft limit)
- ❌ Plan family agent 互相委派 (反递归守卫)

### 13.3 性能约束

| 约束 | 值 |
|------|-----|
| Plugin 加载超时 | 10s |
| 后台任务并发/model | 默认 5 |
| Sisyphus maxTokens | 64000 |
| Thinking budgetTokens | 32000 (Claude) |
| 后台系统默认并发 | 5 per model/provider |
| Compaction 触发 | Session 历史过长时 |

### 13.4 构建命令

```bash
bun test                     # 测试 (Bun test)
bun run build               # ESM + declarations + schema
bun run typecheck            # tsc --noEmit
bunx oh-my-opencode install  # 交互式安装
bunx oh-my-opencode doctor   # 健康诊断
bunx oh-my-opencode run      # 非交互式 session
```

### 13.5 CI/CD

| Workflow | 触发 | 内容 |
|----------|------|------|
| ci.yml | push/PR | 测试 (mock 隔离 + 批量), typecheck, build, schema 自动提交 |
| publish.yml | 手动 | 版本发布 → npm → 11 平台二进制 → GitHub Release → merge master |
| publish-platform.yml | 被调用 | bun compile 生成 11 平台二进制 |
| sisyphus-agent.yml | @mention | AI agent 处理 issues/PRs |

---

## 附录 A: 插件入口流程图

```
OhMyOpenCodePlugin(ctx: PluginInput)
  │
  ├─→ injectServerAuthIntoClient(ctx)
  │
  ├─→ loadPluginConfig(ctx.directory)
  │     ├─ readProjectConfig()    → .opencode/oh-my-opencode.jsonc
  │     ├─ readUserConfig()       → ~/.config/opencode/oh-my-opencode.jsonc
  │     ├─ mergeConfigs()         → project > user > default
  │     ├─ migrateConfig()        → legacy key → new key
  │     └─ zodValidate()          → OhMyOpenCodeConfigSchema
  │
  ├─→ createManagers(ctx, config)
  │     ├─ TmuxSessionManager
  │     ├─ BackgroundManager (~1600 行)
  │     ├─ SkillMcpManager
  │     └─ ConfigHandler
  │
  ├─→ createTools(ctx, config, managers)    → 26 tools (async: skill discovery)
  │
  ├─→ createHooks(ctx, config, managers)    → 46 hooks (3 tiers)
  │     ├─ createCoreHooks()         → 37 hooks
  │     ├─ createContinuationHooks() → 7 hooks
  │     └─ createSkillHooks()        → 2 hooks
  │
  └─→ createPluginInterface(tools, hooks)   → 8 OpenCode hook handlers
```

## 附录 B: 全 Agent Fallback Chain 参考

```typescript
// src/shared/model-requirements.ts
const AGENT_MODEL_REQUIREMENTS = {
  sisyphus: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-opus-4-6" },
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-5.2" },
      { providers: ["opencode"], model: "kimi-k2.5-free" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3.1-pro" },
    ],
  },
  hephaestus: {
    fallbackChain: [
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-5.3-codex" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-opus-4-6" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3.1-pro" },
      { providers: ["github-copilot", "opencode"], model: "copilot-sonnet" },
    ],
  },
  prometheus: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-opus-4-6" },
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-5.2" },
      { providers: ["opencode"], model: "kimi-k2.5-free" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3.1-pro" },
    ],
  },
  oracle: {
    fallbackChain: [
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-5.2", variant: "high" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-opus-4-6" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3.1-pro" },
    ],
  },
  momus: {
    fallbackChain: [
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-5.2", variant: "low" },
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-sonnet-4-6" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3-flash" },
    ],
  },
  roundtable: {
    fallbackChain: [
      { providers: ["anthropic", "github-copilot", "opencode"], model: "claude-opus-4-6", variant: "max" },
      { providers: ["openai", "github-copilot", "opencode"], model: "gpt-5.2", variant: "high" },
      { providers: ["opencode"], model: "kimi-k2.5-free" },
      { providers: ["google", "github-copilot", "opencode"], model: "gemini-3.1-pro", variant: "high" },
    ],
  },
  // ... atlas, metis, explore, librarian, multimodal-looker
}
```

## 附录 C: vitamin-coding 完整技术提案

完整技术提案 (12,695 行) 位于 [09-vitamin-coding-agent-technical-proposal.md](09-vitamin-coding-agent-technical-proposal.md)，包含:
- Part 1-6: 核心设计 (13 包详细设计 + TypeScript 接口)
- Part 7: 实施路线图 (双轨估算)
- Part 8: pi-mono 融合详解 (7 个融合点)
- Part 9: 云端部署 (数据库 Schema + Store Adapter)
- Part 10: 试验性特性 (Inspector + 动态 Agent + SLO)
- 附录: 16 个 ADR (Architecture Decision Records)

审查报告: [09-review-report.md](09-review-report.md) (24 项问题，全部已修复)
复核报告: [09-review-report-2026-02-28.md](09-review-report-2026-02-28.md) (P0-P2 全部 resolved)
