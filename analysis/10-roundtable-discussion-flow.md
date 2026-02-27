# Roundtable 圆桌需求讨论 Agent — 流程实现文档

> 生成时间：2026-02-28 | 基于 dev 分支源码分析

---

## 目录

1. [端到端流程总览](#1-端到端流程总览)
2. [Phase 0: Topic Framing — 议题构造](#2-phase-0-topic-framing--议题构造)
3. [Phase 1: Parallel Perspectives — 并行采集](#3-phase-1-parallel-perspectives--并行采集)
4. [Phase 2: Synthesis — 综合映射](#4-phase-2-synthesis--综合映射)
5. [Phase 3: Focused Debate — 聚焦辩论](#5-phase-3-focused-debate--聚焦辩论)
6. [Phase 4: Decision & Documentation — 决策文档化](#6-phase-4-decision--documentation--决策文档化)
7. [Prompt 组装链路](#7-prompt-组装链路)
8. [Hook 拦截流程](#8-hook-拦截流程)
9. [模型解析与 Fallback 流程](#9-模型解析与-fallback-流程)
10. [文件产物生命周期](#10-文件产物生命周期)
11. [异常路径与降级策略](#11-异常路径与降级策略)

---

## 1. 端到端流程总览

```
         ┌──────────────┐
         │   用户输入     │  "讨论一下这个数据库迁移方案"
         └──────┬───────┘
                │
                ▼
   ┌────────────────────────┐
   │     Sisyphus (编排器)    │  检测触发词: "讨论" → roundtable
   │   动态 prompt 匹配       │  keyTrigger: "discuss, review proposal, roundtable"
   └────────────┬───────────┘
                │ task(subagent_type="roundtable",
                │      prompt="讨论数据库迁移方案...")
                ▼
   ╔════════════════════════════════════════════════════════╗
   ║                 Roundtable Agent                       ║
   ║                                                        ║
   ║  Phase 0: Topic Framing                                ║
   ║  ├─ 解析提案 → 提取核心议题                              ║
   ║  ├─ selectPanelistsForTopic("数据库迁移方案")            ║
   ║  │   → [architect, backend, qa, devops]                ║
   ║  └─ task(subagent_type="explore", bg=true)  ← 预研     ║
   ║                                                        ║
   ║  Phase 1: Parallel Perspectives  ─── run_in_background ║
   ║  ├─ task(panelist="architect", bg=true)                ║
   ║  ├─ task(panelist="backend", bg=true)                  ║
   ║  ├─ task(panelist="qa", bg=true)                       ║
   ║  └─ task(panelist="devops", bg=true)                   ║
   ║        │                                               ║
   ║        ▼                                               ║
   ║  Phase 2: Synthesis                                    ║
   ║  ├─ 收集所有 panelist 回复                              ║
   ║  ├─ 映射: 共识 / 冲突 / 空白区域                        ║
   ║  └─ 写入中间文档 (内部)                                 ║
   ║        │                                               ║
   ║        ▼                                               ║
   ║  Phase 3: Focused Debate (如检测到冲突)                 ║
   ║  ├─ task(panelist="architect vs backend", bg=false)    ║
   ║  └─ [可选] task(subagent_type="oracle") ← 仲裁        ║
   ║        │                                               ║
   ║        ▼                                               ║
   ║  Phase 4: Decision & Documentation                     ║
   ║  ├─ 综合最终结论                                       ║
   ║  └─ Write .sisyphus/roundtable/database-migration.md   ║
   ╚════════════════════════════════════════════════════════╝
                │
                ▼
   ┌────────────────────────┐
   │   Sisyphus 收到结果       │  "已完成讨论，文档位于 .sisyphus/roundtable/"
   │   呈现给用户              │  可直接读取或后续 task 引用
   └────────────────────────┘
```

---

## 2. Phase 0: Topic Framing — 议题构造

### 触发链路

```
用户消息 → Sisyphus 动态 prompt 匹配
                │
                ├─ 匹配 ROUNDTABLE_PROMPT_METADATA.keyTrigger:
                │   "discuss", "review proposal", "roundtable", "need perspectives"
                │
                ├─ 匹配 triggers[]:
                │   domain: "Requirements discussion" / "Architecture review" / "Feature scoping"
                │
                └─ 匹配 useWhen[]:
                    "A proposal or requirement needs structured multi-perspective review"
                    "Architecture decisions with significant trade-offs"
```

### Panelist 选角算法

源码位于 `panelist-roles.ts` 的 `selectPanelistsForTopic()`:

```
输入: topic = "讨论数据库迁移方案"

Step 1: 始终选入
  selected = { architect, qa }

Step 2: 关键词扫描 (topic.toLowerCase())
  "数据库" → 匹配 "database" 关键词 → selected.add("backend")
  "迁移"   → 匹配 "migration" → selected.add("devops")

Step 3: 最小 panel 保障
  selected.size = 4 ≥ 4 → 不需要补充

Step 4: 过滤输出
  → [architect, backend, qa, devops]
```

**关键词映射表完整版：**

```
frontend 触发词:  ui, ux, frontend, css, style, component, layout, responsive, accessibility
backend 触发词:   api, server, backend, database, rest, graphql, endpoint, query, migration
security 触发词:  auth, security, login, token, jwt, oauth, permission, encrypt, vulnerability
devops 触发词:    deploy, ci, cd, docker, kubernetes, k8s, infrastructure, monitor, pipeline, migration
dx 触发词:        sdk, plugin, developer, dx, documentation, doc, onboarding, ergonomic
product 触发词:   user, feature, scope, product, requirement, story, priority, stakeholder, mvp
```

### 预研阶段

Roundtable 应在讨论前通过 `explore` agent 收集代码库上下文：

```
task(
  subagent_type = "explore",
  run_in_background = true,
  prompt = "Survey the codebase for {topic} related code, patterns, and constraints"
)
```

explore 的输出作为 `codebaseContext` 参数传给后续的 `buildPanelistPrompt()`。

---

## 3. Phase 1: Parallel Perspectives — 并行采集

### 执行模式

所有 panelist 任务 **并行** 发出（`run_in_background=true`），利用 oh-my-opencode 的 BackgroundManager 并发执行：

```
Roundtable Agent
  ├─ task(category="unspecified-high", run_in_background=true,
  │       prompt=buildPanelistPrompt({role: architect, proposal, codebaseContext, roundNumber: 1}))
  │
  ├─ task(category="unspecified-high", run_in_background=true,
  │       prompt=buildPanelistPrompt({role: backend, proposal, codebaseContext, roundNumber: 1}))
  │
  ├─ task(category="unspecified-high", run_in_background=true,
  │       prompt=buildPanelistPrompt({role: qa, proposal, codebaseContext, roundNumber: 1}))
  │
  └─ task(category="unspecified-high", run_in_background=true,
          prompt=buildPanelistPrompt({role: devops, proposal, codebaseContext, roundNumber: 1}))
```

### Panelist Prompt 结构

`buildPanelistPrompt()` 生成的 prompt 结构如下：

```
╔══════════════════════════════════════════════╗
║ [DISCUSSION_CONSULT_WARNING]  ← Hook 注入    ║
║ ────────────────────────────────────────     ║
║ Role Identity:                               ║
║   You are {title} ({name})                   ║
║   Perspective: {perspective}                 ║
║   Focus Areas: {focusAreas.join(", ")}       ║
║   Evaluation Criteria: {evaluationCriteria}  ║
║                                              ║
║ [Codebase Context]  ← 如果 explore 有结果     ║
║   {codebaseContext}                          ║
║                                              ║
║ Proposal Under Discussion:                   ║
║   {proposal}                                 ║
║                                              ║
║ Required Output Format:                      ║
║   ## Support Points                          ║
║   ## Concerns & Risks (BLOCKING/SIGNIFICANT  ║
║      /MINOR severity tags)                   ║
║   ## Questions for Other Panelists           ║
║   ## Specific Suggestions                    ║
║                                              ║
║ Behavioral Constraints:                      ║
║   - Stay within your domain expertise        ║
║   - Be specific, reference code when possible║
║   - Constructive criticism with alternatives ║
║   - Total response ≤ 800 words               ║
╚══════════════════════════════════════════════╝
```

### Hook 拦截

当 Roundtable 发出 `task()` 调用时，`roundtable-md-only` hook 自动触发：

```
tool.execute.before("task", args)
  │
  ├─ getAgentFromSession(sessionID) → "roundtable"
  ├─ isRoundtableAgent("roundtable") → true
  ├─ toolName = "task" ∈ TASK_TOOLS → true
  └─ args.prompt = DISCUSSION_CONSULT_WARNING + args.prompt
```

这确保每个 panelist 收到 READ-ONLY 约束。

### 并发控制

由 oh-my-opencode 的 BackgroundManager 控制：
- 默认：5 个并发 task / per model / per provider
- Panelist 通常 4-6 个 → 全部并行执行
- Roundtable 在等待期间不消耗 token

---

## 4. Phase 2: Synthesis — 综合映射

### 触发条件

所有 Phase 1 的后台任务完成后，Roundtable 自动进入 Phase 2。

### 综合流程

```
所有 Panelist 回复 (4 份)
  │
  ├─→ 共识映射 (Consensus)
  │   └─ 多个 panelist 一致认同的点 → 标记为 ✅ Consensus
  │
  ├─→ 冲突检测 (Conflict)
  │   └─ 两个以上 panelist 有对立意见 → 标记为 ⚠️ Debated
  │   └─ BLOCKING 级别 concern → 标记为 🚫 Blocker
  │
  ├─→ 空白区域 (Gap)
  │   └─ 没有任何 panelist 覆盖的关键领域 → 标记为 ❓ Gap
  │
  └─→ 冲突数量决定下一阶段
      ├─ 0 个冲突 → 跳过 Phase 3 → 直接 Phase 4 (提前终止)
      ├─ 1-3 个冲突 → Phase 3 (1 轮辩论)
      └─ >3 个冲突或有 BLOCKING → Phase 3 + 可能 Oracle 仲裁
```

### 轮次决策逻辑

来源于 system-prompt.ts 的 `ROUNDTABLE_DISCUSSION_FLOW`：

```
Round Count Decision:
  1 round (parallel only):  提案清晰、低歧义
  2 rounds (parallel + debate): 检测到冲突
  3 rounds (rare — Oracle): 根本性分歧
```

---

## 5. Phase 3: Focused Debate — 聚焦辩论

### 执行模式

与 Phase 1 不同，辩论轮 **同步** 执行（`run_in_background=false`）：

```
对于每个冲突点:
  task(
    category = "unspecified-high",
    run_in_background = false,      ← 同步等待结果
    prompt = buildPanelistPrompt({
      role: conflictingPanelist,
      proposal: originalProposal,
      roundNumber: 2,
      previousRoundSummary: round1Synthesis   ← 包含 Round 1 综合
    })
  )
```

### Round 2 Prompt 差异

`buildPanelistPrompt()` 当 `roundNumber > 1` 时：

```
追加节:
  ## Previous Round Summary
  {previousRoundSummary}

  ## Round 2 Focus
  Please address the specific concerns raised about your area.
  Review other panelists' feedback and either:
  - Acknowledge and accept their points
  - Provide counter-arguments with evidence
  - Propose compromises
```

### Oracle 升级路径

当辩论无法达成共识时，Roundtable 可升级到 Oracle agent：

```
task(
  subagent_type = "oracle",
  run_in_background = false,
  prompt = "作为技术仲裁者，裁决以下冲突..."
)
```

来源于 system-prompt.ts：
> "For particularly contentious points, consider using the Oracle agent for an authoritative technical perspective."

---

## 6. Phase 4: Decision & Documentation — 决策文档化

### 输出路径

```
项目根目录/
└── .sisyphus/
    └── roundtable/
        └── {topic-kebab-case}.md     ← 最终产物
```

### 文档模板

由 system-prompt.ts 的 `ROUNDTABLE_OUTPUT_FORMAT` 定义：

```markdown
# Roundtable: {Topic Title}

**Date:** {ISO date}
**Panelists:** {role1}, {role2}, ...
**Rounds:** {N}
**Status:** Consensus Reached | Partial Consensus | Escalated

## TL;DR
2-3 句话的核心结论

## Original Proposal
用户原始提案全文

## Panel Composition
| Role | Focus | Key Contribution |
|------|-------|-----------------|
| Architect | 系统设计 | ... |
| Backend | 数据层 | ... |

## Round 1: Perspectives
### Architect's View
...
### Backend Engineer's View
...

## Consensus Points
- ✅ 所有 panelists 一致同意: ...
- ✅ ...

## Debated Points
### Debate 1: {冲突标题}
- **Position A** (Architect): ...
- **Position B** (Backend): ...
- **Resolution:** ... | **Status:** Resolved / Unresolved
- **Rationale:** ...

## Refined Requirements
### Functional Requirements
1. FR-01: ...
2. FR-02: ...

### Non-Functional Requirements
1. NFR-01: ...

### Constraints & Assumptions
- ...

## Out of Scope
- 明确排除: ...

## Open Questions (For User)
1. ❓ ...
2. ❓ ...

## Recommended Next Steps
1. ...
2. ...
```

### Write 守卫

当 Roundtable 调用 `Write` 工具写入文档时，hook 拦截：

```
tool.execute.before("Write", { file_path: ".sisyphus/roundtable/database-migration.md" })
  │
  ├─ getAgentFromSession → "roundtable"
  ├─ isRoundtableAgent → true
  ├─ toolName = "Write" ∈ BLOCKED_TOOLS → true
  ├─ isAllowedFile(".sisyphus/roundtable/database-migration.md", projectDir)
  │   → 匹配 .sisyphus/*.md 模式 → 放行 ✅
  └─ (如果路径为 "src/index.ts" → throw Error ❌)
```

---

## 7. Prompt 组装链路

### 完整组装路径

```
createRoundtableAgent(model, categories, skills)
  │
  └─→ buildRoundtableSystemPrompt(categories, skills)
        │
        ├─→ ROUNDTABLE_IDENTITY            (常量: 身份 + 禁止规则)
        │
        ├─→ ROUNDTABLE_PROTOCOL            (常量: 4 阶段信令)
        │
        ├─→ buildPanelistRoleTable()        (动态: 8 角色表)
        │     └─→ PANELIST_ROLES.map(role =>
        │           `| ${role.name} | ${role.title} | ${role.focusAreas} |`)
        │
        ├─→ categories.map(c =>             (动态: 可用分类列表)
        │     `- \`${c.name}\`: ${c.description}`)
        │
        ├─→ ROUNDTABLE_DISCUSSION_FLOW     (常量: 轮次控制)
        │
        ├─→ ROUNDTABLE_OUTPUT_FORMAT       (常量: Markdown 模板)
        │
        └─→ ROUNDTABLE_BEHAVIORAL_RULES    (常量: DO/DO NOT)
```

### 运行时 Prompt 分层

```
┌─────────────────────────────────┐
│ Layer 0: System Prompt (Agent)  │ ← buildRoundtableSystemPrompt()
│  身份 + 协议 + 角色表 + 行为规则  │    276 行，一次性构建
├─────────────────────────────────┤
│ Layer 1: User Message           │ ← Sisyphus 传入的 task prompt
│  任务描述 + 提案内容             │    包含原始用户请求
├─────────────────────────────────┤
│ Layer 2: Tool Results           │ ← 各 panelist task() 返回
│  4-6 个结构化讨论视角            │    累积到 context window
├─────────────────────────────────┤
│ Layer 3: Thinking Budget        │ ← thinking: { budgetTokens: 32000 }
│  综合推理 + 冲突解决 + 文档规划  │    Claude 扩展推理空间
└─────────────────────────────────┘
```

---

## 8. Hook 拦截流程

### 完整拦截时序图

```
Roundtable Agent
  │
  │  调用 task(prompt="Review from architect perspective...")
  │
  ▼
┌──────────────────────────────────────────────┐
│ tool.execute.before                           │
│                                               │
│ Step 1: getAgentFromSession(sessionID)        │
│   ├─ 读取 session 文件                         │
│   └─ 返回 "roundtable"                        │
│                                               │
│ Step 2: isRoundtableAgent("roundtable")       │
│   └─ true → 继续                              │
│                                               │
│ Step 3: toolName = "task"                     │
│   └─ TASK_TOOLS.includes("task") → true       │
│                                               │
│ Step 4: 注入警告                               │
│   output.args.prompt =                        │
│     DISCUSSION_CONSULT_WARNING + prompt        │
│                                               │
│ 结果: panelist 收到 READ-ONLY 约束 prompt      │
└──────────────────────────────────────────────┘
  │
  ▼
Panelist Agent (后台执行)
  │
  │  返回结构化讨论视角
  │
  ▼
Roundtable Agent
  │
  │  调用 Write(file_path=".sisyphus/roundtable/topic.md")
  │
  ▼
┌──────────────────────────────────────────────┐
│ tool.execute.before                           │
│                                               │
│ Step 1: getAgentFromSession → "roundtable"    │
│ Step 2: isRoundtableAgent → true              │
│ Step 3: toolName = "Write"                    │
│   └─ BLOCKED_TOOLS.includes("Write") → true   │
│                                               │
│ Step 4: isAllowedFile(                        │
│   ".sisyphus/roundtable/topic.md",            │
│   projectDir                                  │
│ )                                             │
│   ├─ 路径在 .sisyphus/ 下 → ✅                │
│   ├─ 扩展名 .md → ✅                          │
│   └─ 放行                                     │
│                                               │
│ ❌ 如果路径为 "src/index.ts":                  │
│   throw new Error(                            │
│     "Roundtable can only write to             │
│      .sisyphus/*.md files"                    │
│   )                                           │
└──────────────────────────────────────────────┘
```

---

## 9. 模型解析与 Fallback 流程

### Roundtable Fallback 链

```
┌──────────────────────────────────────────────────────┐
│ AGENT_MODEL_REQUIREMENTS.roundtable.fallbackChain    │
│                                                      │
│ Priority 1: claude-opus-4-6 (max)                    │
│   providers: [anthropic, github-copilot, opencode]   │
│   → 最强推理能力，首选                                │
│                                                      │
│ Priority 2: gpt-5.2 (high)                           │
│   providers: [openai, github-copilot, opencode]      │
│   → GPT 系列最佳推理，备选                            │
│                                                      │
│ Priority 3: kimi-k2.5-free                           │
│   providers: [opencode]                              │
│   → 免费模型，适合开源/个人用户                        │
│                                                      │
│ Priority 4: gemini-3.1-pro (high)                    │
│   providers: [google, github-copilot, opencode]      │
│   → Google 系列推理模型                               │
└──────────────────────────────────────────────────────┘
```

### 模型解析 3 步流程

```
Step 1: 用户覆盖？
  config.agents.roundtable.model → 如有，直接使用

Step 2: Category 默认？
  AGENT_MODEL_REQUIREMENTS.roundtable.fallbackChain
  → 按 priority 依次检查 provider 是否可用
  → 找到第一个可用的 → 使用

Step 3: 系统默认
  → 如果所有 fallback 不可用 → 回退到系统默认模型
```

### 模型特定配置

`createRoundtableAgent()` 根据解析出的模型自动适配：

```
model = "claude-opus-4-6"
  → thinking: { type: "enabled", budgetTokens: 32000 }
  → temperature: 0.2

model = "gpt-5.2"
  → reasoningEffort: "high"
  → textVerbosity: "high"
  → temperature: 0.2

model = "kimi-k2.5-free"
  → thinking: { type: "enabled", budgetTokens: 32000 }  (非 GPT → 默认 thinking)
  → temperature: 0.2
```

---

## 10. 文件产物生命周期

### 目录结构

```
.sisyphus/                            ← oh-my-opencode 标准产物目录
├── session/                          ← session 相关文件
├── roundtable/                       ← 🆕 Roundtable 讨论产物
│   ├── database-migration.md         ← 讨论产物 1
│   ├── auth-system-redesign.md       ← 讨论产物 2
│   └── plugin-api-v2.md              ← 讨论产物 3
└── ...
```

### 产物生命周期

```
t=0: 用户请求讨论
  │
  ▼
t=1: Roundtable Phase 0-1
  └─ 无文件写入（纯 prompt 交互）

t=2: Roundtable Phase 2-3
  └─ 可能写入中间文档（内部使用）

t=3: Roundtable Phase 4
  └─ Write ".sisyphus/roundtable/{topic}.md"
     → Hook 校验 → 放行
     → 文件创建

t=4: Sisyphus 收到结果
  └─ 向用户汇报，path 可被后续 task 引用

t=5+: 后续开发
  ├─ Hephaestus 可读取讨论产物，作为实现参考
  ├─ Prometheus 可读取需求，纳入规划
  └─ 用户可手动编辑精炼
```

### 文件命名规则

```
输入: "讨论数据库迁移方案的可行性"
       ↓
提取: "database migration" → kebab-case
       ↓
输出: .sisyphus/roundtable/database-migration.md
```

---

## 11. 异常路径与降级策略

### 场景 1: Panelist 任务失败

```
Phase 1: 4 个 panelist 并行
  ├─ architect: ✅ 返回
  ├─ backend:   ✅ 返回
  ├─ qa:        ❌ 超时/错误
  └─ devops:    ✅ 返回

处理策略:
  → Roundtable 基于 3/4 的回复继续综合
  → 在最终文档中标注: "QA perspective unavailable — recommend follow-up review"
```

### 场景 2: 所有 Fallback 模型不可用

```
AGENT_MODEL_REQUIREMENTS 链:
  claude-opus-4-6  → ❌ 不可用
  gpt-5.2          → ❌ 不可用
  kimi-k2.5-free   → ❌ 不可用
  gemini-3.1-pro   → ❌ 不可用

降级策略:
  → 系统默认模型 (通常是当前 session 的 primary model)
  → 如果也不可用 → Sisyphus 收到错误，通知用户
```

### 场景 3: Hook 拦截违规写入

```
Roundtable 尝试: Write("src/database.ts")

拦截:
  isAllowedFile("src/database.ts", projectDir) → false

结果:
  throw new Error(
    "[roundtable-md-only] Roundtable agent is restricted to writing only " +
    ".sisyphus Markdown files. Attempted to write to: src/database.ts"
  )

Roundtable 收到错误 → 纠正行为 → 重试写入到 .sisyphus/*.md
```

### 场景 4: 提前终止

```
Phase 1: 所有 panelist 全票通过，无冲突

Protocol:
  "If all panelists align with no significant concerns — skip to Phase 4"

结果:
  → 跳过 Phase 2-3
  → 直接写入最终文档
  → Round count = 1
```

### 场景 5: Oracle 仲裁失败

```
Phase 3: architect vs backend 无法达成共识
  → 升级 Oracle

Oracle 也无法裁决:
  → 文档标记 "Unresolved — requires human decision"
  → Open Questions 节列出需用户决策的问题
  → 不阻塞 Phase 4 文档输出
```

---

## 附录: 数据流汇总表

| 阶段 | 输入 | 处理 | 输出 | 工具调用 |
|------|------|------|------|---------|
| 触发 | 用户消息 | Sisyphus prompt 匹配 | task(roundtable) | task |
| Phase 0 | 提案文本 | selectPanelistsForTopic | panelist 列表 | task(explore) |
| Phase 1 | panelist + proposal | buildPanelistPrompt × N | N 个视角回复 | task × N (bg) |
| Phase 2 | N 个回复 | 综合映射 | 共识/冲突/空白 | — |
| Phase 3 | 冲突清单 | 聚焦辩论 | 解决/未解决 | task (sync) |
| Phase 4 | 全部综合 | 文档模板填充 | `.sisyphus/roundtable/*.md` | Write |

---

## 附录: 与 Prometheus 的对比

| 维度 | Roundtable | Prometheus |
|------|-----------|-----------|
| **定位** | 需求讨论 + 方案评审 | 实现规划 + 任务分解 |
| **输出** | 讨论文档 (需求级) | Plan-Build 文档 (实现级) |
| **角色数** | 4-6 个 panelists | 1 个规划师 |
| **执行模式** | 并行 + 同步辩论 | 同步规划 |
| **模型需求** | EXPENSIVE (顶级推理) | EXPENSIVE (顶级推理) |
| **文件限制** | .sisyphus/**/*.md | .sisyphus/**/*.md |
| **升级路径** | → Oracle 仲裁 | → Sisyphus 审查 |
| **典型使用** | "讨论这个方案" | "规划怎么实现这个功能" |
| **工作流位置** | 先 Roundtable 讨论 → 后 Prometheus 规划 | Roundtable 之后，实现之前 |
