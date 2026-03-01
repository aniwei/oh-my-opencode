# @vitamin/tui

Terminal UI framework with a diff-based renderer, 12 components, overlay system, theme support, and CJK/IME input handling.

## Installation

```bash
pnpm add @vitamin/tui
```

## Usage

```typescript
import { createTerminal, createRenderer, createInputComponent, createMarkdownComponent } from '@vitamin/tui'

const terminal = createTerminal({ stdin: process.stdin, stdout: process.stdout })
const renderer = createRenderer({ terminal })

const input = createInputComponent({ placeholder: 'Type a message...' })
const markdown = createMarkdownComponent({ content: '# Hello' })
renderer.render([markdown, input])
```

## Key Exports

| Export | Description |
|--------|-------------|
| `Renderer`, `createRenderer` | Diff-based terminal renderer |
| `Terminal`, `createTerminal` | Terminal abstraction layer |
| `ThemeManager`, `createThemeManager` | Theme system with dark/light presets |
| `parseKey`, `isPrintable` | Key input parser |
| `ImeHandler`, `createImeHandler` | CJK IME composition handler |
| `OverlayManager`, `createOverlayManager` | Overlay/modal system |

### Components (12)

| Component | Factory |
|-----------|---------|
| Text | `createTextComponent` |
| Input | `createInputComponent` |
| Editor | `createEditorComponent` |
| Markdown | `createMarkdownComponent` |
| Loader | `createLoaderComponent` |
| Select List | `createSelectListComponent` |
| Box | `createBoxComponent` |
| Image | `createImageComponent` |
| Tool Output | `createToolOutputComponent` |
| Agent Header | `createAgentHeaderComponent` |
| Session List | `createSessionListComponent` |
| Message Display | `createMessageDisplayComponent` |

### Utilities

`stripAnsi`, `measureWidth`, `truncateToWidth`, `wrapText`, `COLORS`, `style`, `moveCursor`, `clearScreen`

## License

See [root README](../../README.md) for details.
