# 10B 分册：动态 Agent 与上行反馈

> **来源**：从主提案 `09-vitamin-coding-agent-technical-proposal.md` Part 10 迁移  
> **范围**：10.5 自主 Agent 合成 · 10.5.15 配置 Schema · 10.6 上行反馈与协商  
> **返回主提案**：[← 主提案 10.0 导航](../09-vitamin-coding-agent-technical-proposal.md)

---

### 10.5 自主 Agent 合成：需求驱动的动态 Agent 创建与编排

#### 10.5.1 问题提出

当前系统的 Agent 矩阵（11 个内置 Agent + 自定义 Agent）是**预定义的**——Sisyphus 从固定的 Agent 列表中选择委派目标。当用户提出一个**超出现有 Agent 能力边界**的需求时，Sisyphus 会尝试用最接近的 Agent 处理，但效果往往不理想。

**核心矛盾**：

```
用户问题的多样性 ∞  >>>  预定义 Agent 的覆盖范围 N
```

**激励性示例——"分析 Bun 框架是否可以编译成 WASM"**：

这是一个典型的超越预定义 Agent 能力的需求。让我们看看当前系统会如何处理：

```
当前流程（不理想）:
  用户: "分析 bun 框架是否可以编译成 wasm"
  │
  Sisyphus 分析:
  │  → "bun" 是什么？我的训练数据可能过时了
  │  → 这涉及 Zig 底层、WASM 编译器、运行时依赖……
  │  → 我没有 Zig 专家 Agent、也没有 WASM 专家 Agent
  │
  Sisyphus 只能:
  │  → 委派给 Oracle（纯推理，但没有最新信息）
  │  → 或委派给 Explore（只能搜索本地代码库，而 Bun 不在本地）
  │  → 或自己勉强回答（质量差）
  │
  结果: 浅层回答，缺乏技术深度和最新信息
```

**理想流程（本节讨论的目标）**：

```
理想流程（本节目标）:
  用户: "分析 bun 框架是否可以编译成 wasm"
  │
  Sisyphus 分析需求:
  │  → 这需要了解 Bun 的最新状态 → 需要联网搜索能力
  │  → 这涉及 Zig 语言底层实现 → 需要 Zig 专家
  │  → 这涉及 WASM 编译约束 → 需要 WASM 专家
  │  → 需要源代码级分析 → 需要代码拉取能力
  │  → 需要交叉验证结论 → 需要多专家圆桌讨论
  │
  Sisyphus 自主合成 Agent Team:
  │
  │  Step 1: 创建 "Web Research Agent"
  │  │  → systemPrompt: 联网搜索专家，聚焦 Bun 框架最新架构和 WASM 相关讨论
  │  │  → tools: [websearch, fetch_webpage]
  │  │  → 任务: 搜集 Bun 的架构信息、官方 WASM 计划、社区讨论
  │  │
  │  Step 2: 创建 "Code Retrieval Agent"
  │  │  → systemPrompt: 代码分析专家，能 clone 和分析大型代码库
  │  │  → tools: [bash, read_file, grep]
  │  │  → 任务: clone bun 仓库，分析构建系统、依赖图、平台特定代码
  │  │
  │  Step 3: 等待 Step 1、2 完成，获取上下文
  │  │
  │  Step 4: 创建圆桌讨论 Agent Team:
  │  │
  │  │  → "Zig Expert Agent"
  │  │  │  systemPrompt: Zig 语言专家，熟悉 Zig 编译器、LLVM 后端、
  │  │  │  交叉编译、#[comptime]、allocator 和 C ABI 互操作
  │  │  │
  │  │  → "WASM Expert Agent"
  │  │  │  systemPrompt: WebAssembly 专家，熟悉 WASI、wasm32 target、
  │  │  │  内存模型、线程模型（SharedArrayBuffer）、组件模型提案
  │  │  │
  │  │  → "Documentation Expert Agent"
  │  │  │  systemPrompt: 技术文档专家，从 Bun 官方文档和源代码注释中
  │  │  │  提取关键设计决策和约束
  │  │  │
  │  │  → "Verification Expert Agent"
  │  │  │  systemPrompt: 结论验证专家，检验其他专家的论点是否有逻辑漏洞、
  │  │  │  事实错误、遗漏的约束条件
  │  │  │
  │  │  → "Roundtable Moderator Agent"
  │  │  │  systemPrompt: 圆桌主持人，引导讨论方向，确保覆盖所有关键维度，
  │  │  │  调和分歧，输出结构化结论
  │  │
  │  Step 5: 执行圆桌讨论，输出结论报告
  │
  结果: 深度分析报告，包含源代码级证据、专家交叉验证、可行性评估
```

#### 10.5.2 设计原则

**"Agent 是 Prompt + Tools + Model 的函数"**

从 oh-my-opencode 的 `AgentConfig` 即可看出，一个 Agent 本质上就是：

```typescript
interface AgentConfig {
  name: string
  model: string
  prompt: string          // ← system prompt 定义了 Agent 的"人格"和"专长"
  tools?: string[]        // ← 可用工具集定义了 Agent 的"能力"
  temperature?: number
  maxTokens?: number
  thinking?: { type: "enabled"; budgetTokens: number }
  // ...
}
```

因此，**动态创建 Agent = 动态生成 `AgentConfig`**。这不需要"元编程"或"代码生成"——只需要 Sisyphus 具备分析需求并填充 `AgentConfig` 各字段的能力。

**五项设计约束**：

| 约束 | 说明 |
|------|------|
| **1. 安全边界** | 动态 Agent 最多只能获得主 Agent 的工具子集，不能创造新工具 |
| **2. 资源限额** | 每个动态 Agent 有 token 上限和轮次上限，防止失控 |
| **3. 可审计** | 所有动态 Agent 的创建决策、system prompt、执行日志全部留存 |
| **4. 渐进式** | 先创建少量 Agent 验证方向，再按需扩展 |
| **5. 可干预** | 用户可以在创建前审查 Agent 配置，在执行中通过断点（10.4）暂停查看 |

#### 10.5.3 Agent 合成引擎核心设计

```typescript
// packages/agent/src/synthesis/agent-synthesizer.ts

import type { AgentConfig } from "@vitamin/agent"

/**
 * Agent 合成引擎
 *
 * Sisyphus（或任何主 Agent）调用此引擎分析需求、筛选现有 Agent、
 * 按需合成新 Agent。引擎本身不做 LLM 调用——它是一个工具，
 * 由 Sisyphus 的 LLM 决策驱动。
 */

// ── Step 1: 需求分析 → 能力需求图谱 ──

/**
 * 能力需求——由 Sisyphus 分析用户需求后填充
 *
 * 示例（"分析 Bun 是否可编译为 WASM"）:
 * {
 *   domain: "系统级框架的 WASM 编译可行性分析",
 *   requiredCapabilities: [
 *     { type: "knowledge", domain: "bun-framework", freshness: "latest" },
 *     { type: "knowledge", domain: "zig-language", freshness: "stable" },
 *     { type: "knowledge", domain: "webassembly", freshness: "latest" },
 *     { type: "tool", name: "websearch", reason: "获取 Bun 最新架构信息" },
 *     { type: "tool", name: "bash", reason: "clone 和分析 Bun 源代码" },
 *     { type: "collaboration", mode: "roundtable", reason: "多专家交叉验证" },
 *   ],
 *   complexity: "high",
 *   expectedOutput: "结构化可行性报告"
 * }
 */
export interface RequirementAnalysis {
  /** 需求领域描述 */
  domain: string
  /** 所需能力清单 */
  requiredCapabilities: RequiredCapability[]
  /** 复杂度评估 */
  complexity: "low" | "medium" | "high" | "expert"
  /** 期望的输出形式 */
  expectedOutput: string
  /** 是否需要最新信息（决定是否必须联网） */
  requiresFreshInfo: boolean
  /** 是否需要外部代码/数据（决定是否需要代码拉取） */
  requiresExternalCode: boolean
}

export type RequiredCapability =
  | { type: "knowledge"; domain: string; freshness: "stable" | "latest" }
  | { type: "tool"; name: string; reason: string }
  | { type: "collaboration"; mode: "roundtable" | "review" | "sequential"; reason: string }
  | { type: "verification"; strategy: "cross-check" | "test-driven" | "counter-argument" }

// ── Step 2: Agent 筛选 → 匹配已有 Agent ──

export interface AgentMatchResult {
  /** 完全匹配的现有 Agent */
  matched: Array<{ agentName: string; covers: RequiredCapability[] }>
  /** 部分匹配（能力不足） */
  partial: Array<{ agentName: string; covers: RequiredCapability[]; missing: RequiredCapability[] }>
  /** 无法被任何现有 Agent 覆盖的能力 */
  uncovered: RequiredCapability[]
  /** 是否需要合成新 Agent */
  needsSynthesis: boolean
}

/**
 * 筛选现有 Agent
 *
 * 遍历所有已注册的 Agent，将其 metadata（category, tools, triggers）
 * 与 requiredCapabilities 进行匹配，输出匹配报告。
 */
export function matchExistingAgents(
  requirements: RequirementAnalysis,
  registeredAgents: RegisteredAgentInfo[],
): AgentMatchResult {
  const matched: AgentMatchResult["matched"] = []
  const partial: AgentMatchResult["partial"] = []
  const coveredSet = new Set<number>()

  for (const agent of registeredAgents) {
    const covers: RequiredCapability[] = []
    const missing: RequiredCapability[] = []

    for (let i = 0; i < requirements.requiredCapabilities.length; i++) {
      const cap = requirements.requiredCapabilities[i]
      if (agentCanCover(agent, cap)) {
        covers.push(cap)
        coveredSet.add(i)
      } else {
        missing.push(cap)
      }
    }

    if (covers.length === requirements.requiredCapabilities.length) {
      matched.push({ agentName: agent.name, covers })
    } else if (covers.length > 0) {
      partial.push({ agentName: agent.name, covers, missing })
    }
  }

  const uncovered = requirements.requiredCapabilities.filter((_, i) => !coveredSet.has(i))

  return {
    matched,
    partial,
    uncovered,
    needsSynthesis: uncovered.length > 0,
  }
}

/** Agent 能力匹配判断 */
function agentCanCover(agent: RegisteredAgentInfo, cap: RequiredCapability): boolean {
  switch (cap.type) {
    case "knowledge":
      return agent.knowledgeDomains.some((d) => d.includes(cap.domain) || cap.domain.includes(d))
    case "tool":
      return agent.availableTools.includes(cap.name)
    case "collaboration":
      return agent.supportsCollaboration === cap.mode
    case "verification":
      return agent.canVerify === true
  }
}

export interface RegisteredAgentInfo {
  name: string
  knowledgeDomains: string[]
  availableTools: string[]
  supportsCollaboration?: "roundtable" | "review" | "sequential"
  canVerify?: boolean
}

// ── Step 3: Agent 合成 → 动态创建 AgentConfig ──

/**
 * Agent 合成蓝图——Sisyphus 通过 LLM 生成此结构，
 * 引擎根据蓝图创建 AgentConfig
 */
export interface AgentBlueprint {
  /** Agent 名称（唯一标识） */
  name: string
  /** Agent 角色描述（一句话） */
  role: string
  /** system prompt 核心内容（由 Sisyphus 的 LLM 生成） */
  promptCore: string
  /** 需要的工具集（必须是系统已注册工具的子集） */
  requiredTools: string[]
  /** 模型偏好 */
  modelPreference: ModelPreference
  /** Agent 行为参数 */
  behavior: {
    /** 温度（创造性程度） */
    temperature: number
    /** Token 上限 */
    maxTokens: number
    /** 最大轮次 */
    maxTurns: number
    /** 是否启用扩展思维 */
    thinking?: { budgetTokens: number }
  }
  /** 上下文注入——其他 Agent 已收集的信息 */
  contextInjection?: string
  /** 是否需要联网能力 */
  needsWebAccess: boolean
}

export interface ModelPreference {
  /** 偏好的能力级别 */
  tier: "fast" | "balanced" | "powerful" | "expert"
  /** 是否需要长上下文 */
  longContext: boolean
  /** 具体模型约束（如 "必须支持 thinking"） */
  constraints?: string[]
}

/**
 * 从蓝图合成 AgentConfig
 *
 * 蓝图由 Sisyphus 的 LLM 生成 → 此函数将其转化为可执行的 AgentConfig。
 * 关键安全检查：工具白名单、token 上限、轮次上限。
 */
export function synthesizeAgent(
  blueprint: AgentBlueprint,
  systemToolWhitelist: Set<string>,
  availableModels: Map<string, ModelInfo>,
): SynthesisResult {
  // 安全检查：工具白名单
  const disallowedTools = blueprint.requiredTools.filter((t) => !systemToolWhitelist.has(t))
  if (disallowedTools.length > 0) {
    return {
      success: false,
      error: `请求了不允许的工具: ${disallowedTools.join(", ")}`,
      disallowedTools,
    }
  }

  // 模型解析
  const model = resolveModelForBlueprint(blueprint.modelPreference, availableModels)
  if (!model) {
    return { success: false, error: "没有可用的模型满足蓝图要求" }
  }

  // 构建 system prompt
  const systemPrompt = buildSynthesizedPrompt(blueprint)

  // 应用安全限制
  const safeMaxTokens = Math.min(blueprint.behavior.maxTokens, 32_000)
  const safeMaxTurns = Math.min(blueprint.behavior.maxTurns, 30)

  const agentConfig: AgentConfig = {
    name: `synth:${blueprint.name}`,
    model: model.id,
    prompt: systemPrompt,
    tools: blueprint.requiredTools,
    temperature: blueprint.behavior.temperature,
    maxTokens: safeMaxTokens,
    maxTurns: safeMaxTurns,
    ...(blueprint.behavior.thinking && {
      thinking: { type: "enabled", budgetTokens: blueprint.behavior.thinking.budgetTokens },
    }),
  }

  return { success: true, agentConfig, model }
}

function buildSynthesizedPrompt(blueprint: AgentBlueprint): string {
  const sections: string[] = []

  sections.push(`<Role>
You are ${blueprint.role}.
</Role>`)

  sections.push(`<Expertise>
${blueprint.promptCore}
</Expertise>`)

  if (blueprint.contextInjection) {
    sections.push(`<Context>
The following information has been gathered by other agents:

${blueprint.contextInjection}
</Context>`)
  }

  sections.push(`<Constraints>
- Stay focused on your designated role. Do not attempt tasks outside your expertise.
- If you encounter information that requires a different expert, clearly flag it.
- Be precise and cite sources when possible.
- Token budget: ${blueprint.behavior.maxTokens} tokens.
- Turn limit: ${blueprint.behavior.maxTurns} turns.
</Constraints>`)

  return sections.join("\n\n")
}

interface ModelInfo {
  id: string
  tier: "fast" | "balanced" | "powerful" | "expert"
  contextWindow: number
  supportsThinking: boolean
}

type SynthesisResult =
  | { success: true; agentConfig: AgentConfig; model: ModelInfo }
  | { success: false; error: string; disallowedTools?: string[] }

function resolveModelForBlueprint(
  pref: ModelPreference,
  available: Map<string, ModelInfo>,
): ModelInfo | undefined {
  const candidates = Array.from(available.values())
    .filter((m) => {
      if (pref.longContext && m.contextWindow < 128_000) return false
      if (pref.constraints?.includes("thinking") && !m.supportsThinking) return false
      return true
    })
    .sort((a, b) => {
      const tierOrder = { fast: 0, balanced: 1, powerful: 2, expert: 3 }
      return Math.abs(tierOrder[a.tier] - tierOrder[pref.tier])
        - Math.abs(tierOrder[b.tier] - tierOrder[pref.tier])
    })
  return candidates[0]
}
```

#### 10.5.4 Sisyphus 的合成决策工具

```typescript
// packages/server/src/tools/synthesize-agent/tool-definition.ts

/**
 * synthesize_agent 工具——注册给 Sisyphus，使其能够动态创建 Agent
 *
 * 这是一个 "meta-tool"：它不直接执行任务，而是创建新的 Agent 来执行任务。
 * 类似于编程语言中的 eval() 或 metaprogramming——但有严格的安全约束。
 */
export const SYNTHESIZE_AGENT_TOOL = {
  name: "synthesize_agent",
  description: `Create a new specialized agent dynamically when no existing agent matches the task requirements.

WHEN TO USE:
- The task requires domain expertise not covered by existing agents
- The task requires a specific combination of tools and knowledge
- Multi-expert collaboration (roundtable) is needed with custom experts

WHEN NOT TO USE:
- An existing agent already covers the task well
- The task is simple enough for the main agent to handle directly

The tool will validate the blueprint, check tool permissions, resolve the model,
and return the synthesized AgentConfig ready for delegation.`,

  parameters: {
    type: "object",
    required: ["blueprint"],
    properties: {
      blueprint: {
        type: "object",
        required: ["name", "role", "promptCore", "requiredTools", "modelPreference", "behavior"],
        properties: {
          name: {
            type: "string",
            description: "Unique agent name (e.g., 'zig-expert', 'wasm-analyzer')",
          },
          role: {
            type: "string",
            description: "One-line role description (e.g., 'Zig language expert specializing in cross-compilation')",
          },
          promptCore: {
            type: "string",
            description: "Core system prompt content defining the agent's expertise and behavior",
          },
          requiredTools: {
            type: "array",
            items: { type: "string" },
            description: "Tools this agent needs (must be subset of system-registered tools)",
          },
          needsWebAccess: {
            type: "boolean",
            description: "Whether this agent needs web search/fetch capabilities",
          },
          modelPreference: {
            type: "object",
            properties: {
              tier: { type: "string", enum: ["fast", "balanced", "powerful", "expert"] },
              longContext: { type: "boolean" },
            },
          },
          behavior: {
            type: "object",
            properties: {
              temperature: { type: "number" },
              maxTokens: { type: "number" },
              maxTurns: { type: "number" },
            },
          },
          contextInjection: {
            type: "string",
            description: "Pre-gathered context from other agents to inject into this agent's prompt",
          },
        },
      },
    },
  },
}

/**
 * analyze_requirements 工具——帮助 Sisyphus 结构化分析需求
 */
export const ANALYZE_REQUIREMENTS_TOOL = {
  name: "analyze_requirements",
  description: `Analyze user requirements and map them to capability needs.
Returns a structured RequirementAnalysis showing what capabilities are needed,
which existing agents can cover them, and what gaps require new agent synthesis.

Use this BEFORE synthesize_agent to understand what's needed.`,

  parameters: {
    type: "object",
    required: ["userRequest"],
    properties: {
      userRequest: {
        type: "string",
        description: "The user's original request text",
      },
      context: {
        type: "string",
        description: "Additional context about the workspace or conversation",
      },
    },
  },
}
```

#### 10.5.5 端到端流程：Bun → WASM 可行性分析

以下展示完整的用户请求 → 自主 Agent 合成 → 执行 → 输出的全流程：

```
═══════════════════════════════════════════════════════════════
 Phase 0: 需求分析
═══════════════════════════════════════════════════════════════

User: "分析 bun 框架是否可以编译成 wasm"

