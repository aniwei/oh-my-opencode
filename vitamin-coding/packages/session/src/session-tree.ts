// 会话树操作
// 支持 fork（从任意节点创建分支）、navigateTo（跳转到树中任意节点）、getTree（获取完整树结构）
import { SessionError } from '@vitamin/shared'

import type { SessionEntry, SessionNode, SessionStorage } from './types'

// 从 entries 列表构建树结构
export function buildTree(entries: SessionEntry[]): SessionNode | null {
  if (entries.length === 0) {
    return null
  }

  const nodeMap = new Map<string, SessionNode>()
  let rootNode: SessionNode | null = null

  // 第一遍：创建所有节点
  for (const entry of entries) {
    nodeMap.set(entry.id, { entry, children: [] })
  }

  // 第二遍：构建父子关系
  for (const entry of entries) {
    const node = nodeMap.get(entry.id)
    if (!node) continue

    if (entry.parentId === null) {
      rootNode = node
    } else {
      const parent = nodeMap.get(entry.parentId)
      if (parent) {
        parent.children.push(node)
      } else {
        // 如果找不到父节点，当做根节点处理
        if (!rootNode) {
          rootNode = node
        }
      }
    }
  }

  return rootNode
}

// 从根到指定节点的路径
export function pathToNode(entries: SessionEntry[], targetId: string): SessionEntry[] {
  const parentMap = new Map<string, string | null>()
  for (const entry of entries) {
    parentMap.set(entry.id, entry.parentId)
  }

  const entryMap = new Map<string, SessionEntry>()
  for (const entry of entries) {
    entryMap.set(entry.id, entry)
  }

  // 从目标节点回溯到根
  const path: SessionEntry[] = []
  let currentId: string | null = targetId
  const visited = new Set<string>()

  while (currentId !== null) {
    if (visited.has(currentId)) {
      break // 防止循环引用
    }
    visited.add(currentId)

    const entry = entryMap.get(currentId)
    if (!entry) break
    path.unshift(entry)
    currentId = entry.parentId
  }

  return path
}

// 获取指定节点的所有叶子节点
export function getLeafNodes(node: SessionNode): SessionNode[] {
  if (node.children.length === 0) {
    return [node]
  }

  const leaves: SessionNode[] = []
  for (const child of node.children) {
    leaves.push(...getLeafNodes(child))
  }
  return leaves
}

// 从 entries 中提取消息 — 沿着从根到 activeEntryId 的路径
export function getMessagesForEntry(
  entries: SessionEntry[],
  activeEntryId: string,
): SessionEntry[] {
  return pathToNode(entries, activeEntryId).filter(
    (e) => e.type === 'message' || e.type === 'compaction',
  )
}

// 创建 fork 分支点
export function createBranchPoint(
  fromEntryId: string,
  branchPointId: string,
  timestamp: number,
): SessionEntry {
  return {
    id: branchPointId,
    parentId: fromEntryId,
    type: 'branch_point',
    content: {
      kind: 'session_start',
      data: { forkedFrom: fromEntryId },
    },
    timestamp,
  }
}

// Session 树管理器
export class SessionTree {
  private entries: SessionEntry[] = []
  private activeEntryId: string | null = null

  constructor(
    private readonly sessionId: string,
    private readonly storage: SessionStorage,
  ) {}

  // 从存储加载所有 entries
  async load(): Promise<void> {
    this.entries = await this.storage.readAll(this.sessionId)
    const lastEntry = this.entries[this.entries.length - 1]
    if (lastEntry) {
      this.activeEntryId = lastEntry.id
    }
  }

  // 追加新 entry
  async append(entry: SessionEntry): Promise<void> {
    // 如果有活跃节点且 entry 没有 parentId，则自动设置
    if (entry.parentId === null && this.activeEntryId !== null && this.entries.length > 0) {
      entry = { ...entry, parentId: this.activeEntryId ?? null }
    }

    await this.storage.append(this.sessionId, entry)
    this.entries.push(entry)
    this.activeEntryId = entry.id
  }

  // fork：从指定节点创建分支
  fork(fromEntryId: string | undefined, branchPointId: string): SessionEntry {
    const targetId = fromEntryId ?? this.activeEntryId
    if (!targetId) {
      throw new SessionError('无法 fork: 会话为空', { code: 'SESSION_FORK_EMPTY' })
    }

    const entryExists = this.entries.some((e) => e.id === targetId)
    if (!entryExists) {
      throw new SessionError(`无法 fork: 节点 "${targetId}" 不存在`, {
        code: 'SESSION_FORK_NOT_FOUND',
      })
    }

    const branchPoint = createBranchPoint(targetId, branchPointId, Date.now())
    this.entries.push(branchPoint)
    this.activeEntryId = branchPointId
    return branchPoint
  }

  // navigateTo：跳转到树中任意节点
  navigateTo(entryId: string): SessionEntry[] {
    const entryExists = this.entries.some((e) => e.id === entryId)
    if (!entryExists) {
      throw new SessionError(`无法导航: 节点 "${entryId}" 不存在`, {
        code: 'SESSION_NAVIGATE_NOT_FOUND',
      })
    }

    this.activeEntryId = entryId
    return this.getActiveMessages()
  }

  // 获取当前活跃路径上的消息
  getActiveMessages(): SessionEntry[] {
    if (!this.activeEntryId) {
      return []
    }
    return getMessagesForEntry(this.entries, this.activeEntryId)
  }

  // 获取完整树结构
  getTree(): SessionNode | null {
    return buildTree(this.entries)
  }

  // 获取所有 entries
  getEntries(): SessionEntry[] {
    return [...this.entries]
  }

  // 当前活跃节点 ID
  getActiveEntryId(): string | null {
    return this.activeEntryId
  }

  // entries 总数
  get size(): number {
    return this.entries.length
  }
}

// 工厂函数
export function createSessionTree(sessionId: string, storage: SessionStorage): SessionTree {
  return new SessionTree(sessionId, storage)
}
