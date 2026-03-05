// 系统 Prompt 构建（§S12.2 六层结构）
import { buildDelegationTable } from '@vitamin/orchestrator'

import type { AgentRegistry } from '@vitamin/orchestrator'
import type { ToolRegistry } from '@vitamin/tools'
import type { ProjectResources, SystemPromptLayers } from '../types'

// 身份 Prompt（Layer 1）
const IDENTITY_PROMPT = `你是 Vitamin，专家级 AI 工程助手。  
目标：高质量完成编码、调试、重构、代码理解，以及产品方案/技术方案讨论、架构设计与规划制定。  
规则：先验证后结论；信息不足先澄清或先用工具探索；不虚构任何未核实的文件/路径/事实；输出简洁、可执行，并严格遵循项目既有风格与约定。
`

// 构建系统 Prompt
export function buildSystemPrompt(
  agentRegistry: AgentRegistry,
  toolRegistry: ToolRegistry,
  resources: ProjectResources,
  options: { activeSkills?: string[]; categoryInfo?: string } = {},
): string {
  const layers = buildSystemPromptLayers(agentRegistry, toolRegistry, resources, options)

  return [
    layers.identity,
    layers.delegationTable,
    layers.toolList,
    layers.projectContext,
    layers.activeSkills,
    layers.categoryInfo,
  ]
    .filter((l) => l.length > 0)
    .join('\n\n---\n\n')
}

// 构建各层（可测试）
export function buildSystemPromptLayers(
  agentRegistry: AgentRegistry,
  toolRegistry: ToolRegistry,
  resources: ProjectResources,
  options: { activeSkills?: string[]; categoryInfo?: string } = {},
): SystemPromptLayers {
  // Layer 1: 身份
  const identity = IDENTITY_PROMPT

  // Layer 2: 委派表
  const registrations = agentRegistry.getAvailable()
  const delegationTable = registrations.length > 0 ? buildDelegationTable(registrations) : ''

  // Layer 3: 工具列表
  const tools = toolRegistry.getAll()
  const toolDescriptions = tools.map((t) => `- ${t.name}: ${t.description}`).join('\n')
  const toolList = tools.length > 0 ? `## Available Tools\n\n${toolDescriptions}` : ''

  // Layer 4: 项目上下文
  const contextParts: string[] = []
  if (resources.agentsMd !== null) {
    contextParts.push(`## Project Context (AGENTS.md)\n\n${resources.agentsMd}`)
  }
  if (resources.rules.length > 0) {
    contextParts.push(`## Project Rules\n\n${resources.rules.join('\n\n---\n\n')}`)
  }
  const projectContext = contextParts.join('\n\n')

  // Layer 5: 活跃 Skill
  const activeSkills =
    options.activeSkills && options.activeSkills.length > 0
      ? `## Active Skills\n\n${options.activeSkills.map((s) => `- ${s}`).join('\n')}`
      : ''

  // Layer 6: Category 信息
  const categoryInfo = options.categoryInfo ?? ''

  return { identity, delegationTable, toolList, projectContext, activeSkills, categoryInfo }
}
