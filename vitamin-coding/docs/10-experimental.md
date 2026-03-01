> [← 返回目录](README.md)

## 第十部分：试验性特性讨论

### 10.0 文档治理：分册与阅读导航

Part 10 体量持续增长后（尤其 10.6.16 + 10.8/10.9/10.10），建议采用“主文 + 分册”治理模式，降低审查和维护成本。

建议拆分方式：

| 文档 | 覆盖范围 | 目标读者 |
|------|----------|----------|
| 主提案（本文件） | 10.1~10.6 的概要设计 + 关键接口 | 架构评审、研发负责人 |
| 分册索引：[README.md](README.md) | Part 10 拆分导航与迁移规则 | 全体维护者 |
| 分册 A：[10a-inspector-breakpoints.md](10a-inspector-breakpoints.md) | 10.2 + 10.3 + 10.4 完整实现细节 | 平台开发、前端调试工具开发 |
| 分册 B：[10b-dynamic-agents-escalation.md](10b-dynamic-agents-escalation.md) | 10.5 + 10.6 完整实现细节 | 编排引擎、Agent Runtime 开发 |
| 分册 C：[10c-validation-testing-slo.md](10c-validation-testing-slo.md) | 10.8 + 10.9 + 10.10 指标/测试/错误路径 | 测试工程、SRE |

维护原则：

1. 主提案只保留“架构决策 + 最小示例”，避免堆叠完整实现代码
2. 分册承载“完整代码草案 + 细节流程图 + 边界条件”
3. 跨分册引用统一使用“节编号 + 文档名”双锚点，避免断链
4. 每次 PR 优先更新分册，再回填主提案摘要

### 10.1 三模式编排：圆桌脑暴 / Plan / Build

#### 10.1.1 问题提出

当前方案（第四部分 4.2 节）采用 **Plan / Build 二元模式**：

```
Plan 模式: Metis 预分析 → Prometheus 规划 → Momus 审查 → 输出计划文件
Build 模式: Atlas 按计划并行执行 → 收集结果
```

这是 oh-my-opencode 的经典流程，但对比人类工作协作模式，存在一个缺失环节——**在形成明确需求之前，团队往往先进行开放式讨论**。

考察人类团队的真实工作流：

| 阶段 | 人类行为 | 当前 Agent 映射 | 缺失？ |
|------|---------|----------------|--------|
| **头脑风暴** | 白板讨论、自由发散、多视角碰撞、淘汰坏点子 | ❌ 无对应 | **是** |
| **需求规划** | 将讨论结论结构化为需求文档、拆分任务、确定优先级 | Prometheus 规划 | 否 |
| **执行** | 按计划分工实现、测试、交付 | Atlas 并行执行 | 否 |

现有 Plan 模式将 "发散讨论" 和 "收敛规划" 合并在 Prometheus 的 Interview 阶段。但这种合并有明显局限：

1. **Prometheus 目标是生成计划**，它的 Interview 是为了"验证计划前提"，而非"探索可能性空间"
2. **单 Agent 视角**：Prometheus 独自采访用户，缺乏多 Agent 在同一上下文中的视角碰撞
3. **过早收敛**：用户说"重构认证系统"，Prometheus 直接开始规划 JWT 方案——但也许团队讨论后会发现 Session+Redis 方案更适合当前阶段

#### 10.1.2 三模式提案

```
┌──────────────────────────────────────────────────────────────────┐
│                     vitamin 三模式编排                            │
│                                                                  │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐             │
│  │  圆桌脑暴  │ ─→ │   Plan     │ ─→ │   Build    │             │
│  │ Roundtable │    │  Planning  │    │ Execution  │             │
│  │            │    │            │    │            │             │
│  │ 自由讨论   │    │ 结构化规划 │    │ 并行执行   │             │
│  │ 多角色碰撞 │    │ 需求文档化 │    │ 产出交付   │             │
│  │ 发散探索   │    │ 任务拆分   │    │ 报告验收   │             │
│  └────────────┘    └────────────┘    └────────────┘             │
│                                                                  │
│  用户可在任意阶段进入：                                          │
│  - "帮我想想怎么做" → 圆桌脑暴                                  │
│  - "帮我制定计划"   → Plan                                       │
│  - "按这个计划执行" → Build                                      │
│  - "帮我重构认证"   → 意图检测 → 自动选择入口                   │
└──────────────────────────────────────────────────────────────────┘
```

