> [← 返回目录](README.md)

## 第九部分：云端部署——数据持久化与缓存

> 本章讨论 vitamin-coding-agent 部署到**云端服务器**时，如何处理对话数据持久化、日志收集与缓存策略。弹性伸缩暂不纳入本阶段设计范围。

### 9.1 部署架构总览

#### 9.1.1 从单机到云端的核心矛盾

vitamin 的单机模式下，一切很简单：

```
单机模式:
  SessionManager → JSONL 文件 → 本地磁盘
  Agent Loop     → 单进程执行
  日志           → pino → /tmp/vitamin.log
  配置           → .vitamin/config.jsonc
```

但在云端服务器（多用户、多实例），问题立刻出现：

| 问题 | 单机 | 云端 |
|------|------|------|
| 对话数据 | JSONL 文件在本地磁盘 | 容器销毁后数据丢失 |
| 日志 | 写到 `/tmp/` | 容器销毁后日志丢失 |
| 配置 | 本地文件 | 服务端配置如何管理？ |
| 工具沙箱 | 信任本地环境 | 多用户共享时如何隔离？ |

#### 9.1.2 云端部署架构（单实例）

```
                      ┌──────────────────┐
                      │   API Gateway    │
                      │   (HTTP/WebSocket)│
                      └────────┬─────────┘
                               │
                      ┌────────▼─────────┐
                      │  vitamin Server  │
                      │                  │
                      │  Agent Loop      │
                      │  Extension       │
                      │  Hook Engine     │
                      └──┬──────┬──────┬─┘
                         │      │      │
              ┌──────────▼──┐ ┌─▼──────▼──────┐
              │    Redis    │ │  PostgreSQL   │
              │             │ │               │
              │ - 会话缓存  │ │ - Session     │
              │ - Agent状态 │ │   持久化      │
              │             │ │ - 用户数据    │
              └──────┬──────┘ │ - 审计日志    │
                     │        └───────┬───────┘
              ┌──────▼────────────────▼───────┐
              │       日志基础设施              │
              │ Server → stdout (JSON)         │
              │        → Loki / Elasticsearch   │
              │ Grafana / Kibana 查询面板       │
              └────────────────────────────────┘
```

**关键设计决策**：vitamin 的云端架构基于**存储抽象层**——同一套 `SessionManager` / `Logger` / `ConfigLoader` 接口，通过 Storage Backend 切换实现本地/云端双模式，**不修改任何业务代码**。当前阶段聚焦单实例部署下的数据持久化与缓存，后续如需多实例扩容可在此基础上叠加分布式锁和负载均衡。

---

### 9.2 Storage Backend 抽象层

#### 9.2.1 为什么需要存储抽象

当前 `@vitamin/session` 的 `SessionManager` 直接依赖 `JsonlStorage`：

```typescript
// 当前设计 — 紧耦合本地文件
import { JsonlStorage } from "./storage/jsonl-storage"

export class SessionManager {
  private storage: JsonlStorage  // ← 直接绑定 JSONL
  constructor(sessionsDir: string) {
    this.storage = new JsonlStorage(sessionsDir)
  }
}
```

云端需要替换为 PostgreSQL / Redis，但 `SessionManager` 的业务逻辑（树构建、分支、导航、压缩）不应该改动。

#### 9.2.2 Storage Interface 设计

```typescript
// packages/session/src/storage/storage-interface.ts

/**
 * 会话存储抽象接口
 *
 * 所有持久化操作通过此接口，具体实现可以是：
 * - JsonlStorage: 本地 JSONL 文件（单机默认）
 * - SqliteStorage: 本地 SQLite（大型会话）
 * - PostgresStorage: PostgreSQL（云端多实例）
 * - RedisStorage: Redis（纯缓存层，需要搭配持久化后端）
 */
export interface SessionStorage {
  // ── 会话 CRUD ──
  createSession(sessionId: string, name: string, metadata?: Record<string, unknown>): Promise<void>
  deleteSession(sessionId: string): Promise<void>
  listSessions(filter?: SessionFilter): Promise<SessionInfo[]>
  getSessionInfo(sessionId: string): Promise<SessionInfo | null>

  // ── 条目操作 ──
  appendEntry(sessionId: string, entry: SessionEntry): Promise<void>
  appendEntries(sessionId: string, entries: SessionEntry[]): Promise<void>
  readAllEntries(sessionId: string): Promise<SessionEntry[]>

  // ── 查询 ──
  getEntry(sessionId: string, entryId: string): Promise<SessionEntry | null>
  getChildren(sessionId: string, parentId: string): Promise<SessionEntry[]>
  getPathToRoot(sessionId: string, entryId: string): Promise<SessionEntry[]>
  getLeafEntries(sessionId: string): Promise<SessionEntry[]>

  // ── 压缩 ──
  appendCompaction(sessionId: string, compaction: CompactionRecord): Promise<void>
  getLatestCompaction(sessionId: string): Promise<CompactionRecord | null>

  // ── 元数据 ──
  updateSessionMetadata(sessionId: string, metadata: Record<string, unknown>): Promise<void>

  // ── 生命周期 ──
  close(): Promise<void>
  healthCheck(): Promise<boolean>
}

export interface SessionFilter {
  userId?: string
  labels?: string[]
  createdAfter?: number
  createdBefore?: number
  limit?: number
  offset?: number
}
```

#### 9.2.3 改造后的 SessionManager

```typescript
// packages/session/src/session-manager.ts（云端改造）

import type { SessionStorage } from "./storage/storage-interface"
import type { SessionEntry, SessionNode, SessionInfo } from "./types"
import { buildTree, getPathToRoot, getLeafNodes } from "./session-tree"

export class SessionManager {
  private currentSessionId: string | null = null
  private currentEntryId: string | null = null

  /**
   * 通过构造函数注入存储后端
   * 
   * 单机: new SessionManager(new JsonlStorage(dir))
   * 云端: new SessionManager(new PostgresStorage(pool))
   * 测试: new SessionManager(new InMemoryStorage())
   */
  constructor(private storage: SessionStorage) {}

  async create(name?: string): Promise<SessionInfo> {
    const sessionId = generateSessionId()
    const sessionName = name ?? `session-${new Date().toISOString().slice(0, 10)}`
    await this.storage.createSession(sessionId, sessionName)
    this.currentSessionId = sessionId
    this.currentEntryId = null
    return this.storage.getSessionInfo(sessionId) as Promise<SessionInfo>
  }

  async append(content: AgentMessage, type: SessionEntry["type"] = "message"): Promise<SessionEntry> {
    const entry: SessionEntry = {
      id: generateEntryId(),
      parentId: this.currentEntryId,
      type,
      content,
      timestamp: Date.now(),
    }
    await this.storage.appendEntry(this.currentSessionId!, entry)
    this.currentEntryId = entry.id
    return entry
  }

  async getCurrentPath(): Promise<SessionEntry[]> {
    if (!this.currentEntryId) return []
    // 存储后端可以优化为 SQL 递归 CTE 查询，而不是加载全量再遍历
    return this.storage.getPathToRoot(this.currentSessionId!, this.currentEntryId)
  }

  async fork(fromEntryId?: string): Promise<void> {
    const targetId = fromEntryId ?? this.currentEntryId
    if (!targetId) throw new Error("No entry to fork from")
    this.currentEntryId = targetId
    await this.storage.appendEntry(this.currentSessionId!, {
      id: generateEntryId(),
      parentId: targetId,
      type: "branch_point",
      content: { type: "fork", fromEntryId: targetId, timestamp: Date.now() },
      timestamp: Date.now(),
    })
  }

  async getTree(): Promise<SessionNode> {
    const entries = await this.storage.readAllEntries(this.currentSessionId!)
    return buildTree(entries)
  }

  // ... 其他方法不变，全部通过 this.storage 调用
}
```

**零业务代码修改**：`SessionManager` 的所有方法（`fork`、`getTree`、`navigateTo`、`compact`）不做任何改动，只是底层 `storage` 从 JSONL 换成了 PostgreSQL。

---

### 9.3 PostgreSQL 存储实现

#### 9.3.1 数据库 Schema