Sisyphus 内部推理:
  → 调用 analyze_requirements("分析 bun 框架是否可以编译成 wasm")
  →
  RequirementAnalysis = {
    domain: "运行时框架的 WebAssembly 编译可行性",
    requiredCapabilities: [
      { type: "knowledge", domain: "bun-runtime",    freshness: "latest" },
      { type: "knowledge", domain: "zig-language",    freshness: "stable" },
      { type: "knowledge", domain: "webassembly",     freshness: "latest" },
      { type: "knowledge", domain: "llvm-backend",    freshness: "stable" },
      { type: "tool",      name: "websearch",    reason: "Bun 最新架构和 WASM 相关讨论" },
      { type: "tool",      name: "bash",         reason: "Clone Bun 仓库分析源代码" },
      { type: "tool",      name: "read_file",    reason: "分析构建脚本和源代码" },
      { type: "collaboration", mode: "roundtable", reason: "多专家交叉验证结论" },
      { type: "verification",  strategy: "counter-argument" },
    ],
    complexity: "expert",
    expectedOutput: "结构化可行性报告",
    requiresFreshInfo: true,
    requiresExternalCode: true,
  }

Sisyphus 筛选现有 Agent:
  → matchExistingAgents(requirements, registeredAgents)
  →
  AgentMatchResult = {
    matched: [],  // 没有 Agent 完全覆盖
    partial: [
      { agentName: "oracle",    covers: [knowledge/zig, knowledge/wasm], missing: [...] },
      { agentName: "librarian", covers: [tool/websearch],               missing: [...] },
      { agentName: "explore",   covers: [tool/bash, tool/read_file],    missing: [...] },
    ],
    uncovered: [
      { type: "knowledge", domain: "bun-runtime", freshness: "latest" },
      { type: "knowledge", domain: "llvm-backend" },
      { type: "collaboration", mode: "roundtable" },
      { type: "verification", strategy: "counter-argument" },
    ],
    needsSynthesis: true,  // ← 触发合成
  }

Sisyphus 决策:
  "现有 Agent 部分覆盖，但缺少 Bun 专项知识、LLVM 后端知识、
   以及多专家圆桌验证能力。需要合成专项 Agent Team。"

═══════════════════════════════════════════════════════════════
 Phase 1: 信息收集（复用现有 Agent + 合成联网 Agent）
═══════════════════════════════════════════════════════════════

Sisyphus 同时启动:

  [Background] Librarian Agent:
    → "搜索 Bun 官方文档中关于 WASM/WebAssembly 的内容"

  [Background] synthesize_agent → "bun-researcher":
    → role: "Bun 框架研究员，专注收集 Bun 架构、编译系统、平台依赖的最新信息"
    → tools: [websearch, fetch_webpage]
    → needsWebAccess: true
    → modelPreference: { tier: "balanced", longContext: false }
    → 任务: 搜索 Bun 源代码架构、zig build 系统、WASM 相关 issue/PR/讨论

  [Background] synthesize_agent → "bun-code-analyzer":
    → role: "代码分析专员，负责 clone 和分析 Bun 仓库的构建系统和平台依赖"
    → tools: [bash, read_file, grep]
    → needsWebAccess: false
    → modelPreference: { tier: "powerful", longContext: true }
    → 任务: git clone bun → 分析 build.zig, src/deps/, 平台特定 #ifdef

  等待所有 Background Agent 完成...

  收集的上下文:
    → Bun 用 Zig 编写核心, 依赖 JavaScriptCore (WebKit JSC)
    → 构建系统: build.zig + CMake(JSC) + platform-specific C/C++
    → 平台依赖: epoll(Linux), kqueue(macOS), IOCP(Windows)
    → Bun 依赖: boringssl, libarchive, lz4, zstd, mimalloc
    → Zig 的 WASM target: wasm32-wasi, wasm32-freestanding
    → JSC 的 WASM 编译现状: 仅 x86_64 和 arm64, 不支持 wasm32 target

═══════════════════════════════════════════════════════════════
 Phase 2: 圆桌讨论组建（合成专家 Team）
═══════════════════════════════════════════════════════════════

Sisyphus 根据收集到的上下文，合成 5 个专家 Agent:

  synthesize_agent → "zig-expert":
    role: "Zig 语言与编译系统专家"
    promptCore: |
      你是 Zig 语言专家，精通：
      - Zig 编译器架构（self-hosted, LLVM 后端, C 后端新增）
      - Zig 的 wasm32-wasi 和 wasm32-freestanding target
      - Zig 的 @cImport、comptime、allocator 系统
      - Zig 与 C/C++ 库的交叉编译（特别是使用 zig cc 交叉编译 C 依赖）
      - build.zig 构建系统
      分析时需关注: Zig 编译到 WASM 的已知限制（如 LLVM 后端对 wasm32 的支持程度、
      线程模型、异常/错误处理、SIMD 支持、动态链接）
    contextInjection: [Phase 1 收集的 Bun 构建系统分析]
    modelPreference: { tier: "expert", longContext: true }
    behavior: { temperature: 0.3, maxTokens: 16000, maxTurns: 5 }

  synthesize_agent → "wasm-expert":
    role: "WebAssembly 平台与 WASI 专家"
    promptCore: |
      你是 WebAssembly 专家，精通：
      - WASM MVP / WASM 2.0 规范（GC、Exception Handling、Component Model）
      - WASI preview1 / preview2 / p3 (HTTP Proxy world)
      - WASM 内存模型（线性内存、多内存提案、共享内存 + Atomics）
      - WASM 线程方案（Web Workers + SharedArrayBuffer, WASI Threads）
      - 大型 C/C++ 项目编译到 WASM 的实践（Emscripten、wasi-sdk）
      分析时需关注: Bun 的运行时特性（IO多路复用、线程池、JIT）
      哪些在 WASM 环境中有/无可行替代方案
    contextInjection: [Phase 1 收集的所有上下文]
    modelPreference: { tier: "expert", longContext: true }
    behavior: { temperature: 0.3, maxTokens: 16000, maxTurns: 5 }

  synthesize_agent → "doc-expert":
    role: "技术文档与架构分析专家"
    promptCore: |
      你是技术文档分析专家，负责：
      - 从源代码和文档中提取关键设计决策
      - 整理 Bun 的模块依赖图和平台抽象层
      - 识别哪些组件是 WASM 编译的阻碍点
      - 梳理 Bun 团队关于 WASM 的官方态度和路线图
      输出: 结构化的"依赖清单"和"阻碍点矩阵"
    contextInjection: [Phase 1 的代码分析结果]
    modelPreference: { tier: "balanced", longContext: true }
    behavior: { temperature: 0.2, maxTokens: 12000, maxTurns: 4 }

  synthesize_agent → "verification-expert":
    role: "结论验证与反驳专家"
    promptCore: |
      你是技术验证专家。你的唯一职责是：
      1. 审查其他专家的论点，找出逻辑漏洞
      2. 提出反面论据（Devil's Advocate）
      3. 验证引用的技术事实是否准确
      4. 检查是否遗漏了关键约束条件
      5. 评估"部分可行"方案的实际可操作性
      你不需要给出自己的方案，只需确保其他专家的结论经得起检验。
    modelPreference: { tier: "expert", longContext: true }
    behavior: { temperature: 0.1, maxTokens: 12000, maxTurns: 5 }

  synthesize_agent → "roundtable-moderator":
    role: "圆桌讨论主持人与结论综合专家"
    promptCore: |
      你是技术圆桌讨论的主持人。你的职责：
      1. 引导讨论按以下维度展开：
         - 技术可行性（编译层面）
         - 运行时可行性（IO/线程/JIT）
         - 依赖链可行性（第三方库）
         - 工程量评估（人力/时间）
         - 替代方案（部分编译、AOT-only 等）
      2. 确保每个维度都有 Zig 专家和 WASM 专家的交叉意见
      3. 让验证专家对关键结论进行反驳测试
      4. 最终输出结构化结论报告，包含：
         - 可行性评级 (Fully Feasible / Partially Feasible / Not Feasible)
         - 关键阻碍清单（按严重程度排序）
         - 可行替代方案
         - 所需工程量估算
         - 信心等级（High / Medium / Low）
    modelPreference: { tier: "powerful", longContext: true }
    behavior: { temperature: 0.4, maxTokens: 20000, maxTurns: 10 }

═══════════════════════════════════════════════════════════════
 Phase 3: 执行圆桌讨论
═══════════════════════════════════════════════════════════════

  Roundtable Moderator 引导讨论:

  Round 1 — 技术可行性:
    Zig Expert:    "Zig 本身支持 wasm32 target，但 Bun 的 build.zig 硬编码了
                    x86_64/aarch64 target triple。主要问题是 JSC 依赖..."
    WASM Expert:   "JavaScriptCore 不支持编译到 wasm32。JSC 的 JIT
                    (DFG/FTL) 直接生成机器码，在 WASM 环境中没有等价物..."
    Verification:  "确认 JSC 的 JIT 依赖是致命问题。但是 JSC 有解释器模式
                    (LLInt)——如果禁用 JIT，是否可行？"
    Zig Expert:    "LLInt 仍然依赖平台特定的汇编 (LowLevelInterpreter.asm),
                    编译到 WASM 需要重写..."

  Round 2 — 运行时可行性:
    WASM Expert:   "Bun 的 IO 模型依赖 epoll/kqueue，WASI 没有等价物。
                    WASI preview2 有 wasi-io，但只支持简单的 read/write..."
    Doc Expert:    "从源代码分析，Bun 的事件循环在 src/bun.js/event_loop.zig，
                    直接调用了 std.os.linux.epoll_*..."
    Verification:  "如果目标是浏览器环境，可以通过 Asyncify 将同步 IO
                    转为异步——但性能代价巨大（10-50x 慢）..."

  Round 3 — 依赖链:
    Doc Expert:    "Bun 依赖: boringssl(C), libarchive(C), mimalloc(C),
                    lz4(C), zstd(C), c-ares(C), zlib(C)。这些都需要
                    用 wasi-sdk 重新编译..."
    Zig Expert:    "zig cc 可以交叉编译大部分 C 依赖到 wasm32-wasi。
                    boringssl 是最大挑战——它有平台特定的汇编优化..."

  ... （多轮讨论）

═══════════════════════════════════════════════════════════════
 Phase 4: 输出结论
═══════════════════════════════════════════════════════════════

  Moderator 综合报告:

  ### Bun → WASM 可行性分析报告

  **可行性评级: Partially Feasible (with major constraints)**

  #### 关键阻碍（按严重程度）:
  1. 🔴 JavaScriptCore 不支持 wasm32 target（致命）
  2. 🔴 JSC JIT 引擎直接生成 x86/ARM 机器码（致命）
  3. 🟡 IO 多路复用 (epoll/kqueue) 无 WASI 对等物
  4. 🟡 线程池依赖 pthread（WASI Threads 规范未稳定）
  5. 🟢 C 依赖链可通过 wasi-sdk/zig cc 交叉编译

  #### 替代方案:
  - 方案 A: 替换 JSC 为 QuickJS（纯 C，支持 wasm32）→ 失去 JIT 性能
  - 方案 B: 仅编译 Bun 的工具链部分（bundler, transpiler）→ 不含运行时
  - 方案 C: 等待 WASM GC + Component Model 成熟后重新评估

  #### 工程量估算: 12-18 人月（方案 B），不可估量（方案 A）

  #### 信心等级: High（基于源代码分析和 JSC 官方文档）
```

#### 10.5.6 Sisyphus 的合成决策提示词增强

```typescript
// 注入 Sisyphus system prompt 的新增段落

const AGENT_SYNTHESIS_SECTION = `
<Agent_Synthesis>
## Dynamic Agent Synthesis (ADVANCED)

You have the ability to CREATE NEW AGENTS when existing ones cannot handle a task.

### Decision Flow:

1. **FIRST**: Check if existing agents can handle the task
   → If YES: use delegate_task with the existing agent
   → If PARTIALLY: check if combining existing agents suffices
   → If NO: proceed to synthesis

2. **Analyze Requirements**: Use analyze_requirements to map needs to capabilities

3. **Synthesis Strategy**:
   - For KNOWLEDGE gaps: Create domain expert agents with specialized prompts
   - For FRESH INFO gaps: Create web research agents (tools: [websearch, fetch_webpage])
   - For CODE ANALYSIS gaps: Create code retrieval agents (tools: [bash, read_file, grep])
   - For VERIFICATION needs: Create adversarial/verification agents
   - For MULTI-EXPERT needs: Create a roundtable team with moderator

4. **Phased Execution** (CRITICAL):
   - Phase 1: Information gathering agents (PARALLEL)
   - Phase 2: Wait for Phase 1, inject context into expert agents
   - Phase 3: Expert analysis / roundtable discussion
   - Phase 4: Synthesis and verification

### Safety Rules:
- NEVER create agents with tools not in the system whitelist
- ALWAYS set reasonable maxTurns (≤ 30) and maxTokens (≤ 32000)
- ALWAYS inject gathered context into later-phase agents (don't make them re-search)
- PREFER reusing existing agents when coverage is 70%+
- For roundtable: ALWAYS include a verification/adversarial expert

### System Prompt Generation Guidelines:
- Be SPECIFIC about the domain (not "you are an expert" but "you are a Zig expert specializing in...")
- Include CONSTRAINTS (what the agent should NOT do)
- Include OUTPUT FORMAT expectations
- For web research agents: specify WHAT to search for, not just "search the web"
- For code analysis agents: specify WHAT to look for in the code
</Agent_Synthesis>
`
```

#### 10.5.7 合成 Agent 的生命周期管理

```typescript
// packages/agent/src/synthesis/agent-lifecycle.ts

/**
 * 合成 Agent 的生命周期
 *
 *   Created → Queued → Running → Completed/Failed → Archived
 *             │                  │
 *             └── Cancelled ◄────┘
 *
 * 与静态 Agent 的区别：合成 Agent 是短命的，任务完成后自动归档。
 * 但其 system prompt 和执行日志会被保留，支持复用和学习。
 */

export interface SynthesizedAgentState {
  /** 合成蓝图（创建时的完整配置） */
  blueprint: AgentBlueprint
  /** 编排阶段（属于哪个执行 Phase） */
  phase: number
  /** 当前状态 */
  status: "created" | "queued" | "running" | "completed" | "failed" | "cancelled" | "archived"
  /** 创建时间 */
  createdAt: number
  /** 完成时间 */
  completedAt?: number
  /** 执行结果摘要 */
  resultSummary?: string
  /** Token 使用量 */
  tokenUsage?: { input: number; output: number }
  /** 依赖的其他 Agent（等待其完成后才执行） */
  dependsOn: string[]
  /** 上下文来源（从哪些 Agent 获取注入的上下文） */
  contextFrom: string[]
  /** 失败策略：当依赖的 Agent 失败时如何处理 */
  failurePolicy: SynthesisFailurePolicy
}

/**
 * Agent 合成流水线的失败处理策略
 *
 * 当依赖的 Agent 失败/取消/超时时，决定当前 Agent 的行为：
 * - abort_all: 整个合成流水线终止（适合强依赖链）
 * - skip_failed: 跳过失败的依赖，用可用的部分上下文继续（适合信息收集型 Phase）
 * - retry_once: 对失败的 Agent 重试一次后再决定（适合网络敏感型 Agent）
 */
export type SynthesisFailurePolicy = "abort_all" | "skip_failed" | "retry_once"

/**
 * Agent 合成编排器
 *
 * 管理多个合成 Agent 的依赖关系和执行顺序。
 * 类似于 Turborepo 的任务图——按依赖拓扑并行执行。
 */
export class SynthesisOrchestrator {
  private agents: Map<string, SynthesizedAgentState> = new Map()
  private results: Map<string, string> = new Map()

  /**
   * 添加合成 Agent 到编排图
   */
  addAgent(
    name: string,
    blueprint: AgentBlueprint,
    phase: number,
    dependsOn: string[] = [],
    contextFrom: string[] = [],
    failurePolicy: SynthesisFailurePolicy = "abort_all",
  ): void {
    this.agents.set(name, {
      blueprint,
      phase,
      status: "created",
      createdAt: Date.now(),
      dependsOn,
      contextFrom,
      failurePolicy,
    })
  }

  /**
   * 计算可并行执行的 Agent 批次
   *
   * 返回拓扑排序后的执行批次，同一批次内的 Agent 可以并行执行。
   */
  computeExecutionBatches(): string[][] {
    const batches: string[][] = []
    /** 已完成或已终止的 Agent（含 completed/failed/cancelled） */
    const finished = new Set<string>()
    /** 标记失败/取消的 Agent，供下游快速失败判断 */
    const failed = new Set<string>()

    // 先将已经终止的 Agent 加入 finished 集合
    for (const [name, state] of this.agents) {
      if (state.status === "completed" || state.status === "failed" || state.status === "cancelled") {
        finished.add(name)
        if (state.status === "failed" || state.status === "cancelled") {
          failed.add(name)
        }
      }
    }

    while (finished.size < this.agents.size) {
      const batch: string[] = []
      for (const [name, state] of this.agents) {
        if (finished.has(name)) continue
        // 如果任何依赖已失败/取消，将该 Agent 标记为失败（快速失败）
        const hasFailedDep = state.dependsOn.some((dep) => failed.has(dep))
        if (hasFailedDep) {
          state.status = "failed"
          finished.add(name)
          failed.add(name)
          continue
        }
        if (state.dependsOn.every((dep) => finished.has(dep))) {
          batch.push(name)
        }
      }
      if (batch.length === 0 && finished.size < this.agents.size) {
        throw new Error("Circular dependency detected in agent synthesis graph")
      }
      if (batch.length > 0) {
        batches.push(batch)
        for (const name of batch) finished.add(name)
      }
    }

    return batches
  }

  /**
   * 为某个 Agent 注入上下文（从已完成的 Agent 获取结果）
   */
  injectContext(agentName: string): string | undefined {
    const state = this.agents.get(agentName)
    if (!state) return undefined

    const contextParts: string[] = []
    for (const source of state.contextFrom) {
      const result = this.results.get(source)
      if (result) {
        contextParts.push(`--- Context from ${source} ---\n${result}`)
      }
    }
    return contextParts.length > 0 ? contextParts.join("\n\n") : undefined
  }

  /**
   * 记录 Agent 执行结果
   */
  recordResult(name: string, result: string, tokenUsage?: { input: number; output: number }): void {
    const state = this.agents.get(name)
    if (!state) return
    state.status = "completed"
    state.completedAt = Date.now()
    state.resultSummary = result.slice(0, 500)
    state.tokenUsage = tokenUsage
    this.results.set(name, result)
  }

  /**
   * 记录 Agent 执行失败（供失败策略与测试用例使用）
   */
  recordFailure(name: string, error: Error): void {
    const state = this.agents.get(name)
    if (!state) return
    state.status = "failed"
    state.completedAt = Date.now()
    state.resultSummary = `ERROR: ${error.message}`
  }

  /**
   * 获取 Agent 当前状态（供 Inspector/测试断言使用）
   */
  getAgentState(name: string): SynthesizedAgentState | undefined {
    return this.agents.get(name)
  }

  /**
   * 获取完整的编排报告（用于审计和 Inspector 展示）
   */
  getOrchestrationReport(): OrchestrationReport {
    const phases = new Map<number, string[]>()
    for (const [name, state] of this.agents) {
      const phaseAgents = phases.get(state.phase) ?? []
      phaseAgents.push(name)
      phases.set(state.phase, phaseAgents)
    }

    return {
      totalAgents: this.agents.size,
      phases: Array.from(phases.entries())
        .sort(([a], [b]) => a - b)
        .map(([phase, agents]) => ({
          phase,
          agents: agents.map((name) => {
            const state = this.agents.get(name)
            return { name, status: state?.status ?? "unknown", role: state?.blueprint.role ?? "" }
          }),
        })),
      totalTokens: Array.from(this.agents.values())
        .reduce((sum, s) => sum + (s.tokenUsage?.input ?? 0) + (s.tokenUsage?.output ?? 0), 0),
    }
  }
}

