// 所有 vitamin-coding-agent 错误的基础类
// 每个错误必须携带 code 和可选的 cause
export class VitaminError extends Error {
  readonly code: string
  override readonly cause?: Error

  constructor(message: string, options: { code: string; cause?: Error }) {
    super(message, { cause: options.cause })
    this.name = 'VitaminError'
    this.code = options.code
    this.cause = options.cause
  }
}

export class ConfigError extends VitaminError {
  constructor(message: string, options: { code: string; cause?: Error }) {
    super(message, options)
    this.name = 'ConfigError'
  }
}

export class ProviderError extends VitaminError {
  constructor(message: string, options: { code: string; cause?: Error }) {
    super(message, options)
    this.name = 'ProviderError'
  }
}

export class StreamError extends VitaminError {
  constructor(message: string, options: { code: string; cause?: Error }) {
    super(message, options)
    this.name = 'StreamError'
  }
}

export class AgentError extends VitaminError {
  constructor(message: string, options: { code: string; cause?: Error }) {
    super(message, options)
    this.name = 'AgentError'
  }
}

export class ToolError extends VitaminError {
  constructor(message: string, options: { code: string; cause?: Error }) {
    super(message, options)
    this.name = 'ToolError'
  }
}

export class HookError extends VitaminError {
  constructor(message: string, options: { code: string; cause?: Error }) {
    super(message, options)
    this.name = 'HookError'
  }
}

export class SessionError extends VitaminError {
  constructor(message: string, options: { code: string; cause?: Error }) {
    super(message, options)
    this.name = 'SessionError'
  }
}

export class ExtensionError extends VitaminError {
  constructor(message: string, options: { code: string; cause?: Error }) {
    super(message, options)
    this.name = 'ExtensionError'
  }
}

export class McpError extends VitaminError {
  constructor(message: string, options: { code: string; cause?: Error }) {
    super(message, options)
    this.name = 'McpError'
  }
}
