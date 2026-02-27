import type { PluginInput } from "@opencode-ai/plugin"
import { HOOK_NAME, ROUNDTABLE_AGENT, BLOCKED_TOOLS, TASK_TOOLS, DISCUSSION_CONSULT_WARNING } from "./constants"
import { log } from "../../shared/logger"
import { getAgentDisplayName } from "../../shared/agent-display-names"
import { getAgentFromSession } from "../prometheus-md-only/agent-resolution"
import { isAllowedFile } from "../prometheus-md-only/path-policy"

function isRoundtableAgent(agentName: string | undefined): boolean {
  return agentName?.toLowerCase().includes(ROUNDTABLE_AGENT) ?? false
}

/**
 * Hook that restricts the Roundtable agent to only write .md files
 * inside .sisyphus/ directory (specifically .sisyphus/roundtable/).
 *
 * Mirrors the prometheus-md-only hook pattern but for the Roundtable moderator.
 */
export function createRoundtableMdOnlyHook(ctx: PluginInput) {
  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown>; message?: string },
    ): Promise<void> => {
      const agentName = await getAgentFromSession(input.sessionID, ctx.directory, ctx.client)

      if (!isRoundtableAgent(agentName)) {
        return
      }

      const toolName = input.tool

      if (TASK_TOOLS.includes(toolName)) {
        const prompt = output.args.prompt as string | undefined
        if (prompt) {
          output.args.prompt = DISCUSSION_CONSULT_WARNING + prompt
          log(`[${HOOK_NAME}] Injected discussion panelist warning to ${toolName}`, {
            sessionID: input.sessionID,
            tool: toolName,
            agent: agentName,
          })
        }
        return
      }

      if (!BLOCKED_TOOLS.includes(toolName)) {
        return
      }

      const filePath = (output.args.filePath ?? output.args.path ?? output.args.file) as string | undefined
      if (!filePath) {
        return
      }

      if (!isAllowedFile(filePath, ctx.directory)) {
        log(`[${HOOK_NAME}] Blocked: Roundtable can only write to .sisyphus/*.md`, {
          sessionID: input.sessionID,
          tool: toolName,
          filePath,
          agent: agentName,
        })
        throw new Error(
          `[${HOOK_NAME}] ${getAgentDisplayName("roundtable")} can only write/edit .md files inside .sisyphus/ directory. ` +
          `Attempted to modify: ${filePath}. ` +
          `${getAgentDisplayName("roundtable")} is a READ-ONLY discussion moderator. ` +
          `Discussion artifacts should be written to .sisyphus/roundtable/`,
        )
      }

      log(`[${HOOK_NAME}] Allowed: .sisyphus/*.md write permitted for roundtable`, {
        sessionID: input.sessionID,
        tool: toolName,
        filePath,
        agent: agentName,
      })
    },
  }
}
