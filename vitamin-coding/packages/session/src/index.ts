// @vitamin/session — 会话管理

// 会话管理器
export { SessionManager, createSessionManager } from './session-manager'
export type { SessionManagerConfig } from './session-manager'

// 会话树
export {
  SessionTree,
  createSessionTree,
  buildTree,
  pathToNode,
  getLeafNodes,
  getMessagesForEntry,
  createBranchPoint,
} from './session-tree'

// JSONL 存储
export { JsonlStorage, createJsonlStorage } from './storage/jsonl-storage'

// 压缩引擎
export { Compactor, createCompactor } from './compaction/compactor'
export type { CompactorConfig, StrategyName } from './compaction/compactor'

// 压缩策略
export { SummaryStrategy, createSummaryStrategy } from './compaction/strategies/summary'
export { SlidingWindowStrategy, createSlidingWindowStrategy } from './compaction/strategies/sliding-window'
export { IncrementalStrategy, createIncrementalStrategy } from './compaction/strategies/incremental'

// Todo 保留
export {
  extractTodoItems,
  extractTodoState,
  appendTodoState,
} from './compaction/todo-preserver'
export type { TodoItem } from './compaction/todo-preserver'

// HTML 导出
export { exportToHtml } from './export/html-export'

// 类型
export type {
  SessionEntry,
  SystemEvent,
  CompactionRecord,
  SessionMetadata,
  SessionNode,
  SessionSummary,
  BoulderState,
  CompactionStrategy,
  CompactionOptions,
  CompactionResult,
  SessionStorage,
  HtmlExportOptions,
  MarkdownExportOptions,
  JsonExportOptions,
  TokenUsage,
  SessionSearchOptions,
  AutoTitleGenerator,
} from './types'
