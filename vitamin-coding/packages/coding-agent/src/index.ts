// @vitamin/coding-agent — 主产品 CLI

// 入口
export { main } from './main'
export { parseCLI, parseCLIFull } from './cli'
export type { SubCommand, ParsedCLI } from './cli'

// 核心
export { createAgentSession } from './core/agent-session'
export { buildSystemPrompt, buildSystemPromptLayers } from './core/system-prompt'
export { loadProjectResources, createResourceLoader } from './core/resource-loader'
export {
  SlashCommandRegistry,
  createSlashCommandRegistry,
  parseSlashCommand,
  BUILTIN_COMMANDS,
} from './core/slash-commands'
export { createKeyBindings, sequenceToKeyId, DEFAULT_KEY_DESCRIPTIONS } from './core/keybindings'
export type { KeyId, KeyHandler, KeyBinding, KeyBindingRegistry } from './core/keybindings'

// 模式
export { createPrintMode } from './modes/print'
export { createJsonMode } from './modes/json'
export { createInteractiveMode } from './modes/interactive'

// 命令
export { executeRunCommand, createRunCommandHelp } from './commands/run'
export { executeDoctorCommand, createDoctorCommandHelp } from './commands/doctor'
export type { CheckResult } from './commands/doctor'
export { executeInstallCommand, createInstallCommandHelp } from './commands/install'
export type { InstallStep, ReadlineInterface } from './commands/install'
export { executeConfigCommand, parseConfigArgs, createConfigCommandHelp } from './commands/config'
export type { ConfigAction, ConfigCommandArgs } from './commands/config'

// 类型
export type {
  RunMode,
  CLIOptions,
  Subsystems,
  AgentSession,
  AgentSessionState,
  AgentSessionResult,
  ToolCallRecord,
  SystemPromptLayers,
  ProjectResources,
  SlashCommandDef,
  ModeRunner,
  OutputEvent,
  JsonOutput,
} from './types'