##### 模式一：圆桌脑暴（Roundtable）

**核心理念**：模拟人类团队头脑风暴——多位"角色"在同一个讨论桌上自由发言、质疑、补充。

```typescript
// packages/orchestrator/src/roundtable/roundtable-session.ts

export interface RoundtableConfig {
  /** 话题（用户的原始请求） */
  topic: string
  /** 参与角色（每个角色由一个 Agent 扮演） */
  participants: RoundtableParticipant[]
  /** 用户是否参与讨论（默认参与） */
  userParticipates: boolean
  /** 最大讨论轮数 */
  maxRounds: number
  /** 主持人（引导讨论走向，默认 Sisyphus） */
  moderator: string
}

export interface RoundtableParticipant {
  /** 角色名称 */
  name: string
  /** 扮演此角色的 Agent */
  agent: string
  /** 角色视角描述（注入 system prompt） */
  perspective: string
}

export interface RoundtableMessage {
  role: "participant" | "moderator" | "user"
  participant?: string
  content: string
  /** 标记为关键观点（由主持人或用户标记） */
  highlight?: boolean
}

/**
 * 圆桌讨论会话
 *
 * 与 Plan 模式的关键区别：
 * - Plan: 单 Agent (Prometheus) 主导，目标是生成结构化计划
 * - 圆桌: 多 Agent 平等参与，目标是发散探索可能性空间
 *
 * 讨论结束后输出"讨论纪要"，可直接作为 Plan 模式的输入。
 */
export class RoundtableSession {
  private messages: RoundtableMessage[] = []
  private round = 0

  constructor(
    private config: RoundtableConfig,
    private dispatch: TaskDispatcher,
  ) {}

  async start(): Promise<RoundtableResult> {
    // 主持人开场：明确话题、介绍参与角色
    const opening = await this.moderatorSpeak(
      `话题: ${this.config.topic}\n参与角色: ${this.config.participants.map(p => p.name).join(", ")}\n请各位从各自角度发表看法。`
    )
    this.messages.push(opening)

    // 多轮讨论
    while (this.round < this.config.maxRounds) {
      this.round++

      // 每轮：所有参与者依次发言
      for (const participant of this.config.participants) {
        const response = await this.participantSpeak(participant)
        this.messages.push(response)
      }

      // 用户可插话
      if (this.config.userParticipates) {
        const userInput = await this.waitForUserInput()
        if (userInput) {
          this.messages.push({ role: "user", content: userInput })
        }
        // 用户可随时输入 "/conclude" 结束讨论
        if (userInput?.includes("/conclude")) break
      }

      // 主持人总结本轮、决定是否继续
      const summary = await this.moderatorSummarize()
      this.messages.push(summary)

      if (summary.content.includes("[CONSENSUS_REACHED]")) break
    }

    // 生成讨论纪要
    return this.generateMinutes()
  }

  private async participantSpeak(participant: RoundtableParticipant): Promise<RoundtableMessage> {
    const result = await this.dispatch({
      subagent: participant.agent,
      prompt: this.buildParticipantPrompt(participant),
      mode: "sync",
    })

    return {
      role: "participant",
      participant: participant.name,
      content: result.output,
    }
  }

  private buildParticipantPrompt(participant: RoundtableParticipant): string {
    const history = this.messages
      .map(m => `[${m.participant ?? m.role}]: ${m.content}`)
      .join("\n\n")

    return [
      `你是"${participant.name}"，${participant.perspective}`,
      ``,
      `当前话题: ${this.config.topic}`,
      ``,
      `讨论历史:`,
      history,
      ``,
      `请从你的角色视角发表观点。可以提出新想法、质疑前面的观点、或补充细节。`,
      `保持简洁（200字内），聚焦最有价值的一个观点。`,
    ].join("\n")
  }

  private async generateMinutes(): Promise<RoundtableResult> {
    const minutesPrompt = [
      `请将以下圆桌讨论整理为"讨论纪要"：`,
      ``,
      ...this.messages.map(m => `[${m.participant ?? m.role}]: ${m.content}`),
      ``,
      `纪要格式：`,
      `## 讨论纪要`,
      `### 话题`,
      `### 关键观点（按角色整理）`,
      `### 共识`,
      `### 分歧`,
      `### 建议方向`,
    ].join("\n")

    const result = await this.dispatch({
      subagent: this.config.moderator,
      prompt: minutesPrompt,
      mode: "sync",
    })

    return {
      minutes: result.output,
      messages: this.messages,
      roundCount: this.round,
      consensusReached: this.messages.some(m => m.content.includes("[CONSENSUS_REACHED]")),
    }
  }

  private async moderatorSpeak(prompt: string): Promise<RoundtableMessage> {
    const result = await this.dispatch({
      subagent: this.config.moderator,
      prompt,
      mode: "sync",
    })
    return { role: "moderator", content: result.output }
  }

  private async moderatorSummarize(): Promise<RoundtableMessage> {
    return this.moderatorSpeak(
      `总结第 ${this.round} 轮讨论要点，判断是否达成共识。如已达成，在回复中包含 [CONSENSUS_REACHED]。`
    )
  }

  /**
   * 等待用户输入
   *
   * 抽象接口——由 TUI 层或 SDK 层覆写实现。
   * 默认实现返回 null（跳过用户参与），实际使用时通过注入或子类重写。
   *
   * @example
   * ```typescript
   * // TUI 层实现
   * session.waitForUserInput = async () => {
   *   return await tuiPrompt("Enter input (or press Enter to skip):")
   * }
   * ```
   */
  private async waitForUserInput(): Promise<string | null> {
    return null
  }
}

