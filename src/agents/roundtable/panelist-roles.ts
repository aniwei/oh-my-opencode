/**
 * Panelist role definitions for the Roundtable discussion system.
 *
 * Each role represents a distinct technical perspective that can participate
 * in requirements discussions. The moderator selects relevant roles based
 * on the discussion topic.
 */

export interface PanelistRole {
  /** Role identifier used in prompts */
  name: string
  /** Human-readable title */
  title: string
  /** What this role focuses on during review */
  focusAreas: string[]
  /** The perspective lens this role applies */
  perspective: string
  /** Typical evaluation criteria */
  evaluationCriteria: string[]
}

export const PANELIST_ROLES: PanelistRole[] = [
  {
    name: "architect",
    title: "Software Architect",
    focusAreas: [
      "System design and component boundaries",
      "Scalability and extensibility",
      "Integration patterns and dependencies",
      "Technical debt implications",
    ],
    perspective:
      "Evaluate proposals through the lens of system-level design, long-term maintainability, and architectural coherence.",
    evaluationCriteria: [
      "Does this fit the existing architecture?",
      "What are the scaling implications?",
      "Are component boundaries clean?",
      "What technical debt does this introduce or resolve?",
    ],
  },
  {
    name: "backend",
    title: "Backend Engineer",
    focusAreas: [
      "API design and data flow",
      "Performance and efficiency",
      "Error handling and resilience",
      "Data modeling and storage",
    ],
    perspective:
      "Evaluate proposals through the lens of server-side implementation, data integrity, and operational reliability.",
    evaluationCriteria: [
      "Is the API design clean and consistent?",
      "Are error cases handled?",
      "What are the performance implications?",
      "Is the data model appropriate?",
    ],
  },
  {
    name: "frontend",
    title: "Frontend Engineer",
    focusAreas: [
      "User interaction and experience",
      "Component design and reusability",
      "State management complexity",
      "Accessibility and responsiveness",
    ],
    perspective:
      "Evaluate proposals through the lens of user-facing implementation, UI/UX quality, and frontend maintainability.",
    evaluationCriteria: [
      "Is the user experience intuitive?",
      "Are components reusable?",
      "Is state management reasonable?",
      "Are accessibility requirements met?",
    ],
  },
  {
    name: "qa",
    title: "QA/Testing Engineer",
    focusAreas: [
      "Testability and test strategy",
      "Edge cases and failure modes",
      "Regression risk assessment",
      "Acceptance criteria clarity",
    ],
    perspective:
      "Evaluate proposals through the lens of verifiability, risk coverage, and quality assurance.",
    evaluationCriteria: [
      "Can each requirement be tested?",
      "What edge cases are missing?",
      "What is the regression risk?",
      "Are acceptance criteria clear and measurable?",
    ],
  },
  {
    name: "product",
    title: "Product/Requirements Analyst",
    focusAreas: [
      "User value and business alignment",
      "Scope definition and prioritization",
      "User story completeness",
      "Success metrics",
    ],
    perspective:
      "Evaluate proposals through the lens of user value, business goals, and requirements completeness.",
    evaluationCriteria: [
      "Does this solve the right problem?",
      "Is the scope well-defined?",
      "Are user stories complete?",
      "How do we measure success?",
    ],
  },
  {
    name: "security",
    title: "Security Engineer",
    focusAreas: [
      "Authentication and authorization",
      "Data protection and privacy",
      "Input validation and injection prevention",
      "Threat modeling",
    ],
    perspective:
      "Evaluate proposals through the lens of security posture, threat surface, and compliance.",
    evaluationCriteria: [
      "What is the threat surface?",
      "Are auth flows secure?",
      "Is sensitive data protected?",
      "Are there injection vectors?",
    ],
  },
  {
    name: "devops",
    title: "DevOps/Infrastructure Engineer",
    focusAreas: [
      "Deployment and rollback strategy",
      "Monitoring and observability",
      "Infrastructure requirements",
      "CI/CD impact",
    ],
    perspective:
      "Evaluate proposals through the lens of operational readiness, deployment safety, and infrastructure impact.",
    evaluationCriteria: [
      "How does this deploy?",
      "Can we roll back safely?",
      "What monitoring is needed?",
      "What infrastructure changes are required?",
    ],
  },
  {
    name: "dx",
    title: "Developer Experience Engineer",
    focusAreas: [
      "API ergonomics and developer usability",
      "Documentation requirements",
      "Migration and adoption path",
      "Cognitive load on maintainers",
    ],
    perspective:
      "Evaluate proposals through the lens of developer productivity, learning curve, and code maintainability.",
    evaluationCriteria: [
      "Is the API intuitive to use?",
      "What documentation is needed?",
      "How hard is the migration?",
      "Will future developers understand this?",
    ],
  },
]