interface OrchestrationReport {
  totalAgents: number
  phases: Array<{
    phase: number
    agents: Array<{ name: string; status: string; role: string }>
  }>
  totalTokens: number
}
```

##### Agent 合成流水线的错误处理

当合成 Agent 在执行过程中失败时，编排器按照 `failurePolicy` 执行不同策略：

```
合成流水线错误处理决策树
═══════════════════════════════════════════════════════════════

Agent X 执行失败（超时/LLM 错误/工具异常）
  │
  ├── failurePolicy = "retry_once"
  │   └── 重试一次（使用相同 blueprint）
  │       ├── 重试成功 → 继续正常流程
  │       └── 重试失败 → 按 "abort_all" 处理
  │
  ├── failurePolicy = "skip_failed"
  │   └── 将 Agent X 标记为 failed
  │       └── 依赖 Agent X 的下游 Agent:
  │           ├── contextFrom 包含 X → 使用部分上下文继续（标注缺失来源）
  │           └── dependsOn 包含 X → 跳过（也标记为 failed）
  │
  └── failurePolicy = "abort_all"（默认）
      └── 终止整个合成流水线
          └── 向 Sisyphus 返回错误报告（含已完成的部分结果）
```

**推荐策略配置**：

| Agent 类型 | 推荐策略 | 理由 |
|-----------|---------|------|
| 信息收集型（web-researcher, code-analyzer） | `skip_failed` | 部分信息仍有价值 |
| 核心分析型（zig-expert, wasm-expert） | `abort_all` | 缺失核心分析则结论不可靠 |
| 网络敏感型（web-researcher） | `retry_once` | 网络波动常见，重试成本低 |
| 验证型（verification） | `abort_all` | 验证不可跳过 |

Sisyphus 生成的 `promptCore` 质量直接决定合成 Agent 的效果。以下是 Prompt 生成的指导框架：

```
┌──────────────────────────────────────────────────────────────┐
│  System Prompt 自动生成决策树                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  需求分析完成 → 确定 Agent 角色                              │
│       │                                                      │
│       ├─ 是否需要最新信息？                                  │
│       │   ├─ YES → 生成联网搜索指令段                        │
│       │   │         "Search for: [specific query terms]"     │
│       │   │         "Focus on: [date range, official sources]"│
│       │   └─ NO  → 依赖模型内置知识                          │
│       │                                                      │
│       ├─ 是否需要代码分析？                                  │
│       │   ├─ YES → 生成代码分析指令段                        │
│       │   │         "Clone [repo] and analyze [specific dirs]"│
│       │   │         "Look for: [patterns, dependencies]"     │
│       │   └─ NO  → 跳过                                      │
│       │                                                      │
│       ├─ 是否参与圆桌？                                      │
│       │   ├─ YES → 生成圆桌行为指令段                        │
│       │   │         "When debating: [cite evidence, not opinions]"│
│       │   │         "Push back on: [weak arguments from others]"│
│       │   │         "Acknowledge: [when others make better points]"│
│       │   └─ NO  → 独立执行指令                              │
│       │                                                      │
│       ├─ 输出格式？                                          │
│       │   ├─ 报告 → "Output as structured markdown report"   │
│       │   ├─ 清单 → "Output as actionable checklist"         │
│       │   ├─ 对话 → "Respond conversationally"               │
│       │   └─ JSON → "Output as JSON matching schema: {...}"  │
│       │                                                      │
│       └─ 约束边界？                                          │
│           → "Stay within: [domain scope]"                    │
│           → "Do NOT: [out-of-scope actions]"                 │
│           → "If unsure: [flag for moderator, don't guess]"   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Prompt 模板组装示例**：

```typescript
/**
 * 为 "zig-expert" 角色自动组装 system prompt
 */
function assemblePrompt(analysis: RequirementAnalysis, role: "zig-expert"): string {
  return `<Role>
You are a Zig language and compiler infrastructure expert.
</Role>

<Expertise>
Deep knowledge of:
- Zig compiler architecture (self-hosted compiler, LLVM backend, stage1/stage2/stage3)
- Cross-compilation targets: wasm32-wasi, wasm32-freestanding, x86_64, aarch64
- build.zig build system internals
- Zig ↔ C interop (@cImport, translate-c, linking C libraries)
- Memory management: allocators, ArenaAllocator, GeneralPurposeAllocator
- Zig standard library (std.os, std.net, std.io) platform abstractions
</Expertise>

<Task>
Analyze whether Bun's Zig codebase can be compiled to a WebAssembly target.
Focus on:
1. build.zig configuration — is wasm32 a viable target or are there hardcoded assumptions?
2. Platform-specific code paths — how much code uses std.os.linux.* or std.os.darwin.*?
3. C dependency compilation — can Bun's C deps (boringssl, mimalloc, etc.) cross-compile to wasm32?
4. LLVM backend limitations for wasm32-wasi
</Task>

<Context>
${/* injected from Phase 1 agents */ ""}
</Context>

<RoundtableRules>
When participating in the roundtable discussion:
- ALWAYS cite specific source code paths or documentation
- If another expert makes a claim about Zig, VERIFY it or CHALLENGE it with evidence
- Distinguish between "impossible today" and "difficult but achievable"
- Acknowledge when a WASM expert or Doc expert makes a point that changes your assessment
</RoundtableRules>

<Constraints>
- Stay focused on Zig compilation and build system aspects
- Do NOT speculate about JavaScript engine internals (leave that to WASM expert)
- If you encounter unfamiliar code, say "I need to examine [file]" rather than guessing
- Token budget: 16000, Turn limit: 5
</Constraints>`
}
```

#### 10.5.9 安全模型与资源治理

```typescript
// packages/agent/src/synthesis/safety.ts

/**
 * 合成安全策略
 *
 * 动态创建 Agent 是高权限操作——需要严格的安全边界。
 * 类似 Docker 的 --cap-add/--cap-drop，合成 Agent 只能获得
 * 被显式授予的能力。
 */

export interface SynthesisSafetyPolicy {
  /** 全局工具白名单——合成 Agent 不能使用白名单外的工具 */
  toolWhitelist: Set<string>

  /** 全局工具黑名单——即使白名单允许，这些工具也不给合成 Agent */
  toolBlacklist: Set<string>

  /** 单个合成 Agent 的资源限制 */
  perAgentLimits: {
    maxTokens: number        // 单 Agent 最大 token 使用量
    maxTurns: number         // 单 Agent 最大轮次
    maxDurationMs: number    // 单 Agent 最大执行时间
  }

  /** 整体合成任务的资源限制 */
  totalLimits: {
    maxAgents: number        // 单次合成最多创建多少 Agent
    maxTotalTokens: number   // 所有合成 Agent 的 token 总量上限
    maxTotalDurationMs: number // 全部合成任务的执行时间上限
    maxConcurrent: number    // 最大并行 Agent 数
  }

  /** 是否需要用户确认 */
  requireConfirmation: "always" | "expensive_only" | "never"

  /** "expensive" 的阈值 */
  expensiveThreshold: {
    agentCount: number       // 超过 N 个 Agent 视为 expensive
    estimatedTokens: number  // 预估 token 超过 N 视为 expensive
  }
}

/**
 * 默认安全策略——保守的默认值
 */
export const DEFAULT_SAFETY_POLICY: SynthesisSafetyPolicy = {
  toolWhitelist: new Set([
    "read_file", "grep", "glob", "bash",
    "websearch", "fetch_webpage",
    "lsp_diagnostics", "lsp_references",
    "ast_grep",
  ]),
  toolBlacklist: new Set([
    "write_file",     // 合成 Agent 不能写文件（除非显式授权）
    "edit_file",      // 合成 Agent 不能编辑文件
    "delete_file",    // 合成 Agent 不能删除文件
  ]),
  perAgentLimits: {
    maxTokens: 32_000,
    maxTurns: 30,
    maxDurationMs: 5 * 60 * 1000,  // 5 分钟
  },
  totalLimits: {
    maxAgents: 10,
    maxTotalTokens: 200_000,
    maxTotalDurationMs: 30 * 60 * 1000,  // 30 分钟
    maxConcurrent: 5,
  },
  requireConfirmation: "expensive_only",
  expensiveThreshold: {
    agentCount: 5,
    estimatedTokens: 100_000,
  },
}
```

**用户确认交互**：

```
┌──────────────────────────────────────────────────────────────┐
│  🔬 Agent Synthesis — Confirmation Required                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Sisyphus wants to create 7 specialized agents:              │
│                                                              │
│  Phase 1 (parallel):                                         │
│    🔍 bun-researcher    — Web research, Bun architecture     │
│    📂 bun-code-analyzer — Clone & analyze Bun source code    │
│    📚 librarian         — (existing agent, reused)           │
│                                                              │
│  Phase 2 (roundtable, after Phase 1):                        │
│    🦎 zig-expert        — Zig compilation analysis           │
│    🧊 wasm-expert       — WASM platform constraints          │
│    📋 doc-expert        — Documentation & architecture       │
│    🔴 verification      — Conclusion verification            │
│    🎙 moderator         — Roundtable orchestration           │
│                                                              │
│  Estimated cost:                                             │
│    Tokens: ~120k (input) + ~40k (output) ≈ $2.50            │
│    Time: ~8-15 minutes                                       │
│    Models: claude-opus-4-6 (×3), claude-sonnet-4-6 (×3),    │
│            claude-haiku-4-5 (×1)                             │
│                                                              │
│  [✅ Approve]  [✏️ Edit Agents]  [❌ Cancel]                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### 10.5.10 合成 Agent 复用与学习

```typescript
// packages/agent/src/synthesis/agent-cache.ts

/**
 * Agent 蓝图缓存
 *
 * 成功的合成 Agent 蓝图可以被缓存，下次遇到类似需求时直接复用。
 * 类似于编程中的 "memoization"——相同的输入产生相同的 Agent。
 */

export interface CachedBlueprint {
  /** 蓝图内容 */
  blueprint: AgentBlueprint
  /** 触发此蓝图的需求模式（用于匹配） */
  triggerPattern: {
    /** 需求中的关键词 */
    keywords: string[]
    /** 需求的能力类型 */
    capabilityTypes: string[]
    /** 需求的复杂度 */
    complexity: string
  }
  /** 成功执行次数 */
  successCount: number
  /** 失败执行次数 */
  failureCount: number
  /** 平均评分（用户反馈或自动评估） */
  avgScore: number
  /** 最后使用时间 */
  lastUsedAt: number
  /** 平均 token 消耗 */
  avgTokenUsage: number
}

/**
 * 蓝图匹配与推荐
 *
 * 当 Sisyphus 分析新需求时，先检查缓存中是否有可复用的蓝图。
 * 匹配策略：关键词重叠 + 能力类型匹配 + 成功率加权。
 */
export function findReusableBlueprints(
  requirements: RequirementAnalysis,
  cache: CachedBlueprint[],
): CachedBlueprint[] {
  return cache
    .filter((cached) => {
      // 能力类型至少 50% 重叠
      const reqTypes = new Set(requirements.requiredCapabilities.map((c) => c.type))
      const cachedTypes = new Set(cached.triggerPattern.capabilityTypes)
      const overlap = [...reqTypes].filter((t) => cachedTypes.has(t)).length
      return overlap / reqTypes.size >= 0.5
    })
    .filter((cached) => {
      // 成功率 > 60%
      const total = cached.successCount + cached.failureCount
      return total === 0 || cached.successCount / total > 0.6
    })
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 3)
}
```

#### 10.5.11 与现有系统的集成点

```
                        ┌─────────────────────────┐
                        │      Sisyphus (主Agent)   │
                        │                         │
                        │  接收用户需求           │
                        │       │                 │
                        │  analyze_requirements   │ ← 新增工具
                        │       │                 │
                        │  matchExistingAgents    │ ← 筛选现有 Agent
                        │       │                 │
                        │  ┌────▼────┐            │
                        │  │ 需要    │            │
                        │  │ 合成？  │            │
                        │  └───┬─────┘            │
                        │      │                  │
                        └──────┼──────────────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
         NO: 正常路径    PARTIAL: 混合      YES: 全合成
         delegate_task   现有 + 合成        synthesize_agent
         (existing agent) Agent 混合编排    + SynthesisOrchestrator
               │               │               │
               ▼               ▼               ▼
        ┌──────────┐    ┌──────────┐    ┌──────────────┐
        │ 现有 Agent│    │ 混合执行 │    │ 合成编排执行 │
        │ 执行任务  │    │          │    │              │
        └──────────┘    └──────────┘    │ Phase 1: 信息收集│
                                        │ Phase 2: 专家分析│
                                        │ Phase 3: 圆桌验证│
                                        │ Phase 4: 结论综合│
                                        └──────────────┘
                                               │
                  ┌────────────────────────────┐│
                  │    集成点                    ││
                  │                              ││
                  │  1. delegate-task 工具       ││ ← 合成 Agent 通过 delegate_task 执行
                  │  2. BackgroundManager        ││ ← 并行 Agent 通过 background 管理
                  │  3. Hook 系统                ││ ← 合成事件触发 hook
                  │  4. Inspector (10.3)         ││ ← 合成 Agent 可视化展示
                  │  5. 断点系统 (10.4)          ││ ← 合成 Agent 可设断点调试
                  │  6. LogBroadcastHub (10.2)   ││ ← 合成 Agent 日志实时推送
                  │  7. Category 系统            ││ ← 合成 Agent 的模型通过 Category 解析
                  │                              ││
                  └────────────────────────────┘│
```

#### 10.5.12 与 10.1 三模式编排的关系

10.1 讨论的三模式编排（圆桌/Plan/Build）与本节的 Agent 合成是**正交但互补**的两个维度：

| 维度 | 10.1 三模式编排 | 10.5 Agent 合成 |
|------|----------------|----------------|
| **解决的问题** | 如何执行（讨论/计划/实施） | 谁来执行（现有 Agent / 新合成 Agent） |
| **Agent 来源** | 预定义 Agent 列表 | 动态合成 + 预定义混合 |
| **决策时机** | 请求分类后 | Agent 匹配后 |
| **组合使用** | 合成的圆桌 Agent Team 使用 Roundtable 模式执行 | 三模式选择可以考虑合成 Agent 的能力 |

**组合示例**：

```
用户: "分析 Bun 是否可编译成 WASM"

Step 1 - 模式选择 (10.1):
  → 复杂度: expert → 选择 Roundtable 模式

Step 2 - Agent 匹配 (10.5):
  → matchExistingAgents → needsSynthesis: true
  → 合成 5 个专家 Agent

Step 3 - 组合执行:
  → Phase 1: 信息收集 Agent (Build 模式, 并行)
  → Phase 2: 专家圆桌讨论 (Roundtable 模式, 合成 Agent Team)
  → Phase 3: 结论综合 (单 Agent, Build 模式)
```

#### 10.5.13 Inspector 面板扩展

在 10.3 Inspector 的基础上，为 Agent 合成增加一个新面板：

```
┌───────────────────────────────────────────────────────────────────┐
│  vitamin DevTools Inspector — Agent Synthesis                     │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─ 合成编排图 ──────────────────────────────────────────────┐    │
│  │                                                            │    │
│  │  Phase 1 (信息收集)          Phase 2 (圆桌)                │    │
│  │                                                            │    │
│  │  ┌────────────┐              ┌───────────┐                │    │
│  │  │ bun-       │ ─┐           │ zig-      │                │    │
│  │  │ researcher │  │    ┌─────→│ expert    │                │    │
│  │  │ ✅ 完成    │  │    │      │ 🔄 进行中 │                │    │
│  │  └────────────┘  │    │      └───────────┘                │    │
│  │                   ├────┤                                    │    │
│  │  ┌────────────┐  │    │      ┌───────────┐                │    │
│  │  │ bun-code-  │  │    ├─────→│ wasm-     │                │    │
│  │  │ analyzer   │ ─┤    │      │ expert    │                │    │
│  │  │ ✅ 完成    │  │    │      │ ⏳ 等待中 │                │    │
│  │  └────────────┘  │    │      └───────────┘                │    │
│  │                   │    │                                    │    │
│  │  ┌────────────┐  │    │      ┌───────────┐    ┌─────────┐│    │
│  │  │ librarian  │ ─┘    ├─────→│ doc-      │───→│moderator││    │
│  │  │ (现有)     │       │      │ expert    │    │ (总结)  ││    │
│  │  │ ✅ 完成    │       │      │ ⏳ 等待中 │    │ ⏳ 等待 ││    │
│  │  └────────────┘       │      └───────────┘    └─────────┘│    │
│  │                        │                                    │    │
│  │                        │      ┌─────────────┐              │    │
│  │                        └─────→│ verification│              │    │
│  │                               │ expert      │              │    │
│  │                               │ ⏳ 等待中   │              │    │
│  │                               └─────────────┘              │    │
│  │                                                            │    │
│  │  总进度: ██████░░░░ 3/8 (37%)  Token: 45.2k / 200k       │    │
│  │                                                            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─ 选中 Agent: zig-expert (合成) ────────────────────────────┐    │
│  │                                                            │    │
│  │  状态: 🔄 Running (Turn 2/5)                              │    │
│  │  模型: claude-opus-4-6                                    │    │
│  │  Token: 8.2k in / 3.1k out                               │    │
│  │                                                            │    │
│  │  System Prompt (点击展开):                                 │    │
│  │  ┌────────────────────────────────────────────────────┐    │    │
│  │  │ <Role>                                             │    │    │
│  │  │ You are a Zig language and compiler infrastructure │    │    │
│  │  │ expert.                                            │    │    │
│  │  │ </Role>                                            │    │    │
│  │  │ ...                                                │    │    │
│  │  └────────────────────────────────────────────────────┘    │    │
│  │                                                            │    │
│  │  注入上下文 (来自 Phase 1):                                │    │
│  │  • bun-researcher: Bun 使用 Zig 编写核心...              │    │
│  │  • bun-code-analyzer: build.zig 分析—目标三元组...       │    │
│  │                                                            │    │
│  │  [🔴 设置断点]  [⏸ 暂停]  [📋 复制 Prompt]               │    │
│  │                                                            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

#### 10.5.14 实现路径与工作量

| 阶段 | 内容 | 工作量 | 依赖 |
|------|------|--------|------|
| **Phase A** | `RequirementAnalysis` + `matchExistingAgents` 能力筛选 | ~3 天 | Agent metadata 体系 |
| **Phase B** | `AgentBlueprint` + `synthesizeAgent` 蓝图→配置转化 | ~3 天 | Phase A |
| **Phase C** | `synthesize_agent` + `analyze_requirements` 工具注册 | ~2 天 | Phase B |
| **Phase D** | Sisyphus prompt 增强：合成决策段 | ~2 天 | Phase C |
| **Phase E** | `SynthesisOrchestrator` 多阶段依赖编排 | ~4 天 | Phase B |
| **Phase F** | 安全策略 + 资源限额 + 用户确认交互 | ~2 天 | Phase E |
| **Phase G** | `CachedBlueprint` 蓝图缓存与复用 | ~2 天 | Phase E |
| **Phase H** | Inspector 合成面板（前端） | ~4 天 | Phase E, 10.3 |
| **合计** | | **~22 天** | 核心（Phase A-E）~14 天 |

**风险与开放问题**：

