// @vitamin/session 核心类型
import type { Message } from '@vitamin/ai'

// 会话条目 — JSONL 中每行存储一条
export interface SessionEntry {
  id: string
  parentId: string | null
  type: 'message' | 'system' | 'compaction' | 'branch_point'
  content: Message | SystemEvent | CompactionRecord
  timestamp: number
  label?: string
  bookmarked?: boolean
  metadata?: Record<string, unknown>
}

// 系统事件（非消息条目）
export interface SystemEvent {
  kind: 'session_start' | 'session_end' | 'model_change' | 'compaction_trigger'
  data: Record<string, unknown>
}

// 压缩记录（摘要替代原始消息）
export interface CompactionRecord {
  summary: string
  compactedCount: number
  retainedStartId: string
  previousSummary?: string
  todoState?: string
}

// Token 使用统计
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalCost: number
}

// 会话元数据
export interface SessionMetadata {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  tags: string[]
  model?: string
  agent?: string
  activeEntryId?: string
  bookmarkCount: number
  tokenUsage: TokenUsage
}

// 会话树节点
export interface SessionNode {
  entry: SessionEntry
  children: SessionNode[]
}

// 会话快照（列表用）
export interface SessionSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  tags: string[]
  preview?: string
}

// Boulder State — Plan/Build 跨 Session 状态
export interface BoulderState {
  active_plan: string
  session_ids: string[]
  status: 'rolling' | 'paused' | 'completed' | 'failed'
  current_step?: string
  progress: {
    total: number
    completed: number
    percentage: number
  }
  created_at: string
  updated_at: string
}

// 压缩策略接口
export interface CompactionStrategy {
  readonly name: string
  compact(options: CompactionOptions): Promise<CompactionResult>
}

// 压缩选项
export interface CompactionOptions {
  messages: Message[]
  existingSummary?: string
  retainRecent: number
  todoState?: string
  // LLM 摘要函数 — 由外部注入，解耦 Provider
  summarize: (prompt: string) => Promise<string>
}

// 压缩结果
export interface CompactionResult {
  summary: string
  retainedMessages: Message[]
  compactedCount: number
  todoState?: string
}

// 存储层接口
export interface SessionStorage {
  // 追加一条 entry
  append(sessionId: string, entry: SessionEntry): Promise<void>
  // 读取所有 entries
  readAll(sessionId: string): Promise<SessionEntry[]>
  // 会话是否存在
  exists(sessionId: string): Promise<boolean>
  // 删除会话
  remove(sessionId: string): Promise<void>
  // 列出所有会话 ID
  listSessionIds(): Promise<string[]>
}

// 会话搜索/过滤选项
export interface SessionSearchOptions {
  query?: string
  tags?: string[]
  model?: string
  agent?: string
  dateRange?: { from?: number; to?: number }
  sortBy?: 'updatedAt' | 'createdAt' | 'messageCount'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

// HTML 导出选项
export interface HtmlExportOptions {
  title?: string
  includeMetadata?: boolean
  syntaxHighlight?: boolean
  theme?: 'light' | 'dark'
}

// Markdown 导出选项
export interface MarkdownExportOptions {
  includeMetadata?: boolean
  includeToolCalls?: boolean
  includeTimestamps?: boolean
}

// JSON 导出选项
export interface JsonExportOptions {
  includeMetadata?: boolean
  pretty?: boolean
}

// 自动标题生成器
export interface AutoTitleGenerator {
  generate(firstMessage: string): Promise<string>
}
