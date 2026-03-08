// 所有 vitamin-coding 错误的基础类
// 每个错误必须携带 code 和可选的 cause
export class VitaminError extends Error {
  readonly code: string
  override readonly cause?: Error

  constructor(message: string, options: { code: string; cause?: Error }) {
    super(message, { cause: options.cause })
    this.name = new.target.name
    this.code = options.code
    this.cause = options.cause
  }
}

export class ConfigError extends VitaminError {}

export class ProviderError extends VitaminError {}

export class StreamError extends VitaminError {}

export class AgentError extends VitaminError {}

export class ToolError extends VitaminError {}

export class HookError extends VitaminError {}

export class SessionError extends VitaminError {}

export class ExtensionError extends VitaminError {}

export class McpError extends VitaminError {}
