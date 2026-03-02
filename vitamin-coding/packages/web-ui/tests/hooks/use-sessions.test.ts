import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useSessions } from '../../src/hooks/use-sessions'

const mockSessions = [
  { id: 's1', title: 'Session 1', createdAt: 1000, updatedAt: 2000, messageCount: 5 },
  { id: 's2', title: 'Session 2', createdAt: 3000, updatedAt: 4000, messageCount: 3 },
]

vi.mock('../../src/services/session-api', () => ({
  sessionApi: {
    list: vi.fn().mockResolvedValue(mockSessions),
    create: vi.fn().mockImplementation((title?: string) =>
      Promise.resolve({ id: 's3', title: title ?? 'New', createdAt: 5000, updatedAt: 5000, messageCount: 0 }),
    ),
    remove: vi.fn().mockResolvedValue({ removed: true }),
  },
}))

describe('use-sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('#given hook 初始化', () => {
    describe('#when 首次渲染', () => {
      it('#then 自动加载 session 列表', async () => {
        const { result } = renderHook(() => useSessions())

        await waitFor(() => {
          expect(result.current.sessions.length).toBe(2)
        })

        expect(result.current.sessions[0].id).toBe('s1')
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe('#given 已加载 sessions', () => {
    describe('#when 调用 createSession', () => {
      it('#then 新 session 添加到列表头部', async () => {
        const { result } = renderHook(() => useSessions())

        await waitFor(() => {
          expect(result.current.sessions.length).toBe(2)
        })

        await act(async () => {
          await result.current.createSession('Test Session')
        })

        expect(result.current.sessions.length).toBe(3)
        expect(result.current.sessions[0].id).toBe('s3')
      })
    })

    describe('#when 调用 removeSession', () => {
      it('#then 从列表中移除对应 session', async () => {
        const { result } = renderHook(() => useSessions())

        await waitFor(() => {
          expect(result.current.sessions.length).toBe(2)
        })

        await act(async () => {
          await result.current.removeSession('s1')
        })

        expect(result.current.sessions.length).toBe(1)
        expect(result.current.sessions[0].id).toBe('s2')
      })
    })
  })
})
