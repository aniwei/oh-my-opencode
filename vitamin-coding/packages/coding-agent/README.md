# @vitamin/coding-agent

Main CLI product for Vitamin Coding Agent. Supports interactive, print, JSON, and RPC modes, with slash commands, doctor diagnostics, install wizard, and config management.

## Installation

```bash
pnpm add -g @vitamin/coding-agent
```

## Usage

```typescript
import { main, parseCLI, createAgentSession } from '@vitamin/coding-agent'

// Run as CLI
await main()

// Or create a session programmatically
const session = await createAgentSession({
  mode: 'interactive',
  projectDir: process.cwd(),
})
```

### CLI Commands

```bash
vitamin                        # Interactive mode (default)
vitamin "fix the login bug"    # Print mode with initial prompt
vitamin run --json             # JSON output mode
vitamin doctor                 # Health diagnostics
vitamin install                # Interactive setup wizard
vitamin config get agents      # Config management
```

## Key Exports

| Export | Description |
|--------|-------------|
| `main` | CLI entry point |
| `parseCLI`, `parseCLIFull` | CLI argument parser |
| `createAgentSession` | Programmatic session creation |
| `buildSystemPrompt` | System prompt assembly |
| `SlashCommandRegistry`, `BUILTIN_COMMANDS` | Slash command system |
| `createKeyBindings` | Key binding registry |
| `createInteractiveMode` | Interactive TUI mode |
| `createPrintMode` | Streaming print mode |
| `createJsonMode` | Structured JSON output mode |
| `executeDoctorCommand` | Doctor diagnostics |
| `executeInstallCommand` | Install wizard |
| `executeConfigCommand` | Config CLI |

## Types

`RunMode`, `CLIOptions`, `AgentSession`, `SlashCommandDef`, `ModeRunner`, `OutputEvent`, `JsonOutput`, `CheckResult`

## License

See [root README](../../README.md) for details.
