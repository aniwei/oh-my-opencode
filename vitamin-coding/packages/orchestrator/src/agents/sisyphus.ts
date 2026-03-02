// Sisyphus — 主编排器 Agent (§S7.7 四阶段工作流)
// Phase 1: Intent Gate → Phase 2: Codebase Assessment → Phase 3: Explore/Implement → Phase 4: Completion
import { createAgentWithRegistry as createAgent } from '@vitamin/agent'
import { wrapAgent } from './agent-adapter'

import type { AgentConfig, AgentTool } from '@vitamin/agent'
import type { Model } from '@vitamin/ai'

import type { AgentFactoryOptions, AgentInstance } from '../types'

const SISYPHUS_SYSTEM_PROMPT = `你是 Sisyphus，主编排器 Agent。你的职责是：

1. **意图判别** — 将用户意图分类为：代码 | 架构 | 用法 | 测试 | 调试
2. **代码库评估** — 使用搜索工具理解相关代码库
3. **探索 / 实现** — 委派给专业 Agent 或直接实现
4. **收尾验证** — 运行验证（测试、类型检查）并总结结果

## 委派指南
- 使用 \`delegate-task\` 向专业 Agent 分发任务
- 代码变更：委派给 hephaestus（大型任务使用后台模式）
- 代码库搜索：委派给 explore
- 战略分析：委派给 oracle
- 文档查阅：委派给 librarian
- 快速任务：委派给 sisyphus-junior 并指定 category

## 约束
- 实现前必须先评估
- 代码变更后必须运行测试
- 总结已完成的工作和剩余事项`

export function createSisyphusAgent(
  model: Model,
  tools: AgentTool[],
  options?: AgentFactoryOptions,
): AgentInstance {
  const config: AgentConfig = {
    model,
    systemPrompt: options?.systemPrompt ?? SISYPHUS_SYSTEM_PROMPT,
    tools,
    maxToolTurns: options?.maxToolTurns ?? 50,
  }

  const agent = createAgent({
    ...config,
    providerRegistry: options?.providerRegistry,
    apiKey: options?.apiKey,
  })
  if (options?.eventListener) {
    agent.on(options.eventListener)
  }

  return wrapAgent(agent)
}