```sql
-- 会话表
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  labels      TEXT[] DEFAULT '{}',
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  message_count INT DEFAULT 0,
  branch_count  INT DEFAULT 0
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_updated ON sessions(updated_at DESC);

-- 会话条目表（树结构的核心）
CREATE TABLE session_entries (
  id          TEXT NOT NULL,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  parent_id   TEXT,  -- NULL = 根节点
  type        TEXT NOT NULL CHECK (type IN ('message', 'system', 'compaction', 'branch_point')),
  content     JSONB NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, id)
);

-- 树查询关键索引
CREATE INDEX idx_entries_parent ON session_entries(session_id, parent_id);
CREATE INDEX idx_entries_type ON session_entries(session_id, type);

-- 压缩记录表
CREATE TABLE compaction_records (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  summary     TEXT NOT NULL,
  compressed_entry_ids TEXT[] NOT NULL,
  token_count INT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_compaction_session ON compaction_records(session_id, created_at DESC);

-- 审计日志表
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL,
  session_id  TEXT,
  action      TEXT NOT NULL,  -- 'tool_execute', 'file_write', 'bash_command', etc.
  detail      JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_session ON audit_logs(session_id, created_at DESC);
```

#### 9.3.2 PostgresStorage 实现

```typescript
// packages/session/src/storage/postgres-storage.ts

import type { Pool } from "pg"
import type { SessionStorage, SessionFilter, SessionEntry, SessionInfo, CompactionRecord } from "./storage-interface"

export class PostgresStorage implements SessionStorage {
  constructor(private pool: Pool) {}

  async createSession(sessionId: string, name: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.pool.query(
      `INSERT INTO sessions (id, user_id, name, metadata) VALUES ($1, $2, $3, $4)`,
      [sessionId, metadata?.userId ?? "default", name, JSON.stringify(metadata ?? {})]
    )
  }

  async appendEntry(sessionId: string, entry: SessionEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO session_entries (id, session_id, parent_id, type, content, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [entry.id, sessionId, entry.parentId, entry.type, JSON.stringify(entry.content), JSON.stringify(entry.metadata ?? {})]
    )
    // 更新会话统计
    await this.pool.query(
      `UPDATE sessions SET updated_at = NOW(), message_count = message_count + 1 WHERE id = $1`,
      [sessionId]
    )
  }

  async appendEntries(sessionId: string, entries: SessionEntry[]): Promise<void> {
    // 批量插入优化
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      for (const entry of entries) {
        await client.query(
          `INSERT INTO session_entries (id, session_id, parent_id, type, content, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [entry.id, sessionId, entry.parentId, entry.type, JSON.stringify(entry.content), JSON.stringify(entry.metadata ?? {})]
        )
      }
      await client.query(
        `UPDATE sessions SET updated_at = NOW(), message_count = message_count + $1 WHERE id = $2`,
        [entries.length, sessionId]
      )
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * 树路径查询 — 使用 PostgreSQL 递归 CTE
   * 
   * 这是云端存储的核心优势：
   * - JSONL: 必须加载全量数据到内存，然后遍历
   * - PostgreSQL: 数据库端递归查询，只返回路径上的条目
   * 
   * 对于有 10000+ 条目的大型会话，性能差异巨大。
   */
  async getPathToRoot(sessionId: string, entryId: string): Promise<SessionEntry[]> {
    const result = await this.pool.query(
      `WITH RECURSIVE path AS (
        SELECT id, parent_id, type, content, metadata, created_at
        FROM session_entries
        WHERE session_id = $1 AND id = $2

        UNION ALL

        SELECT e.id, e.parent_id, e.type, e.content, e.metadata, e.created_at
        FROM session_entries e
        JOIN path p ON e.id = p.parent_id AND e.session_id = $1
      )
      SELECT * FROM path ORDER BY created_at ASC`,
      [sessionId, entryId]
    )
    return result.rows.map(this.rowToEntry)
  }

  async getLeafEntries(sessionId: string): Promise<SessionEntry[]> {
    const result = await this.pool.query(
      `SELECT e.*
       FROM session_entries e
       LEFT JOIN session_entries child ON child.parent_id = e.id AND child.session_id = e.session_id
       WHERE e.session_id = $1 AND child.id IS NULL`,
      [sessionId]
    )
    return result.rows.map(this.rowToEntry)
  }

  async getChildren(sessionId: string, parentId: string): Promise<SessionEntry[]> {
    const result = await this.pool.query(
      `SELECT * FROM session_entries WHERE session_id = $1 AND parent_id = $2 ORDER BY created_at ASC`,
      [sessionId, parentId]
    )
    return result.rows.map(this.rowToEntry)
  }

  async readAllEntries(sessionId: string): Promise<SessionEntry[]> {
    const result = await this.pool.query(
      `SELECT * FROM session_entries WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    )
    return result.rows.map(this.rowToEntry)
  }

  async listSessions(filter?: SessionFilter): Promise<SessionInfo[]> {
    const conditions: string[] = ["1=1"]
    const params: unknown[] = []
    let paramIndex = 1

    if (filter?.userId) {
      conditions.push(`user_id = $${paramIndex++}`)
      params.push(filter.userId)
    }
    if (filter?.labels?.length) {
      conditions.push(`labels && $${paramIndex++}`)
      params.push(filter.labels)
    }
    if (filter?.createdAfter) {
      conditions.push(`created_at >= to_timestamp($${paramIndex++})`) 
      params.push(filter.createdAfter / 1000)
    }

    const limit = filter?.limit ?? 50
    const offset = filter?.offset ?? 0

    const result = await this.pool.query(
      `SELECT * FROM sessions WHERE ${conditions.join(" AND ")}
       ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    )
    return result.rows.map(this.rowToSessionInfo)
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1")
      return true
    } catch {
      return false
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  private rowToEntry(row: any): SessionEntry {
    return {
      id: row.id,
      parentId: row.parent_id,
      type: row.type,
      content: row.content,
      timestamp: new Date(row.created_at).getTime(),
      metadata: row.metadata,
    }
  }

  private rowToSessionInfo(row: any): SessionInfo {
    return {
      id: row.id,
      name: row.name,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      messageCount: row.message_count,
      branchCount: row.branch_count,
      labels: row.labels,
    }
  }
}
```

---

### 9.4 Redis 缓存层

#### 9.4.1 缓存策略

PostgreSQL 负责持久化，Redis 负责**热数据缓存和实时状态**：

```
读取路径:
  SessionManager.getCurrentPath()
    → Redis 缓存命中？ → 返回
    → 缓存未命中 → PostgreSQL 查询 → 写入 Redis → 返回

写入路径:
  SessionManager.append()
    → PostgreSQL 写入（持久化）
    → Redis 缓存失效 + 更新（一致性）
    → Redis Pub/Sub 通知其他实例（多实例同步）
```

| Redis Key | 用途 | TTL | 失效策略 |
|-----------|------|-----|----------|
| `session:{id}:path:{entryId}` | 当前路径缓存 | 10min | 写时失效 |
| `session:{id}:tree` | 完整树缓存 | 5min | 写时失效 |
| `session:{id}:info` | 会话元数据 | 30min | 写时更新 |
| `agent:{instanceId}:state` | Agent 运行时状态 | 自动过期 | 心跳续期 |
| `lock:session:{id}` | 分布式写锁 | 30s | 自动释放 |
| `user:{id}:sessions` | 用户会话列表 | 5min | 写时失效 |

#### 9.4.2 CachedStorage 缓存包装器

```typescript
// packages/session/src/storage/cached-storage.ts

import type { SessionStorage, SessionEntry, SessionInfo, SessionFilter } from "./storage-interface"
import type { Redis } from "ioredis"

/**
 * 缓存包装器 — 装饰器模式
 * 
 * 包装任何 SessionStorage 实现，添加 Redis 缓存层。
 * 使用场景：new CachedStorage(new PostgresStorage(pool), redis)
 */
export class CachedStorage implements SessionStorage {
  constructor(
    private backend: SessionStorage,
    private redis: Redis,
    private config: CacheConfig = DEFAULT_CACHE_CONFIG
  ) {}

  async appendEntry(sessionId: string, entry: SessionEntry): Promise<void> {
    // 1. 写入持久化后端
    await this.backend.appendEntry(sessionId, entry)

    // 2. 失效相关缓存
    await this.invalidateSessionCache(sessionId)

    // 3. 通知其他实例
    await this.redis.publish("session:updated", JSON.stringify({
      sessionId,
      entryId: entry.id,
      type: entry.type,
    }))
  }