export interface RoundtableResult {
  minutes: string
  messages: RoundtableMessage[]
  roundCount: number
  consensusReached: boolean
}
```

##### 默认角色配置

圆桌讨论不要求固定角色组合，但提供默认适配：

```typescript
// packages/orchestrator/src/roundtable/default-participants.ts

import type { RoundtableParticipant } from "./roundtable-session"

/**
 * 默认圆桌角色
 *
 * 基于 oh-my-opencode 已有 Agent 的能力特征映射为讨论角色。
 * 用户可在配置中覆盖角色或添加自定义角色。
 */
export const DEFAULT_ROUNDTABLE_PARTICIPANTS: RoundtableParticipant[] = [
  {
    name: "架构师",
    agent: "oracle",
    perspective: "关注系统架构、技术选型、依赖管理、可扩展性。倾向于从全局视角审视方案，警惕过度设计。",
  },
  {
    name: "实现者",
    agent: "hephaestus",
    perspective: "关注代码实现可行性、工程复杂度、开发效率。倾向于务实的最小方案，警惕理论过于美好。",
  },
  {
    name: "审查者",
    agent: "momus",
    perspective: "关注风险、边界情况、兼容性、安全性。倾向于找出方案的漏洞和潜在问题。",
  },
  {
    name: "研究员",
    agent: "librarian",
    perspective: "关注业界最佳实践、最新技术趋势、相关论文/文档。带来外部知识视角。",
  },
]
```

##### 模式二：Plan（结构化规划）

沿用现有 Prometheus 规划流程，但增加**可选的圆桌纪要输入**：

```typescript
// packages/orchestrator/src/plan-build/plan-pipeline.ts（改动部分）

export interface PlanPipelineInput {
  userRequest: string
  /** 圆桌讨论纪要（如有） */
  roundtableMinutes?: string
}