1. **Prompt 质量**：Sisyphus 生成的 `promptCore` 质量高度依赖 Sisyphus 本身的 LLM 能力。如果 Sisyphus 用的是 Haiku 级模型，生成的专家 prompt 可能不够专业。**缓解**：对 Sisyphus 的 synthesize_agent 调用强制使用高端模型
2. **成本控制**：一个复杂需求可能创建 7-10 个 Agent，每个消耗 10k-30k token，总成本可能达 $2-5。**缓解**：默认要求 `expensive_only` 确认，显示预估成本
3. **幻觉风险**：合成的 "Zig 专家" Agent 仍然是 LLM，可能输出看似专业但实际错误的分析。**缓解**：`verification-expert` 的存在就是为了对抗幻觉，但验证专家本身也可能犯错
4. **循环依赖检测**：Agent 合成的依赖图可能出现循环。**缓解**：`computeExecutionBatches` 已包含循环检测
5. **上下文窗口压力**：Phase 2 的 Agent 需要注入 Phase 1 的结果作为上下文，如果 Phase 1 结果太长，可能超出上下文窗口。**缓解**：对注入上下文做摘要压缩（复用第五部分的 Compaction 策略）
6. **与 MCP 的关系**：如果需要的能力不在系统工具集内（如 "调用 Jira API 查询 issue"），合成 Agent 也无法获得。**缓解**：未来可考虑让 `synthesize_agent` 动态加载 MCP 服务器（但安全风险更大）

**结论**：自主 Agent 合成是 vitamin 从"**固定 Agent 矩阵**"进化为"**需求驱动的动态 Agent 网络**"的关键一步。通过 `analyze_requirements → matchExistingAgents → synthesizeAgent → SynthesisOrchestrator` 的四步流水线，主 Agent 可以根据需求自主组建专家团队，再结合 10.1 的三模式编排执行。这使得系统的能力边界从"开发者预定义了什么"扩展为"LLM 能想到什么"。建议在核心功能（Part 1-6）稳定后，作为 Phase 5+ 的高级特性开发。

### 10.5.15 试验性特性的配置 Schema

Part 10 的 6 个试验性特性需要对应的配置 Schema，以纳入 `@vitamin/config` 的统一配置体系。以下定义所有试验性特性的配置接口：

```typescript
// packages/config/src/schema/experimental-features-schema.ts

import { z } from "zod/v4"

/**
 * 10.1 圆桌讨论配置
 */
export const RoundtableConfigSchema = z.object({
  /** 默认最大讨论轮数 */
  max_rounds: z.number().int().min(1).max(20).default(5),
  /** 是否启用自动意图检测（圆桌 vs Plan） */
  auto_detect: z.boolean().default(true),
  /** 默认参与角色 */
  default_participants: z.array(z.string()).default(["architect", "implementer", "reviewer", "user-advocate"]),
  /** 讨论超时（ms） */
  timeout_ms: z.number().default(10 * 60 * 1000),
})

/**
 * 10.3 Inspector 配置
 */
export const InspectorConfigSchema = z.object({
  /** Inspector 服务端口 */
  port: z.number().int().min(1024).max(65535).default(6274),
  /** 是否启用认证 */
  auth_enabled: z.boolean().default(true),
  /** 认证 token（启用认证时必填，自动生成） */
  auth_token: z.string().optional(),
  /** 允许访问的 IP 范围（CIDR 格式） */
  allowed_ips: z.array(z.string()).default(["127.0.0.1/32", "::1/128"]),
  /** 是否自动打开浏览器 */
  auto_open: z.boolean().default(true),
})

/**
 * 10.4 断点引擎配置
 */
export const BreakpointConfigSchema = z.object({
  /** checkpoint 检查超时（ms），超时自动 continue */
  checkpoint_timeout_ms: z.number().default(30 * 60 * 1000),
  /** 同时允许的最大暂停数 */
  max_concurrent_pauses: z.number().int().min(1).default(10),
  /** 条件断点表达式最大长度 */
  max_condition_length: z.number().int().default(500),
  /** 条件断点执行超时（ms） */
  condition_eval_timeout_ms: z.number().default(100),
})

/**
 * 10.5 Agent 合成配置
 */
export const SynthesisConfigSchema = z.object({
  /** 安全策略覆盖 */
  safety_policy: z.object({
    tool_whitelist: z.array(z.string()).optional(),
    tool_blacklist: z.array(z.string()).optional(),
    per_agent_max_tokens: z.number().default(32_000),
    per_agent_max_turns: z.number().default(30),
    per_agent_max_duration_ms: z.number().default(5 * 60 * 1000),
    max_agents: z.number().default(10),
    max_total_tokens: z.number().default(200_000),
    max_concurrent: z.number().default(5),
  }).optional(),
  /** 用户确认策略 */
  require_confirmation: z.enum(["always", "expensive_only", "never"]).default("expensive_only"),
  /** expensive 阈值 */
  expensive_threshold_agents: z.number().default(5),
  expensive_threshold_tokens: z.number().default(100_000),
})

/**
 * 10.6 Escalation 配置
 */
export const EscalationConfigSchema = z.object({
  /** 冒泡深度上限 */
  max_bubble_depth: z.number().int().min(1).max(10).default(3),
  /** 自动解决器配置 */
  auto_resolver: z.object({
    /** 是否启用自动解决器 */
    enabled: z.boolean().default(true),
    /** 自动解决器超时（ms） */
    timeout_ms: z.number().default(60_000),
  }).default({}),
  /** 协商配置 */
  negotiation: z.object({
    /** 默认协商最大轮数 */
    max_rounds: z.number().int().min(1).max(10).default(3),
    /** 协商失败默认降级策略 */
    fallback: z.enum(["escalate_to_parent", "mediator_decision", "initiator_priority", "replan_with_sequence"]).default("escalate_to_parent"),
  }).default({}),
})

/**
 * 试验性特性总配置（合并到 @vitamin/config 根 Schema）
 */
export const ExperimentalFeaturesSchema = z.object({
  roundtable: RoundtableConfigSchema.optional(),
  inspector: InspectorConfigSchema.optional(),
  breakpoints: BreakpointConfigSchema.optional(),
  synthesis: SynthesisConfigSchema.optional(),
  escalation: EscalationConfigSchema.optional(),
}).optional()
```

### 10.6 单向数据流与上行反馈：Agent 的异常冒泡与重规划机制

#### 10.6.1 问题提出：当前的单向命令链为何不够

当前 vitamin（以及 oh-my-opencode）的 Agent 通信是**严格的单向命令链**：

```
Sisyphus ──task()──→ 子 Agent Session ──执行──→ 返回文本结果
   │                                                  │
   │          信息流方向: 自顶向下（命令），自底向上（结果）       │
   │                                                  │
   └──────────────── 读取结果文本 ◄────────────────────┘
```

这个模型足以处理"**子任务明确且子 Agent 能力充分**"的场景。但当以下情况出现时，它就显得力不从心：

**场景 1：需求歧义——"我不确定你要什么"**

```
Sisyphus: "重构 UserService 的认证逻辑"
  │
  └→ Hephaestus（执行 Agent）:
       → 发现 UserService 有 3 种认证策略 (JWT, OAuth, Session)
       → 需求没说重构哪种，还是全部重构？
       → 需求没说目标架构（策略模式？中间件？）
       → 🤷 只能猜测 → 猜错了 → 浪费 token → 结果被拒
```

**场景 2：能力不足——"这超出了我的能力"**

```
Atlas (Plan 执行器): "执行 Task 3: 优化数据库查询"
  │
  └→ Category Worker (deep):
       → 分析后发现需要修改 3 个微服务的 GraphQL schema
       → 这需要全局架构理解，不应该由单个 worker 决定
       → 但 worker 无法"升级"给 Atlas，只能在输出里写"建议..."
       → Atlas 可能忽略这个建议（因为它只看成功/失败）
```

**场景 3：结论冲突——"我发现计划有问题"**

```
Metis (Plan Agent): 制定了 5 步计划
  │
  └→ Atlas 开始执行:
       → Task 1 完成 ✅
       → Task 2 完成 ✅
       → Task 3 执行中... 发现 Task 1 的实现与 Task 4 的前提假设矛盾
       → 但 Atlas 只能继续执行或放弃，不能回溯修改 Task 1
       → 也不能要求 Metis 重新规划
```

**核心问题**：当前系统缺乏 React 式的**"状态提升"（Lifting State Up）**机制——子组件发现的问题无法系统性地冒泡到父组件触发重新渲染。

#### 10.6.2 设计灵感：React 单向数据流的映射

React 的单向数据流模型给了我们重要启示：

```
React 世界                          Agent 世界
─────────────────────────────────────────────────────────
Props 向下传递                      任务指令 + 上下文向下委派
  │                                   │
State 在组件内管理                  Agent 内部执行状态
  │                                   │
事件向上冒泡 (onChange, onError)    ❌ 当前缺失：问题/疑问向上反馈
  │                                   │
父组件决策 → 更新 State → 重新渲染  父 Agent 决策 → 重新规划 → 重新执行
```

**React 的关键设计原则及其 Agent 映射**：

| React 原则 | Agent 映射 | 当前状态 |
|-----------|-----------|---------|
| **单向数据流** | 指令自顶向下，反馈自底向上 | ✅ 下行有，❌ 上行缺失 |
| **状态提升** | 子 Agent 无法自行决策时，将问题提升到有足够上下文的父 Agent | ❌ 不存在 |
| **受控组件** | 子 Agent 的关键决策由父 Agent 控制 | 部分（Prompt 约束） |
| **错误边界** | Agent 执行错误被捕获并冒泡到能处理的层级 | ❌ 仅文本返回 |
| **纯组件** | 相同输入 → 相同输出，子 Agent 不产生全局副作用 | 部分（工具调用有副作用） |
| **Context** | 跨层级共享信息（不需要逐层传递） | ❌ 仅靠 Prompt 注入 |

#### 10.6.3 Agent 上行反馈协议（Escalation Protocol）

```typescript
// packages/agent/src/escalation/escalation-types.ts

/**
 * Agent 上行反馈协议
 *
 * 类比 React: 子组件通过 onChange/onError 事件向上冒泡
 * 类比 Exception: 子函数 throw → 调用栈向上传播 → 某一层 catch 处理
 *
 * 设计选择：不使用异常机制（打断执行流），而是使用**结构化信号**:
 * - 子 Agent 发出 EscalationSignal
 * - 框架将 Signal 传递给父 Agent
 * - 父 Agent 决定响应策略（回答问题 / 重新规划 / 继续 / 中止）
 * - 响应以 EscalationResponse 形式传回子 Agent
 */

// ── 上行信号：子 Agent → 父 Agent ──

export type EscalationSignal =
  | ClarificationRequest    // "我不确定需求，请澄清"
  | CapabilityEscalation    // "这超出了我的能力范围"
  | ConflictReport          // "我发现了计划/事实冲突"
  | ProgressBlock           // "我被某个问题卡住了"
  | ConclusionChallenge     // "我对结论有疑问，需要验证"
  | ResourceExhaustion      // "我的 token/轮次即将耗尽但任务未完成"

/** 1. 澄清请求——"需求不明确，请回答我的问题" */
export interface ClarificationRequest {
  type: "clarification"
  priority: EscalationPriority

  /** 需要澄清的具体问题 */
  questions: Array<{
    question: string
    /** 子 Agent 自己的猜测（如果有） */
    tentativeAnswer?: string
    /** 此问题影响的后续决策 */
    impactedDecisions: string[]
  }>

  /** 当前执行到哪一步了 */
  currentProgress: string
  /** 如果不澄清，子 Agent 打算怎么做（默认行为） */
  fallbackPlan?: string
}

/** 2. 能力升级——"这需要其他 Agent 或更高权限" */
export interface CapabilityEscalation {
  type: "capability"
  priority: EscalationPriority

  /** 缺少的能力 */
  missingCapability: string
  /** 为什么需要这个能力 */
  reason: string
  /** 建议的解决方式 */
  suggestion:
    | { action: "delegate_to"; agentType: string; reason: string }
    | { action: "grant_tool"; toolName: string; reason: string }
    | { action: "escalate_to_user"; question: string }
    | { action: "synthesize_agent"; blueprint: string }

  currentProgress: string
}

/** 3. 冲突报告——"我发现了计划或事实的矛盾" */
export interface ConflictReport {
  type: "conflict"
  priority: EscalationPriority

  /** 冲突的两方 */
  parties: {
    /** 冲突方 A（如"Task 1 的实现"） */
    sideA: { source: string; claim: string }
    /** 冲突方 B（如"Task 4 的前提假设"） */
    sideB: { source: string; claim: string }
  }

  /** 冲突的严重程度 */
  severity: "blocks_current_task" | "blocks_future_task" | "inconsistency_only"
  /** 子 Agent 的分析 */
  analysis: string
  /** 建议的解决方案 */
  suggestedResolution?: string
}

/** 4. 进度阻塞——"我卡在某个问题上" */
export interface ProgressBlock {
  type: "blocked"
  priority: EscalationPriority

  /** 阻塞原因 */
  blockingIssue: string
  /** 已尝试的解决方案 */
  attemptedSolutions: string[]
  /** 需要的帮助类型 */
  helpNeeded: string

  currentProgress: string
  /** 已消耗的 token */
  tokenUsed: number
}

/** 5. 结论质疑——"我对当前方向有疑问" */
export interface ConclusionChallenge {
  type: "challenge"
  priority: EscalationPriority

  /** 被质疑的结论/方向 */
  challengedClaim: string
  /** 质疑依据 */
  evidence: string
  /** 影响范围 */
  impactAssessment: string
  /** 建议的替代方向 */
  alternativeProposal?: string
}

/** 6. 资源耗尽——"我快要用完额度了" */
export interface ResourceExhaustion {
  type: "resource_exhaustion"
  priority: "high"

  /** 哪种资源即将耗尽 */
  resource: "tokens" | "turns" | "time"
  /** 当前使用量 */
  current: number
  /** 上限 */
  limit: number
  /** 任务完成度估计 */
  completionEstimate: string
  /** 需要的额外资源 */
  requestedExtension: number
}

export type EscalationPriority = "low" | "medium" | "high" | "critical"

// ── 下行响应：父 Agent → 子 Agent ──

export type EscalationResponse =
  | AnswerResponse          // 回答问题
  | ReplanResponse          // 重新规划（要求子 Agent 按新计划执行）
  | ContinueResponse        // 继续（按你的判断走）
  | AbortResponse           // 中止此任务
  | DelegateResponse        // 转给其他 Agent 处理
  | ExtendResponse          // 追加资源

/** 回答澄清问题 */
export interface AnswerResponse {
  action: "answer"
  answers: Array<{
    questionRef: string
    answer: string
  }>
  /** 可选：附加指令 */
  additionalGuidance?: string
}

/** 要求重新规划 */
export interface ReplanResponse {
  action: "replan"
  /** 修改后的指令 */
  revisedInstructions: string
  /** 取消哪些后续步骤 */
  cancelledSteps?: string[]
  /** 新增的步骤 */
  newSteps?: string[]
  /** 重规划原因 */
  reason: string
}

/** 确认继续执行 */
export interface ContinueResponse {
  action: "continue"
  /** 使用子 Agent 的 fallbackPlan 还是其他方案 */
  useFallback: boolean
  guidance?: string
}

/** 中止任务 */
export interface AbortResponse {
  action: "abort"
  reason: string
  /** 是否保留已完成的工作 */
  preserveProgress: boolean
}

/** 转交给其他 Agent */
export interface DelegateResponse {
  action: "delegate"
  targetAgent: string
  /** 转交时携带的上下文（含当前 Agent 的进度） */
  handoffContext: string
}

/** 追加资源配额 */
export interface ExtendResponse {
  action: "extend"
  additionalTokens?: number
  additionalTurns?: number
  additionalTimeMs?: number
}
```

#### 10.6.4 上行反馈引擎实现

```typescript
// packages/agent/src/escalation/escalation-engine.ts

import type {
  EscalationSignal,
  EscalationResponse,
  EscalationPriority,
} from "./escalation-types"

/**
 * 上行反馈引擎
 *
 * 核心设计类比：
 * - React: onChange={(value) => setState(value)} → 父组件重新渲染
 * - DOM: event.stopPropagation() / event.preventDefault()
 * - Exception: throw → catch → 决策 → resume
 *
 * vitamin 采用的模型:
 *
 *   子 Agent ──escalate()──→ EscalationEngine ──notify──→ 父 Agent Session
 *       │                         │                            │
 *       │ (await: 挂起等待)        │ (路由 + 策略匹配)           │ (LLM 决策)
 *       │                         │                            │
 *       └──── resume ◄────────────┘──── response ◄─────────────┘
 *
 * 与 10.4 断点引擎的相似性：
 * - 断点引擎: checkpoint() → Promise 挂起 → Inspector resume  → resolve
 * - 反馈引擎: escalate()   → Promise 挂起 → 父 Agent response → resolve
 *
 * 两者都使用 **Promise 挂起** 模式，确保子 Agent 的执行流自然暂停等待决策。
 */

export class EscalationEngine {
  private pendingEscalations: Map<string, PendingEscalation> = new Map()
  private autoResolvers: AutoResolver[] = []
  private listeners = new Set<EscalationEventListener>()

  /**
   * 子 Agent 调用此方法上报问题
   *
   * 返回一个 Promise<EscalationResponse>，子 Agent await 后自然挂起，
   * 直到父 Agent（或自动策略）给出响应。
   *
   * 类比 React: 这就是子组件调用 props.onChange(newValue)
   */
  async escalate(
    signal: EscalationSignal,
    context: EscalationContext,
  ): Promise<EscalationResponse> {
    const id = generateEscalationId()

    // Step 1: 检查是否有自动解决策略
    const autoResponse = this.tryAutoResolve(signal, context)
    if (autoResponse) {
      this.notify({ type: "auto_resolved", id, signal, response: autoResponse })
      return autoResponse
    }

    // Step 2: 创建 pending escalation（Promise 挂起）
    return new Promise<EscalationResponse>((resolve) => {
      this.pendingEscalations.set(id, {
        id,
        signal,
        context,
        resolve,
        createdAt: Date.now(),
      })

      // Step 3: 通知父 Agent session
      this.notify({
        type: "escalation_raised",
        id,
        signal,
        context,
        agentName: context.agentName,
        parentSessionId: context.parentSessionId,
      })
    })
  }

  /**
   * 父 Agent（或编排器）调用此方法响应问题
   *
   * 类比 React: 父组件调用 setState → 触发子组件重新渲染
   */
  respond(escalationId: string, response: EscalationResponse): void {
    const pending = this.pendingEscalations.get(escalationId)
    if (!pending) return

    this.pendingEscalations.delete(escalationId)
    this.notify({
      type: "escalation_resolved",
      id: escalationId,
      signal: pending.signal,
      response,
      durationMs: Date.now() - pending.createdAt,
    })
    pending.resolve(response)
  }

  /**
   * 注册自动解决策略
   *
   * 类比 React: defaultProps / getDerivedStateFromError
   * 某些常见问题不需要等父 Agent LLM 推理，可以用确定性代码自动回答。
   */
  registerAutoResolver(resolver: AutoResolver): void {
    this.autoResolvers.push(resolver)
  }

  private tryAutoResolve(
    signal: EscalationSignal,
    context: EscalationContext,
  ): EscalationResponse | null {
    for (const resolver of this.autoResolvers) {
      const response = resolver(signal, context)
      if (response) return response
    }
    return null
  }

  /** 获取所有待处理的上行反馈 */
  getPendingEscalations(): PendingEscalationInfo[] {
    return Array.from(this.pendingEscalations.values()).map((p) => ({
      id: p.id,
      signal: p.signal,
      agentName: p.context.agentName,
      waitingMs: Date.now() - p.createdAt,
    }))
  }

  /** 超时处理：长时间无响应时自动使用 fallback */
  startTimeoutWatcher(timeoutMs: number = 5 * 60 * 1000): void {
    setInterval(() => {
      const now = Date.now()
      for (const [id, pending] of this.pendingEscalations) {
        if (now - pending.createdAt > timeoutMs) {
          const fallback = this.buildTimeoutFallback(pending.signal)
          this.respond(id, fallback)
          this.notify({ type: "escalation_timeout", id, signal: pending.signal })
        }
      }
    }, 30_000)
  }

  private buildTimeoutFallback(signal: EscalationSignal): EscalationResponse {
    switch (signal.type) {
      case "clarification":
        return {
          action: "continue",
          useFallback: true,
          guidance: "Timeout waiting for clarification. Proceed with your best judgment.",
        }
      case "resource_exhaustion":
        return {
          action: "extend",
          additionalTokens: 10_000,
          additionalTurns: 5,
        }
      default:
        return {
          action: "continue",
          useFallback: false,
          guidance: "Timeout. Proceed with your current approach.",
        }
    }
  }

  onEvent(listener: EscalationEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(event: EscalationEvent): void {
    for (const listener of this.listeners) listener(event)
  }
}

// ── 类型定义 ──

interface PendingEscalation {
  id: string
  signal: EscalationSignal
  context: EscalationContext
  resolve: (response: EscalationResponse) => void
  createdAt: number
}

export interface EscalationContext {
  /** 发出信号的 Agent 名称 */
  agentName: string
  /** 发出信号的 Agent session ID */
  sessionId: string
  /** 父 Agent 的 session ID */
  parentSessionId: string
  /** Agent 在委派链中的深度（Sisyphus=0, 直接子Agent=1, ...） */
  depth: number
  /** 当前任务描述 */
  taskDescription: string
  /** 当前已使用的 token */
  tokenUsed: number
  /** 当前轮次 */
  currentTurn: number
}

interface PendingEscalationInfo {
  id: string
  signal: EscalationSignal
  agentName: string
  waitingMs: number
}

type AutoResolver = (signal: EscalationSignal, context: EscalationContext) => EscalationResponse | null

type EscalationEvent =
  | { type: "escalation_raised"; id: string; signal: EscalationSignal; context: EscalationContext; agentName: string; parentSessionId: string }
  | { type: "escalation_resolved"; id: string; signal: EscalationSignal; response: EscalationResponse; durationMs: number }
  | { type: "escalation_timeout"; id: string; signal: EscalationSignal }
  | { type: "auto_resolved"; id: string; signal: EscalationSignal; response: EscalationResponse }

type EscalationEventListener = (event: EscalationEvent) => void

function generateEscalationId(): string {
  return `esc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