  async getPathToRoot(sessionId: string, entryId: string): Promise<SessionEntry[]> {
    const cacheKey = `session:${sessionId}:path:${entryId}`

    // 尝试缓存
    const cached = await this.redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }

    // 缓存未命中 → 查询后端
    const path = await this.backend.getPathToRoot(sessionId, entryId)

    // 写入缓存
    await this.redis.setex(cacheKey, this.config.pathTtlSeconds, JSON.stringify(path))

    return path
  }

  async readAllEntries(sessionId: string): Promise<SessionEntry[]> {
    const cacheKey = `session:${sessionId}:tree`

    const cached = await this.redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const entries = await this.backend.readAllEntries(sessionId)
    await this.redis.setex(cacheKey, this.config.treeTtlSeconds, JSON.stringify(entries))

    return entries
  }

  async listSessions(filter?: SessionFilter): Promise<SessionInfo[]> {
    // 列表查询不缓存（变化频繁，且有分页/过滤条件）
    return this.backend.listSessions(filter)
  }

  // ── 缓存失效 ──

  private async invalidateSessionCache(sessionId: string): Promise<void> {
    const keys = await this.redis.keys(`session:${sessionId}:*`)
    if (keys.length > 0) {
      await this.redis.del(...keys)
    }
  }

  // ── 其他方法直接代理 ──

  createSession(id: string, name: string, meta?: Record<string, unknown>) {
    return this.backend.createSession(id, name, meta)
  }
  deleteSession(id: string) { return this.backend.deleteSession(id) }
  getSessionInfo(id: string) { return this.backend.getSessionInfo(id) }
  appendEntries(id: string, entries: SessionEntry[]) {
    return this.backend.appendEntries(id, entries).then(() => this.invalidateSessionCache(id))
  }
  getEntry(sid: string, eid: string) { return this.backend.getEntry(sid, eid) }
  getChildren(sid: string, pid: string) { return this.backend.getChildren(sid, pid) }
  getLeafEntries(sid: string) { return this.backend.getLeafEntries(sid) }
  appendCompaction(sid: string, c: CompactionRecord) {
    return this.backend.appendCompaction(sid, c).then(() => this.invalidateSessionCache(sid))
  }
  getLatestCompaction(sid: string) { return this.backend.getLatestCompaction(sid) }
  updateSessionMetadata(sid: string, m: Record<string, unknown>) {
    return this.backend.updateSessionMetadata(sid, m)
  }
  close() { return this.backend.close() }
  healthCheck() { return this.backend.healthCheck() }
}

interface CacheConfig {
  pathTtlSeconds: number
  treeTtlSeconds: number
  infoTtlSeconds: number
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  pathTtlSeconds: 600,   // 10 分钟
  treeTtlSeconds: 300,   // 5 分钟
  infoTtlSeconds: 1800,  // 30 分钟
}
```

---

### 9.5 日志持久化与收集

#### 9.5.1 日志分层设计

vitamin 的日志分为 3 层，每层有不同的持久化策略：

```
┌────────────────────────────────────────────────────────────────┐
│ 第 1 层：结构化运行日志                                         │
│ 来源：pino logger                                              │
│ 内容：Agent 状态变化、工具调用、LLM 请求/响应、Extension 事件    │
│ 格式：JSON Lines (每行一条 JSON)                                │
│ 输出：stdout（容器标准输出 → 日志收集器自动采集）               │
│ 持久化：Loki / Elasticsearch（通过日志收集器）                  │
│ 保留：30 天                                                    │
├────────────────────────────────────────────────────────────────┤
│ 第 2 层：审计日志                                               │
│ 来源：工具执行 Hook                                             │
│ 内容：所有文件修改、bash 命令执行、外部 API 调用                │
│ 格式：PostgreSQL audit_logs 表                                  │
│ 输出：直接写数据库                                              │
│ 持久化：PostgreSQL                                              │
│ 保留：1 年                                                     │
├────────────────────────────────────────────────────────────────┤
│ 第 3 层：对话数据                                               │
│ 来源：SessionManager                                           │
│ 内容：完整对话树（用户消息、Agent 回复、工具结果、压缩记录）    │
│ 格式：PostgreSQL session_entries 表                              │
│ 输出：通过 SessionStorage 接口写入                              │
│ 持久化：PostgreSQL + S3 归档                                    │
│ 保留：永久（活跃）/ S3 归档（冷数据）                          │
└────────────────────────────────────────────────────────────────┘
```

#### 9.5.2 结构化日志实现

```typescript
// packages/shared/src/logger.ts

import pino from "pino"

export interface LoggerConfig {
  /** 日志级别 */
  level: "debug" | "info" | "warn" | "error"
  /** 部署模式 */
  mode: "local" | "cloud"
  /** 本地模式：日志文件路径 */
  filePath?: string
  /** 云端模式：是否添加 trace context */
  traceEnabled?: boolean
}

export function createLogger(config: LoggerConfig): pino.Logger {
  if (config.mode === "local") {
    // 本地模式：写文件 + pretty print
    return pino({
      level: config.level,
      transport: {
        targets: [
          // 文件输出（machine-readable）
          {
            target: "pino/file",
            options: { destination: config.filePath ?? "/tmp/vitamin.log" },
            level: config.level,
          },
          // 终端输出（human-readable，仅 warn+）
          {
            target: "pino-pretty",
            options: { colorize: true },
            level: "warn",
          },
        ],
      },
    })
  }

  // 云端模式：JSON 到 stdout（让容器日志收集器采集）
  return pino({
    level: config.level,
    // 添加容器/trace 元数据
    mixin() {
      return {
        service: "vitamin-agent",
        instance: process.env.HOSTNAME ?? "unknown",
        version: process.env.VITAMIN_VERSION ?? "dev",
        // OpenTelemetry trace context（如果启用）
        ...(config.traceEnabled ? getTraceContext() : {}),
      }
    },
    // 序列化规则：避免敏感信息泄漏
    redact: {
      paths: ["apiKey", "authorization", "password", "secret", "token"],
      censor: "[REDACTED]",
    },
  })
}

/**
 * Agent 运行时日志示例（云端模式 stdout 输出）:
 *
 * {"level":30,"time":1740700000000,"service":"vitamin-agent","instance":"worker-3","msg":"tool_execute","tool":"bash","args":{"command":"npm test"},"duration":12400}
 * {"level":30,"time":1740700012000,"service":"vitamin-agent","instance":"worker-3","msg":"llm_request","model":"claude-opus-4-6","inputTokens":8500,"outputTokens":1200}
 * {"level":40,"time":1740700013000,"service":"vitamin-agent","instance":"worker-3","msg":"steering_injected","sessionId":"s-abc","messageCount":1}
 */
```

#### 9.5.3 审计日志 Hook

```typescript
// packages/hooks/src/builtin/audit-logger.ts

import type { HookRegistration } from "../types"
import type { Pool } from "pg"

/**
 * 审计日志 Hook — 记录所有工具执行到 PostgreSQL
 *
 * 云端场景必须有审计日志：
 * - 合规要求：谁在什么时候让 Agent 执行了什么命令
 * - 安全回溯：Agent 修改了哪些文件，执行了什么 bash 命令
 * - 费用追踪：每次 LLM 调用的 token 消耗
 */
