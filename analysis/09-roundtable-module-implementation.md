# Roundtable 圆桌需求讨论 Agent — 模块实现文档

> 生成时间：2026-02-28 | 基于 dev 分支源码分析

---

## 目录

1. [模块概述](#1-模块概述)
2. [文件结构与职责](#2-文件结构与职责)
3. [核心模块实现详解](#3-核心模块实现详解)
4. [系统集成点](#4-系统集成点)
5. [Hook 守卫机制](#5-hook-守卫机制)
6. [测试覆盖](#6-测试覆盖)
7. [配置与覆盖](#7-配置与覆盖)

---

## 1. 模块概述

Roundtable 是一个 **多视角需求讨论编排 Agent**，定位为 **讨论主持人（Moderator）**，通过结构化辩论轮次协调多个专家视角对方案进行评审、挑战和精炼。

### 设计定位

| 属性 | 值 |
|------|---|
| **Agent 名称** | `roundtable` |
| **显示名称** | `Roundtable (Discussion)` |
| **模式** | `subagent` — 使用自有 fallback 链，不受 UI 模型选择影响 |
| **分类** | `advisor` — 与 Oracle 同级，属于顾问型 Agent |
| **成本** | `EXPENSIVE` — 需要高质量推理模型 |
| **角色** | 纯讨论主持，不写代码，只输出 `.sisyphus/roundtable/*.md` |
| **核心动词** | "讨论"、"评审方案"、"圆桌"、"需要多方意见" |

### 与现有 Agent 的关系

```
Sisyphus (编排器)
  │
  ├─ 检测到 "讨论/review proposal" 关键词
  │
  └─→ task(subagent_type="roundtable", ...)
        │
        ├─→ task(subagent_type="explore", bg=true)   ← 预研代码库
        ├─→ task(category="unspecified-high", bg=true) ← Panelist A
        ├─→ task(category="unspecified-high", bg=true) ← Panelist B
        ├─→ task(category="unspecified-high", bg=true) ← Panelist C
        │     ...
        ├─→ [合成 → 冲突检测]
        ├─→ task(category="unspecified-high", bg=false) ← Round 2 辩论
        ├─→ task(subagent_type="oracle", bg=false)      ← 仲裁（如需）
        └─→ Write .sisyphus/roundtable/{topic}.md
```

---

## 2. 文件结构与职责

```
src/agents/roundtable/
├── index.ts               # 桶导出 (2 行)
├── agent.ts               # Agent 工厂函数 + Prompt 元数据 (82 行)
├── system-prompt.ts        # 4 阶段讨论协议 System Prompt (276 行)
├── panelist-roles.ts       # 8 个专家角色定义 + 选角逻辑 (284 行)
└── agent.test.ts          # 测试：20 用例 (209 行)

src/hooks/roundtable-md-only/
├── index.ts               # 桶导出 (1 行)
├── constants.ts           # Hook 常量 + 讨论警告文本 (38 行)
└── hook.ts                # tool.execute.before 守卫实现 (84 行)
```

**集成修改的文件：**

| 文件 | 修改内容 |
|------|---------|
| `src/agents/types.ts` L91-102 | `BuiltinAgentName` 联合类型添加 `"roundtable"` |
| `src/agents/builtin-agents.ts` L15,47,60 | 导入 + `agentSources` + `agentMetadata` 注册 |
| `src/agents/index.ts` L5 | 桶导出 `createRoundtableAgent` + `ROUNDTABLE_PROMPT_METADATA` |
| `src/shared/model-requirements.ts` L92-99 | 添加 roundtable fallback 链 |
| `src/shared/agent-display-names.ts` L18 | 注册显示名称 `"Roundtable (Discussion)"` |

---

## 3. 核心模块实现详解

### 3.1 Agent 工厂函数 — `agent.ts`

> 源文件: `src/agents/roundtable/agent.ts` (82 行)

```typescript
// src/agents/roundtable/agent.ts — 完整实现

import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "../types"
import { isGptModel } from "../types"
import { buildRoundtableSystemPrompt } from "./system-prompt"
import type { AvailableCategory, AvailableSkill } from "../dynamic-agent-prompt-builder"

const MODE: AgentMode = "subagent"
```

**Prompt 元数据** — 供 Sisyphus 动态 prompt 构建，决定何时委派给 Roundtable：

```typescript
export const ROUNDTABLE_PROMPT_METADATA: AgentPromptMetadata = {
  category: "advisor",
  cost: "EXPENSIVE",
  promptAlias: "Roundtable",
  keyTrigger: '"discuss", "review proposal", "roundtable", "need perspectives" → fire `roundtable`',
  triggers: [
    { domain: "Requirements discussion",
      trigger: "Proposal needs multi-perspective review before implementation" },
    { domain: "Architecture review",
      trigger: "Design decision with trade-offs needing diverse expert input" },
    { domain: "Feature scoping",
      trigger: "Feature scope unclear, needs structured debate to refine" },
  ],
  useWhen: [
    "A proposal or requirement needs structured multi-perspective review",
    "Complex feature scoping with many stakeholders",
    "Architecture decisions with significant trade-offs",
    "When user explicitly asks for discussion or diverse opinions",
    "Before starting implementation of ambiguous requirements",
  ],
  avoidWhen: [
    "Simple, well-defined tasks (use direct implementation)",
    "Bug fixes with clear root cause",
    "Tasks where the approach is obvious",
    "When user wants quick action, not discussion",
  ],
}
```

**工厂函数** — 遵循 `(model: string) => AgentConfig` 签名 + `.mode` 静态属性：

```typescript
export function createRoundtableAgent(
  model: string,
  availableCategories: AvailableCategory[] = [],
  availableSkills: AvailableSkill[] = [],
): AgentConfig {
  const prompt = buildRoundtableSystemPrompt(availableCategories, availableSkills)

  const base = {
    description:
      "Multi-perspective requirements discussion moderator. Orchestrates structured debate " +
      "rounds with expert panelists to refine proposals. (Roundtable - OhMyOpenCode)",
    mode: MODE,
    model,
    temperature: 0.2,        // 低温度 → 稳定一致的讨论引导
    prompt,
    maxTokens: 64000,        // 大输出 → 完整讨论文档
  } as AgentConfig

  // GPT 模型 → reasoningEffort + textVerbosity
  if (isGptModel(model)) {
    return { ...base, reasoningEffort: "high", textVerbosity: "high" } as AgentConfig
  }

  // Claude/其他模型 → thinking 扩展推理
  return { ...base, thinking: { type: "enabled", budgetTokens: 32000 } } as AgentConfig
}
createRoundtableAgent.mode = MODE  // 关键：AgentFactory 要求的静态属性
```

**设计决策**：

| 决策 | 理由 |
|------|------|
| `temperature: 0.2` | 讨论主持需稳定、结构化；不需要创意发散 |
| `maxTokens: 64000` | 输出含完整讨论文档、多视角综合 |
| `thinking: 32000` | 需要深度推理来识别冲突、判断优先级 |
| `mode: "subagent"` | 由 Sisyphus 委派调用，自有 fallback 链 |

---

### 3.2 System Prompt — `system-prompt.ts`

> 源文件: `src/agents/roundtable/system-prompt.ts` (276 行)

System Prompt 由 5 个模块化常量拼接而成：

```typescript
export function buildRoundtableSystemPrompt(
  availableCategories: AvailableCategory[],
  availableSkills: AvailableSkill[],
): string {
  const roleTable = buildPanelistRoleTable()       // 动态构建角色表
  const categoryList = availableCategories          // 动态注入可用分类
    .map((c) => `- \`${c.name}\`: ${c.description}`)
    .join("\n")

  return `${ROUNDTABLE_IDENTITY}       // 身份约束
${ROUNDTABLE_PROTOCOL}                  // 4 阶段讨论协议
## Available Panelist Roles
${roleTable}                            // 动态：角色表
## Available Task Categories
${categoryList}                         // 动态：分类列表
${ROUNDTABLE_DISCUSSION_FLOW}           // 轮次控制 + 升级策略
${ROUNDTABLE_OUTPUT_FORMAT}             // 输出文档模板
${ROUNDTABLE_BEHAVIORAL_RULES}`         // 行为准则
}
```

#### 模块 1: `ROUNDTABLE_IDENTITY` — 身份锁定

```
核心约束:
  ├── YOU ARE A DISCUSSION MODERATOR
  ├── 禁止写代码或实现文件
  ├── 禁止单方面技术决策
  ├── 输出限定: .sisyphus/roundtable/{topic}.md
  └── 必须包含: 讨论记录 + 精炼需求 + 行动项
```

#### 模块 2: `ROUNDTABLE_PROTOCOL` — 4 阶段讨论协议

| 阶段 | 名称 | 执行方式 | 核心动作 |
|------|------|---------|---------|
| Phase 0 | Topic Framing | 同步 | 解析提案 → 选专家 → 构造 prompt |
| Phase 1 | Parallel Perspectives | `run_in_background=true` | 并行发出所有 panelist 任务 |
| Phase 2 | Synthesis | 同步 | 映射共识/冲突/空白 → 写中间文档 |
| Phase 3 | Focused Debate | `run_in_background=false` | 针对冲突点同步辩论 |
| Phase 4 | Decision & Documentation | 同步 | 解决冲突 → 写最终文档 → 呈现用户 |

#### 模块 3: `ROUNDTABLE_DISCUSSION_FLOW` — 轮次控制

```
轮次决策:
  1 轮 (并行): 提案清晰，低歧义
  2 轮 (并行 + 辩论): 检测到冲突
  3 轮 (罕见): 根本性分歧 → Oracle 仲裁

升级机制:
  冲突无法解决 → task(subagent_type="oracle", ...) → Oracle 裁决

提前终止:
  Round 1 全票通过 → 跳过 Round 2 → 直接文档化
```

#### 模块 4: `ROUNDTABLE_OUTPUT_FORMAT` — 输出文档模板

```markdown
# Roundtable: {Topic Title}
## TL;DR                        ← 2-3 句摘要
## Original Proposal             ← 原始提案全文
## Panel Composition             ← 参与角色 + 贡献
## Round 1: Perspectives         ← 各角色视角
## Consensus Points              ← 共识点
## Debated Points                ← 冲突 + 解决 + 理由
## Refined Requirements          ← 精炼后的功能/非功能需求
## Out of Scope                  ← 显式排除项
## Open Questions (For User)     ← 需用户决定的问题
## Recommended Next Steps        ← 下一步行动
```

#### 模块 5: `ROUNDTABLE_BEHAVIORAL_RULES` — 行为准则

```
DO:
  ✅ Round 1 用 run_in_background=true (并行)
  ✅ Round 2 用 run_in_background=false (同步)
  ✅ 每个 panelist prompt 包含完整原始提案
  ✅ 讨论前先用 explore agent 收集代码库上下文
  ✅ 产出写入 .sisyphus/roundtable/ 目录
  ✅ Panelist prompt 必须自包含、角色明确、有结构化输出要求

DO NOT:
  ❌ 跳过相关视角 (如 UI 相关必须有 Frontend)
  ❌ 不经 panel 讨论就做决策
  ❌ 写代码文件
  ❌ 超过 6 个 panelists (收益递减)
  ❌ 超过 3 轮 (应升级给用户)
  ❌ 忽略少数意见 (即使被否决也要文档记录)
```

---

### 3.3 Panelist 角色系统 — `panelist-roles.ts`

> 源文件: `src/agents/roundtable/panelist-roles.ts` (284 行)

#### 角色类型定义

```typescript
export interface PanelistRole {
  name: string              // 角色标识 (用于 prompt 引用)
  title: string             // 人类可读标题
  focusAreas: string[]      // 该角色关注的领域
  perspective: string       // 评审视角描述
  evaluationCriteria: string[]  // 评价标准
}
```

#### 8 个内置专家角色

| 角色 | 标题 | 核心聚焦 | 评审标准示例 |
|------|------|---------|------------|
| `architect` | Software Architect | 系统设计、可扩展性、组件边界、技术债 | "这是否适合现有架构？" |
| `backend` | Backend Engineer | API 设计、性能、错误处理、数据模型 | "API 设计是否干净一致？" |
| `frontend` | Frontend Engineer | 用户交互、组件复用、状态管理、可访问性 | "用户体验是否直观？" |
| `qa` | QA/Testing Engineer | 可测试性、边界场景、回归风险、验收标准 | "每个需求都可以测试吗？" |
| `product` | Product/Requirements Analyst | 用户价值、范围定义、用户故事、成功指标 | "这是否解决了正确的问题？" |
| `security` | Security Engineer | 认证授权、数据保护、注入防御、威胁建模 | "威胁面是什么？" |
| `devops` | DevOps/Infrastructure Engineer | 部署策略、监控、基础设施、CI/CD | "如何部署？能否安全回滚？" |
| `dx` | Developer Experience Engineer | API 易用性、文档需求、迁移路径、认知负荷 | "API 使用是否直观？" |

#### 智能选角函数

```typescript
export function selectPanelistsForTopic(topic: string): PanelistRole[] {
  // 始终参与: architect + qa
  const always: string[] = ["architect", "qa"]
  const selected = new Set<string>(always)

  // 关键词匹配 → 添加对应角色:
  //   ui/ux/frontend...     → frontend
  //   api/backend/database... → backend
  //   auth/login/token...    → security
  //   deploy/ci/docker...    → devops
  //   sdk/plugin/dx...       → dx
  //   user/feature/scope...  → product

  // 兜底：少于 4 人自动补充 backend + frontend
  if (selected.size < 4) {
    selected.add("backend")
    selected.add("frontend")
  }

  return PANELIST_ROLES.filter((role) => selected.has(role.name))
}
```

**选角映射表：**

| 话题关键词 | 触发角色 | 示例 |
|-----------|---------|------|
| `ui, ux, css, style, component` | `frontend` | "重新设计仪表盘 UI" |
| `api, server, database, rest, graphql` | `backend` | "设计 REST API" |
| `auth, login, token, jwt, oauth` | `security` | "添加 OAuth2 登录" |
| `deploy, ci, docker, k8s, monitor` | `devops` | "搭建 CI/CD 管线" |
| `sdk, plugin, dx, documentation` | `dx` | "设计插件 SDK" |
| `user, feature, scope, product` | `product` | "定义 MVP 功能范围" |

#### Panelist Prompt 构建器

```typescript
export function buildPanelistPrompt(input: {
  role: PanelistRole
  proposal: string
  codebaseContext?: string       // explore agent 预研结果
  roundNumber: number
  previousRoundSummary?: string  // Round 2+ 的前轮摘要
}): string
```

生成结构化 prompt，包含：
1. 角色身份 + 视角 + 聚焦领域 + 评价标准
2. （可选）代码库上下文
3. （可选）前轮讨论摘要
4. 被讨论的提案全文
5. **严格格式要求**：Support Points / Concerns & Risks(BLOCKING/SIGNIFICANT/MINOR) / Questions / Suggestions
6. 行为约束：不越界、具体化、建设性、总计 ≤800 字

---

## 4. 系统集成点

### 4.1 类型注册 — `types.ts`

```typescript
// src/agents/types.ts L91-102
export type BuiltinAgentName =
  | "sisyphus"
  | "hephaestus"
  | "oracle"
  | "librarian"
  | "explore"
  | "multimodal-looker"
  | "metis"
  | "momus"
  | "atlas"
  | "roundtable"    // ← 新增
```

### 4.2 Agent 工厂注册 — `builtin-agents.ts`

```typescript
// src/agents/builtin-agents.ts L15
import { createRoundtableAgent, ROUNDTABLE_PROMPT_METADATA } from "./roundtable"

// L36-47: agentSources 注册
const agentSources: Record<BuiltinAgentName, AgentSource> = {
  // ... 其他 agents
  roundtable: createRoundtableAgent as AgentFactory,  // ← 新增
}

// L55-63: agentMetadata 注册
const agentMetadata: Partial<Record<BuiltinAgentName, AgentPromptMetadata>> = {
  // ... 其他 metadata
  roundtable: ROUNDTABLE_PROMPT_METADATA,  // ← 新增
}
```

**注册效果**：Roundtable 被 `collectPendingBuiltinAgents()` 自动收集，其 metadata 注入 Sisyphus 的动态 prompt（Delegation Table、Key Triggers、Tool Selection Table），使 Sisyphus 知道何时委派给 Roundtable。

### 4.3 模型 Fallback 链 — `model-requirements.ts`

```typescript
// src/shared/model-requirements.ts L92-99
roundtable: {
  fallbackChain: [
    { providers: ["anthropic", "github-copilot", "opencode"],
      model: "claude-opus-4-6", variant: "max" },          // 首选：Claude Opus 4-6 (max)
    { providers: ["openai", "github-copilot", "opencode"],
      model: "gpt-5.2", variant: "high" },                 // 次选：GPT-5.2 (high)
    { providers: ["opencode"],
      model: "kimi-k2.5-free" },                            // 第三：Kimi K2.5 (free)
    { providers: ["google", "github-copilot", "opencode"],
      model: "gemini-3.1-pro", variant: "high" },           // 第四：Gemini 3.1 Pro (high)
  ],
},
```

**设计理由**：讨论主持需要高质量推理（识别冲突、综合多方观点），因此 fallback 链与 Prometheus（规划）一致，优先选用 Opus/GPT-5.2 等顶级推理模型。

### 4.4 显示名称 — `agent-display-names.ts`

```typescript
// src/shared/agent-display-names.ts L18
roundtable: "Roundtable (Discussion)",
```

### 4.5 桶导出 — `agents/index.ts`

```typescript
// src/agents/index.ts L5
export { createRoundtableAgent, ROUNDTABLE_PROMPT_METADATA } from "./roundtable"
```

---

## 5. Hook 守卫机制

### 5.1 `roundtable-md-only` Hook

> 源文件: `src/hooks/roundtable-md-only/hook.ts` (84 行)

模式复用 `prometheus-md-only` hook 架构，限制 Roundtable agent 的写入权限。

```typescript
export function createRoundtableMdOnlyHook(ctx: PluginInput) {
  return {
    "tool.execute.before": async (input, output) => {
      // 1. 从 session 获取 agent 名称
      const agentName = await getAgentFromSession(input.sessionID, ctx.directory, ctx.client)

      // 2. 非 Roundtable agent → 直接放行
      if (!isRoundtableAgent(agentName)) return

      // 3. task/call_omo_agent 工具 → 注入讨论顾问警告
      if (TASK_TOOLS.includes(toolName)) {
        output.args.prompt = DISCUSSION_CONSULT_WARNING + prompt
        return
      }

      // 4. Write/Edit 工具 → 路径校验
      if (BLOCKED_TOOLS.includes(toolName)) {
        if (!isAllowedFile(filePath, ctx.directory)) {
          throw Error("Roundtable can only write to .sisyphus/*.md")
        }
      }
    }
  }
}
```

**守卫规则：**

| 工具 | 行为 |
|------|------|
| `task` / `call_omo_agent` | 注入 `DISCUSSION_CONSULT_WARNING` → panelist 收到只读约束 |
| `Write` / `Edit` / `write` / `edit` | 检查路径是否在 `.sisyphus/*.md` 内，否则 throw |
| 其他工具 (grep, glob, lsp) | 直接放行（只读操作） |

**复用关系：**

```
prometheus-md-only/
├── agent-resolution.ts    ← Roundtable 复用 getAgentFromSession()
└── path-policy.ts         ← Roundtable 复用 isAllowedFile()
```

### 5.2 Panelist 讨论警告注入

当 Roundtable 通过 `task()` 委派 panelist 任务时，hook 自动在 prompt 前注入警告：

```typescript
// src/hooks/roundtable-md-only/constants.ts
export const DISCUSSION_CONSULT_WARNING = `
---
[SYSTEM DIRECTIVE: READ-ONLY]

You are being invoked by Roundtable (Discussion), a READ-ONLY discussion moderator agent.

CRITICAL CONSTRAINTS:
- DO NOT modify any files
- ONLY provide analysis, perspectives, and recommendations from your assigned role

YOUR ROLE: You are a panelist in a requirements roundtable discussion.
---
`
```

这确保所有通过 Roundtable 发出的子任务都被约束为只读分析。

---

## 6. 测试覆盖

> 源文件: `src/agents/roundtable/agent.test.ts` (209 行, 20 用例)

### 测试结构（given/when/then 模式）

| 测试组 | 用例数 | 覆盖内容 |
|--------|-------|---------|
| `createRoundtableAgent factory` | 3 | Claude 配置(thinking) / GPT 配置(reasoningEffort) / 静态 mode |
| `ROUNDTABLE_PROMPT_METADATA` | 3 | category+cost / triggers / useWhen+avoidWhen |
| `PANELIST_ROLES` | 3 | 角色数量 / 必填字段 / 核心角色存在性 |
| `getPanelistRole` | 2 | 已存在角色 / 不存在角色 |
| `selectPanelistsForTopic` | 5 | UI话题 / 认证话题 / API话题 / 通用话题 / 部署话题 |
| `buildPanelistPrompt` | 3 | Round 1 prompt / Round 2 + 前轮摘要 / 代码库上下文 |
| `buildRoundtableSystemPrompt` | 1 | 完整 system prompt 包含关键节 |

---

## 7. 配置与覆盖

### 用户配置覆盖示例

```jsonc
// .opencode/oh-my-opencode.jsonc
{
  "agents": {
    "roundtable": {
      "model": "anthropic/claude-opus-4-6",
      "variant": "max",
      "temperature": 0.15,
      "prompt_append": "Always include a DX perspective in panel composition."
    }
  }
}
```

### 禁用 Roundtable

```jsonc
{
  "disabled_agents": ["roundtable"]
}
```

### 禁用 Hook 守卫

```jsonc
{
  "disabled_hooks": ["roundtable-md-only"]
}
```

---

## 附录：完整文件清单与行数

| 文件路径 | 行数 | 职责 |
|---------|------|------|
| `src/agents/roundtable/index.ts` | 19 | 桶导出 + 模块文档注释 |
| `src/agents/roundtable/agent.ts` | 82 | Agent 工厂 + Prompt 元数据 |
| `src/agents/roundtable/system-prompt.ts` | 276 | 5 段模块化 System Prompt |
| `src/agents/roundtable/panelist-roles.ts` | 284 | 8 个角色 + 选角 + Prompt 构建 |
| `src/agents/roundtable/agent.test.ts` | 209 | 20 个测试用例 |
| `src/hooks/roundtable-md-only/index.ts` | 1 | Hook 桶导出 |
| `src/hooks/roundtable-md-only/constants.ts` | 38 | Hook 常量 + 警告文本 |
| `src/hooks/roundtable-md-only/hook.ts` | 84 | tool.execute.before 守卫 |
| **合计** | **993** | — |
