# @vitamin/extension

Extension API for tool, command, and event registration. Ships with 4 built-in extensions: plan-mode, skill-loader, git-master, and tmux-manager.

## Installation

```bash
pnpm add @vitamin/extension
```

## Usage

```typescript
import { createExtensionRunner, createExtensionLoader, createPlanModeExtension } from '@vitamin/extension'

const runner = createExtensionRunner()
const loader = createExtensionLoader({ runner })

runner.register(createPlanModeExtension({ onPlanStart: (plan) => console.log(plan) }))
await runner.start()
```

## Key Exports

| Export | Description |
|--------|-------------|
| `ExtensionRunner`, `createExtensionRunner` | Extension lifecycle runner |
| `ExtensionLoader`, `createExtensionLoader` | Extension discovery and loading |
| `ExtensionEventBus`, `createExtensionEventBus` | Inter-extension event bus |
| `buildExtensionApi`, `createExtensionRegistry` | API builder for extensions |
| `ToolWrapper`, `createToolWrapper` | Tool intercept/modify wrapper |

### Built-in Extensions (4)

| Extension | Factory |
|-----------|---------|
| Plan Mode | `createPlanModeExtension` |
| Skill Loader | `createSkillLoaderExtension` |
| Git Master | `createGitMasterExtension` |
| Tmux Manager | `createTmuxManagerExtension` |

## Types

`ExtensionAPI`, `ExtensionFactory`, `ExtensionDescriptor`, `SlashCommand`, `ToolInterceptEvent`, `ToolResultInterceptEvent`, `InputInterceptEvent`

## License

See [root README](../../README.md) for details.