```

#### 10.6.5 子 Agent 的 `escalate` 工具

```typescript
// packages/server/src/tools/escalate/tool-definition.ts

/**
 * escalate 工具——注册给所有子 Agent，使其能够向父 Agent 上报问题
 *
 * 这是"单向数据流"的关键一环：
 * - 指令（Props）向下流：task() → 子 Agent
 * - 反馈（Events）向上流：子 Agent → escalate() → 父 Agent
 *
 * 类比 React: <Child onChange={(v) => parent.setState(v)} />
 * 类比 DOM:   child.dispatchEvent(new CustomEvent('problem', { bubbles: true }))
 */
export const ESCALATE_TOOL = {
  name: "escalate",
  description: `Report a problem, question, or conflict to the parent agent for resolution.
Use this when you encounter situations that exceed your scope or require higher-level decisions.

WHEN TO USE:
- Requirements are ambiguous and you need clarification before proceeding
- The task requires capabilities you don't have (tools, knowledge, access)
- You discover a conflict between the plan and reality
- You're stuck and have exhausted your troubleshooting approaches
- You challenge a conclusion or direction and want it reviewed
- You're running low on tokens/turns and need more to complete

WHEN NOT TO USE:
- The issue is within your capability to resolve independently
- You're simply reporting final results (use normal output instead)
- The question is trivial and you can make a reasonable assumption

BEHAVIOR:
- Your execution PAUSES while waiting for the parent's response
- The parent may answer your questions, revise your instructions, or abort
- After receiving the response, CONTINUE execution with the new guidance`,

  parameters: {
    type: "object",
    required: ["signal_type", "details"],
    properties: {
      signal_type: {
        type: "string",
        enum: ["clarification", "capability", "conflict", "blocked", "challenge", "resource_exhaustion"],
        description: "Type of escalation signal",
      },
      details: {
        type: "object",
        description: "Signal-specific details (questions for clarification, missing capabilities, conflict parties, etc.)",
      },
      priority: {
        type: "string",
        enum: ["low", "medium", "high", "critical"],
        default: "medium",
      },
      current_progress: {
        type: "string",
        description: "Summary of what you've accomplished so far",
      },
      fallback_plan: {
        type: "string",
        description: "What you would do if the parent doesn't respond (optional)",
      },
    },
  },
}
```

#### 10.6.6 父 Agent 的反馈处理流程

当子 Agent 调用 `escalate()` 时，父 Agent session 会收到一条结构化通知，触发 LLM 推理来决策响应：

```typescript
// packages/agent/src/escalation/parent-handler.ts

/**
 * 父 Agent 的反馈处理流程
 *
 *   子 Agent escalate()
 *       │
 *       ▼
 *   EscalationEngine 收到 signal
 *       │
 *       ├─ 匹配 AutoResolver？ ──YES──→ 直接返回自动响应
 *       │
 *       NO
 *       │
 *       ▼
 *   构造反馈通知消息 → 注入父 Agent Session
 *       │
 *       ▼
 *   父 Agent LLM 推理 → 决策响应
 *       │
 *       ├─ "answer"    → 回答问题，子 Agent 继续
 *       ├─ "replan"    → 修改指令，子 Agent 按新指令执行
 *       ├─ "continue"  → 确认继续，使用 fallback 或自行决定
 *       ├─ "abort"     → 中止子任务
 *       ├─ "delegate"  → 将任务转交给另一个 Agent
 *       └─ "extend"    → 追加资源配额
 *       │
 *       ▼
 *   EscalationEngine.respond() → resolve Promise → 子 Agent 恢复执行
 */

/**
 * 构造注入父 Agent session 的反馈通知消息
 */
function buildEscalationNotification(
  escalationId: string,
  signal: EscalationSignal,
  context: EscalationContext,
): string {
  const header = `<escalation id="${escalationId}" from="${context.agentName}" priority="${signal.priority}">`

  switch (signal.type) {
    case "clarification":
      return `${header}
CHILD AGENT NEEDS CLARIFICATION

Agent "${context.agentName}" (task: ${context.taskDescription}) has paused and is asking:

${signal.questions.map((q, i) => `  ${i + 1}. ${q.question}
     Impact: ${q.impactedDecisions.join(", ")}
     ${q.tentativeAnswer ? `My guess: ${q.tentativeAnswer}` : ""}`).join("\n")}

Progress so far: ${signal.currentProgress}
${signal.fallbackPlan ? `Fallback if no answer: ${signal.fallbackPlan}` : ""}

Respond with escalation_respond(id="${escalationId}", action="answer", answers=[...])
Or: action="continue" to let it proceed with its guess
Or: action="replan" to change the instructions
Or: action="abort" to cancel this task
</escalation>`

    case "conflict":
      return `${header}
CHILD AGENT REPORTS A CONFLICT

Agent "${context.agentName}" discovered a contradiction:

  Side A (${signal.parties.sideA.source}): ${signal.parties.sideA.claim}
  Side B (${signal.parties.sideB.source}): ${signal.parties.sideB.claim}

Severity: ${signal.severity}
Analysis: ${signal.analysis}
${signal.suggestedResolution ? `Suggested resolution: ${signal.suggestedResolution}` : ""}

This ${signal.severity === "blocks_current_task" ? "BLOCKS the current task" : "may impact future tasks"}.

Respond with escalation_respond(id="${escalationId}", action="replan", ...)
Or: action="answer" to resolve the conflict
Or: action="abort" to cancel and restructure
</escalation>`

    case "capability":
      return `${header}
CHILD AGENT LACKS REQUIRED CAPABILITY

Agent "${context.agentName}" needs: ${signal.missingCapability}
Reason: ${signal.reason}

Suggested action: ${JSON.stringify(signal.suggestion)}

Respond with escalation_respond(id="${escalationId}", action="delegate", targetAgent=...)
Or: action="answer" with alternative instructions
</escalation>`

    case "blocked":
      return `${header}
CHILD AGENT IS STUCK

Agent "${context.agentName}" is blocked: ${signal.blockingIssue}

Already tried:
${signal.attemptedSolutions.map((s) => `  - ${s}`).join("\n")}

Help needed: ${signal.helpNeeded}
Token used: ${signal.tokenUsed}

Respond with escalation_respond(id="${escalationId}", action="answer", ...)
Or: action="delegate" to hand off to specialist
Or: action="abort" to cut losses
</escalation>`

    case "challenge":
      return `${header}
CHILD AGENT CHALLENGES A CONCLUSION

Agent "${context.agentName}" questions: ${signal.challengedClaim}
Evidence: ${signal.evidence}
Impact: ${signal.impactAssessment}
${signal.alternativeProposal ? `Alternative: ${signal.alternativeProposal}` : ""}

Respond with escalation_respond(id="${escalationId}", action="replan", ...)
Or: action="answer" to overrule the challenge with reasoning
Or: action="continue" to acknowledge but proceed anyway
</escalation>`

    case "resource_exhaustion":
      return `${header}
CHILD AGENT RUNNING OUT OF RESOURCES

Agent "${context.agentName}": ${signal.resource} at ${signal.current}/${signal.limit}
Completion estimate: ${signal.completionEstimate}
Requested extension: +${signal.requestedExtension}

Respond with escalation_respond(id="${escalationId}", action="extend", ...)
Or: action="abort" to stop with current results
</escalation>`
  }
}
```

#### 10.6.7 自顶向下重规划：跨层级的级联效应

当一个深层子 Agent 的上行反馈导致顶层计划失效时，系统需要支持**级联重规划**——类似 React 的"状态更新导致子树重新渲染"：

```
级联重规划 — 类比 React 的子树重渲染
═══════════════════════════════════════════════════════════════

假设委派链: Sisyphus → Atlas → Worker-3 → Sub-worker-A

Sub-worker-A 发现: "Task 1 的实现与 Task 4 的前提假设矛盾"
  │
  escalate(type="conflict", severity="blocks_future_task")
  │
  ▼
Worker-3 收到反馈:
  │
  ├─ Worker-3 能自己解决？
  │   ├─ YES → respond("answer") → Sub-worker-A 继续
  │   └─ NO  → Worker-3 自身也 escalate 给 Atlas
  │            (反馈冒泡——类似 event.bubbles = true)
  │
  ▼
Atlas 收到反馈:
  │
  ├─ Atlas 能在计划层面修复？
  │   ├─ YES → respond("replan"):
  │   │   → 取消 Task 4
  │   │   → 修改 Task 1 的实现约束
  │   │   → 新增 Task 1b 做兼容适配
  │   │   → 重新开始 Task 3 下游
  │   │
  │   └─ NO  → Atlas 也 escalate 给 Sisyphus
  │            (冒泡到最顶层)
  │
  ▼
Sisyphus 收到反馈:
  │
  → 这是全局性问题 → 可能需要:
    → 调用 Metis 重新制定 Plan
    → 调用 Oracle 分析策略
    → 或直接问用户
```

```typescript
// packages/agent/src/escalation/cascade-replanner.ts

/**
 * 级联重规划器
 *
 * 当上行反馈需要修改上游计划时，从触发点开始向上逐层调整:
 *
 *   1. 标记受影响的下游任务为 "invalidated"
 *   2. 请求计划层 Agent (Metis) 根据新信息重新规划
 *   3. 取消正在执行的受影响子 Agent
 *   4. 按新计划重新派发任务
 *
 * 类比 React: setState → shouldComponentUpdate → render(子树)
 */

export interface ReplanTrigger {
  /** 触发重规划的原始 escalation */
  escalationId: string
  /** 受影响的层级 */
  affectedDepth: number
  /** 受影响的任务 ID 列表 */
  invalidatedTasks: string[]
  /** 新发现的约束/事实 */
  newConstraints: string[]
  /** 重规划范围 */
  scope: ReplanScope
}

export type ReplanScope =
  | "local"      // 只影响当前子任务（子 Agent 自行调整）
  | "sibling"    // 影响同级任务（需要编排器 Atlas 调整）
  | "plan"       // 影响整体计划（需要 Metis 重新规划）
  | "objective"  // 影响需求理解（需要 Sisyphus 重新分析或问用户）

/**
 * 判断重规划范围
 *
 * 根据冲突严重度和影响范围自动确定需要"重渲染"到哪一层
 */
export function determineReplanScope(signal: EscalationSignal): ReplanScope {
  switch (signal.type) {
    case "clarification":
      // 需求澄清 → 可能影响整个目标
      return signal.questions.some((q) => q.impactedDecisions.length > 2)
        ? "objective"
        : "local"

    case "conflict":
      switch (signal.severity) {
        case "blocks_current_task": return "local"
        case "blocks_future_task":  return "sibling"
        case "inconsistency_only":  return "local"
      }
      break

    case "capability":
      // 能力不足 → 需要上层调度
      return signal.suggestion.action === "synthesize_agent" ? "plan" : "sibling"

    case "challenge":
      // 结论质疑 → 可能需要重新规划
      return "plan"

    case "blocked":
      // 卡住了 → 看影响范围
      return "sibling"

    case "resource_exhaustion":
      // 资源不足 → 本地处理
      return "local"
  }

  return "local"
}

/**
 * 执行重规划的任务取消流程
 *
 * 类比 React: 新的 state 导致旧的 pending renders 被取消
 */
export interface CascadeCancel {
  /** 需要取消的运行中 Agent session ID 列表 */
  sessionsToCancel: string[]
  /** 需要保留的已完成任务（它们的结果仍然有效） */
  preservedSessions: string[]
  /** 需要重新执行的任务（使用新的指令） */
  retryTasks: Array<{
    taskId: string
    revisedInstructions: string
  }>
}
```

#### 10.6.8 信号冒泡与拦截策略

```
信号冒泡模型 — 类比 DOM Event Propagation
═══════════════════════════════════════════════════════════════

                    Sisyphus (depth=0)
                    ┌─────────────┐
                    │ 最终处理者   │ ← 如果没有中间层处理，信号到达这里
                    │             │    类似 document.addEventListener()
                    └──────┬──────┘
                           │
                    Atlas (depth=1)             Roundtable (depth=1)
                    ┌──────┴──────┐            ┌──────────────┐
                    │ 可拦截处理   │            │ 可拦截处理    │
                    │ 🛑 或 ⬆️    │            │ 🛑 或 ⬆️     │
                    └──────┬──────┘            └──────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
          Worker-1     Worker-2     Worker-3
          (depth=2)    (depth=2)    (depth=2)
          ┌────────┐   ┌────────┐   ┌────────┐
          │ 🔼     │   │ 🔼     │   │ 🔼     │
          │ 发出   │   │ 发出   │   │ 发出   │
          │ 信号   │   │ 信号   │   │ 信号   │
          └────────┘   └────────┘   └────────┘

信号处理规则:
  🛑 拦截 (stopPropagation): 中间层 Agent 能处理 → 直接响应，不向上传
  ⬆️ 冒泡 (bubbles):        中间层 Agent 无法处理 → 自身也 escalate → 信号继续上行
  🔄 转化 (transform):      中间层 Agent 部分处理，将问题转化后继续上行
```

```typescript
// packages/agent/src/escalation/bubble-policy.ts

/**
 * 信号冒泡策略
 *
 * 每个 Agent 层级可以配置自己的冒泡策略：
 * - intercept: 拦截信号，自行处理（类似 event.stopPropagation()）
 * - bubble:    透传信号给上一级（类似默认冒泡）
 * - transform: 处理部分内容后以新形态继续冒泡
 * - auto:      根据信号类型和严重程度自动决定
 */

export interface BubblePolicy {
  /** 处理策略（按信号类型配置） */
  handlers: Partial<Record<EscalationSignal["type"], BubbleAction>>
  /** 默认策略 */
  defaultAction: BubbleAction
  /** 强制冒泡的优先级阈值（priority >= 此值则强制冒泡） */
  forceBubbleAbovePriority?: EscalationPriority
}

export type BubbleAction = "intercept" | "bubble" | "transform" | "auto"

/**
 * 各层级的默认冒泡策略
 */
export const DEFAULT_BUBBLE_POLICIES: Record<string, BubblePolicy> = {
  /** Sisyphus (顶层): 拦截一切——最终处理者 */
  sisyphus: {
    handlers: {},
    defaultAction: "intercept",
  },

  /** Atlas (编排层): 拦截执行层问题，冒泡计划层问题 */
  atlas: {
    handlers: {
      clarification: "auto",       // 看内容决定
      capability: "bubble",        // 能力问题 → 上报给 Sisyphus
      conflict: "auto",            // 看严重程度
      blocked: "intercept",        // 卡住 → 自行调度替代方案
      challenge: "bubble",         // 结论质疑 → 上报
      resource_exhaustion: "intercept", // 资源 → 自行分配
    },
    defaultAction: "auto",
  },

  /** Worker (执行层): 大部分信号冒泡 */
  worker: {
    handlers: {
      resource_exhaustion: "bubble",
      blocked: "auto",
      clarification: "bubble",     // Worker 不应自行解释需求
      conflict: "bubble",
      capability: "bubble",
      challenge: "bubble",
    },
    defaultAction: "bubble",
  },
}
```

#### 10.6.9 自动解决器：常见问题的确定性处理

```typescript
// packages/agent/src/escalation/auto-resolvers.ts

/**
 * 自动解决器——不需要 LLM 推理的常见反馈模式
 *
 * 类比 React: getDerivedStateFromError (确定性错误处理，不需要渲染)
 */

import type { AutoResolver } from "./escalation-engine"

/** 资源耗尽自动追加（在安全限额内） */
export const resourceAutoResolver: AutoResolver = (signal, context) => {
  if (signal.type !== "resource_exhaustion") return null

  // 如果还在安全限额内，自动追加 50%
  const extension = Math.round(signal.requestedExtension * 0.5)
  if (signal.current + extension <= signal.limit * 2) {
    return {
      action: "extend" as const,
      additionalTokens: signal.resource === "tokens" ? extension : undefined,
      additionalTurns: signal.resource === "turns" ? extension : undefined,
      additionalTimeMs: signal.resource === "time" ? extension : undefined,
    }
  }
  return null
}

/** 低优先级澄清请求自动使用 fallback */
export const lowPriorityClarificationResolver: AutoResolver = (signal) => {
  if (signal.type !== "clarification") return null
  if (signal.priority !== "low") return null
  if (!signal.fallbackPlan) return null

  return {
    action: "continue" as const,
    useFallback: true,
    guidance: "Low priority clarification — proceed with your fallback plan.",
  }
}

/** 重复澄清相同问题时自动使用 fallback（防止循环） */
export const deduplicateResolver: AutoResolver = (() => {
  const seen = new Map<string, number>()

  return (signal) => {
    if (signal.type !== "clarification") return null

    const key = signal.questions.map((q) => q.question).join("|")
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)

    if (count >= 2) {
      return {
        action: "continue" as const,
        useFallback: true,
        guidance: "This question was asked before. Proceed with your best judgment.",
      }
    }
    return null
  }
})()

/**
 * 内置自动解决器集合
 */
export const BUILTIN_AUTO_RESOLVERS: AutoResolver[] = [
  resourceAutoResolver,
  lowPriorityClarificationResolver,
  deduplicateResolver,
]
```

#### 10.6.10 子 Agent System Prompt 增强

```typescript
// 注入所有子 Agent system prompt 的反馈协议段

