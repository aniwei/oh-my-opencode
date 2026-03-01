// Agent 元数据 — 模型优先级和工具限制常量
import type { AgentPromptMetadata } from '../types'

// Agent 模型优先级链 (来源: DEVELOPMENT-SPEC.md §S7.8)
export const AGENT_MODEL_PRIORITY: Record<string, string[]> = {
  sisyphus: ['claude-opus-4-6', 'gpt-5.2', 'kimi-k2.5', 'gemini-3.1-pro'],
  hephaestus: ['gpt-5.3-codex', 'claude-opus-4-6', 'gemini-3.1-pro', 'copilot-sonnet'],
  prometheus: ['claude-opus-4-6', 'gpt-5.2', 'kimi-k2.5', 'gemini-3.1-pro'],
  oracle: ['gpt-5.2(high)', 'claude-opus-4-6', 'gemini-3.1-pro'],
  momus: ['gpt-5.2(low)', 'claude-sonnet-4-6', 'gemini-3-flash'],
  atlas: ['kimi-k2.5', 'claude-sonnet-4-6', 'gemini-3-flash'],
  metis: ['claude-opus-4-6', 'gpt-5.2', 'gemini-3.1-pro'],
  explore: ['grok-code-fast(FREE)', 'gemini-3-flash', 'kimi-k2.5'],
  librarian: ['gemini-3-flash', 'kimi-k2.5', 'copilot-sonnet', 'claude-sonnet'],
  roundtable: ['claude-opus-4-6(max)', 'gpt-5.2(high)', 'kimi-k2.5', 'gemini-3.1-pro'],
  'sisyphus-junior': ['claude-haiku-4-5', 'gpt-4.1-mini', 'gemini-3-flash'],
  'multimodal-looker': ['claude-sonnet-4-6', 'gemini-3.1-pro', 'gpt-5.2'],
}

// Agent 工具限制表 (来源: DEVELOPMENT-SPEC.md §S5.3)
export const AGENT_TOOL_RESTRICTIONS: Record<string, { allowed?: string[]; denied?: string[] }> = {
  explore: { allowed: ['read', 'grep', 'glob', 'find', 'ls', 'ast-grep'] },
  oracle: { allowed: ['read', 'grep', 'glob', 'find', 'ls', 'ast-grep'] },
  librarian: { allowed: ['read', 'grep', 'glob', 'mcp:websearch:*', 'mcp:context7:*'] },
  atlas: { denied: ['write', 'edit', 'edit-diff', 'bash'] },
}

// Agent 元数据定义 (来源: DEVELOPMENT-SPEC.md §S7.5)
export const AGENT_METADATA: Record<string, AgentPromptMetadata> = {
  sisyphus: {
    category: 'orchestrator',
    cost: 'EXPENSIVE',
    triggers: [
      { domain: 'general', trigger: 'default orchestrator for complex tasks' },
    ],
    useWhen: ['complex multi-step tasks', 'tasks requiring delegation'],
    executionMode: 'sync',
  },
  hephaestus: {
    category: 'specialist',
    cost: 'EXPENSIVE',
    triggers: [
      { domain: 'code', trigger: 'refactor|redesign|implement|build' },
    ],
    useWhen: ['deep implementation work', 'large refactoring'],
    executionMode: 'both',
  },
  explore: {
    category: 'exploration',
    cost: 'CHEAP',
    triggers: [
      { domain: 'search', trigger: 'find|search|locate|where|which' },
    ],
    useWhen: ['codebase exploration', 'finding files or patterns'],
    avoidWhen: ['tasks requiring writes'],
    executionMode: 'both',
  },
  oracle: {
    category: 'advisor',
    cost: 'MODERATE',
    triggers: [
      { domain: 'strategy', trigger: 'explain|analyze|review|evaluate' },
    ],
    useWhen: ['strategic analysis', 'code review', 'architecture decisions'],
    avoidWhen: ['tasks requiring writes'],
    executionMode: 'sync',
  },
  librarian: {
    category: 'exploration',
    cost: 'CHEAP',
    triggers: [
      { domain: 'knowledge', trigger: 'documentation|api|library|docs' },
    ],
    useWhen: ['external knowledge lookup', 'API documentation'],
    avoidWhen: ['tasks requiring writes'],
    executionMode: 'both',
  },
  'sisyphus-junior': {
    category: 'utility',
    cost: 'CHEAP',
    triggers: [
      { domain: 'quick', trigger: 'quick|simple|small|fast' },
    ],
    useWhen: ['quick category tasks', 'small independent tasks'],
    executionMode: 'both',
  },
  prometheus: {
    category: 'specialist',
    cost: 'EXPENSIVE',
    triggers: [
      { domain: 'planning', trigger: 'plan|design|architect|propose' },
    ],
    useWhen: ['complex task planning', 'structured plan generation'],
    avoidWhen: ['simple tasks', 'direct implementation'],
    executionMode: 'sync',
  },
  momus: {
    category: 'advisor',
    cost: 'MODERATE',
    triggers: [
      { domain: 'review', trigger: 'review|validate|approve' },
    ],
    useWhen: ['plan review', 'quality gate checks'],
    executionMode: 'sync',
  },
  metis: {
    category: 'advisor',
    cost: 'MODERATE',
    triggers: [
      { domain: 'analysis', trigger: 'analyze|assess|evaluate|complexity' },
    ],
    useWhen: ['pre-planning analysis', 'complexity assessment'],
    executionMode: 'sync',
  },
  atlas: {
    category: 'orchestrator',
    cost: 'MODERATE',
    triggers: [
      { domain: 'execution', trigger: 'execute|start-work|run-plan' },
    ],
    useWhen: ['plan execution', 'parallel task orchestration'],
    avoidWhen: ['tasks without a plan'],
    executionMode: 'sync',
  },
  'multimodal-looker': {
    category: 'utility',
    cost: 'MODERATE',
    triggers: [
      { domain: 'visual', trigger: 'screenshot|image|look|visual|UI' },
    ],
    useWhen: ['screenshot analysis', 'visual inspection', 'UI verification'],
    executionMode: 'sync',
  },
}