export function createAuditLoggerHook(pool: Pool, userId: string): HookRegistration {
  return {
    name: "cloud:audit-logger",
    timing: "tool.execute.after",
    priority: 10,  // 最高优先级，确保日志不丢失
    disableable: false,  // 不可禁用

    async handler(input, output) {
      const { tool, args, result, duration } = input

      // 异步写入，不阻塞工具执行
      pool.query(
        `INSERT INTO audit_logs (user_id, session_id, action, detail)
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          input.sessionId,
          `tool:${tool}`,
          JSON.stringify({
            tool,
            args: sanitizeArgs(args),  // 移除敏感参数
            resultLength: JSON.stringify(result).length,
            isError: result.isError ?? false,
            duration,
          }),
        ]
      ).catch((error) => {
        // 审计日志写入失败不应影响主流程
        logger.error({ error, tool }, "audit log write failed")
      })
    },
  }
}

/** 移除敏感参数 */
function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...args }
  for (const key of ["apiKey", "password", "secret", "token", "authorization"]) {
    if (key in sanitized) sanitized[key] = "[REDACTED]"
  }
  // bash 命令：记录完整命令（审计需要），但截断超长输出
  if (typeof sanitized.command === "string" && sanitized.command.length > 10000) {
    sanitized.command = sanitized.command.slice(0, 10000) + "... [truncated]"
  }
  return sanitized
}
```

#### 9.5.4 日志收集架构（容器端）

```yaml
# docker-compose.cloud.yml — 日志基础设施

services:
  vitamin-worker:
    image: vitamin-agent:latest
    environment:
      - VITAMIN_MODE=cloud
      - VITAMIN_LOG_LEVEL=info
      - DATABASE_URL=postgres://user:pass@postgres:5432/vitamin
      - REDIS_URL=redis://redis:6379
    logging:
      driver: "json-file"    # Docker 默认日志驱动
      options:
        max-size: "100m"
        max-file: "5"
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 2G
          cpus: '2'

  # 日志收集器：采集容器 stdout → 发送到 Loki
  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/config.yml
    # Promtail 配置：自动发现容器、解析 JSON 日志、按 service/instance 标签分类

  # 日志存储
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    # 支持 S3 后端存储，长期归档

  # 日志查询面板
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    # 预配置 Loki 数据源 + vitamin 日志 Dashboard
```

---

### 9.6 Storage Backend 初始化工厂

#### 9.6.1 根据环境自动选择存储后端

```typescript
// packages/session/src/storage/create-storage.ts

import type { SessionStorage } from "./storage-interface"

export interface StorageConfig {
  /** 存储后端类型 */
  backend: "jsonl" | "sqlite" | "postgres"
  /** JSONL / SQLite: 本地目录 */
  dir?: string
  /** PostgreSQL: 连接字符串 */
  databaseUrl?: string
  /** Redis: 连接字符串（启用缓存层） */
  redisUrl?: string
}

/**
 * 存储后端工厂
 *
 * 根据配置自动选择合适的存储后端：
 * - 本地开发: JSONL（零依赖，文件即数据）
 * - 本地大型项目: SQLite（快速查询）
 * - 云端部署: PostgreSQL + Redis 缓存
 */
export async function createStorage(config: StorageConfig): Promise<SessionStorage> {
  switch (config.backend) {
    case "jsonl": {
      const { JsonlStorage } = await import("./jsonl-storage")
      return new JsonlStorage(config.dir!)
    }
    case "sqlite": {
      const { SqliteStorage } = await import("./sqlite-storage")
      return new SqliteStorage(config.dir!)
    }
    case "postgres": {
      const { Pool } = await import("pg")
      const { PostgresStorage } = await import("./postgres-storage")
      const pool = new Pool({ connectionString: config.databaseUrl })

      // 自动执行数据库迁移
      await runMigrations(pool)

      const pgStorage = new PostgresStorage(pool)

      // 如果配置了 Redis，包装缓存层
      if (config.redisUrl) {
        const Redis = (await import("ioredis")).default
        const { CachedStorage } = await import("./cached-storage")
        const redis = new Redis(config.redisUrl)
        return new CachedStorage(pgStorage, redis)
      }

      return pgStorage
    }
  }
}

/**
 * 从环境变量自动推断存储配置
 *
 * 云端容器通常通过环境变量配置：
 *   DATABASE_URL=postgres://... → 自动选择 postgres backend
 *   REDIS_URL=redis://...       → 自动启用缓存层
 *   两者都没有                  → 本地 JSONL
 */
export function inferStorageConfig(projectDir: string): StorageConfig {
  if (process.env.DATABASE_URL) {
    return {
      backend: "postgres",
      databaseUrl: process.env.DATABASE_URL,
      redisUrl: process.env.REDIS_URL,
    }
  }

  return {
    backend: "jsonl",
    dir: `${projectDir}/.vitamin/sessions`,
  }
}
```

#### 9.6.2 SDK 集成（对使用者透明）

```typescript
// 用户代码完全不需要关心存储后端

// ── 本地使用（自动 JSONL）──
const agent = await createVitaminAgent({
  projectDir: "./my-project",
})
// → inferStorageConfig() 发现没有 DATABASE_URL → 使用 JSONL

// ── 云端使用（自动 PostgreSQL + Redis）──
// 只需要设置环境变量：
//   DATABASE_URL=postgres://user:pass@db:5432/vitamin
//   REDIS_URL=redis://cache:6379
const agent = await createVitaminAgent({
  projectDir: "/workspace/user-123/session-456",
})
// → inferStorageConfig() 发现 DATABASE_URL → 使用 PostgreSQL + Redis

// ── 显式指定 ──
const agent = await createVitaminAgent({
  projectDir: "./",
  config: {
    session: {
      storage_backend: "postgres",
      database_url: "postgres://...",
      redis_url: "redis://...",
    },
  },
})
```

---

### 9.7 数据生命周期管理

#### 9.7.1 分层存储策略

```
数据温度:

  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │   Hot    │     │   Warm   │     │   Cold   │
  │ (Redis)  │ ──→ │ (PG)     │ ──→ │ (S3)     │
  │          │     │          │     │          │
  │ 当前活跃 │     │ 近 30 天 │     │ 30 天+   │
  │ 会话缓存 │     │ 可查询   │     │ 归档     │
  └──────────┘     └──────────┘     └──────────┘
       ↑                ↑                ↑
    TTL 自动过期     定时归档任务      永久保留
    (分钟级)        (每日 cron)      (或按策略删除)
```

#### 9.7.2 归档任务

```typescript
// packages/cloud/src/archiver.ts

/**
 * 冷数据归档任务
 *
 * 定期将不活跃的会话数据从 PostgreSQL 迁移到 S3/MinIO。
 * 保留元数据索引在 PostgreSQL（可搜索），对话内容移到对象存储（廉价）。
 */
export class SessionArchiver {
  constructor(
    private pool: Pool,
    private s3: S3Client,
    private config: ArchiveConfig
  ) {}

  /**
   * 归档不活跃会话
   *
   * 策略：超过 archiveAfterDays 天未更新的会话
   *       → 导出完整 JSONL 到 S3
   *       → 删除 PostgreSQL 中的 session_entries
   *       → 在 sessions 表标记为 archived + s3_path
   */
  async archiveInactiveSessions(): Promise<ArchiveResult> {
    const cutoff = new Date(Date.now() - this.config.archiveAfterDays * 86400_000)

    // 查找待归档会话
    const { rows: candidates } = await this.pool.query(
      `SELECT id, name, user_id FROM sessions
       WHERE updated_at < $1 AND metadata->>'archived' IS NULL
       LIMIT $2`,
      [cutoff, this.config.batchSize]
    )

    let archived = 0
    for (const session of candidates) {
      try {
        // 1. 导出为 JSONL
        const entries = await this.pool.query(
          `SELECT * FROM session_entries WHERE session_id = $1 ORDER BY created_at`,
          [session.id]
        )
        const jsonl = entries.rows.map(r => JSON.stringify(r)).join("\n")

        // 2. 上传到 S3
        const s3Key = `archives/${session.user_id}/${session.id}.jsonl.gz`
        await this.s3.send(new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: s3Key,
          Body: await gzip(jsonl),
          ContentType: "application/x-ndjson",
          ContentEncoding: "gzip",
        }))

        // 3. 删除 PostgreSQL 中的条目
        await this.pool.query(
          `DELETE FROM session_entries WHERE session_id = $1`,
          [session.id]
        )

        // 4. 标记为已归档
        await this.pool.query(
          `UPDATE sessions SET metadata = metadata || $1 WHERE id = $2`,
          [JSON.stringify({ archived: true, s3_path: s3Key, archived_at: new Date().toISOString() }), session.id]
        )

        archived++
      } catch (error) {
        logger.error({ sessionId: session.id, error }, "archive failed")
      }
    }

    return { candidateCount: candidates.length, archivedCount: archived }
  }

  /**
   * 恢复归档会话
   *
   * 当用户需要查看历史会话时，从 S3 恢复到 PostgreSQL。
   */
  async restoreSession(sessionId: string): Promise<void> {
    const { rows } = await this.pool.query(
      `SELECT metadata FROM sessions WHERE id = $1`,
      [sessionId]
    )
    const s3Path = rows[0]?.metadata?.s3_path
    if (!s3Path) throw new Error("Session is not archived or not found")

    // 从 S3 下载
    const response = await this.s3.send(new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: s3Path,
    }))
    const jsonl = await gunzip(await response.Body!.transformToByteArray())
    const entries = jsonl.toString().split("\n").filter(Boolean).map(JSON.parse)

    // 批量写回 PostgreSQL
    const client = await this.pool.connect()
    try {
      await client.query("BEGIN")
      for (const entry of entries) {
        await client.query(
          `INSERT INTO session_entries (id, session_id, parent_id, type, content, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
          [entry.id, entry.session_id, entry.parent_id, entry.type, entry.content, entry.metadata, entry.created_at]
        )
      }
      // 取消归档标记
      await client.query(
        `UPDATE sessions SET metadata = metadata - 'archived' - 's3_path' - 'archived_at' WHERE id = $1`,
        [sessionId]
      )
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }
}

interface ArchiveConfig {
  archiveAfterDays: number   // 多少天不活跃后归档（默认 30）
  bucket: string             // S3 桶名
  batchSize: number          // 每次归档批量大小（默认 100）
}
```

---

### 9.8 Sandbox 抽象接口与多后端实现

#### 9.8.1 设计动机

沙箱执行环境不止一种：

| 后端 | 运行位置 | 隔离机制 | 典型场景 |
|------|----------|----------|----------|
| **OS-native** | Linux 服务器 | cgroups + seccomp + chroot | 传统云端部署，完整开发工作负载 |
| **Server Wasm** | 服务器 (Wasmtime / WasmEdge) | Wasm 线性内存沙箱 + WASI 能力白名单 | 轻量级服务端隔离，冷启动 <10ms |
| **Browser Wasm** | 浏览器 (BrowserPod / WebVM) | 浏览器 Wasm 沙箱 + 虚拟文件系统 | Web 前端模式，零服务器成本 |

它们隔离强度、性能特征、平台约束各不相同，但 Agent 循环不关心——Agent 只需要 "执行命令、读写文件、获取结果"。因此需要一个**统一抽象接口**，让沙箱后端可插拔。

#### 9.8.2 Sandbox 抽象接口

```typescript
// packages/sandbox/src/sandbox-interface.ts

/**
 * 沙箱执行结果
 */
export interface SandboxExecResult {
  stdout: string
  stderr: string
  exitCode: number
  /** 实际执行时长（ms） */
  durationMs: number
  /** 是否因超时被终止 */
  timedOut: boolean
}

/**
 * 沙箱文件系统接口
 *
 * Agent 工具（file_read、file_write、list_dir）统一通过此接口操作文件，
 * 无需关心底层是真实磁盘、Wasm 虚拟文件系统还是 IndexedDB。
 */
export interface SandboxFileSystem {
  readFile(path: string, encoding?: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  readdir(path: string): Promise<string[]>
  stat(path: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number }>
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
  rm(path: string, options?: { recursive?: boolean }): Promise<void>
  exists(path: string): Promise<boolean>
}

/**
 * 沙箱资源限制
 */
export interface SandboxLimits {
  /** CPU 限制（核数） */
  cpuLimit: number
  /** 内存限制（MB） */
  memoryLimitMb: number
  /** 单命令超时（ms） */
  commandTimeoutMs: number
  /** 磁盘配额（MB），可选 */
  diskQuotaMb?: number
  /** 允许访问的网络地址（白名单），为空表示禁止所有网络 */
  networkAllowList?: string[]
  /** 禁止的命令前缀 */
  blockedCommands?: string[]
}

/**
 * Sandbox 统一抽象接口
 *
 * 所有沙箱后端（OS-native、Server Wasm、Browser Wasm）均实现此接口。
 * Agent 工具通过此接口执行命令和操作文件，完全屏蔽底层实现。
 *
 * 设计原则：
 * - 最小接口：只暴露 Agent 工具链需要的能力
 * - 生命周期管理：initialize → exec/fs → destroy
 * - 资源约束：所有后端统一遵守 limits
 */
export interface Sandbox {
  /** 沙箱类型标识 */
  readonly type: "os-native" | "server-wasm" | "browser-wasm"

  /** 工作目录根路径（对沙箱内进程可见） */
  readonly workDir: string

  /** 文件系统操作 */
  readonly fs: SandboxFileSystem

  /** 当前资源限制 */
  readonly limits: SandboxLimits

  /**
   * MCP 代理通道（可选）
   *
   * 沙箱内的 Agent 可能需要调用 MCP 工具（如 websearch、fetch_webpage），
   * 但沙箱隔离了网络和进程。此通道作为代理桥接：
   * - OS-native: 通过 unix socket/named pipe 暴露 MCP proxy
   * - Server Wasm: 通过 WASI 能力注入或宿主函数回调
   * - Browser Wasm: 通过 postMessage 与宿主通信
   *
   * 如果 MCP 通道不可用（undefined），Agent 在沙箱内无法调用 MCP 工具。
   */
  readonly mcp?: SandboxMcpProxy

  /**
   * 初始化沙箱
   *
   * OS-native: 创建 cgroup、挂载 chroot
   * Server Wasm: 实例化 Wasm 模块、挂载 WASI 虚拟目录
   * Browser Wasm: 初始化 BrowserPod、加载磁盘镜像
   */
  initialize(): Promise<void>

  /**
   * 执行命令
   *
   * 所有后端的统一执行入口。命令字符串由 Agent 的 bash 工具生成。
   */
  exec(command: string, options?: ExecOptions): Promise<SandboxExecResult>

  /**
   * 健康检查
   */
  healthCheck(): Promise<boolean>

  /**
   * 销毁沙箱，释放所有资源
   */
  destroy(): Promise<void>
}

export interface ExecOptions {
  /** 覆盖工作目录 */
  cwd?: string
  /** 环境变量 */
  env?: Record<string, string>
  /** 超时覆盖（ms） */
  timeout?: number
  /** 中止信号 */
  signal?: AbortSignal
  /** stdin 输入 */
  stdin?: string
}

/**
 * Sandbox MCP 代理接口
 *
 * 为沙箱内的 Agent 提供 MCP 工具调用能力，
 * 实际请求由宿主环境的 MCP 客户端代理执行。
 */
export interface SandboxMcpProxy {
  /** 调用 MCP 工具（代理到宿主 MCP 客户端） */
  callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<unknown>
  /** 列出当前可用的 MCP 工具（由宿主白名单控制） */
  listTools(): Promise<Array<{ server: string; tool: string }>>
}
```

#### 9.8.3 OS-native 后端（cgroups + seccomp）

传统 Linux 服务器沙箱，适合完整开发工作负载：

```typescript
// packages/sandbox/src/backends/os-native-sandbox.ts

import type { Sandbox, SandboxExecResult, SandboxFileSystem, SandboxLimits, ExecOptions } from "../sandbox-interface"
import { spawn } from "node:child_process"
import * as fs from "node:fs/promises"
import * as path from "node:path"

export class OsNativeSandbox implements Sandbox {
  readonly type = "os-native" as const
  readonly fs: SandboxFileSystem

  constructor(
    readonly workDir: string,
    readonly limits: SandboxLimits,
    private cgroupPath?: string,
  ) {
    this.fs = new NativeFileSystem(workDir)
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.workDir, { recursive: true })

    if (this.limits.cpuLimit || this.limits.memoryLimitMb) {
      this.cgroupPath = `/sys/fs/cgroup/vitamin-${process.pid}-${Date.now()}`
      await this.setupCgroup()
    }
  }

  async exec(command: string, options?: ExecOptions): Promise<SandboxExecResult> {
    // 对命令做标准化处理（trim + 解析首 token），防止前导空格、绝对路径、间接执行绕过
    const normalized = command.trim()
    const tokens = normalized.split(/\s+/)
    const executable = tokens[0]?.replace(/^.*\//, "")  // 去掉绝对路径前缀
    const blockedCommands = this.limits.blockedCommands ?? DEFAULT_BLOCKED
    for (const blocked of blockedCommands) {
      if (normalized.startsWith(blocked)
        || tokens.includes(blocked.split(/\s+/)[0])
        || (executable && blocked.startsWith(executable))) {
        return { stdout: "", stderr: `Command blocked: ${blocked}`, exitCode: 1, durationMs: 0, timedOut: false }
      }
    }
    // 拦截常见间接执行中继（bash -c, sh -c, eval 等）
    if (/\b(bash|sh|zsh|eval)\s+(-c\s+)?['"]/.test(normalized)) {
      for (const blocked of blockedCommands) {
        if (normalized.includes(blocked)) {
          return { stdout: "", stderr: `Command blocked (indirect execution): ${blocked}`, exitCode: 1, durationMs: 0, timedOut: false }
        }
      }
    }

    const timeout = options?.timeout ?? this.limits.commandTimeoutMs
    const cwd = options?.cwd ?? this.workDir
    const start = Date.now()

    return new Promise<SandboxExecResult>((resolve) => {
      const child = spawn("sh", ["-c", command], {
        cwd,
        env: { ...process.env, ...options?.env },
        timeout,
      })

      let stdout = ""
      let stderr = ""
      let timedOut = false

      child.stdout.on("data", (data) => { stdout += data.toString() })
      child.stderr.on("data", (data) => { stderr += data.toString() })

      const timer = setTimeout(() => {
        timedOut = true
        child.kill("SIGKILL")
      }, timeout)

      options?.signal?.addEventListener("abort", () => child.kill("SIGTERM"))

      child.on("close", (code) => {
        clearTimeout(timer)
        resolve({ stdout, stderr, exitCode: code ?? 1, durationMs: Date.now() - start, timedOut })
      })
    })
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.exec("echo ok", { timeout: 5000 })
      return result.exitCode === 0
    } catch {
      return false
    }
  }

  async destroy(): Promise<void> {
    if (this.cgroupPath) {
      await fs.rm(this.cgroupPath, { recursive: true }).catch(() => {})
    }
  }

  private async setupCgroup(): Promise<void> {
    await fs.mkdir(this.cgroupPath!, { recursive: true })
    if (this.limits.memoryLimitMb) {
      await fs.writeFile(
        path.join(this.cgroupPath!, "memory.max"),
        String(this.limits.memoryLimitMb * 1024 * 1024)
      )
    }
    if (this.limits.cpuLimit) {
      await fs.writeFile(
        path.join(this.cgroupPath!, "cpu.max"),
        `${this.limits.cpuLimit * 100000} 100000`
      )
    }
  }
}

class NativeFileSystem implements SandboxFileSystem {
  constructor(private root: string) {}

  private resolve(p: string): string {
    const resolved = path.resolve(this.root, p)
    if (!resolved.startsWith(this.root)) throw new Error(`Path escape: ${p}`)
    return resolved
  }

  async readFile(p: string, encoding = "utf-8") { return fs.readFile(this.resolve(p), encoding as BufferEncoding) }
  async writeFile(p: string, content: string) { await fs.writeFile(this.resolve(p), content) }
  async readdir(p: string) { return fs.readdir(this.resolve(p)) }
  async stat(p: string) {
    const s = await fs.stat(this.resolve(p))
    return { isFile: s.isFile(), isDirectory: s.isDirectory(), size: s.size }
  }
  async mkdir(p: string, opts?: { recursive?: boolean }) { await fs.mkdir(this.resolve(p), opts) }
  async rm(p: string, opts?: { recursive?: boolean }) { await fs.rm(this.resolve(p), opts) }
  async exists(p: string) { return fs.access(this.resolve(p)).then(() => true).catch(() => false) }
}

const DEFAULT_BLOCKED = [
  "rm -rf /",
  "dd if=",
  ":(){ :|:& };:",
  "chmod 777 /",
  "curl | bash",
  "wget | bash",
]
```

#### 9.8.4 Server Wasm 后端（Wasmtime / WasmEdge）

服务器端同样可以使用 Wasm 做沙箱——通过 WASI（WebAssembly System Interface）提供受控的文件系统和进程能力，**无需 Linux cgroup/seccomp 权限**，任何操作系统均可运行：

```
┌─────────────────────────────────────────────────────────┐
│                  vitamin Server                         │
│                                                         │
│  Agent Loop ──→ Sandbox.exec("npm test")                │
│                      │                                  │
│              ┌───────▼────────┐                         │
│              │  Wasm Runtime  │                         │
│              │  (Wasmtime)    │                         │
│              │                │                         │
│              │  ┌───────────┐ │                         │
│              │  │ WASI 层   │ │                         │
│              │  │           │ │                         │
│              │  │ fs: 仅    │ │  ← 能力白名单:          │
│              │  │  /work/   │ │    fs: /workspace/{uid} │
│              │  │ net: deny │ │    net: 仅允许白名单     │
│              │  │ env: 受控 │ │    env: 过滤后注入       │
│              │  └───────────┘ │                         │
│              │                │                         │
│              │  线性内存沙箱  │  ← 无法访问宿主内存      │
│              │  无法调用任意  │  ← 无法执行宿主命令      │
│              │  系统调用      │                         │
│              └────────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

**Server Wasm vs OS-native 对比**：

| 维度 | OS-native (cgroups) | Server Wasm (Wasmtime/WasmEdge) |
|------|--------------------|---------------------------------|
| **平台** | 仅 Linux | Linux / macOS / Windows |
| **权限** | 需要 root / cgroup 权限 | 无特殊权限 |
| **隔离粒度** | 进程级 | 函数调用级（Wasm 线性内存） |
| **冷启动** | ~50-200ms（chroot 挂载） | **<10ms**（Wasm 模块实例化） |
| **性能** | 接近原生 | 接近原生（AOT 编译后 ~90%） |
| **文件系统** | 真实文件系统（chroot） | WASI 虚拟目录映射 |
| **网络** | iptables / seccomp 过滤 | WASI 能力白名单（默认无网络） |
| **安全逃逸面** | 内核漏洞可能逃逸 | Wasm 沙箱逃逸面极小 |
| **工具生态** | 直接运行宿主 CLI 工具 | 需要 WASI 编译的工具或 shell 组件 |
| **适用场景** | 需要运行任意原生二进制 | 可控工具集 + 最高安全要求 |

```typescript
// packages/sandbox/src/backends/server-wasm-sandbox.ts

import type { Sandbox, SandboxExecResult, SandboxFileSystem, SandboxLimits, ExecOptions } from "../sandbox-interface"
import * as fs from "node:fs/promises"
import * as path from "node:path"

/**
 * 服务器端 Wasm 沙箱
 *
 * 使用 Wasmtime / WasmEdge 在服务器端运行 Wasm 模块，
 * 通过 WASI 能力模型提供文件系统和进程控制。
 *
 * 优势：
 * - 无需 Linux cgroup 权限，macOS/Windows 亦可运行
 * - 冷启动 <10ms（vs chroot ~200ms）
 * - Wasm 线性内存隔离，比 cgroups 更难逃逸
 * - 能力白名单模型：默认拒绝所有，显式授予 fs/net 权限
 *
 * 限制：
 * - 工具需要 WASI 兼容（或通过 shell 组件转发）
 * - 复杂 shell 管道链兼容性待验证
 */
export class ServerWasmSandbox implements Sandbox {
  readonly type = "server-wasm" as const
  readonly fs: SandboxFileSystem
  private runtime: WasiRuntime | null = null

  constructor(
    readonly workDir: string,
    readonly limits: SandboxLimits,
    private runtimeType: "wasmtime" | "wasmedge" = "wasmtime",
  ) {
    this.fs = new WasiFileSystem(workDir)
  }

  async initialize(): Promise<void> {
    this.runtime = await createWasiRuntime(this.runtimeType, {
      // WASI 能力白名单
      preopens: {
        "/workspace": this.workDir,  // 仅映射工作目录
      },
      env: this.buildSafeEnv(),
      // Wasmtime fuel 机制：每条 Wasm 指令消耗 1 fuel，用于 CPU 限制
      fuelLimit: this.cpuToFuel(this.limits.cpuLimit),
      memoryLimitPages: Math.ceil(this.limits.memoryLimitMb / 64),  // Wasm 页 = 64KB
      networkAccess: this.limits.networkAllowList?.length
        ? { type: "allowlist", hosts: this.limits.networkAllowList }
        : { type: "deny" },
    })
  }

  async exec(command: string, options?: ExecOptions): Promise<SandboxExecResult> {
    if (!this.runtime) throw new Error("Sandbox not initialized")

    for (const blocked of this.limits.blockedCommands ?? []) {
      if (command.startsWith(blocked)) {
        return { stdout: "", stderr: `Command blocked: ${blocked}`, exitCode: 1, durationMs: 0, timedOut: false }
      }
    }

    const timeout = options?.timeout ?? this.limits.commandTimeoutMs
    const start = Date.now()

    try {
      const result = await this.runtime.exec(command, {
        cwd: options?.cwd ?? "/workspace",
        env: options?.env,
        stdin: options?.stdin,
        timeout,
        signal: options?.signal,
      })

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs: Date.now() - start,
        timedOut: false,
      }
    } catch (error: unknown) {
      const isTimeout = error instanceof Error && error.message.includes("fuel")
      return {
        stdout: "",
        stderr: isTimeout ? "Execution timed out (fuel exhausted)" : String(error),
        exitCode: 1,
        durationMs: Date.now() - start,
        timedOut: isTimeout,
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.exec("echo ok", { timeout: 5000 })
      return result.exitCode === 0
    } catch {
      return false
    }
  }

  async destroy(): Promise<void> {
    this.runtime?.dispose()
    this.runtime = null
  }

  private cpuToFuel(cpuLimit: number): bigint {
    return 1_000_000_000n * BigInt(cpuLimit)
  }

  private buildSafeEnv(): Record<string, string> {
    return {
      HOME: "/workspace",
      PATH: "/usr/local/bin:/usr/bin:/bin",
      TERM: "xterm-256color",
      NODE_ENV: "production",
    }
  }
}

/** WasiFileSystem 使用 ESM 顶层导入，避免每个方法重复 require() */
class WasiFileSystem implements SandboxFileSystem {
  constructor(private hostRoot: string) {}

  private toHostPath(wasmPath: string): string {
    const p = wasmPath.replace(/^\/workspace\/?/, "")
    const resolved = path.resolve(this.hostRoot, p)
    if (!resolved.startsWith(this.hostRoot)) throw new Error(`Path escape: ${wasmPath}`)
    return resolved
  }

  async readFile(p: string, encoding = "utf-8") {
    return fs.readFile(this.toHostPath(p), encoding as BufferEncoding)
  }
  async writeFile(p: string, content: string) {
    await fs.writeFile(this.toHostPath(p), content)
  }
  async readdir(p: string) {
    return fs.readdir(this.toHostPath(p))
  }
  async stat(p: string) {
    const s = await fs.stat(this.toHostPath(p))
    return { isFile: s.isFile(), isDirectory: s.isDirectory(), size: s.size }
  }
  async mkdir(p: string, opts?: { recursive?: boolean }) {
    await fs.mkdir(this.toHostPath(p), opts)
  }
  async rm(p: string, opts?: { recursive?: boolean }) {
    await fs.rm(this.toHostPath(p), opts)
  }
  async exists(p: string) {
    return fs.access(this.toHostPath(p)).then(() => true).catch(() => false)
  }
}

// -- 类型占位（实际由 Wasm 运行时 SDK 提供）--
interface WasiRuntime {
  exec(command: string, options: Record<string, unknown>): Promise<{ stdout: string; stderr: string; exitCode: number }>
  dispose(): void
}
declare function createWasiRuntime(type: string, config: Record<string, unknown>): Promise<WasiRuntime>
```

#### 9.8.5 Browser Wasm 后端（BrowserPod / WebVM）

浏览器内 Wasm 虚拟机沙箱，适合 Web 前端模式（参见 [WebVM](https://webvm.io/)、[BrowserPod](https://browserpod.io/)）：

```typescript
// packages/sandbox/src/backends/browser-wasm-sandbox.ts

import type { Sandbox, SandboxExecResult, SandboxFileSystem, SandboxLimits, ExecOptions } from "../sandbox-interface"

/**
 * 浏览器 Wasm 沙箱
 *
 * 使用 BrowserPod SDK 或 CheerpX (WebVM) JavaScript API
 * 在浏览器内运行完整 Linux 环境。
 *
 * 优势：
 * - 零服务器成本（工具执行完全在客户端）
 * - 浏览器 Wasm 沙箱是硬件级隔离
 * - 用户代码从未离开浏览器，无数据主权风险
 *
 * 限制：
 * - 浏览器内存上限 2-4GB
 * - 网络能力受限（需 Portals / 代理）
 * - 后台标签页可能被节流
 */
export class BrowserWasmSandbox implements Sandbox {
  readonly type = "browser-wasm" as const
  readonly fs: SandboxFileSystem

  constructor(
    readonly workDir: string,
    readonly limits: SandboxLimits,
    private pod: BrowserPod,
  ) {
    this.fs = new BrowserPodFileSystem(pod)
  }

  async initialize(): Promise<void> {
    await this.pod.boot()
    await this.pod.fs.mkdir(this.workDir, { recursive: true })
  }

  async exec(command: string, options?: ExecOptions): Promise<SandboxExecResult> {
    const timeout = options?.timeout ?? this.limits.commandTimeoutMs
    const start = Date.now()

    try {
      const result = await this.pod.exec(command, {
        cwd: options?.cwd ?? this.workDir,
        env: options?.env,
        timeout,
        signal: options?.signal,
      })

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs: Date.now() - start,
        timedOut: false,
      }
    } catch (error: unknown) {
      return {
        stdout: "",
        stderr: String(error),
        exitCode: 1,
        durationMs: Date.now() - start,
        timedOut: Date.now() - start >= timeout,
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.exec("echo ok", { timeout: 5000 })
      return result.exitCode === 0
    } catch {
      return false
    }
  }

  async destroy(): Promise<void> {
    await this.pod.shutdown()
  }
}

class BrowserPodFileSystem implements SandboxFileSystem {
  constructor(private pod: BrowserPod) {}

  async readFile(p: string, encoding = "utf-8") { return this.pod.fs.readFile(p, encoding) }
  async writeFile(p: string, content: string) { await this.pod.fs.writeFile(p, content) }
  async readdir(p: string) { return this.pod.fs.readdir(p) }
  async stat(p: string) { return this.pod.fs.stat(p) }
  async mkdir(p: string, opts?: { recursive?: boolean }) { await this.pod.fs.mkdir(p, opts) }
  async rm(p: string, opts?: { recursive?: boolean }) { await this.pod.fs.rm(p, opts) }
  async exists(p: string) { return this.pod.fs.exists(p) }
}

// -- 类型占位（实际由 BrowserPod SDK 提供）--
interface BrowserPod {
  boot(): Promise<void>
  exec(command: string, options: Record<string, unknown>): Promise<{ stdout: string; stderr: string; exitCode: number }>
  shutdown(): Promise<void>
  fs: SandboxFileSystem
}
```

#### 9.8.6 Sandbox 工厂与自动选择

```typescript
// packages/sandbox/src/create-sandbox.ts

import type { Sandbox, SandboxLimits } from "./sandbox-interface"

export type SandboxBackend = "os-native" | "server-wasm" | "browser-wasm" | "auto"

export interface SandboxFactoryConfig {
  /** 沙箱后端类型，"auto" 表示自动检测 */
  backend: SandboxBackend
  /** 工作目录 */
  workDir: string
  /** 资源限制 */
  limits: SandboxLimits
  /** Server Wasm: 运行时选择 */
  wasmRuntime?: "wasmtime" | "wasmedge"
  /** Browser Wasm: BrowserPod 实例（由外部传入） */
  browserPod?: BrowserPod
}

/**
 * 沙箱工厂
 *
 * 自动选择逻辑：
 * 1. 如果传入 browserPod → browser-wasm
 * 2. 如果服务器端可检测到 wasmtime/wasmedge → server-wasm
 * 3. 如果 Linux + 有 cgroup 权限 → os-native
 * 4. 兜底：server-wasm（无需特殊权限）
 */
export async function createSandbox(config: SandboxFactoryConfig): Promise<Sandbox> {
  const backend = config.backend === "auto"
    ? await detectBestBackend(config)
    : config.backend

  switch (backend) {
    case "os-native": {
      const { OsNativeSandbox } = await import("./backends/os-native-sandbox")
      const sandbox = new OsNativeSandbox(config.workDir, config.limits)
      await sandbox.initialize()
      return sandbox
    }
    case "server-wasm": {
      const { ServerWasmSandbox } = await import("./backends/server-wasm-sandbox")
      const sandbox = new ServerWasmSandbox(config.workDir, config.limits, config.wasmRuntime)
      await sandbox.initialize()
      return sandbox
    }
    case "browser-wasm": {
      const { BrowserWasmSandbox } = await import("./backends/browser-wasm-sandbox")
      const sandbox = new BrowserWasmSandbox(config.workDir, config.limits, config.browserPod!)
      await sandbox.initialize()
      return sandbox
    }
  }
}

async function detectBestBackend(config: SandboxFactoryConfig): Promise<Exclude<SandboxBackend, "auto">> {
  if (config.browserPod) return "browser-wasm"
  if (typeof globalThis.window !== "undefined"
    && typeof globalThis.document !== "undefined"
    && typeof globalThis.SharedArrayBuffer !== "undefined") return "browser-wasm"
  if (await isWasmRuntimeAvailable()) return "server-wasm"
  if (process.platform === "linux" && await hasCgroupAccess()) return "os-native"
  return "server-wasm"
}

async function isWasmRuntimeAvailable(): Promise<boolean> {
  try {
    const { execSync } = await import("node:child_process")
    execSync("wasmtime --version", { stdio: "ignore" })
    return true
  } catch {
    try {
      const { execSync } = await import("node:child_process")
      execSync("wasmedge --version", { stdio: "ignore" })
      return true
    } catch {
      return false
    }
  }
}

async function hasCgroupAccess(): Promise<boolean> {
  try {
    const fs = await import("node:fs/promises")
    await fs.access("/sys/fs/cgroup", (await import("node:fs")).constants.W_OK)
    return true
  } catch {
    return false
  }
}
```

#### 9.8.7 创建统一沙箱工具

```typescript
// packages/sandbox/src/create-sandboxed-tools.ts

import type { Sandbox } from "./sandbox-interface"

/**
 * 基于 Sandbox 抽象接口创建 Agent 工具
 *
 * 不论底层是 OS-native、Server Wasm 还是 Browser Wasm，
 * Agent 看到的工具接口完全一致。
 */
export function createSandboxedTools(sandbox: Sandbox) {
  return {
    bash: {
      name: "bash",
      async execute(id: string, args: { command: string }, signal: AbortSignal) {
        const result = await sandbox.exec(args.command, { signal })
        return {
          content: [{ type: "text", text: result.stdout + result.stderr }],
          isError: result.exitCode !== 0,
        }
      },
    },

    file_read: {
      name: "file_read",
      async execute(id: string, args: { file_path: string }) {
        try {
          const content = await sandbox.fs.readFile(args.file_path)
          return { content: [{ type: "text", text: content }] }
        } catch (error) {
          return { content: [{ type: "text", text: String(error) }], isError: true }
        }
      },
    },

    file_write: {
      name: "file_write",
      async execute(id: string, args: { file_path: string; content: string }) {
        try {
          await sandbox.fs.writeFile(args.file_path, args.content)
          return { content: [{ type: "text", text: `Written to ${args.file_path}` }] }
        } catch (error) {
          return { content: [{ type: "text", text: String(error) }], isError: true }
        }
      },
    },

    list_dir: {
      name: "list_dir",
      async execute(id: string, args: { path: string }) {
        try {
          const entries = await sandbox.fs.readdir(args.path)
          return { content: [{ type: "text", text: entries.join("\n") }] }
        } catch (error) {
          return { content: [{ type: "text", text: String(error) }], isError: true }
        }
      },
    },
  }
}
```

#### 9.8.8 三后端对照总表

| 维度 | OS-native | Server Wasm | Browser Wasm |
|------|-----------|-------------|--------------|
| **运行位置** | Linux 服务器 | 任意服务器 | 浏览器 |
| **平台要求** | Linux + cgroup 权限 | 安装 wasmtime/wasmedge | 现代浏览器 + SharedArrayBuffer |
| **隔离强度** | 强（内核级） | **极强**（Wasm 沙箱） | **极强**（浏览器 + Wasm 双重沙箱） |
| **逃逸面** | 内核漏洞 | Wasm 运行时漏洞（极罕见） | 浏览器漏洞（极罕见） |
| **冷启动** | ~50-200ms | **<10ms** | ~2s 首次 / <500ms 后续 |
| **执行性能** | **原生** | ~90% 原生（AOT） | ~40-60% 原生（JIT） |
| **文件系统** | 真实 chroot | WASI 虚拟目录映射 | IndexedDB 虚拟 FS |
| **网络** | iptables 过滤 | WASI 能力白名单 | Portals 受控出入口 |
| **工具兼容性** | **任意原生二进制** | WASI 兼容工具 | BrowserPod 引擎支持的语言 |
| **服务器成本** | 需要计算资源 | 需要计算资源 | **零**（客户端执行） |
| **隐私** | 代码在服务器 | 代码在服务器 | **代码不出浏览器** |
| **适合场景** | 完整开发任务 | 受控工具集 + 跨平台 | Web IDE / 教育 / 隐私敏感 |

```
Sandbox 后端选择决策树:

  需要运行任意原生 CLI 工具？
    ├── 是 → OS-native (cgroups + seccomp)
    └── 否
         │
         运行在浏览器中？
         ├── 是 → Browser Wasm (BrowserPod / WebVM)
         └── 否
              │
              有 Linux cgroup 权限？
              ├── 否 → Server Wasm (Wasmtime / WasmEdge)
              └── 是
                   │
                   需要最高安全隔离？
                   ├── 是 → Server Wasm
                   └── 否 → OS-native（性能最优）
```
---

### 9.9 云端部署配置总览

```typescript
// packages/config/src/schema/cloud.ts

import { z } from "zod/v4"

export const CloudConfigSchema = z.object({
  /** 存储后端 */
  storage_backend: z.enum(["jsonl", "sqlite", "postgres"]).default("jsonl"),

  /** PostgreSQL 连接 */
  database_url: z.string().optional(),

  /** Redis 连接 */
  redis_url: z.string().optional(),

  /** S3 归档配置 */
  archive: z.object({
    enabled: z.boolean().default(false),
    bucket: z.string().default("vitamin-archives"),
    archive_after_days: z.number().default(30),
    region: z.string().default("us-east-1"),
  }).optional(),

  /** 沙箱配置 */
  sandbox: z.object({
    enabled: z.boolean().default(false),
    /** 沙箱后端："auto" 按环境自动选择 */
    backend: z.enum(["os-native", "server-wasm", "browser-wasm", "auto"]).default("auto"),
    /** Server Wasm 运行时（仅 backend 为 server-wasm / auto 时生效） */
    wasm_runtime: z.enum(["wasmtime", "wasmedge"]).optional(),
    cpu_limit: z.number().default(2),
    memory_limit_mb: z.number().default(1024),
    command_timeout_ms: z.number().default(300_000),
    blocked_commands: z.array(z.string()).optional(),
    network_allow_list: z.array(z.string()).optional(),
  }).optional(),

  /** 审计日志 */
  audit: z.object({
    enabled: z.boolean().default(true),
    retention_days: z.number().default(365),
  }).optional(),

  /** 日志配置 */
  logging: z.object({
    level: z.enum(["debug", "info", "warn", "error"]).default("info"),
    trace_enabled: z.boolean().default(false),
    redact_sensitive: z.boolean().default(true),
  }).optional(),
})
```

### 9.10 云端 vs 单机对照表

| 维度 | 单机 CLI | 云端部署 |
|------|---------|----------|
| **Session 存储** | JSONL 文件 | PostgreSQL + Redis 缓存 |
| **日志** | pino → `/tmp/vitamin.log` | pino → stdout → Loki/ES |
| **审计** | 无 | PostgreSQL `audit_logs` 表 |
| **配置** | `.vitamin/config.jsonc` | 环境变量 |
| **工具隔离** | 信任本地 | Sandbox 抽象接口 (OS-native / Server Wasm / Browser Wasm) |
| **数据归档** | 手动删除 | S3 自动归档 + 恢复 |
| **多用户** | 单用户 | userId 隔离 |
| **代码改动** | - | **零业务代码改动**（仅切换 Storage Backend） |
