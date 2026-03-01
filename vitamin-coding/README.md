# vitamin-coding

> AI coding agent monorepo — multi-agent orchestration, extensible tool system, and terminal UI.

## Packages

| Package | Description |
|---------|-------------|
| `@vitamin/shared` | Common utilities: logger, fs, path, event emitter, types |
| `@vitamin/config` | JSONC configuration loader with Zod validation and migration |
| `@vitamin/ai` | AI provider abstraction: 6 providers, streaming, fallback chains |
| `@vitamin/agent` | Agent state machine: dual-loop execution, tool calling |
| `@vitamin/tools` | Tool registry with 26+ built-in tools (read/write/edit/bash/grep/glob/...) |
| `@vitamin/hooks` | Lifecycle hook engine with 17 hooks across session/tool-guard/transform tiers |
| `@vitamin/orchestrator` | Multi-agent orchestration: 14 agents, task dispatch, Plan/Build pipeline |
| `@vitamin/session` | Session management: tree structure, JSONL storage, compaction strategies |
| `@vitamin/extension` | Extension API: tool/command/event registration, 4 built-in extensions |
| `@vitamin/mcp` | MCP protocol: stdio/HTTP transport, OAuth, skill-embedded MCP |
| `@vitamin/tui` | Terminal UI framework: diff renderer, 12 components, overlay system |
| `@vitamin/coding-agent` | Main product CLI: interactive/print/JSON modes, slash commands |
| `@vitamin/sdk` | Embeddable SDK: `createVitaminAgent()`, RPC server/client |

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Architecture

```
@vitamin/coding-agent (CLI entry)
  ├── @vitamin/tui          (terminal rendering)
  ├── @vitamin/orchestrator  (multi-agent dispatch)
  │   ├── @vitamin/agent     (agent state machine)
  │   │   └── @vitamin/ai    (LLM providers)
  │   └── @vitamin/tools     (tool registry)
  ├── @vitamin/hooks         (lifecycle hooks)
  ├── @vitamin/session       (session persistence)
  ├── @vitamin/extension     (extension system)
  ├── @vitamin/mcp           (MCP protocol)
  └── @vitamin/config        (configuration)

@vitamin/sdk (embeddable agent)
  └── @vitamin/coding-agent
```

## Development

- **Runtime**: Node.js >= 22
- **Package Manager**: pnpm 9.15.4
- **Build**: tsup (ESM + declarations)
- **Test**: Vitest
- **Lint**: Biome
- **Monorepo**: Turborepo

## Commands

```bash
pnpm build              # Build all packages
pnpm test               # Run all tests
pnpm test:coverage      # Run tests with coverage
pnpm typecheck          # Type check all packages
pnpm lint               # Lint all files
pnpm lint:fix           # Auto-fix lint issues
pnpm clean              # Clean all build artifacts
pnpm publish:packages   # Publish all packages to npm
pnpm version:bump 0.1.0 # Bump all package versions
```

## License

MIT
