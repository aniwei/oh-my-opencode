// 会话管理器 — CRUD + 列表 + 恢复
import { randomUUID } from 'node:crypto'

import { createLogger, SessionError } from '@vitamin/shared'

import type { Message } from '@vitamin/ai'

import { createCompactor } from './compaction/compactor'
import { exportToHtml } from './export/html-export'
import { createSessionTree } from './session-tree'
import { createJsonlStorage } from './storage/jsonl-storage'

import type { CompactorConfig, StrategyName } from './compaction/compactor'
import type { SessionTree } from './session-tree'
import type {
  AutoTitleGenerator,
  HtmlExportOptions,
  JsonExportOptions,
  MarkdownExportOptions,
  SessionEntry,
  SessionMetadata,
  SessionSearchOptions,
  SessionStorage,
  SessionSummary,
  TokenUsage,
} from './types'

const log = createLogger('session:manager')

// 会话管理器配置
export interface SessionManagerConfig {
  // 存储基础目录
  baseDir: string
  // 压缩配置
  compaction?: Partial<CompactorConfig>
  // 自动标题生成器
  autoTitleGenerator?: AutoTitleGenerator
}

// 会话管理器
export class SessionManager {
  private readonly storage: SessionStorage
  private readonly sessions = new Map<string, SessionTree>()
  private readonly metadataCache = new Map<string, SessionMetadata>()
  private readonly tokenUsageCache = new Map<string, TokenUsage>()
  private readonly compactor: ReturnType<typeof createCompactor>

  constructor(private readonly config: SessionManagerConfig) {
    this.storage = createJsonlStorage(config.baseDir)
    this.compactor = createCompactor(config.compaction)
  }

  // 创建新会话
  async create(title?: string): Promise<SessionMetadata> {
    const id = randomUUID()
    const now = Date.now()

    const metadata: SessionMetadata = {
      id,
      title: title ?? `会话 ${new Date(now).toLocaleString('zh-CN')}`,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      tags: [],
      bookmarkCount: 0,
      tokenUsage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCost: 0 },
    }

    // 写入初始系统事件
    const tree = createSessionTree(id, this.storage)
    const startEntry: SessionEntry = {
      id: randomUUID(),
      parentId: null,
      type: 'system',
      content: { kind: 'session_start', data: { title: metadata.title } },
      timestamp: now,
    }
    await tree.append(startEntry)

    this.sessions.set(id, tree)
    this.metadataCache.set(id, metadata)