const ESCALATION_PROTOCOL_SECTION = `
<Escalation_Protocol>
## When You're Stuck, Confused, or Disagree — ESCALATE

You have an \`escalate\` tool. Use it when:

### 1. Requirements are unclear
\`\`\`
escalate(
  signal_type="clarification",
  details={ questions: [
    { question: "Should I refactor all 3 auth strategies or just JWT?",
      impactedDecisions: ["scope of changes", "test coverage needed"],
      tentativeAnswer: "I'll assume JWT only unless told otherwise" }
  ]},
  priority="medium",
  current_progress="Analyzed UserService, found 3 auth strategies",
  fallback_plan="Refactor JWT auth only"
)
\`\`\`

### 2. Task exceeds your capabilities
\`\`\`
escalate(
  signal_type="capability",
  details={ missingCapability: "GraphQL schema expertise across microservices",
            reason: "Query optimization requires modifying 3 service schemas",
            suggestion: { action: "delegate_to", agentType: "oracle",
                          reason: "Needs cross-service architecture analysis" }},
  priority="high",
  current_progress="Identified N+1 query in UserResolver"
)
\`\`\`

### 3. You find a conflict with the plan
\`\`\`
escalate(
  signal_type="conflict",
  details={
    parties: {
      sideA: { source: "Task 1 implementation", claim: "Uses async event handler" },
      sideB: { source: "Task 4 requirement", claim: "Assumes sync callback interface" }
    },
    severity: "blocks_future_task",
    analysis: "Task 4 will fail unless Task 1's interface is changed"
  },
  priority="high"
)
\`\`\`

### 4. You're stuck after trying multiple approaches
\`\`\`
escalate(
  signal_type="blocked",
  details={
    blockingIssue: "Build fails with cryptic linker error",
    attemptedSolutions: ["Clean rebuild", "Updated deps", "Checked .env"],
    helpNeeded: "Someone familiar with native module compilation"
  },
  priority="medium"
)
\`\`\`

### IMPORTANT RULES:
- Escalation PAUSES your execution. You will resume when the parent responds.
- DO NOT escalate trivial issues you can resolve yourself.
- ALWAYS include current_progress so the parent knows what you've done.
- If you provide a fallback_plan, the parent may just let you proceed with it.
- After receiving a response, FOLLOW the parent's guidance exactly.
</Escalation_Protocol>
`
```

#### 10.6.11 与现有系统的对比与演进

```
当前系统（v1: 单向命令链）
═════════════════════════════════════

  Sisyphus ──task()──→ Worker ──执行──→ 结果文本返回
                         │
                         ├─ 成功 → 文本结果
                         ├─ 失败 → 错误信息（仍是文本）
                         └─ 困惑 → 猜测执行（浪费 token）

  特点: 简单、可预测
  问题: Worker 是"聋哑的"——不能问问题、不能报告冲突


引入上行反馈后（v2: 双向数据流）
═════════════════════════════════════

  Sisyphus ──task()──→ Worker ──执行──→ 结果文本返回
     │                   │        ↑
     │                   │        │
     │ <──escalate()─────┘  respond()
     │                              │
     ▼                              │
   分析反馈 → 决策┐                   │
     │           │                  │
     ├── answer ─┘──────────────────┘
     ├── replan → 修改指令 → Worker 重新执行
     ├── delegate → 转交其他 Agent
     └── abort → 取消并处理善后

  特点: Worker 变得"有嘴有耳"——能提问、能质疑、能求助
  代价: 复杂度增加、需要处理并发反馈、超时等


完整演进路线:
═════════════════════════════════════

  v1 (当前)    : 单向命令链              → 子 Agent 是"执行者"
  v2 (10.6)    : 双向数据流 + 上行反馈   → 子 Agent 是"协作者"
  v3 (10.5+10.6): 动态合成 + 上行反馈     → 子 Agent 是"按需创建的协作者"
  v4 (未来)    : 自组织 Agent 网络        → Agent 自行发现和组建协作关系
```

#### 10.6.12 端到端场景推演

**场景："重构 UserService 的认证逻辑"**

```
═══════════════════════════════════════════════════════════════
 Phase 0: Sisyphus 接收需求并委派
═══════════════════════════════════════════════════════════════

User: "重构 UserService 的认证逻辑"
Sisyphus:
  → 调用 Metis 制定计划
  → Metis 输出:
    Task 1: 分析现有认证架构 (explore)
    Task 2: 设计新认证方案 (oracle)
    Task 3: 实现新方案 (hephaestus)
    Task 4: 迁移测试 (category=deep)
    Task 5: 集成测试 (category=deep)
  → 交给 Atlas 执行

═══════════════════════════════════════════════════════════════
 Phase 1: Atlas 开始执行，Task 1 触发上行反馈
═══════════════════════════════════════════════════════════════

Atlas → task(subagent_type="explore", prompt="分析 UserService 认证架构")

Explore Agent 执行:
  → 发现 3 种认证策略 (JWT, OAuth2, Session)
  → 发现它们耦合在 UserService 类中（2000+ 行）
  → 发现还有一个未文档化的 API Key 认证逻辑
  →
  ┌──────────────────────────────────────────────┐
  │ escalate(                                     │
  │   signal_type="clarification",                │
  │   details={ questions: [                      │
  │     { question: "重构范围是全部 4 种认证策略   │
  │       还是特定的？发现了 JWT, OAuth2, Session, │
  │       API Key（未文档化）",                    │
  │       impactedDecisions: [                    │
  │         "重构范围", "新架构设计", "测试覆盖"   │
  │       ],                                      │
  │       tentativeAnswer: "假设全部重构" }        │
  │   ]},                                         │
  │   priority="medium",                          │
  │   current_progress="已完成架构分析",            │
  │   fallback_plan="假设重构全部 4 种策略"        │
  │ )                                             │
  └──────────────────────────────────────────────┘

信号冒泡:
  Explore → Atlas:
    Atlas 判断: 这是需求层面的问题，我不应该自行决定
    Atlas 选择: ⬆️ 冒泡给 Sisyphus

  Atlas → Sisyphus:
    Sisyphus 判断: 这是用户需求的歧义，我来问用户
    Sisyphus → User: "发现 UserService 有 4 种认证策略
      (JWT, OAuth2, Session, 和一个未文档化的 API Key)。
      请问重构范围包括哪些？"

  User: "先重构 JWT 和 OAuth2，API Key 保持原样但抽取出来"

  Sisyphus → Atlas → Explore: respond("answer",
    answers=[{ answer: "重构 JWT 和 OAuth2, 抽取 API Key, Session 保持" }])

  Explore Agent 恢复执行: 按明确范围继续分析 ✅

═══════════════════════════════════════════════════════════════
 Phase 2: Task 3 执行中发现冲突，触发重规划
═══════════════════════════════════════════════════════════════

Atlas → task(subagent_type="hephaestus", prompt="实现策略模式重构...")

