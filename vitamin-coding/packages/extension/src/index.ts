// @vitamin/extension — 扩展系统

// 运行器
export { ExtensionRunner, createExtensionRunner } from './extension-runner'

// 加载器
export { ExtensionLoader, createExtensionLoader } from './extension-loader'

// 事件总线
export { ExtensionEventBus, createExtensionEventBus } from './event-bus'

// API 构建器
export {
  buildExtensionApi,
  createExtensionRegistry,
} from './api-builder'
export type { ExtensionRegistry, ApiBuilderConfig } from './api-builder'

// 工具拦截包装器
export { ToolWrapper, createToolWrapper } from './tool-wrapper'
export type {
  ToolInterceptResult,
  ToolResultModifyResult,
} from './tool-wrapper'

// 内置 Extension
export {
  createPlanModeExtension,
  createPlanModeDescriptor,
  createSkillLoaderExtension,
  createSkillLoaderDescriptor,
  createGitMasterExtension,
  createGitMasterDescriptor,
  createTmuxManagerExtension,
  createTmuxManagerDescriptor,
  parseTmuxSessions,
} from './extensions'
export type {
  PlanModeCallbacks,
  SkillLoaderCallbacks,
  SkillDefinition,
  GitMasterCallbacks,
  GitOperationResult,
  TmuxManagerCallbacks,
  TmuxSession,
} from './extensions'

// 类型导出
export type {
  ExtensionEventName,
  ExtensionEventPayloads,
  ExtensionEventHandler,
  ToolInterceptEvent,
  ToolResultInterceptEvent,
  InputInterceptEvent,
  SlashCommand,
  ExtensionAPI,
  ExtensionFactory,
  ExtensionDescriptor,
  ExtensionSource,
  ExtensionLoadResult,
  ExtensionRunnerConfig,
  LoadedExtension,
} from './types'
