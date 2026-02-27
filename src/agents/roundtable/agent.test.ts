import { describe, expect, it } from "bun:test"
import { createRoundtableAgent, ROUNDTABLE_PROMPT_METADATA } from "./agent"
import { PANELIST_ROLES, selectPanelistsForTopic, getPanelistRole, buildPanelistPrompt } from "./panelist-roles"
import { buildRoundtableSystemPrompt } from "./system-prompt"

describe("roundtable agent", () => {
  describe("#given createRoundtableAgent factory", () => {
    describe("#when called with a Claude model", () => {
      it("#then returns agent config with thinking enabled", () => {
        const config = createRoundtableAgent("anthropic/claude-opus-4-6")
        expect(config.mode).toBe("subagent")
        expect(config.model).toBe("anthropic/claude-opus-4-6")
        expect(config.temperature).toBe(0.2)
        expect(config.description).toContain("Roundtable")
        expect((config as Record<string, unknown>).thinking).toEqual({
          type: "enabled",
          budgetTokens: 32000,
        })
      })
    })

    describe("#when called with a GPT model", () => {
      it("#then returns agent config with reasoning effort", () => {
        const config = createRoundtableAgent("openai/gpt-5.2")
        expect(config.mode).toBe("subagent")
        expect((config as Record<string, unknown>).reasoningEffort).toBe("high")
      })
    })

    describe("#when checking static mode property", () => {
      it("#then has subagent mode", () => {
        expect(createRoundtableAgent.mode).toBe("subagent")
      })
    })
  })

  describe("#given ROUNDTABLE_PROMPT_METADATA", () => {
    it("#then has correct category and cost", () => {
      expect(ROUNDTABLE_PROMPT_METADATA.category).toBe("advisor")
      expect(ROUNDTABLE_PROMPT_METADATA.cost).toBe("EXPENSIVE")
      expect(ROUNDTABLE_PROMPT_METADATA.promptAlias).toBe("Roundtable")
    })

    it("#then has triggers defined", () => {
      expect(ROUNDTABLE_PROMPT_METADATA.triggers.length).toBeGreaterThan(0)
      expect(ROUNDTABLE_PROMPT_METADATA.triggers[0].domain).toBe("Requirements discussion")
    })

    it("#then has useWhen and avoidWhen", () => {
      expect(ROUNDTABLE_PROMPT_METADATA.useWhen?.length).toBeGreaterThan(0)
      expect(ROUNDTABLE_PROMPT_METADATA.avoidWhen?.length).toBeGreaterThan(0)
    })
  })
})

describe("panelist roles", () => {
  describe("#given PANELIST_ROLES", () => {
    it("#then has at least 5 roles", () => {
      expect(PANELIST_ROLES.length).toBeGreaterThanOrEqual(5)
    })

    it("#then each role has required fields", () => {
      for (const role of PANELIST_ROLES) {
        expect(role.name).toBeTruthy()
        expect(role.title).toBeTruthy()
        expect(role.focusAreas.length).toBeGreaterThan(0)
        expect(role.perspective).toBeTruthy()
        expect(role.evaluationCriteria.length).toBeGreaterThan(0)
      }
    })

    it("#then includes core roles", () => {
      const names = PANELIST_ROLES.map((r) => r.name)
      expect(names).toContain("architect")
      expect(names).toContain("backend")
      expect(names).toContain("frontend")
      expect(names).toContain("qa")
    })
  })

  describe("#given getPanelistRole", () => {
    describe("#when retrieving existing role", () => {
      it("#then returns the role", () => {
        const role = getPanelistRole("architect")
        expect(role).toBeDefined()
        expect(role!.title).toBe("Software Architect")
      })
    })

    describe("#when retrieving non-existent role", () => {
      it("#then returns undefined", () => {
        const role = getPanelistRole("ceo")
        expect(role).toBeUndefined()
      })
    })
  })

  describe("#given selectPanelistsForTopic", () => {
    describe("#when topic mentions UI/frontend", () => {
      it("#then selects frontend panelist", () => {
        const panelists = selectPanelistsForTopic("Redesign the UI dashboard")
        const names = panelists.map((p) => p.name)
        expect(names).toContain("frontend")
        expect(names).toContain("architect")
        expect(names).toContain("qa")
      })
    })

    describe("#when topic mentions authentication", () => {
      it("#then selects security panelist", () => {
        const panelists = selectPanelistsForTopic("Add OAuth2 login support")
        const names = panelists.map((p) => p.name)
        expect(names).toContain("security")
        expect(names).toContain("architect")
      })
    })

    describe("#when topic mentions API design", () => {
      it("#then selects backend panelist", () => {
        const panelists = selectPanelistsForTopic("Design REST API for user management")
        const names = panelists.map((p) => p.name)
        expect(names).toContain("backend")
        expect(names).toContain("architect")
      })
    })

    describe("#when topic is generic", () => {
      it("#then selects at least 4 panelists", () => {
        const panelists = selectPanelistsForTopic("Build a new feature")
        expect(panelists.length).toBeGreaterThanOrEqual(4)
      })
    })

    describe("#when topic mentions deployment", () => {
      it("#then selects devops panelist", () => {
        const panelists = selectPanelistsForTopic("Set up CI/CD pipeline with Docker")
        const names = panelists.map((p) => p.name)
        expect(names).toContain("devops")
      })
    })
  })

  describe("#given buildPanelistPrompt", () => {
    describe("#when building round 1 prompt", () => {
      it("#then includes role and proposal", () => {
        const role = getPanelistRole("architect")!
        const prompt = buildPanelistPrompt({
          role,
          proposal: "Add caching layer to API",
          roundNumber: 1,
        })
        expect(prompt).toContain("Software Architect")
        expect(prompt).toContain("Add caching layer to API")
        expect(prompt).toContain("Round 1")
        expect(prompt).toContain("Support Points")
        expect(prompt).toContain("Concerns & Risks")
      })
    })

    describe("#when building round 2 prompt with previous summary", () => {
      it("#then includes previous round context", () => {
        const role = getPanelistRole("backend")!
        const prompt = buildPanelistPrompt({
          role,
          proposal: "Migrate to microservices",
          roundNumber: 2,
          previousRoundSummary: "Round 1: Architect raised scalability concerns",
        })
        expect(prompt).toContain("Round 2")
        expect(prompt).toContain("Previous Round Summary")
        expect(prompt).toContain("Architect raised scalability concerns")
      })
    })

    describe("#when codebase context is provided", () => {
      it("#then includes context section", () => {
        const role = getPanelistRole("qa")!
        const prompt = buildPanelistPrompt({
          role,
          proposal: "Refactor test suite",
          codebaseContext: "Current test coverage: 75%",
          roundNumber: 1,
        })
        expect(prompt).toContain("Codebase Context")
        expect(prompt).toContain("Current test coverage: 75%")
      })
    })
  })
})

describe("roundtable system prompt", () => {
  describe("#given buildRoundtableSystemPrompt", () => {
    it("#then generates a complete system prompt", () => {
      const prompt = buildRoundtableSystemPrompt(
        [
          { name: "quick", description: "Fast tasks" },
          { name: "ultrabrain", description: "Complex reasoning" },
        ],
        [{ name: "testing", description: "Test utilities", location: "project" }],
      )
      expect(prompt).toContain("Roundtable")
      expect(prompt).toContain("MODERATOR")
      expect(prompt).toContain("Discussion Protocol")
      expect(prompt).toContain("quick")
      expect(prompt).toContain("ultrabrain")
    })
  })
})
