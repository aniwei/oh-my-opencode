/**
 * Roundtable Agent — Multi-Perspective Requirements Discussion Moderator
 *
 * Named concept: "Roundtable" — a panel of experts with diverse perspectives
 * discussing and refining proposals through structured debate rounds.
 *
 * The Roundtable agent is a moderator that:
 * 1. Receives a proposal/requirement from user or parent agent
 * 2. Selects relevant expert perspectives (panelists)
 * 3. Launches parallel perspective-gathering tasks
 * 4. Synthesizes viewpoints, identifies conflicts
 * 5. Optionally runs focused debate rounds
 * 6. Produces a refined requirements document
 *
 * It uses task() to delegate to panelist perspectives and Oracle for tie-breaking.
 * All artifacts are stored in .sisyphus/roundtable/
 */
export { createRoundtableAgent, ROUNDTABLE_PROMPT_METADATA } from "./agent"
