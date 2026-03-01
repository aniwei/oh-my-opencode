// 会话管理器测试
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

import { createSessionManager } from '../src/session-manager'

import type { Message } from '@vitamin/ai'

function createTempDir(): string {
  const dir = join(tmpdir(), `vitamin-test-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function makeUserMsg(text: string): Message {
  return { role: 'user', content: text, timestamp: Date.now() }
}

function makeAssistantMsg(text: string): Message {
  return {
    role: 'assistant',
    content: [{ type: 'text', text }],
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    stopReason: 'end_turn',
    model: 'test',
  }
}

describe('SessionManager', () => {
  let baseDir: string

  beforeEach(() => {
    baseDir = createTempDir()
  })

  afterEach(() => {
    if (existsSync(baseDir)) {
      rmSync(baseDir, { recursive: true })
    }
  })

  describe('#given 新的 SessionManager', () => {
    describe('#when create 会话', () => {
      it('#then 返回包含 id/title/createdAt/messageCount 的元数据', async () => {
        const manager = createSessionManager({ baseDir })
        const meta = await manager.create('测试会话')

        expect(meta.id).toBeDefined()
        expect(meta.title).toBe('测试会话')
        expect(meta.createdAt).toBeGreaterThan(0)
        expect(meta.messageCount).toBe(0)
      })
    })

    describe('#when create 3 个 → list()', () => {
      it('#then 全部返回且字段完整', async () => {
        const manager = createSessionManager({ baseDir })
        await manager.create('会话 1')
        await manager.create('会话 2')
        await manager.create('会话 3')

        const list = await manager.list()
        expect(list).toHaveLength(3)
        for (const item of list) {
          expect(item.id).toBeDefined()
          expect(item.title).toBeDefined()
          expect(item.createdAt).toBeGreaterThan(0)
        }
      })
    })
  })

  describe('#given 已有会话', () => {
    describe('#when appendMessage', () => {
      it('#then 消息可持久化', async () => {
        const manager = createSessionManager({ baseDir })
        const meta = await manager.create('测试')

        await manager.appendMessage(meta.id, makeUserMsg('你好'))
        await manager.appendMessage(meta.id, makeAssistantMsg('你好！'))

        const tree = await manager.getTree(meta.id)
        expect(tree.size).toBeGreaterThanOrEqual(3) // system + 2 messages
      })
    })

    describe('#when remove 会话', () => {
      it('#then list 不再包含', async () => {
        const manager = createSessionManager({ baseDir })
        const meta = await manager.create('待删除')

        await manager.remove(meta.id)
        const list = await manager.list()
        expect(list.find((s) => s.id === meta.id)).toBeUndefined()
      })
    })

    describe('#when recover 恢复最近会话', () => {
      it('#then 返回最近更新的会话', async () => {
        const manager = createSessionManager({ baseDir })
        await manager.create('会话 A')

        // 等一下再创建第二个，确保时间戳不同
        const metaB = await manager.create('会话 B')
        await manager.appendMessage(metaB.id, makeUserMsg('最新消息'))

        // 用新的 manager 实例模拟重启
        const manager2 = createSessionManager({ baseDir })
        const recovered = await manager2.recover()

        expect(recovered).not.toBeNull()
        expect(recovered!.id).toBe(metaB.id)
      })
    })

    describe('#when recover 空存储', () => {
      it('#then 返回 null', async () => {
        const manager = createSessionManager({ baseDir })
        const recovered = await manager.recover()
        expect(recovered).toBeNull()
      })
    })

    describe('#when getTree 不存在的 session', () => {
      it('#then 抛出 SESSION_NOT_FOUND 错误', async () => {
        const manager = createSessionManager({ baseDir })
        await expect(manager.getTree('nonexistent')).rejects.toThrow('不存在')
      })
    })
  })

  describe('#given HTML 导出', () => {
    describe('#when exportHtml 含代码块的会话', () => {
      it('#then HTML 含 <code> 标签', async () => {
        const manager = createSessionManager({ baseDir })
        const meta = await manager.create('导出测试')

        await manager.appendMessage(meta.id, makeUserMsg('请写代码'))
        await manager.appendMessage(
          meta.id,
          makeAssistantMsg('```ts\nconst x = 1\n```'),
        )

        const html = await manager.exportHtml(meta.id)
        expect(html).toContain('<code')
        expect(html).toContain('const x = 1')
        expect(html).toContain('<!DOCTYPE html>')
      })
    })
  })
})