Hephaestus 执行:
  → 开始拆分 JWT 认证到独立类
  → 发现 OAuth2 的 token 刷新逻辑深度依赖 JWT 的 token 验证
  → Task 2 (Oracle) 的设计方案假设它们是独立的
  →
  ┌──────────────────────────────────────────────┐
  │ escalate(                                     │
  │   signal_type="conflict",                     │
  │   details={                                   │
  │     parties: {                                │
  │       sideA: { source: "Oracle 设计方案",      │
  │         claim: "JWT 和 OAuth2 是独立的策略" }, │
  │       sideB: { source: "实际代码分析",         │
  │         claim: "OAuth2 token 刷新依赖         │
  │          JWT.verifyToken()" },                │
  │     },                                        │
  │     severity: "blocks_current_task",          │
  │     analysis: "如果强行分离，OAuth2 刷新将     │
  │       失去 token 验证能力",                    │
  │     suggestedResolution: "引入 TokenService    │
  │       共享层，JWT 和 OAuth2 都依赖它"          │
  │   },                                          │
  │   priority="high"                             │
  │ )                                             │
  └──────────────────────────────────────────────┘

信号冒泡:
  Hephaestus → Atlas:
    Atlas 判断: 这影响了 Task 2 的设计方案，需要 Sisyphus 层面重规划
    Atlas 选择: ⬆️ 冒泡给 Sisyphus

  Sisyphus 处理:
    → 分析: 设计方案有缺陷，需要修改
    → 决策: 请 Oracle 针对 "JWT ↔ OAuth2 共享依赖" 重新设计
    → 然后让 Hephaestus 按新设计继续
    →
    respond("replan",
      revisedInstructions="引入 TokenService 共享层...",
      cancelledSteps=["Task 4的 JWT/OAuth2 独立测试"],
      newSteps=["Task 2b: Oracle 修改设计方案加入 TokenService",
                "Task 3b: Hephaestus 按新设计实现"],
      reason="OAuth2 依赖 JWT token 验证，无法完全独立")

  Atlas 执行重规划:
    → 取消 Task 4 的部分测试
    → 启动 Task 2b (Oracle 修改设计)
    → Task 2b 完成后，Hephaestus 用新设计恢复执行 ✅
```

#### 10.6.13 Inspector 集成：反馈可视化

在 10.3 Inspector 的基础上，增加上行反馈的可视化：

```
┌───────────────────────────────────────────────────────────────────┐
│  vitamin DevTools Inspector — Escalation Monitor                  │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─ Agent 委派链 ────────────────────────────────────────────┐    │
│  │                                                            │    │
│  │  Sisyphus ──→ Atlas ──→ Worker-3 ──→ Sub-worker-A         │    │
│  │     │           │          │             │                 │    │
│  │     │           │          │        ⚡ ESCALATION          │    │
│  │     │           │          │        type: conflict         │    │
│  │     │           │          │        priority: high         │    │
│  │     │           │          │             │                 │    │
│  │     │           │     ⬆️ bubble    ⬆️ bubble               │    │
│  │     │           │          │             │                 │    │
│  │     │      🛑 intercept   ◄────────────┘                  │    │
│  │     │           │                                          │    │
│  │     │      respond("replan")                               │    │
│  │     │           │                                          │    │
│  │     │           ▼                                          │    │
│  │     │      Worker-3 重新执行                                │    │
│  │     │                                                      │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─ 待处理反馈 (1) ──────────────────────────────────────────┐    │
│  │                                                            │    │
│  │  ⚡ #esc_17093_a3b2 — conflict — from: Hephaestus         │    │
│  │     "OAuth2 token 刷新依赖 JWT.verifyToken()"              │    │
│  │     等待: Atlas 响应中... (12.3s)                           │    │
│  │                                                            │    │
│  │  [查看详情]  [手动响应]  [强制继续]                         │    │
│  │                                                            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─ 反馈历史 ────────────────────────────────────────────────┐    │
│  │                                                            │    │
│  │  ✅ #esc_17090_c1f4 — clarification — Explore → Sisyphus  │    │
│  │     "重构范围是全部 4 种认证策略还是特定的？"               │    │
│  │     → 已解决: answer (45.2s)                               │    │
│  │                                                            │    │
│  │  ✅ #esc_17089_e8a1 — resource_exhaustion — Worker-1       │    │
│  │     → 自动解决: extend +5000 tokens (auto)                 │    │
│  │                                                            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

#### 10.6.14 与其他试验性特性的协同

| 特性 | 与 10.6 上行反馈的关系 |
|------|----------------------|
| **10.1 三模式编排** | Roundtable 讨论中的参与者可以 escalate 给 Moderator；Plan/Build 的执行阶段可以 escalate 触发重规划；Ad-hoc Roundtable (10.6.16) 复用 RoundtableSession 的讨论循环逻辑 |
| **10.2 实时日志** | 上行反馈事件通过 LogBroadcastHub 实时推送给 Inspector；协商会议过程实时广播 |
| **10.3 Inspector** | 新增 Escalation Monitor 面板展示反馈链路和待处理信号；协商面板可视化圆桌进度 |
| **10.4 断点系统** | 可以在 escalation 信号发出/响应处设置断点（新增 CheckpointPhase: `before_escalate` / `after_escalate_response`）；协商前暂停对方 Agent 依赖 checkpoint pause 机制 |
| **10.5 Agent 合成** | 当 `capability` 类型的 escalation 表明需要新专家时，可触发 Agent 合成流程；协商中发现需要特殊能力的 Agent 时也可触发合成 |

#### 10.6.15 实现路径与工作量

| 阶段 | 内容 | 工作量 | 依赖 |
|------|------|--------|------|
| **Phase A** | `EscalationSignal` + `EscalationResponse` 类型体系 | ~2 天 | 无 |
| **Phase B** | `EscalationEngine` 核心（Promise 挂起 + respond + 超时） | ~3 天 | Phase A |
| **Phase C** | `escalate` 工具注册 + 子 Agent prompt 增强 | ~2 天 | Phase B |
| **Phase D** | 父 Agent 通知构造 + Session 注入集成 | ~3 天 | Phase B, delegate-task 现有机制 |
| **Phase E** | 信号冒泡策略 + 各层级默认策略 | ~2 天 | Phase D |
| **Phase F** | 自动解决器（资源追加、低优先级 fallback、去重） | ~1 天 | Phase B |
| **Phase G** | 级联重规划器 + 任务取消/重试流程 | ~4 天 | Phase E, Atlas 编排 |
| **Phase H** | Inspector Escalation Monitor 面板 | ~3 天 | Phase B, 10.3 |
| **Phase I** | 断点集成（`before_escalate` / `after_escalate_response`） | ~1 天 | Phase B, 10.4 |
| **合计** | | **~21 天** | 核心（Phase A-E）~12 天 |

**风险与开放问题**：

1. **反馈风暴**：如果多个子 Agent 同时 escalate，父 Agent 可能被大量反馈淹没，LLM 推理成本飙升。**缓解**：设置每个 Agent 的 escalation 频率限制（如每分钟最多 3 次），超限后自动使用 fallback
2. **循环反馈**：子 Agent A escalate → 父决策 → A 不满意再 escalate，形成死循环。**缓解**：`deduplicateResolver` 检测重复问题，第 2 次自动使用 fallback
3. **延迟代价**：每次 escalation 至少需要一次父 Agent 的 LLM 推理（~2-10 秒），多层冒泡的延迟更高。**缓解**：自动解决器处理常见模式；低优先级信号设置短超时
4. **重规划的一致性**：级联重规划后，部分子 Agent 可能已执行了基于旧计划的操作（如修改了文件）。**缓解**：每次重规划前收集当前状态快照，新计划需要考虑已产生的副作用
5. **LLM 决策质量**：父 Agent 的响应质量取决于其 LLM 能力。低端模型可能无法正确理解 conflict 信号。**缓解**：对 escalation 处理强制使用高端模型（类似 10.5 的 synthesize_agent 策略）
6. **与用户的关系**：`objective` 级别的 escalation 最终可能需要问用户，但频繁打扰用户违背自主执行的设计目标。**缓解**：Sisyphus 层面做初步分析，只将真正需要人类判断的问题呈现给用户

**结论**：上行反馈机制是 vitamin Agent 协作从"**单向命令链**"进化为"**双向数据流**"的关键一步。借鉴 React 的状态提升和事件冒泡模型，让子 Agent 在发现问题时能系统性地向上反馈，而不是默默猜测或在输出文本中夹带"建议"。`EscalationEngine` 采用与断点引擎相同的 Promise 挂起模式，实现上保持一致。整体演进路线：v1 单向命令 → v2 双向反馈 → v3 动态合成+反馈 → v4 自组织网络。建议在 10.5 Agent 合成之后开发，因为两者的组合（"创建新 Agent"+"向上反馈"）能产生最强的协作能力。

#### 10.6.16 同级协商与运行时临时圆桌（Ad-hoc Roundtable）

> **注**：本节内容体量较大（包含完整的协商引擎、编排器集成、多方协商、降级策略等），
> 未来可考虑提升为独立的 **10.7 节**以提高文档导航性。当前保留在 10.6 下以维护与 Escalation 体系的内聚关系。

##### 问题分析：上行反馈无法覆盖的"同级协商"场景

10.6.1–10.6.15 设计的上行反馈协议是**纯垂直架构**：信号从子 Agent 向上冒泡，由父 Agent 决策后向下回应。这个模型能良好处理以下场景：

- 子 Agent → 父 Agent："我不理解需求"（`clarification`）
- 子 Agent → 父 Agent："这超出我能力"（`capability`）
- 子 Agent → 父 Agent："计划有矛盾"（`conflict`）

但有一类重要场景**无法被垂直模型优雅地处理**——**同级 Agent 之间需要互相协商达成共识**：

```
场景：全栈开发任务中的前后端 API 协商
═══════════════════════════════════════════════════════════════

User: "实现用户资料编辑功能"

Sisyphus → Metis 规划:
  Task 1: 前端 Agent → 实现资料编辑页面 (category=frontend)
  Task 2: 后端 Agent → 实现资料更新 API (category=backend)
  Task 3: 集成测试 (依赖 Task 1, 2)

Atlas 并行执行 Task 1 和 Task 2 ...

问题出现:
  前端 Agent: "我需要知道 API 的请求/响应格式才能实现表单提交"
  后端 Agent: "我需要知道前端需要哪些字段才能设计 API Schema"

  → 典型的鸡生蛋问题：两个同级 Agent 互相依赖对方的输出
```

如果用 10.6 的垂直 escalation 处理这个场景：

```
当前方案的间接传话路径（低效）
═══════════════════════════════════════════════════════════════

Frontend Agent:
  escalate(type="blocked", helpNeeded="需要 API 接口规范")
    │
    ▼
Atlas 收到反馈:
  → "前端需要 API 规范"
  → 单独构造指令给 Backend Agent: "请先设计 API 接口"
    │
    ▼
Backend Agent:
  → 按照自己的理解设计 API (没有前端视角的输入)
  → 返回结果给 Atlas
    │
    ▼
Atlas:
  → 把 API 规范转发给 Frontend Agent
    │
    ▼
Frontend Agent:
  → 看到 API 规范 → 发现问题: "这个响应格式不适合前端渲染"
  → 再次 escalate(type="conflict")
    │
    ▼
Atlas:
  → 又是一轮"传话" ...
  → 如此反复 3-5 轮，每轮 4 次 LLM 调用（两个 Agent + Atlas 两次决策）
```

**核心问题**：Atlas 只是在"传话"，它既不懂前端细节也不懂后端约束，是一个**上下文损耗极高的中间人**。同时每轮协商都需要经过两次垂直路径（上行+下行），延迟和 token 成本成倍增长。

这正是 React 单向数据流模型在特定场景下的局限：**当两个兄弟组件需要频繁通信时，每次都通过父组件中转（状态提升）效率极低**。React 社区的解法是引入 Context 或状态管理库（Redux/Zustand）让组件直接共享状态。在 Agent 协作中，对应的解法是**临时圆桌协商**。

##### 解决方案：CoordinationRequest + Ad-hoc Roundtable

引入第 7 种上行反馈信号 `CoordinationRequest`，以及运行时临时圆桌机制：

```typescript
// packages/agent/src/escalation/coordination-types.ts

/**
 * 第 7 种上行信号：协调请求
 *
 * 与其他 6 种信号的区别：
 * - 其他信号: "我有问题，请上级帮我解决"
 * - 协调请求: "我需要和同级 Agent 协商，请上级安排一次对话"
 *
 * 类比:
 * - React: 两个兄弟组件需要共享状态 → 提升到父组件 → 或引入 Context
 * - 人类团队: 前端工程师走到后端工程师工位旁 → "我们对一下接口"
 * - 微服务: 两个服务需要约定契约 → Consumer-Driven Contract Testing
 */
export interface CoordinationRequest {
  type: "coordination"
  priority: EscalationPriority

  /** 需要协商的对象（哪些同级 Agent） */
  requestedPeers: Array<{
    /** 对方 Agent 的角色/任务描述 */
    role: string
    /** 对方的 category 或 subagent_type（用于 Atlas 定位） */
    category?: string
    /** 对方正在执行的任务 ID（如果已知） */
    taskId?: string
  }>

  /** 协商主题 */
  topic: string

  /** 协商的具体内容 */
  agenda: Array<{
    /** 待定事项 */
    item: string
    /** 发起方的提议（如果有） */
    proposal?: string
    /** 约束条件 */
    constraints?: string[]
  }>

  /** 发起方已有的上下文（供对方参考） */
  context: string

  /** 期望的产出物类型 */
  expectedOutput:
    | "api_contract"        // API 接口规范
    | "data_schema"         // 数据模型定义
    | "protocol"            // 通信协议
    | "interface"           // 代码接口/抽象定义
    | "shared_convention"   // 共享约定（命名、格式等）
    | "dependency_order"    // 执行依赖顺序
    | "general_agreement"   // 通用共识

  currentProgress: string
}

/**
 * 协商结果——临时圆桌的产出物
 *
 * 与 RoundtableResult（10.1）的区别：
 * - 10.1 的圆桌是 pre-planning 阶段的开放讨论，产出是"讨论纪要"
 * - 这里的临时圆桌是 runtime 阶段的聚焦协商，产出是"契约/协议"
 */
export interface NegotiationAgreement {
  /** 协议 ID（可追溯） */
  agreementId: string
  /** 参与方 */
  parties: string[]
  /** 协商主题 */
  topic: string

  /** 达成的共识 */
  consensus: Array<{
    item: string
    decision: string
    /** 谁做出的让步（如果有） */
    concession?: { party: string; original: string; revised: string }
  }>

  /** 未解决的分歧（需要上升给 Atlas 或 Sisyphus） */
  unresolvedDisputes?: Array<{
    item: string
    positions: Array<{ party: string; stance: string; reason: string }>
  }>

  /** 具体产出物（如 API Schema、接口定义等） */
  artifact?: {
    type: CoordinationRequest["expectedOutput"]
    content: string
    /** 对各方的约束说明 */
    bindingTerms: Array<{ party: string; obligation: string }>
  }

  /** 是否需要后续重新协商 */
  requiresFollowUp: boolean
  /** 关联的任务 ID（用于审计追溯） */
  relatedTaskIds?: string[]
  /** 创建时间（自动填充） */
  createdAt?: number
}

/**
 * NegotiationAgreement 持久化
 *
 * 协商协议存储在 Session 存储中，关联到触发的 task ID，支持：
 * 1. 审计日志——回溯某次 API 接口为什么这样设计
 * 2. Session 回放——Inspector 中查看协商过程
 * 3. 集成测试——验证协商结果是否被正确执行
 * 4. 复用——相同上下文的后续协商可参考已有协议
 *
 * 存储位置：@vitamin/session 的 SessionStorage 中，作为 session 元数据的一部分
 */
export interface NegotiationStore {
  /** 保存协商协议 */
  save(agreement: NegotiationAgreement): Promise<void>
  /** 根据协议 ID 查询 */
  getById(agreementId: string): Promise<NegotiationAgreement | undefined>
  /** 查询某个 session 关联的所有协议 */
  getBySession(sessionId: string): Promise<NegotiationAgreement[]>
  /** 查询某个 task 关联的所有协议（跨 session） */
  getByTask(taskId: string): Promise<NegotiationAgreement[]>
}
```

##### Ad-hoc Roundtable 引擎

与 10.1 的预规划圆桌不同，运行时临时圆桌具有以下特征：

| 维度 | 10.1 圆桌（Pre-planning） | 临时圆桌（Runtime Ad-hoc） |
|------|--------------------------|---------------------------|
| **触发时机** | 任务开始前 | 执行过程中 |
| **触发方式** | 用户指令或意图检测 | 子 Agent 的 `coordination` escalation |
| **参与者** | 预定义角色（架构师/实现者/审查者/研究员） | 运行时动态确定（相关的执行中 Agent） |
| **讨论目标** | 开放式探索方向 | 聚焦式达成具体协议 |
| **产出物** | 讨论纪要（RoundtableMinutes） | 协商协议（NegotiationAgreement） |
| **后续动作** | 流入 Plan 模式 | 各方携带协议继续执行 |
| **主持人** | Sisyphus | 父级编排器（Atlas）或 Oracle |
| **最大轮数** | 配置式（默认 5 轮） | 更短（默认 3 轮，聚焦效率） |

```typescript
// packages/agent/src/escalation/adhoc-roundtable.ts

import type { TaskDispatcher } from "../orchestrator/types"
import type {
  CoordinationRequest,
  NegotiationAgreement,
} from "./coordination-types"

/**
 * 运行时临时圆桌
 *
 * 生命周期:
 *   1. 子 Agent A 发出 CoordinationRequest
 *   2. 父 Agent (Atlas) 拦截信号 → 识别需要协商
 *   3. Atlas 暂停相关 Agent 的执行（Promise 挂起）
 *   4. 创建 AdHocRoundtable → 注入双方上下文 → 开始协商
 *   5. 协商达成 → 生成 NegotiationAgreement
 *   6. Atlas 将 Agreement 分发给双方 → 各自恢复执行
 *
 * 与 RoundtableSession (10.1) 共享核心讨论循环逻辑，
 * 但协商模式更聚焦：有明确 agenda、期望具体产出物、限制发散。
 */
export interface AdHocRoundtableConfig {
  /** 协商发起方的 escalation */
  trigger: CoordinationRequest
  /** 发起方 Agent 标识 */
  initiator: AgentIdentity
  /** 被邀请的对方 Agent 标识列表 */
  invitees: AgentIdentity[]
  /** 各方当前的执行上下文摘要 */
  contextPerParty: Map<string, string>
  /** 主持人（默认 Atlas 或 Oracle） */
  mediator: string
  /** 最大协商轮数（默认 3） */
  maxRounds: number
}

export interface AgentIdentity {
  agentName: string
  taskId: string
  sessionId: string
  category: string
  /** 当前 Agent 的进度摘要（自动从 session 提取） */
  progressSummary: string
}

export class AdHocRoundtable {
  private messages: NegotiationMessage[] = []
  private round = 0

  constructor(
    private config: AdHocRoundtableConfig,
    private dispatch: TaskDispatcher,
  ) {}

  async negotiate(): Promise<NegotiationAgreement> {
    // Phase 1: 主持人开场 — 明确协商 agenda
    const opening = await this.mediatorSpeak(
      this.buildOpeningPrompt()
    )
    this.messages.push(opening)

    // Phase 2: 多轮协商
    while (this.round < this.config.maxRounds) {
      this.round++

      // 2a. 发起方陈述/回应
      const initiatorMsg = await this.partySpeak(
        this.config.initiator,
        "initiator"
      )
      this.messages.push(initiatorMsg)

      // 2b. 各被邀请方依次回应
      for (const invitee of this.config.invitees) {
        const inviteeMsg = await this.partySpeak(invitee, "invitee")
        this.messages.push(inviteeMsg)
      }

      // 2c. 主持人判断是否达成共识
      const mediatorSummary = await this.mediatorSpeak(
        this.buildMediatorSummaryPrompt()
      )
      this.messages.push(mediatorSummary)

      if (mediatorSummary.content.includes("[AGREEMENT_REACHED]")) {
        break
      }

      // 2d. 如果存在僵局，主持人提出调解方案
      if (mediatorSummary.content.includes("[DEADLOCK]")) {
        const mediation = await this.mediatorSpeak(
          this.buildMediationPrompt()
        )
        this.messages.push(mediation)
      }
    }

    // Phase 3: 生成正式协议
    return this.generateAgreement()
  }

  private buildOpeningPrompt(): string {
    const agendaText = this.config.trigger.agenda
      .map((a, i) => `${i + 1}. ${a.item}${a.proposal ? `\n   提议: ${a.proposal}` : ""}${a.constraints ? `\n   约束: ${a.constraints.join("; ")}` : ""}`)
      .join("\n")

    const partiesContext = [
      this.config.initiator,
      ...this.config.invitees,
    ].map((p) => {
      const ctx = this.config.contextPerParty.get(p.agentName)
      return `- ${p.agentName} (${p.category}): ${ctx ?? p.progressSummary}`
    }).join("\n")

    return [
      `# 运行时协商会议`,
      ``,
      `## 背景`,
      `${this.config.initiator.agentName} 在执行任务时发起了协作请求。`,
      `现在需要各方就以下议题达成共识后才能继续执行。`,
      ``,
      `## 参与方当前状态`,
      partiesContext,
      ``,
      `## 协商议题`,
      agendaText,
      ``,
      `## 期望产出`,
      `类型: ${this.config.trigger.expectedOutput}`,
      ``,
      `## 规则`,
      `- 每方每轮发言不超过 300 字，聚焦具体决策`,
      `- 提出反对意见时必须给出替代方案`,
      `- 目标是在 ${this.config.maxRounds} 轮内达成协议`,
      ``,
      `请各方开始讨论。`,
    ].join("\n")
  }

  private buildMediatorSummaryPrompt(): string {
    const recentMessages = this.messages
      .slice(-((this.config.invitees.length + 1) * this.round))
      .map((m) => `[${m.party}]: ${m.content}`)
      .join("\n\n")

    return [
      `第 ${this.round} 轮协商完毕，请判断:`,
      ``,
      `各方发言:`,
      recentMessages,
      ``,
      `请分析:`,
      `1. 各议题是否已达成共识？`,
      `2. 存在哪些分歧？`,
      `3. 是否需要继续讨论？`,
      ``,
      `如果所有议题已达成共识: 在回复中包含 [AGREEMENT_REACHED]`,
      `如果存在僵局无法推进: 在回复中包含 [DEADLOCK]`,
      `否则继续下一轮讨论`,
    ].join("\n")
  }

  private buildMediationPrompt(): string {
    return [
      `检测到僵局。作为调解人，请:`,
      `1. 分析双方的核心诉求和约束`,
      `2. 提出折中方案`,
      `3. 如果无法调解，标记为未解决分歧，交由上级处理`,
    ].join("\n")
  }

  private async partySpeak(
    party: AgentIdentity,
    role: "initiator" | "invitee",
  ): Promise<NegotiationMessage> {
    const history = this.messages
      .map((m) => `[${m.party}]: ${m.content}`)
      .join("\n\n")

    const prompt = [
      `你是 ${party.agentName}，正在参与一次运行时协商会议。`,
      `你的角色: ${party.category}`,
      `你当前的任务进度: ${party.progressSummary}`,
      ``,
      `讨论历史:`,
      history,
      ``,
      role === "initiator"
        ? `作为发起方，请阐述你的需求和提议。`
        : `作为被邀请方，请回应对方的提议。可以同意、提出修改建议、或给出替代方案。`,
      ``,
      `重要: 聚焦具体的技术决策（API 格式、字段定义、协议约定等），不要泛泛而谈。`,
    ].join("\n")

    const result = await this.dispatch({
      subagent: party.agentName,
      prompt,
      mode: "sync",
    })

    return {
      party: party.agentName,
      role,
      content: result.output,
      round: this.round,
    }
  }

  private async generateAgreement(): Promise<NegotiationAgreement> {
    const allMessages = this.messages
      .map((m) => `[${m.party}](round ${m.round}): ${m.content}`)
      .join("\n\n")

    const prompt = [
      `请将以下协商过程整理为正式协议:`,
      ``,
      allMessages,
      ``,
      `输出格式 (JSON):`,
      `{`,
      `  "consensus": [{ "item": "...", "decision": "..." }],`,
      `  "unresolvedDisputes": [{ "item": "...", "positions": [...] }],`,
      `  "artifact": { "type": "${this.config.trigger.expectedOutput}", "content": "...", "bindingTerms": [...] }`,
      `}`,
    ].join("\n")

    const result = await this.dispatch({
      subagent: this.config.mediator,
      prompt,
      mode: "sync",
    })

    return {
      agreementId: `neg-${Date.now()}`,
      parties: [
        this.config.initiator.agentName,
        ...this.config.invitees.map((i) => i.agentName),
      ],
      topic: this.config.trigger.topic,
      ...this.parseLlmJson(result.output),
      requiresFollowUp: false,
    }
  }

  /**
   * 解析 LLM 输出的 JSON
   *
   * LLM 输出可能不是合法 JSON（包含 markdown 代码块、注释等），
   * 尝试多种解析策略后回退到空协议。
   */
  private parseLlmJson(raw: string): Record<string, unknown> {
    // 策略 1: 直接解析
    try {
      return JSON.parse(raw)
    } catch { /* 尝试下一策略 */ }

    // 策略 2: 提取 ```json ... ``` 代码块
    const jsonBlockMatch = raw.match(/```(?:json)?\s*\n([\s\S]*?)\n```/)
    if (jsonBlockMatch) {
      try {
        return JSON.parse(jsonBlockMatch[1])
      } catch { /* 尝试下一策略 */ }
    }

    // 策略 3: 提取第一个 { ... } 块
    const braceMatch = raw.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0])
      } catch { /* 回退 */ }
    }

    // 回退: 返回空协议（记录警告）
    console.warn("Failed to parse LLM JSON output for agreement, using empty agreement")
    return { consensus: [], unresolvedDisputes: [{ item: "all", positions: ["LLM output was not valid JSON"] }] }
  }
}

export interface NegotiationMessage {
  party: string
  role: "initiator" | "invitee" | "mediator"
  content: string
  round: number
}
```

##### 编排器集成：Atlas 如何处理 CoordinationRequest

当编排器（Atlas）收到 `coordination` 类型的 escalation 时，执行以下流程：

```
CoordinationRequest 处理流程
═══════════════════════════════════════════════════════════════

Atlas 收到 Frontend Agent 的 CoordinationRequest:
  topic: "用户资料 API 接口协商"
  requestedPeers: [{ role: "后端开发", category: "backend" }]
  expectedOutput: "api_contract"
  │
  ▼
Step 1: 定位对方 Agent
  Atlas 查找当前执行中的 Agent:
  ├── taskId: "task-2" → Backend Agent (session: "sess-xyz")
  └── 确认 Backend Agent 当前状态: running / idle / waiting
  │
  ▼
Step 2: 暂停双方执行
  ├── Frontend Agent: 已在 escalation 的 Promise 上挂起
  └── Backend Agent: 发送 PAUSE 信号 → 挂起在下一个 checkpoint
      (复用 10.4 断点引擎的 Promise 挂起机制)
  │
  ▼
Step 3: 收集双方上下文
  ├── Frontend Agent 上下文: 已完成页面结构, 需要知道 API 格式
  └── Backend Agent 上下文: 已完成数据模型, 准备设计 Controller
  │
  ▼
Step 4: 创建临时圆桌
  AdHocRoundtable({
    trigger: coordinationRequest,
    initiator: frontendAgent,
    invitees: [backendAgent],
    contextPerParty: { frontend: "...", backend: "..." },
    mediator: "oracle",   // 架构师角色做调解人
    maxRounds: 3,
  })
  │
  ▼
Step 5: 协商进行（2-3 轮）
  Round 1:
    [Frontend]: "需要 PUT /api/users/:id，body 含 name, email, avatar"
    [Backend]:  "同意 PUT。建议用 PATCH 支持部分更新，avatar 用
                 multipart/form-data 单独上传"
    [Oracle]:   "两个合理点: 全量用 PUT, 部分用 PATCH, 头像独立端点"

  Round 2:
    [Frontend]: "同意 PATCH + 独立头像端点。请确认响应格式"
    [Backend]:  "响应统一用 { data: User, meta: { updatedAt } }，
                 头像端点返回 { url: string }"
    [Oracle]:   "[AGREEMENT_REACHED] 三个端点确认"
  │
  ▼
Step 6: 生成 NegotiationAgreement
  {
    consensus: [
      { item: "更新接口", decision: "PATCH /api/users/:id" },
      { item: "头像上传", decision: "POST /api/users/:id/avatar (multipart)" },
      { item: "响应格式", decision: "{ data: T, meta: { updatedAt } }" },
    ],
    artifact: {
      type: "api_contract",
      content: "... OpenAPI Schema YAML ...",
      bindingTerms: [
        { party: "frontend", obligation: "按此 Schema 发送请求" },
        { party: "backend", obligation: "按此 Schema 实现端点和验证" },
      ]
    }
  }
  │
  ▼
Step 7: 分发协议并恢复执行
  ├── Frontend Agent: respond({ action: "answer",
  │     answers: [{ answer: "API 协议已确定: ..." }],
  │     additionalGuidance: agreement.artifact.content })
  │   → Promise resolve → 恢复执行，按协议实现 API 调用
  │
  └── Backend Agent: 注入 agreement 到 session context
      → checkpoint resolve → 恢复执行，按协议实现端点
```

```typescript
// packages/agent/src/escalation/coordination-handler.ts

import type { EscalationEngine } from "./escalation-engine"
import type { AdHocRoundtable, AdHocRoundtableConfig } from "./adhoc-roundtable"
import type {
  CoordinationRequest,
  NegotiationAgreement,
} from "./coordination-types"

/**
 * Coordination 所需的 SessionManager 扩展接口
 *
 * 继承自 @vitamin/session 的基础 SessionManager（会话存取），
 * 增加运行时 Agent 控制能力（暂停、注入上下文、查询进度）。
 */
export interface CoordinationSessionManager {
  /** 暂停指定 session 中正在执行的 Agent（返回可恢复的句柄） */
  pauseAgent(sessionId: string): Promise<PauseHandle>
  /** 获取当前所有活跃 Agent 会话 */
  getActiveSessions(): Promise<AgentIdentity[]>
  /** 向指定 session 注入上下文内容（用于分发协商协议） */
  injectContext(sessionId: string, content: string): Promise<void>
  /** 获取指定 session 的进度摘要（用于圆桌上下文收集） */
  getProgressSummary(sessionId: string): Promise<string>
}

interface PauseHandle {
  /** 恢复被暂停的 Agent 执行 */
  resume(): Promise<void>
}

/**
 * Atlas 层面的 Coordination 处理器
 *
 * 收到 CoordinationRequest 后:
 * 1. 定位对方 Agent
 * 2. 暂停并收集上下文
 * 3. 组建临时圆桌
 * 4. 分发协议
 */
export class CoordinationHandler {
  constructor(
    private engine: EscalationEngine,
    private sessionManager: CoordinationSessionManager,
    private dispatch: TaskDispatcher,
  ) {}

