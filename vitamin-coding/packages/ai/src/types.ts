// @vitamin/ai 核心类型定义
// 涵盖 Model, Message, StreamEvent, ToolDefinition, StreamContext 等

// 已知 API 协议类型
export type ApiType =
  | 'anthropic-messages'
  | 'openai-completions'
  | 'openai-responses'
  | 'google-generative-ai'
  | 'bedrock-converse'
  | 'github-copilot'
  | 'ollama'

// 已知提供商
export type KnownProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'amazon-bedrock'
  | 'github-copilot'
  | 'xai'
  | 'groq'
  | 'openrouter'
  | 'deepseek'
  | 'ollama'
  | 'moonshot'
  | 'custom'

// 模型费率（每百万 token）
export interface ModelCost {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

// 思维级别
export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

// Provider 兼容性覆盖
export interface ProviderCompat {
  // 是否支持 system prompt
  supportsSystemPrompt?: boolean
  // 是否支持工具调用
  supportsToolCalls?: boolean
  // 是否支持 thinking/reasoning
  supportsThinking?: boolean
  // 是否支持图片输入
  supportsImages?: boolean
  // 是否支持流式输出
  supportsStreaming?: boolean
}

// 模型定义 — 核心数据结构
export interface Model {
  // 唯一标识: "provider/model-id"
  id: string
  // 显示名称
  name: string
  // API 协议
  api: ApiType
  // 提供商
  provider: KnownProvider
  // 基础 URL（可覆盖）
  baseUrl: string
  // 是否支持推理（thinking/reasoning）
  reasoning: boolean
  // 输入模态
  input: ('text' | 'image' | 'audio')[]
  // 费率（每百万 token）
  cost: ModelCost
  // 上下文窗口大小
  contextWindow: number
  // 最大输出 token
  maxOutputTokens: number
  // 思维级别支持
  thinkingLevels?: ThinkingLevel[]
  // 传输方式
  transport?: 'sse' | 'websocket' | 'auto'
  // 兼容性覆盖
  compat?: ProviderCompat
}

// 统一内容部分类型
export interface TextContent {
  type: 'text'
  text: string
}

export interface ImageSource {
  type: 'base64' | 'url'
  mediaType: string
  data: string
}

export interface ImageContent {
  type: 'image'
  source: ImageSource
}

export interface AudioContent {
  type: 'audio'
  source: { mediaType: string; data: string }
}

export interface ThinkingContent {
  type: 'thinking'
  text: string
  signature?: string
}

export interface ToolCall {
  type: 'tool_call'
  id: string
  name: string
  arguments: Record<string, unknown>
}

export type ContentPart = TextContent | ImageContent | AudioContent

// 统一消息类型
export interface UserMessage {
  role: 'user'
  content: string | ContentPart[]
  timestamp: number
}

export interface AssistantMessage {
  role: 'assistant'
  content: (TextContent | ThinkingContent | ToolCall)[]
  usage: Usage
  stopReason: StopReason
  model: string
}

export interface ToolResultMessage {
  role: 'tool_result'
  toolCallId: string
  content: (TextContent | ImageContent)[]
  isError: boolean
}

export type Message = UserMessage | AssistantMessage | ToolResultMessage

// 停止原因
export type StopReason = 'end_turn' | 'max_tokens' | 'tool_use' | 'stop_sequence'

// Token 使用量
export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

// 流式事件（高粒度）
export type StreamEvent =
  | { type: 'start'; partial: AssistantMessage }
  | { type: 'text_delta'; index: number; delta: string }
  | { type: 'thinking_delta'; index: number; delta: string }
  | { type: 'tool_call_start'; toolCall: ToolCall }
  | { type: 'tool_call_delta'; id: string; delta: string }
  | { type: 'tool_call_end'; id: string; toolCall: ToolCall }
  | { type: 'done'; message: AssistantMessage }
  | { type: 'error'; error: Error; partial?: AssistantMessage }

// Zod schema 类型占位（避免直接依赖 zod）
export interface ZodType<T = unknown> {
  parse(data: unknown): T
  safeParse(data: unknown): { success: boolean; data?: T; error?: unknown }
  toJSONSchema?: () => unknown
}

// 工具定义 — 使用 Zod schema
export interface ToolDefinition<TArgs = unknown> {
  name: string
  description: string
  parameters: ZodType<TArgs>
  // 工具可见性控制
  visibility?: 'always' | 'when-enabled' | 'when-requested'
}

// 流式上下文
export interface StreamContext {
  systemPrompt: string
  messages: Message[]
  tools?: ToolDefinition[]
  thinkingLevel?: ThinkingLevel
  maxTokens?: number
  temperature?: number
  cacheRetention?: 'none' | 'short' | 'long'
}

// 流式选项
export interface StreamOptions {
  signal?: AbortSignal
  // API Key（可覆盖，优先于 resolver）
  apiKey?: string
  // 重试配置
  maxRetries?: number
  // 超时（毫秒）
  timeout?: number
  // 代理 URL
  proxy?: string
}

// 用于辅助判断模型家族
export function isGptFamily(model: Model): boolean {
  return (
    model.provider === 'openai' ||
    model.api === 'openai-completions' ||
    model.api === 'openai-responses'
  )
}

export function isClaudeFamily(model: Model): boolean {
  return model.provider === 'anthropic' || model.api === 'anthropic-messages'
}

export function isGeminiFamily(model: Model): boolean {
  return model.provider === 'google' || model.api === 'google-generative-ai'
}

// 从 AssistantMessage 提取工具调用
export function getToolCalls(message: AssistantMessage): ToolCall[] {
  return message.content.filter((c): c is ToolCall => c.type === 'tool_call')
}

// 检查 AssistantMessage 是否包含工具调用
export function hasToolCalls(message: AssistantMessage): boolean {
  return message.content.some((c) => c.type === 'tool_call')
}

// 创建空的 Usage
export function emptyUsage(): Usage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
}

// 合并两个 Usage
export function mergeUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  }
}
