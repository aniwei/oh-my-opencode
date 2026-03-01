// JSONL 存储测试
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

import { createJsonlStorage } from '../src/storage/jsonl-storage'

import type { SessionEntry } from '../src/types'

function createTempDir(): string {
  const dir = join(tmpdir(), `vitamin-test-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function makeEntry(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    id: randomUUID(),
    parentId: null,
    type: 'message',
    content: { role: 'user', content: 'hello', timestamp: Date.now() },
    timestamp: Date.now(),
    ...overrides,
  }
}

describe('JsonlStorage', () => {
  let baseDir: string

  beforeEach(() => {
    baseDir = createTempDir()
  })

  afterEach(() => {
    if (existsSync(baseDir)) {
      rmSync(baseDir, { recursive: true })
    }
  })

  describe('#given 空存储', () => {
    describe('#when append 一条 entry', () => {
      it('#then 可以回读', async () => {
        const storage = createJsonlStorage(baseDir)
        const entry = makeEntry()

        await storage.append('session-1', entry)
        const entries = await storage.readAll('session-1')

        expect(entries).toHaveLength(1)
        expect(entries[0].id).toBe(entry.id)
      })
    })

    describe('#when readAll 不存在的 session', () => {
      it('#then 返回空数组', async () => {
        const storage = createJsonlStorage(baseDir)
        const entries = await storage.readAll('nonexistent')
        expect(entries).toHaveLength(0)
      })
    })

    describe('#when exists 检查不存在的 session', () => {
      it('#then 返回 false', async () => {
        const storage = createJsonlStorage(baseDir)
        const result = await storage.exists('nonexistent')
        expect(result).toBe(false)
      })
    })

    describe('#when listSessionIds', () => {
      it('#then 返回空数组', async () => {
        const storage = createJsonlStorage(baseDir)
        const ids = await storage.listSessionIds()
        expect(ids).toHaveLength(0)
      })
    })
  })

  describe('#given 已有数据的存储', () => {
    describe('#when append 50 条 entries', () => {
      it('#then 全部可回读', async () => {
        const storage = createJsonlStorage(baseDir)
        const entries: SessionEntry[] = []

        for (let i = 0; i < 50; i++) {
          const entry = makeEntry({ id: `entry-${i}` })
          entries.push(entry)
          await storage.append('session-1', entry)
        }

        const readBack = await storage.readAll('session-1')
        expect(readBack).toHaveLength(50)
        for (let i = 0; i < 50; i++) {
          expect(readBack[i].id).toBe(`entry-${i}`)
        }
      })
    })

    describe('#when remove 会话', () => {
      it('#then 文件被删除', async () => {
        const storage = createJsonlStorage(baseDir)
        await storage.append('session-1', makeEntry())

        expect(await storage.exists('session-1')).toBe(true)
        await storage.remove('session-1')
        expect(await storage.exists('session-1')).toBe(false)
      })
    })

    describe('#when listSessionIds 有多个会话', () => {
      it('#then 返回所有 session ID', async () => {
        const storage = createJsonlStorage(baseDir)
        await storage.append('session-a', makeEntry())
        await storage.append('session-b', makeEntry())
        await storage.append('session-c', makeEntry())

        const ids = await storage.listSessionIds()
        expect(ids.sort()).toEqual(['session-a', 'session-b', 'session-c'])
      })
    })
  })
})