  async handle(
    escalationId: string,
    signal: CoordinationRequest,
    initiator: AgentIdentity,
  ): Promise<void> {
    // 1. 定位被请求的 peer Agent
    const invitees = await this.resolvePeers(signal.requestedPeers)

    if (invitees.length === 0) {
      // 没找到合适的 peer → 降级为普通 capability escalation
      await this.engine.respond(escalationId, {
        action: "answer",
        answers: [{
          questionRef: "coordination",
          answer: "未找到可协商的对方 Agent，请在任务描述中自行假设接口规范",
        }],
      })
      return
    }

    // 2. 暂停对方 Agent（利用 10.4 断点引擎的 pause 机制）
    const pauseHandles = await Promise.all(
      invitees.map((inv) => this.sessionManager.pauseAgent(inv.sessionId))
    )

    // 3. 收集各方上下文
    const contextPerParty = new Map<string, string>()
    contextPerParty.set(initiator.agentName, signal.context)
    for (const inv of invitees) {
      const ctx = await this.sessionManager.getProgressSummary(inv.sessionId)
      contextPerParty.set(inv.agentName, ctx)
    }

    // 4. 选择调解人
    //    - 如果有 Oracle 在场 → Oracle 主持
    //    - 否则 Atlas 自己主持
    const mediator = this.selectMediator(signal)

    // 5. 创建并运行临时圆桌
    const config: AdHocRoundtableConfig = {
      trigger: signal,
      initiator,
      invitees,
      contextPerParty,
      mediator,
      maxRounds: this.determineMaxRounds(signal),
    }

    const roundtable = new AdHocRoundtable(config, this.dispatch)
    const agreement = await roundtable.negotiate()

    // 6. 处理协商结果
    if (agreement.unresolvedDisputes && agreement.unresolvedDisputes.length > 0) {
      // 有未解决分歧 → 上报给 Sisyphus 或让用户决定
      await this.escalateUnresolvedDisputes(agreement)
    }

    // 7. 分发协议给发起方（通过 escalation response）
    await this.engine.respond(escalationId, {
      action: "answer",
      answers: [{
        questionRef: "coordination",
        answer: this.formatAgreementForAgent(agreement, initiator.agentName),
      }],
      additionalGuidance: agreement.artifact?.content,
    })

    // 8. 分发协议给被邀请方（通过 session 注入）并恢复执行
    for (let i = 0; i < invitees.length; i++) {
      const inv = invitees[i]
      await this.sessionManager.injectContext(
        inv.sessionId,
        this.formatAgreementForAgent(agreement, inv.agentName),
      )
      await pauseHandles[i].resume()
    }
  }

  private async resolvePeers(
    requested: CoordinationRequest["requestedPeers"],
  ): Promise<AgentIdentity[]> {
    const activeSessions = await this.sessionManager.getActiveSessions()
    return requested
      .map((req) => {
        return activeSessions.find((s) =>
          (req.taskId && s.taskId === req.taskId) ||
          (req.category && s.category === req.category)
        )
      })
      .filter((s): s is AgentIdentity => s !== undefined)
  }

  private selectMediator(signal: CoordinationRequest): string {
    // API 设计类 → Oracle（架构视角）
    // 数据模型类 → Oracle
    // 通用协调 → Atlas 自身
    switch (signal.expectedOutput) {
      case "api_contract":
      case "data_schema":
      case "interface":
      case "protocol":
        return "oracle"
      default:
        return "atlas"
    }
  }

  private determineMaxRounds(signal: CoordinationRequest): number {
    // agenda 越多/越复杂 → 给更多轮数（上限 5）
    const agendaCount = signal.agenda.length
    return Math.min(Math.max(agendaCount, 2), 5)
  }

  private formatAgreementForAgent(
    agreement: NegotiationAgreement,
    agentName: string,
  ): string {
    const lines = [
      `## 协商协议 (${agreement.agreementId})`,
      ``,
      `### 参与方: ${agreement.parties.join(", ")}`,
      `### 主题: ${agreement.topic}`,
      ``,
      `### 共识:`,
      ...agreement.consensus.map((c) => `- **${c.item}**: ${c.decision}`),
    ]

    if (agreement.artifact) {
      const myTerms = agreement.artifact.bindingTerms
        .filter((t) => t.party === agentName)
      lines.push(
        ``,
        `### 你需要遵守的约定:`,
        ...myTerms.map((t) => `- ${t.obligation}`),
        ``,
        `### 详细规范:`,
        "```",
        agreement.artifact.content,
        "```",
      )
    }

    return lines.join("\n")
  }
}
```

##### 子 Agent Prompt 增强：协商工具

将 `escalate` 工具的选项扩展，新增 `coordination` 信号类型：

```
当你在执行任务时发现需要和其他 Agent 协商（例如前后端 API 对接、
多模块接口约定、数据格式统一等），使用 escalate 工具：

<tool_use>
  <name>escalate</name>
  <arguments>
    signal_type: "coordination"
    topic: "用户资料编辑 API 接口定义"
    requested_peers:
      - role: "后端 API 开发"
        category: "backend"
    agenda:
      - item: "接口 URL 和 HTTP 方法"
        proposal: "PUT /api/users/:id"
      - item: "请求体格式"
        proposal: "{ name?: string, email?: string }"
      - item: "响应体格式"
    expected_output: "api_contract"
    context: "我正在实现用户资料编辑页面，已完成表单组件，
              需要后端接口规范来实现提交逻辑。"
  </arguments>
</tool_use>

系统会暂停你的执行，组织一次临时协商会议。
协商完成后你会收到协议内容，请严格按照协议实现。
```

##### 多方协商：超越两方的场景

临时圆桌不限于两方，支持多方协商：

```
场景：微服务架构中的多方接口协商
═══════════════════════════════════════════════════════════════

User: "实现订单结算流程"

Atlas 并行执行:
  Task 1: 前端 Agent → 结算页面  (category=frontend)
  Task 2: 订单 Agent → 订单服务  (category=backend)
  Task 3: 支付 Agent → 支付服务  (category=backend)
  Task 4: 库存 Agent → 库存服务  (category=backend)

订单 Agent 发现: 需要和支付、库存、前端三方协商接口

escalate(type="coordination",
  topic="结算流程 API 协议",
  requestedPeers=[
    { role: "支付处理", category: "payment" },
    { role: "库存检查", category: "inventory" },
    { role: "前端展示", category: "frontend" },
  ],
  agenda=[
    { item: "结算发起: 前端 → 订单服务" },
    { item: "库存预扣: 订单服务 → 库存服务" },
    { item: "支付请求: 订单服务 → 支付服务" },
    { item: "支付回调: 支付服务 → 订单服务" },
    { item: "结算结果: 订单服务 → 前端" },
  ],
  expectedOutput="protocol"
)

Atlas 组织四方临时圆桌:
  主持人: Oracle (全局架构视角)
  参与方: 前端、订单、支付、库存

  协商 3 轮后达成:
  → 结算发起: POST /api/orders/checkout
  → 库存预扣: 内部 RPC OrderService → InventoryService.reserve()
  → 支付请求: POST /api/payments/create (订单服务调支付服务)
  → 支付回调: Webhook /api/orders/payment-callback
  → 结算结果: SSE /api/orders/:id/status (前端轮询/长连接)

四方各自携带协议恢复执行 ✅
```

##### 与 10.6 Escalation 体系的集成关系

```
完整信号类型体系（更新后）
═══════════════════════════════════════════════════════════════

EscalationSignal (7 种):
  │
  ├── 垂直信号（子→父，10.6.3 已定义的 6 种）:
  │   ├── clarification      "需求不清楚"
  │   ├── capability          "超出我能力"
  │   ├── conflict            "发现矛盾"
  │   ├── blocked             "我卡住了"
  │   ├── challenge           "对结论有疑问"
  │   └── resource_exhaustion "资源快用完"
  │
  └── 水平信号（同级协商，10.6.16 新增）:
      └── coordination        "需要和同级 Agent 协商"

信号处理路径:
  │
  ├── 垂直信号 → 冒泡策略 (10.6.8):
  │   intercept / bubble / transform / auto
  │
  └── coordination 信号 → 特殊处理:
      ├── 父 Agent 定位 peer → 暂停双方
      ├── 创建 AdHocRoundtable
      ├── 协商完成 → 分发协议
      ├── 有未解决分歧 → 降级为垂直 escalation（冒泡给上级）
      └── 完全无法协商 → abort + 重规划
```

##### 协商失败的降级策略

```typescript
// packages/agent/src/escalation/negotiation-fallback.ts

/**
 * 协商失败的 4 种降级策略
 *
 * 当临时圆桌在 maxRounds 轮后仍有未解决分歧时:
 */
export type NegotiationFallback =
  | EscalateToParent       // 将分歧上报给更高层级
  | MediatorDecision       // 由调解人（Oracle）做最终裁决
  | InitiatorPriority      // 以发起方的提议为准（默认）
  | ReplanWithSequence     // 放弃并行，改为串行执行

/** 策略 1: 上报——交给 Sisyphus 或用户裁决 */
export interface EscalateToParent {
  type: "escalate_to_parent"
  /** 未解决的分歧会被包装成 ConflictReport 向上冒泡 */
}

/**
 * 策略 2: 调解人裁决
 *
 * Oracle 基于架构全局视角做最终决定。
 * 各方必须接受（类似仲裁）。
 */
export interface MediatorDecision {
  type: "mediator_decision"
  /** Oracle 的裁决理由 */
  rationale: string
}

/**
 * 策略 3: 发起方优先
 *
 * 如果协商不影响核心功能，以发起方提议为准。
 * 适合低优先级的格式、命名等约定分歧。
 */
export interface InitiatorPriority {
  type: "initiator_priority"
}

/**
 * 策略 4: 放弃并行，改为串行
 *
 * "鸡生蛋"问题的终极回退：先让一方完成，另一方再基于结果执行。
 * 代价是总时间翻倍，但保证正确性。
 *
 * 例: 先让 Backend Agent 完成 API → 再让 Frontend Agent 基于实际 API 实现
 */
export interface ReplanWithSequence {
  type: "replan_with_sequence"
  /** 执行顺序 */
  sequence: string[]
}

/**
 * 选择降级策略
 */
export function selectFallback(
  agreement: NegotiationAgreement,
  signal: CoordinationRequest,
): NegotiationFallback {
  const disputes = agreement.unresolvedDisputes ?? []

  // 无分歧 → 不需要降级
  if (disputes.length === 0) {
    return { type: "initiator_priority" }
  }

  // 高优先级的核心接口分歧 → 上报
  const hasCritical = disputes.some((d) =>
    d.positions.some((p) => p.reason.includes("breaking") || p.reason.includes("安全"))
  )
  if (hasCritical) {
    return { type: "escalate_to_parent" }
  }

  // API / 数据模型分歧 → Oracle 仲裁
  if (signal.expectedOutput === "api_contract" || signal.expectedOutput === "data_schema") {
    return { type: "mediator_decision", rationale: "" }
  }

  // 其他 → 发起方优先
  return { type: "initiator_priority" }
}
```

##### 端到端场景：全栈用户资料编辑功能

```
═══════════════════════════════════════════════════════════════
 Phase 0: 任务规划
═══════════════════════════════════════════════════════════════

User: "实现用户资料编辑功能，支持修改姓名、邮箱和头像"

Sisyphus → Metis 规划:
  Task 1: Frontend Agent → 资料编辑页面 + 表单组件
  Task 2: Backend Agent  → 用户资料 CRUD API
  Task 3: Integration    → E2E 测试（依赖 1, 2）

Atlas 并行启动 Task 1 和 Task 2

═══════════════════════════════════════════════════════════════
 Phase 1: 两个 Agent 独立工作
═══════════════════════════════════════════════════════════════

Frontend Agent:
  ✅ 创建 ProfileEditPage 组件
  ✅ 实现表单验证逻辑 (name: required, email: valid format)
  ✅ 实现头像裁剪组件
  🔄 准备实现 API 调用层...
  💡 "我需要知道后端 API 的格式才能实现 api.updateProfile()"

Backend Agent:
  ✅ 创建 UserProfileController
  ✅ 实现数据库 Migration (add avatar_url column)
  🔄 准备设计 API 端点...
  💡 "前端需要哪些字段？头像是 base64 还是 file upload？"

═══════════════════════════════════════════════════════════════
 Phase 2: Frontend Agent 发起协商
═══════════════════════════════════════════════════════════════

Frontend Agent → escalate(type="coordination"):
  topic: "用户资料编辑 API 接口协商"
  requestedPeers: [{ category: "backend" }]
  agenda:
    - item: "资料更新接口（URL、方法、字段）"
      proposal: "PUT /api/profile, body: { name, email }"
    - item: "头像上传方式"
      proposal: "同一接口，avatar 字段传 base64"
      constraints: ["前端已实现裁剪，输出为 Blob"]
    - item: "响应格式"
  expectedOutput: "api_contract"
  context: "已完成表单组件和头像裁剪，需要 API 规范"

═══════════════════════════════════════════════════════════════
 Phase 3: Atlas 组织临时圆桌
═══════════════════════════════════════════════════════════════

Atlas:
  → 暂停 Frontend Agent (已在 escalation Promise 上挂起)
  → 暂停 Backend Agent (发送 checkpoint pause)
  → 收集双方上下文
  → 创建 AdHocRoundtable (mediator=Oracle, maxRounds=3)

── Round 1 ──

[Frontend Agent]:
  "需要以下接口:
   1. 更新资料: PUT /api/profile, body: { name?, email? }
   2. 头像: 建议同一接口传 base64
   3. 响应: 需要返回更新后的完整用户对象

   约束: 前端裁剪组件输出 Blob/base64, 最大 2MB"

[Backend Agent]:
  "1. 同意 PUT，但建议用 PATCH (支持部分更新更 RESTful)
   2. 头像不建议 base64 — 2MB base64 编码后约 2.7MB，
      建议独立端点 POST /api/profile/avatar (multipart/form-data)
   3. 响应同意返回完整用户对象: { id, name, email, avatarUrl, updatedAt }"

[Oracle (调解人)]:
  "两个分歧点:
   - PUT vs PATCH: PATCH 语义更准确，建议采纳
   - base64 vs multipart: multipart 更高效，
     但前端需要两次请求(资料+头像)
   继续讨论"

── Round 2 ──

[Frontend Agent]:
  "1. 同意 PATCH
   2. 两次请求可接受，但希望头像上传后直接返回新的 avatarUrl，
      这样资料表单提交时不需要再单独处理头像
   3. 需要确认: 头像端点是否需要关联 userId?"

[Backend Agent]:
  "1. ✅ PATCH /api/profile
   2. 头像端点: POST /api/profile/avatar
      → 返回 { avatarUrl: string }
      → userId 从 JWT token 中提取，不需要传
   3. 完整更新流程:
      Step a: POST /api/profile/avatar → { avatarUrl }
      Step b: PATCH /api/profile → { name?, email? } → { user }"

[Oracle (调解人)]:
  "[AGREEMENT_REACHED]
   共识:
   1. PATCH /api/profile — 资料更新
   2. POST /api/profile/avatar — 头像独立上传
   3. JWT 鉴权，无需传 userId
   4. 响应格式统一"

═══════════════════════════════════════════════════════════════
 Phase 4: 协议分发，双方恢复执行
═══════════════════════════════════════════════════════════════

NegotiationAgreement:
  artifact: {
    type: "api_contract",
    content: """
      ## Profile API Contract

      ### PATCH /api/profile
      Auth: Bearer JWT
      Request: { name?: string, email?: string }
      Response: { data: { id, name, email, avatarUrl, updatedAt } }

      ### POST /api/profile/avatar
      Auth: Bearer JWT
      Content-Type: multipart/form-data
      Body: file (max 2MB, image/*)
      Response: { data: { avatarUrl: string } }
    """,
    bindingTerms: [
      { party: "frontend", obligation: "先上传头像获取 URL，再提交资料" },
      { party: "backend", obligation: "JWT 鉴权 + 上述端点和格式" },
    ]
  }

Frontend Agent 恢复:
  → 拿到协议 → 实现 api.uploadAvatar() + api.updateProfile()
  → 表单提交流程: 检查头像变更 → 上传 → 提交资料 ✅

Backend Agent 恢复:
  → 拿到协议 → 实现 ProfileController.update() + .uploadAvatar()
  → 验证逻辑按协议添加 ✅

═══════════════════════════════════════════════════════════════
 Phase 5: Task 3 集成测试 — 基于协议验证
═══════════════════════════════════════════════════════════════

Atlas 启动 Task 3:
  → 集成测试 Agent 收到 NegotiationAgreement 作为上下文
  → 基于 API Contract 编写 E2E 测试
  → 验证前后端是否都遵守了协议 ✅
```

##### 与纯垂直 Escalation 的对比

| 维度 | 纯垂直 (Atlas 传话) | CoordinationRequest + Ad-hoc Roundtable |
|------|--------------------|-----------------------------------------|
| **协商轮数** | 每轮需要 4 次 LLM 调用（前端上行→Atlas→后端→Atlas→前端下行） | 每轮 3 次 LLM 调用（前端+后端+调解人），轮间无中转 |
| **上下文完整性** | Atlas 转述时丢失细节 | 双方在同一讨论上下文中，信息完整 |
| **决策质量** | Atlas 不具备前后端专业知识 | Oracle 作为调解人提供架构视角 |
| **产出物** | 无结构化产出，只有 Atlas 的文本转述 | 结构化 `NegotiationAgreement` + 可执行的 `artifact` |
| **可追溯性** | 分散在多次 escalation 日志中 | 集中在一次协商会议记录中 |
| **后续验证** | 无法确认双方理解一致 | 集成测试可基于 `artifact` 自动验证契约 |

##### 实现路径增量

在 10.6.15 基础上追加：

| 阶段 | 内容 | 工作量 | 依赖 |
|------|------|--------|------|
| **Phase J** | `CoordinationRequest` + `NegotiationAgreement` 类型 | ~1 天 | Phase A |
| **Phase K** | `AdHocRoundtable` 引擎（复用 10.1 讨论循环逻辑） | ~3 天 | Phase J, 10.1 |
| **Phase L** | `CoordinationHandler` + Atlas 集成 + peer 定位 + 暂停/恢复 | ~3 天 | Phase K, Phase D, 10.4 |
| **Phase M** | 降级策略（上报/仲裁/发起方优先/串行回退） | ~1 天 | Phase L |
| **Phase N** | Inspector 协商面板（圆桌进度可视化） | ~2 天 | Phase K, 10.3 |
| **追加合计** | | **~10 天** | 前置: 10.6 Phase A-E + 10.1 + 10.4 |

**与其他特性的协同更新**：

| 特性 | 与 10.6.16 同级协商的关系 |
|------|-------------------------|
| **10.1 三模式编排** | Ad-hoc Roundtable 复用 RoundtableSession 的讨论循环逻辑，但采用聚焦式协商模板而非开放式讨论 |
| **10.4 断点系统** | 协商前暂停对方 Agent 依赖 checkpoint pause 机制；可在协商开始/结束处设置断点 |
| **10.5 Agent 合成** | 当协商发现需要特殊能力的 Agent（如需要 GraphQL 专家）时，可触发 Agent 合成 |
| **10.6.7 级联重规划** | 协商失败的降级策略 `replan_with_sequence` 触发 Atlas 的级联重规划（并行→串行） |

**风险与开放问题**：

1. **协商质量**：LLM 扮演"前端 Agent"和"后端 Agent"时能否真正产生有价值的技术碰撞？风险同 10.1 的讨论质量问题。**缓解**：各方已有实际执行上下文（不是空谈），质量应优于纯角色扮演
2. **暂停代价**：对方 Agent 可能在关键操作中途被暂停。**缓解**：只在 checkpoint 处暂停（复用 10.4 机制），保证操作原子性
3. **多方协商爆炸**：4+ Agent 同时协商，每轮 5 次 LLM 调用 × 3 轮 = 15 次 LLM 调用。**缓解**：maxRounds 动态调整 + 超时后强制使用调解人裁决

**结论**：同级协商 + 运行时临时圆桌是上行反馈机制的**水平方向补全**。垂直方向（10.6.3–10.6.15）解决"向上汇报"，水平方向（10.6.16）解决"同级协作"。两者结合后，Agent 协作模型从"命令链"演进为"**有主持的协商网络**"——每个 Agent 既可以向上反馈问题，也可以请求与同级建立临时协商通道。这正是从 React 单向数据流到 React Context / 状态管理库的自然演进。

