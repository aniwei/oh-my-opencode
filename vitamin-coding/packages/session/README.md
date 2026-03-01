# @vitamin/session

Session management with tree-structured conversation branching, JSONL persistent storage, 3 compaction strategies, todo preservation, and HTML export.

## Installation

```bash
pnpm add @vitamin/session
```

## Usage

```typescript
import { createSessionManager, createJsonlStorage, createCompactor } from '@vitamin/session'

const storage = createJsonlStorage({ dir: '.vitamin/sessions' })
const manager = createSessionManager({ storage })

const session = await manager.create({ title: 'Debug auth issue' })
await manager.append(session.id, { role: 'user', content: 'Fix the login bug' })
```

## Key Exports

| Export | Description |
|--------|-------------|
| `SessionManager`, `createSessionManager` | Session lifecycle management |
| `SessionTree`, `createSessionTree` | Tree-structured conversation branching |
| `buildTree`, `pathToNode`, `getLeafNodes`, `createBranchPoint` | Tree utilities |
| `JsonlStorage`, `createJsonlStorage` | JSONL persistent storage |
| `Compactor`, `createCompactor` | Compaction engine |
| `createSummaryStrategy` | Summary-based compaction |
| `createSlidingWindowStrategy` | Sliding window compaction |
| `createIncrementalStrategy` | Incremental compaction |
| `extractTodoItems`, `extractTodoState`, `appendTodoState` | Todo preservation across compaction |
| `exportToHtml` | HTML session export |

## Types

`SessionEntry`, `SessionMetadata`, `SessionNode`, `SessionSummary`, `CompactionStrategy`, `CompactionResult`, `StrategyName`, `HtmlExportOptions`, `TodoItem`

## License

See [root README](../../README.md) for details.
