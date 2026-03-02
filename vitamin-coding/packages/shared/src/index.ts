export {
  VitaminError,
  ConfigError,
  ProviderError,
  StreamError,
  AgentError,
  ToolError,
  HookError,
  SessionError,
  ExtensionError,
  McpError,
} from './error'

export type {
  Brand,
  DeepPartial,
  DeepReadonly,
  Awaitable,
  VoidCallback,
  AsyncVoidCallback,
} from './types'

export { TypedEventEmitter } from './event-emitter'
export type { EventMap } from './event-emitter'

export {
  createDisposable,
  createAsyncDisposable,
  DisposableStack,
  AsyncDisposableStack,
} from './disposable'
export type { Disposable, AsyncDisposable } from './disposable'

export { createLogger, getRootLogger, attachLogListener } from './logger'

export {
  readTextFile,
  writeTextFile,
  mkdirp,
  rimraf,
  pathExists,
  isDirectory,
  isFile,
} from './fs'

export { normalizePath, resolvePath, findProjectRoot } from './path'

export { spawnProcess } from './process'
export type { SpawnOptions, SpawnResult } from './process'

export {
  truncate,
  slugify,
  estimateTokens,
  truncateToTokenBudget,
} from './string'

export { parseJsonc, safeStringify } from './json'