/**
 * Build a markdown table of available panelist roles for the moderator prompt.
 */
export function buildPanelistRoleTable(): string {
  const header = "| Role | Title | Focus Areas | Perspective |\n|------|-------|-------------|-------------|"
  const rows = PANELIST_ROLES.map(
    (role) =>
      `| \`${role.name}\` | ${role.title} | ${role.focusAreas.slice(0, 2).join(", ")} | ${role.perspective.slice(0, 80)}... |`,
  )
  return [header, ...rows].join("\n")
}

/**
 * Build a panelist-specific discussion prompt for a given role and topic.
 */
export function buildPanelistPrompt(input: {
  role: PanelistRole
  proposal: string
  codebaseContext?: string
  roundNumber: number
  previousRoundSummary?: string
}): string {
  const { role, proposal, codebaseContext, roundNumber, previousRoundSummary } = input

  const contextSection = codebaseContext
    ? `\n## Codebase Context\n${codebaseContext}\n`
    : ""

  const previousSection = previousRoundSummary
    ? `\n## Previous Round Summary\n${previousRoundSummary}\n`
    : ""

  return `# Roundtable Discussion — Round ${roundNumber}

## Your Role: ${role.title}

${role.perspective}

### Your Focus Areas
${role.focusAreas.map((f) => `- ${f}`).join("\n")}

### Your Evaluation Criteria
${role.evaluationCriteria.map((c) => `- ${c}`).join("\n")}
${contextSection}${previousSection}
## Proposal Under Discussion

${proposal}

## Your Deliverable (STRICT FORMAT)

### Support Points
List what you think is well-designed or correctly scoped from your perspective.

### Concerns & Risks
List specific risks, gaps, or problems you identify. Rate each: BLOCKING / SIGNIFICANT / MINOR.

### Questions
Questions that need answers before proceeding (from your domain's perspective).

### Suggestions
Concrete improvement suggestions with rationale.

## Rules
- Stay within your role's domain — do not evaluate areas outside your expertise
- Be specific — cite concrete technical details, not vague concerns
- Be constructive — every concern should have a suggested mitigation
- Rate severity honestly — not everything is BLOCKING
- Keep total response under 800 words`
}

/**
 * Get panelist role by name.
 */
export function getPanelistRole(name: string): PanelistRole | undefined {
  return PANELIST_ROLES.find((role) => role.name === name)
}

/**
 * Select relevant panelist roles based on topic keywords.
 */
export function selectPanelistsForTopic(topic: string): PanelistRole[] {
  const lower = topic.toLowerCase()

  const always: string[] = ["architect", "qa"]
  const selected = new Set<string>(always)

  if (matchesAny(lower, ["ui", "ux", "frontend", "component", "page", "view", "css", "style", "layout", "responsive"]))
    selected.add("frontend")

  if (matchesAny(lower, ["api", "backend", "server", "database", "db", "query", "endpoint", "rest", "graphql", "grpc"]))
    selected.add("backend")

  if (matchesAny(lower, ["auth", "login", "password", "token", "jwt", "oauth", "permission", "rbac", "encrypt", "security"]))
    selected.add("security")

  if (matchesAny(lower, ["deploy", "ci", "cd", "docker", "k8s", "kubernetes", "monitor", "infra", "pipeline"]))
    selected.add("devops")

  if (matchesAny(lower, ["sdk", "plugin", "api design", "dx", "developer", "documentation", "migration"]))
    selected.add("dx")

  if (matchesAny(lower, ["user", "feature", "requirement", "story", "scope", "mvp", "product", "priority"]))
    selected.add("product")

  if (selected.size < 4) {
    selected.add("backend")
    selected.add("frontend")
  }

  return PANELIST_ROLES.filter((role) => selected.has(role.name))
}

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw))
}
