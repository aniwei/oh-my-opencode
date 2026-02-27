import { createSystemDirective, SystemDirectiveTypes } from "../../shared/system-directive"
import { getAgentDisplayName } from "../../shared/agent-display-names"

export const HOOK_NAME = "roundtable-md-only"

export const ROUNDTABLE_AGENT = "roundtable"

export const ALLOWED_EXTENSIONS = [".md"]

export const BLOCKED_TOOLS = ["Write", "Edit", "write", "edit"]

export const TASK_TOOLS = ["task", "call_omo_agent"]

export const DISCUSSION_CONSULT_WARNING = `

---

${createSystemDirective(SystemDirectiveTypes.PROMETHEUS_READ_ONLY)}

You are being invoked by ${getAgentDisplayName("roundtable")}, a READ-ONLY discussion moderator agent.

**CRITICAL CONSTRAINTS:**
- DO NOT modify any files (no Write, Edit, or any file mutations)
- DO NOT execute commands that change system state
- ONLY provide analysis, perspectives, and recommendations from your assigned role

**YOUR ROLE**: You are a panelist in a requirements roundtable discussion.
Provide your expert perspective on the proposal.
Return your analysis in the required format (Support / Concerns / Questions / Suggestions).

---

`