    log.info(`创建会话: ${id} - ${metadata.title}`)
    return metadata
  }

  // 获取或加载会话树
  async getTree(sessionId: string): Promise<SessionTree> {
    let tree = this.sessions.get(sessionId)
    if (!tree) {
      const exists = await this.storage.exists(sessionId)
      if (!exists) {
        throw new SessionError(`会话 "${sessionId}" 不存在`, { code: 'SESSION_NOT_FOUND' })
      }

      tree = createSessionTree(sessionId, this.storage)
      await tree.load()
      this.sessions.set(sessionId, tree)
    }
    return tree
  }

  // 向会话追加消息
  async appendMessage(sessionId: string, message: Message): Promise<void> {
    const tree = await this.getTree(sessionId)

    const entry: SessionEntry = {
      id: randomUUID(),
      parentId: null, // SessionTree.append 会自动设置
      type: 'message',
      content: message,
      timestamp: Date.now(),
    }

    await tree.append(entry)

    // 更新元数据缓存
    const metadata = this.metadataCache.get(sessionId)
    if (metadata) {
      metadata.messageCount++
      metadata.updatedAt = entry.timestamp
    }

    // 自动标题：第一条用户消息时触发
    if (metadata && metadata.messageCount === 1 && message.role === 'user' && this.config.autoTitleGenerator) {
      const userText = typeof message.content === 'string' ? message.content : ''
      if (userText.length > 0) {
        this.config.autoTitleGenerator.generate(userText).then((title) => {
          if (title && metadata) {
            metadata.title = title
            log.info(`自动标题: ${sessionId} → ${title}`)
          }
        }).catch((error) => {
          log.warn(`自动标题失败: ${String(error)}`)
        })
      }
    }
  }

  // 更新 Token 使用量
  updateTokenUsage(sessionId: string, usage: Partial<TokenUsage>): void {
    const metadata = this.metadataCache.get(sessionId)
    if (!metadata) return

    metadata.tokenUsage.inputTokens += usage.inputTokens ?? 0
    metadata.tokenUsage.outputTokens += usage.outputTokens ?? 0
    metadata.tokenUsage.cacheReadTokens += usage.cacheReadTokens ?? 0
    metadata.tokenUsage.cacheWriteTokens += usage.cacheWriteTokens ?? 0
    metadata.tokenUsage.totalCost += usage.totalCost ?? 0
  }

  // 更新会话 Agent
  updateAgent(sessionId: string, agent: string): void {
    const metadata = this.metadataCache.get(sessionId)
    if (metadata) {
      metadata.agent = agent
    }
  }

  // 更新会话 Model
  updateModel(sessionId: string, model: string): void {
    const metadata = this.metadataCache.get(sessionId)
    if (metadata) {
      metadata.model = model
    }
  }

  // 重命名会话
  async rename(sessionId: string, title: string): Promise<void> {
    const metadata = this.metadataCache.get(sessionId)
    if (metadata) {
      metadata.title = title
      metadata.updatedAt = Date.now()
    }
  }

  // Fork 创建分支
  async fork(sessionId: string, fromEntryId?: string): Promise<SessionMetadata> {
    const tree = await this.getTree(sessionId)
    const branchPointId = randomUUID()
    tree.fork(fromEntryId, branchPointId)

    // 持久化 branch_point entry
    const branchEntry: SessionEntry = {
      id: branchPointId,
      parentId: fromEntryId ?? tree.getActiveEntryId() ?? null,
      type: 'branch_point',
      content: { kind: 'session_start', data: { forkedFrom: sessionId } },
      timestamp: Date.now(),
    }
    await this.storage.append(sessionId, branchEntry)

    // 返回更新后的元数据
    const metadata = this.metadataCache.get(sessionId)
    return metadata ?? this.buildMetadata(sessionId, tree)
  }

  // 恢复上次会话
  async recover(): Promise<SessionMetadata | null> {
    const ids = await this.storage.listSessionIds()
    if (ids.length === 0) {
      return null
    }

    // 加载所有会话的元数据，找到最近更新的
    let latestId: string | null = null
    let latestTimestamp = 0

    for (const id of ids) {
      const tree = createSessionTree(id, this.storage)
      await tree.load()
      this.sessions.set(id, tree)

      const entries = tree.getEntries()
      const lastEntry = entries[entries.length - 1]
      if (lastEntry && lastEntry.timestamp > latestTimestamp) {
        latestTimestamp = lastEntry.timestamp
        latestId = id
      }
    }

    if (!latestId) {
      return null
    }

    const tree = this.sessions.get(latestId)!
    const metadata = this.buildMetadata(latestId, tree)
    this.metadataCache.set(latestId, metadata)

    log.info(`恢复会话: ${latestId}`)
    return metadata
  }

  // 列出所有会话
  async list(): Promise<SessionSummary[]> {
    const ids = await this.storage.listSessionIds()
    const summaries: SessionSummary[] = []

    for (const id of ids) {
      const tree = await this.getTree(id)
      const metadata = this.buildMetadata(id, tree)
      this.metadataCache.set(id, metadata)

      summaries.push({
        id: metadata.id,
        title: metadata.title,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        messageCount: metadata.messageCount,
        tags: metadata.tags,
      })
    }

    // 按更新时间降序排列
    summaries.sort((a, b) => b.updatedAt - a.updatedAt)
    return summaries
  }

  // 搜索/过滤会话
  async search(options: SessionSearchOptions): Promise<SessionSummary[]> {
    const all = await this.list()
    let filtered = all

    // 关键词搜索（标题匹配）
    if (options.query) {
      const q = options.query.toLowerCase()
      filtered = filtered.filter((s) => s.title.toLowerCase().includes(q))
    }

    // 标签过滤
    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter((s) =>
        options.tags!.some((tag) => s.tags.includes(tag)),
      )
    }

    // 日期范围过滤
    if (options.dateRange) {
      if (options.dateRange.from) {
        filtered = filtered.filter((s) => s.updatedAt >= options.dateRange!.from!)
      }
      if (options.dateRange.to) {
        filtered = filtered.filter((s) => s.updatedAt <= options.dateRange!.to!)
      }
    }

    // 排序
    const sortBy = options.sortBy ?? 'updatedAt'
    const sortOrder = options.sortOrder ?? 'desc'
    filtered.sort((a, b) => {
      const aVal = a[sortBy] as number
      const bVal = b[sortBy] as number
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
    })

    // 分页
    const offset = options.offset ?? 0
    const limit = options.limit ?? filtered.length
    return filtered.slice(offset, offset + limit)
  }

  // 删除会话
  async remove(sessionId: string): Promise<void> {
    await this.storage.remove(sessionId)
    this.sessions.delete(sessionId)
    this.metadataCache.delete(sessionId)
    log.info(`删除会话: ${sessionId}`)
  }

  // 压缩会话
  async compact(
    sessionId: string,
    strategy?: StrategyName,
  ): Promise<void> {
    const tree = await this.getTree(sessionId)
    const entries = tree.getActiveMessages()

    // 提取消息内容
    const messages = entries
      .filter((e) => e.type === 'message')
      .map((e) => e.content as Message)

    if (messages.length <= (this.config.compaction?.retainRecent ?? 5)) {
      log.info(`会话 ${sessionId} 消息不足，跳过压缩`)
      return
    }

    // 查找最新的摘要（多次压缩后应取最后一条）
    const compactionEntries = entries.filter((e) => e.type === 'compaction')
    const existingCompaction = compactionEntries.length > 0
      ? compactionEntries[compactionEntries.length - 1]
      : undefined
    const existingSummary = existingCompaction
      ? (existingCompaction.content as { summary: string }).summary
      : undefined

    const result = strategy
      ? await this.compactor.compactWith(strategy, messages, existingSummary)
      : await this.compactor.compact(messages, existingSummary)

    // 持久化压缩记录
    const compactionEntry: SessionEntry = {
      id: randomUUID(),
      parentId: tree.getActiveEntryId(),
      type: 'compaction',
      content: {
        summary: result.summary,
        compactedCount: result.compactedCount,
        retainedStartId: entries[entries.length - result.retainedMessages.length]?.id ?? '',
        todoState: result.todoState,
      },
      timestamp: Date.now(),
    }

    await this.storage.append(sessionId, compactionEntry)
    log.info(`会话 ${sessionId} 压缩完成: ${result.compactedCount} 条 → 摘要`)
  }

  // 导出为 HTML
  async exportHtml(
    sessionId: string,
    options?: HtmlExportOptions,
  ): Promise<string> {
    const tree = await this.getTree(sessionId)
    const entries = tree.getActiveMessages()
    const messages = entries
      .filter((e) => e.type === 'message')
      .map((e) => e.content as Message)

    const metadata = this.metadataCache.get(sessionId) ?? this.buildMetadata(sessionId, tree)

    return exportToHtml(messages, metadata, options)
  }

  // 导出为 Markdown
  async exportMarkdown(
    sessionId: string,
    options?: MarkdownExportOptions,
  ): Promise<string> {
    const tree = await this.getTree(sessionId)
    const entries = tree.getActiveMessages()
    const metadata = this.metadataCache.get(sessionId) ?? this.buildMetadata(sessionId, tree)
    const lines: string[] = []

    if (options?.includeMetadata !== false) {
      lines.push(`# ${metadata.title}`, '')
      lines.push(`- **创建时间**: ${new Date(metadata.createdAt).toLocaleString('zh-CN')}`)
      lines.push(`- **消息数**: ${String(metadata.messageCount)}`)
      if (metadata.model) {
        lines.push(`- **模型**: ${metadata.model}`)
      }
      lines.push('')
      lines.push('---', '')
    }

    for (const entry of entries) {
      if (entry.type === 'message') {
        const msg = entry.content as Message
        const roleLabel = msg.role === 'user' ? '👤 User' : '🤖 Assistant'
        const timestamp = options?.includeTimestamps
          ? ` _${new Date(entry.timestamp).toLocaleTimeString('zh-CN')}_`
          : ''

        lines.push(`### ${roleLabel}${timestamp}`, '')

        if (typeof msg.content === 'string') {
          lines.push(msg.content, '')
        }
      } else if (entry.type === 'system' && options?.includeToolCalls) {
        lines.push(`> 系统事件: ${JSON.stringify(entry.content)}`, '')
      }
    }

    return lines.join('\n')
  }

  // 导出为 JSON
  async exportJson(
    sessionId: string,
    options?: JsonExportOptions,
  ): Promise<string> {
    const tree = await this.getTree(sessionId)
    const entries = tree.getActiveMessages()
    const metadata = this.metadataCache.get(sessionId) ?? this.buildMetadata(sessionId, tree)

    const exportData = {
      ...(options?.includeMetadata !== false ? { metadata } : {}),
      messages: entries
        .filter((e) => e.type === 'message')
        .map((e) => ({
          role: (e.content as Message).role,
          content: (e.content as Message).content,
          timestamp: e.timestamp,
        })),
    }

    return options?.pretty !== false
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData)
  }

  // 从会话树构建元数据
  private buildMetadata(sessionId: string, tree: SessionTree): SessionMetadata {
    const entries = tree.getEntries()
    const messageEntries = entries.filter((e) => e.type === 'message')
    const firstEntry = entries[0]
    const lastEntry = entries[entries.length - 1]

    // 尝试从 system 事件中获取 title
    const startEvent = entries.find(
      (e) => e.type === 'system' && (e.content as { kind: string }).kind === 'session_start',
    )
    const title = startEvent
      ? ((startEvent.content as { data: { title?: string } }).data.title ?? `会话 ${sessionId.slice(0, 8)}`)
      : `会话 ${sessionId.slice(0, 8)}`

    return {
      id: sessionId,
      title,
      createdAt: firstEntry?.timestamp ?? Date.now(),
      updatedAt: lastEntry?.timestamp ?? Date.now(),
      messageCount: messageEntries.length,
      tags: [],
      activeEntryId: tree.getActiveEntryId() ?? undefined,
      bookmarkCount: entries.filter((e) => e.bookmarked).length,
      tokenUsage: this.tokenUsageCache.get(sessionId) ?? {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalCost: 0,
      },
    }
  }

  // 设置条目标签
  async setLabel(sessionId: string, entryId: string, label: string): Promise<void> {
    const tree = await this.getTree(sessionId)
    const entry = tree.getEntries().find((e) => e.id === entryId)
    if (!entry) {
      throw new SessionError(`条目 "${entryId}" 不存在`, { code: 'ENTRY_NOT_FOUND' })
    }
    entry.label = label
    log.info(`设置标签: ${sessionId}/${entryId} → ${label}`)
  }

  // 切换条目书签状态
  async toggleBookmark(sessionId: string, entryId: string): Promise<boolean> {
    const tree = await this.getTree(sessionId)
    const entry = tree.getEntries().find((e) => e.id === entryId)
    if (!entry) {
      throw new SessionError(`条目 "${entryId}" 不存在`, { code: 'ENTRY_NOT_FOUND' })
    }
    entry.bookmarked = !entry.bookmarked
    log.info(`书签切换: ${sessionId}/${entryId} → ${String(entry.bookmarked)}`)
    return entry.bookmarked
  }

  // 获取所有书签条目
  async getBookmarks(sessionId: string): Promise<SessionEntry[]> {
    const tree = await this.getTree(sessionId)
    return tree.getEntries().filter((e) => e.bookmarked)
  }
}

// 工厂函数
export function createSessionManager(config: SessionManagerConfig): SessionManager {
  return new SessionManager(config)
}
