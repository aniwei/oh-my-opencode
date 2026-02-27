/**
 * Roundtable Agent — Factory function and prompt metadata
 *
 * The Roundtable moderator orchestrates multi-perspective requirements
 * discussions. It delegates to panelist perspectives via task() and
 * synthesizes results into a refined requirements document.
 */

import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "../types"
import { isGptModel } from "../types"
import { buildRoundtableSystemPrompt } from "./system-prompt"
import type { AvailableCategory, AvailableSkill } from "../dynamic-agent-prompt-builder"

const MODE: AgentMode = "subagent"

export const ROUNDTABLE_PROMPT_METADATA: AgentPromptMetadata = {
  category: "advisor",
  cost: "EXPENSIVE",
  promptAlias: "Roundtable",
  keyTrigger: "\"discuss\", \"review proposal\", \"roundtable\", \"need perspectives\" → fire `roundtable`",
  triggers: [
    {
      domain: "Requirements discussion",
      trigger: "Proposal needs multi-perspective review before implementation",
    },
    {
      domain: "Architecture review",
      trigger: "Design decision with trade-offs needing diverse expert input",
    },
    {
      domain: "Feature scoping",
      trigger: "Feature scope unclear, needs structured debate to refine",
    },
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

/**
 * Create a Roundtable agent with dynamic prompt based on available categories and skills.
 */
export function createRoundtableAgent(
  model: string,
  availableCategories: AvailableCategory[] = [],
  availableSkills: AvailableSkill[] = [],
): AgentConfig {
  const prompt = buildRoundtableSystemPrompt(availableCategories, availableSkills)

  const base = {
    description:
      "Multi-perspective requirements discussion moderator. Orchestrates structured debate rounds with expert panelists to refine proposals. (Roundtable - OhMyOpenCode)",
    mode: MODE,
    model,
    temperature: 0.2,
    prompt,
    maxTokens: 64000,
  } as AgentConfig

  if (isGptModel(model)) {
    return { ...base, reasoningEffort: "high", textVerbosity: "high" } as AgentConfig
  }

  return { ...base, thinking: { type: "enabled", budgetTokens: 32000 } } as AgentConfig
}
createRoundtableAgent.mode = MODE