export async function runPlanPipeline(input: PlanPipelineInput): Promise<PlanResult> {
  // 1. Metis 预分析（注入圆桌纪要作为上下文）
  const metisPrompt = input.roundtableMinutes
    ? `圆桌讨论纪要:\n${input.roundtableMinutes}\n\n用户请求: ${input.userRequest}`
    : input.userRequest

  const analysis = await dispatch({ subagent: "metis", prompt: metisPrompt, mode: "sync" })

  // 2. Prometheus 规划（有圆桌纪要时可跳过 Interview 阶段）
  const prometheusPrompt = input.roundtableMinutes
    ? `基于以下讨论共识直接生成计划（跳过需求访谈）:\n${analysis.output}`
    : analysis.output

  const plan = await dispatch({ subagent: "prometheus", prompt: prometheusPrompt, mode: "sync" })

  // 3. Momus 审查
  const review = await dispatch({ subagent: "momus", prompt: plan.output, mode: "sync" })

  return { plan: plan.output, review: review.output }
}
```

##### 模式三：Build（执行）

不变，沿用 Atlas 并行执行引擎。

#### 10.1.3 三模式 vs 二模式对比

| 维度 | 二模式 (Plan / Build) | 三模式 (圆桌 / Plan / Build) |
|------|----------------------|------------------------------|
| **进入复杂任务的路径** | 直接 Plan | 可选先圆桌讨论，再 Plan |
| **多视角碰撞** | Prometheus 独自分析 | 多 Agent 在同一上下文中对话 |
| **用户参与时机** | Plan 阶段的 Interview 环节 | 圆桌阶段即可深度参与 |
| **方向判断** | 隐含在 Prometheus 的规划中 | 显式在圆桌中探索和排除 |
| **Plan 阶段耗时** | 需要 Interview（用户来回 ~3-5 轮） | 如有圆桌纪要可跳过 Interview |
| **总延迟** | 较短（直接规划） | 可能更长（多一个讨论阶段） |
| **适合场景** | 需求清晰的任务 | 需求模糊、有多种可行方向的任务 |
| **Agent token 消耗** | 较低 | 较高（多角色发言） |
| **实现复杂度** | 较低 | 中等（新增圆桌引擎） |

#### 10.1.4 流程衔接设计

```
用户输入
  │
  ▼
Sisyphus Intent Gate
  │
  ├── 检测到需求明确的复杂任务 ──────────────→ Plan 模式
  │   (例: "用 JWT 替换 Session 认证")
  │
  ├── 检测到需求模糊的开放任务 ──────────────→ 圆桌脑暴
  │   (例: "帮我想想怎么优化用户体验")
  │   (例: "认证系统需要改进，有什么建议")
  │
  ├── 用户显式命令 /roundtable ──────────────→ 圆桌脑暴
  │   用户显式命令 /plan ────────────────────→ Plan 模式
  │   用户显式命令 /build ───────────────────→ Build 模式
  │
  └── 简单任务 ──────────────────────────────→ 直接执行

圆桌脑暴完成后:
  │
  ├── 自动流转 → Plan 模式（注入讨论纪要）
  │   └── 如讨论已达共识 → Prometheus 跳过 Interview，直接规划
  │
  └── 用户拿走纪要手动处理
      └── 后续可 /plan --minutes={file} 手动注入

Plan 完成后:
  │
  ├── 用户确认 → Build 模式 (/start-work)
  └── 用户修改 → 回到 Plan 或圆桌
```

#### 10.1.5 关键词触发与意图检测

```typescript
// packages/orchestrator/src/roundtable/intent-keywords.ts

/** 圆桌模式触发词 */
export const ROUNDTABLE_TRIGGER_PATTERNS = [
  /\b(讨论|brainstorm|头脑风暴|想想|思考一下|商量|探讨)\b/i,
  /\b(有什么建议|什么方案好|怎么做比较好|哪种方式|有哪些选择)\b/i,
  /\b(利弊|权衡|tradeoff|trade-off|pros.?cons)\b/i,
  /\b(discuss|think about|consider|what.?if|options?)\b/i,
]

/** Plan 模式触发词（现有） */
export const PLAN_TRIGGER_PATTERNS = [
  /\b(plan|规划|制定计划|refactor|redesign|architect)\b/i,
  /\b(重构|重新设计|迁移|migration)\b/i,
]

/**
 * 判断是否应进入圆桌而非直接 Plan
 *
 * 启发式规则：
 * 1. 匹配圆桌触发词 → 圆桌
 * 2. 匹配 Plan 触发词但请求中包含不确定性表达 → 圆桌
 * 3. 匹配 Plan 触发词且需求明确 → Plan
 * 4. 都不匹配 → 直接执行
 */
