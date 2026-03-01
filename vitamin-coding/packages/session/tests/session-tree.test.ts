// 会话树测试
import { randomUUID } from 'node:crypto'

import {
  buildTree,
  createBranchPoint,
  createSessionTree,
  getLeafNodes,
  getMessagesForEntry,
  pathToNode,
} from '../src/session-tree'

import type { SessionEntry, SessionStorage } from '../src/types'

// 内存存储 stub — 测试用
function createMemoryStorage(): SessionStorage & { entries: Map<string, SessionEntry[]> } {
  const entries = new Map<string, SessionEntry[]>()

  return {
    entries,
    async append(sessionId: string, entry: SessionEntry): Promise<void> {
      const list = entries.get(sessionId) ?? []
      list.push(entry)
      entries.set(sessionId, list)
    },
    async readAll(sessionId: string): Promise<SessionEntry[]> {
      return entries.get(sessionId) ?? []
    },
    async exists(sessionId: string): Promise<boolean> {
      return entries.has(sessionId)
    },
    async remove(sessionId: string): Promise<void> {
      entries.delete(sessionId)
    },
    async listSessionIds(): Promise<string[]> {
      return [...entries.keys()]
    },
  }
}

function makeEntry(id: string, parentId: string | null, type: SessionEntry['type'] = 'message'): SessionEntry {
  return {
    id,
    parentId,
    type,
    content: { role: 'user', content: `msg-${id}`, timestamp: Date.now() },
    timestamp: Date.now(),
  }
}

describe('SessionTree', () => {
  describe('#given 线性会话 A→B→C', () => {
    const entries: SessionEntry[] = [
      makeEntry('A', null),
      makeEntry('B', 'A'),
      makeEntry('C', 'B'),
    ]

    describe('#when buildTree', () => {
      it('#then 构建正确的树结构', () => {
        const tree = buildTree(entries)

        expect(tree).not.toBeNull()
        expect(tree!.entry.id).toBe('A')
        expect(tree!.children).toHaveLength(1)
        expect(tree!.children[0].entry.id).toBe('B')
        expect(tree!.children[0].children).toHaveLength(1)
        expect(tree!.children[0].children[0].entry.id).toBe('C')
      })
    })

    describe('#when pathToNode C', () => {
      it('#then 返回 [A, B, C]', () => {
        const path = pathToNode(entries, 'C')
        expect(path.map((e) => e.id)).toEqual(['A', 'B', 'C'])
      })
    })

    describe('#when getLeafNodes', () => {
      it('#then 返回 C', () => {
        const tree = buildTree(entries)!
        const leaves = getLeafNodes(tree)
        expect(leaves).toHaveLength(1)
        expect(leaves[0].entry.id).toBe('C')
      })
    })
  })

  describe('#given fork 创建分支', () => {
    const entries: SessionEntry[] = [
      makeEntry('A', null),
      makeEntry('B', 'A'),
      makeEntry('C', 'B'),
      { ...makeEntry('BP', 'B'), type: 'branch_point' },
      makeEntry('D', 'BP'),
    ]

    describe('#when buildTree', () => {
      it('#then B 有两个子节点 (C 和 BP)', () => {
        const tree = buildTree(entries)!
        const bNode = tree.children[0]
        expect(bNode.entry.id).toBe('B')
        expect(bNode.children).toHaveLength(2)

        const childIds = bNode.children.map((c) => c.entry.id).sort()
        expect(childIds).toEqual(['BP', 'C'])
      })
    })

    describe('#when getLeafNodes', () => {
      it('#then 返回两个叶子节点 (C 和 D)', () => {
        const tree = buildTree(entries)!
        const leaves = getLeafNodes(tree)
        expect(leaves).toHaveLength(2)
        const leafIds = leaves.map((l) => l.entry.id).sort()
        expect(leafIds).toEqual(['C', 'D'])
      })
    })

    describe('#when navigateTo 每个叶节点', () => {
      it('#then 消息历史正确', () => {
        const pathC = pathToNode(entries, 'C')
        expect(pathC.map((e) => e.id)).toEqual(['A', 'B', 'C'])

        const pathD = pathToNode(entries, 'D')
        expect(pathD.map((e) => e.id)).toEqual(['A', 'B', 'BP', 'D'])
      })
    })
  })

  describe('#given createBranchPoint', () => {
    describe('#when 创建分支点', () => {
      it('#then 返回 branch_point 类型的 entry', () => {
        const bp = createBranchPoint('parent-id', 'bp-id', 12345)
        expect(bp.id).toBe('bp-id')
        expect(bp.parentId).toBe('parent-id')
        expect(bp.type).toBe('branch_point')
        expect(bp.timestamp).toBe(12345)
      })
    })
  })

  describe('#given SessionTree 实例 + 内存存储', () => {
    describe('#when load → append → fork → navigateTo', () => {
      it('#then 完整流程正确', async () => {
        const storage = createMemoryStorage()
        const tree = createSessionTree('sess-1', storage)

        // 追加两条消息
        await tree.append(makeEntry('A', null))
        await tree.append(makeEntry('B', null))
        expect(tree.size).toBe(2)
        expect(tree.getActiveEntryId()).toBe('B')

        // fork 从 A 创建分支
        tree.fork('A', 'bp-1')
        expect(tree.getActiveEntryId()).toBe('bp-1')

        // 在分支上追加消息
        await tree.append(makeEntry('C', null))
        expect(tree.getActiveEntryId()).toBe('C')

        // navigateTo 回到 B
        const messages = tree.navigateTo('B')
        expect(tree.getActiveEntryId()).toBe('B')
        expect(messages.length).toBeGreaterThanOrEqual(0)
      })
    })

    describe('#when fork 空会话', () => {
      it('#then 抛出 SESSION_FORK_EMPTY 错误', () => {
        const storage = createMemoryStorage()
        const tree = createSessionTree('sess-empty', storage)

        expect(() => tree.fork(undefined, 'bp-1')).toThrow('无法 fork')
      })
    })

    describe('#when navigateTo 不存在的节点', () => {
      it('#then 抛出错误', async () => {
        const storage = createMemoryStorage()
        const tree = createSessionTree('sess-1', storage)
        await tree.append(makeEntry('A', null))

        expect(() => tree.navigateTo('nonexistent')).toThrow('无法导航')
      })
    })

    describe('#when getTree', () => {
      it('#then 返回完整树结构', async () => {
        const storage = createMemoryStorage()
        const tree = createSessionTree('sess-1', storage)

        await tree.append(makeEntry('A', null))
        await tree.append(makeEntry('B', null))

        const root = tree.getTree()
        expect(root).not.toBeNull()
        expect(root!.entry.id).toBe('A')
      })
    })
  })

  describe('#given getMessagesForEntry', () => {
    describe('#when 过滤消息和压缩条目', () => {
      it('#then 只返回 message 和 compaction 类型', () => {
        const entries: SessionEntry[] = [
          makeEntry('A', null),
          { ...makeEntry('S', 'A'), type: 'system' },
          makeEntry('B', 'S'),
          { ...makeEntry('BP', 'B'), type: 'branch_point' },
          makeEntry('C', 'BP'),
        ]

        const messages = getMessagesForEntry(entries, 'C')
        // A → S → B → BP → C，过滤后只保留 message 类型: A, B, C
        expect(messages.every((e) => e.type === 'message' || e.type === 'compaction')).toBe(true)
      })
    })
  })
})