export function detectMode(input: string): "roundtable" | "plan" | "direct" {
  const hasRoundtable = ROUNDTABLE_TRIGGER_PATTERNS.some(p => p.test(input))
  const hasPlan = PLAN_TRIGGER_PATTERNS.some(p => p.test(input))
  const hasUncertainty = /不确定|不太清楚|maybe|not sure|还没想好|看看/.test(input)
  /** 否定词排除——"不想讨论"、"不用讨论"、"别讨论了" 不应触发圆桌 */
  const hasNegation = /不想|不用|不要|别|不需要|don'?t|no need/.test(input)

  if (hasRoundtable && !hasNegation) return "roundtable"
  if (hasPlan && hasUncertainty) return "roundtable"
  if (hasPlan) return "plan"
  return "direct"
}
```

#### 10.1.6 实现路径评估

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| **Phase A** | `RoundtableSession` 核心引擎 + 默认角色 | ~3 天 |
| **Phase B** | `/roundtable` 命令 + 意图检测集成 | ~2 天 |
| **Phase C** | 纪要→Plan 流转 + Prometheus Interview 跳过逻辑 | ~2 天 |
| **Phase D** | TUI 圆桌讨论 UI（多角色气泡、高亮标记） | ~3 天 |
| **Phase E** | 配置化（自定义角色、轮数、触发词） | ~1 天 |
| **合计** | | ~11 天 |

**风险与开放问题**：

1. **Token 成本控制**：每轮 4 个角色 × 200 字 × N 轮——3 轮讨论约消耗 ~15k token，可接受；10 轮可能 ~50k，需要控制
2. **讨论质量**：LLM 扮演不同角色时是否真能产生有价值的视角碰撞？需要实测。风险是退化为"同一模型换四种语气说同一句话"
3. **用户耐心**：用户可能不愿等待多轮 AI 互相讨论——需要良好的 UI 提示和随时中断能力
4. **与 Metis 的重叠**：Metis 已有"预分析"职能，圆桌是否让 Metis 变得多余？建议：Metis 仍负责信息收集（代码搜索/文档检索），圆桌负责方向讨论。两者互补而非替代
5. **多模型混合**：如果不同角色使用不同模型（如架构师用 Claude Opus、实现者用 GPT-5.3），视角差异可能更真实——但延迟和成本也更高

**结论**：三模式方案是**值得实验的增强**，建议作为 Extension 实现（而非核心模块），在 Phase 5 或更后期的里程碑中试验。路径依赖为零——即使圆桌模式效果不佳，Plan/Build 仍完全可用。

### 10.2~10.4 详细设计已迁移至 A 分册

为降低主提案长度并提高维护效率，以下章节的完整实现细节已迁移：

- 10.2 实时日志推送系统
- 10.3 开发调试可视化界面（DevTools Inspector）
- 10.4 Agent 断点与步进调试系统

请参考分册文档：

- [10A 分册：Inspector 与断点系统](10a-inspector-breakpoints.md)

主提案仅保留架构决策与跨模块关系，详细接口、流程图、示例代码以分册为准。

### 10.5~10.6 详细设计已迁移至 B 分册

为降低主提案长度并提高维护效率，以下章节的完整实现细节已迁移：

- 10.5 自主 Agent 合成：需求驱动的动态 Agent 创建与编排
- 10.5.15 试验性特性的配置 Schema
- 10.6 单向数据流与上行反馈：Agent 的异常冒泡与重规划机制（含 10.6.16 协商）

请参考分册文档：

- [10B 分册：动态 Agent 与上行反馈](10b-dynamic-agents-escalation.md)

主提案仅保留架构决策与跨模块关系，详细接口、流程图、示例代码以分册为准。

### 10.8~10.10 详细设计已迁移至 C 分册

为降低主提案长度并提高维护效率，以下章节的完整实现细节已迁移：

- 10.8 性能基准指标
- 10.9 试验性特性的测试策略
- 10.10 Part 4 核心流程的错误与重试路径

请参考分册文档：

- [10C 分册：验证、测试与 SLO](10c-validation-testing-slo.md)

主提案仅保留架构决策与跨模块关系，详细接口、流程图、示例代码以分册为准。
