import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAgentStatus } from '../../src/hooks/use-agent-status'

describe('use-agent-status', () => {
  const mockResponse = {
    state: 'running' as const,
    toolCalls: 5,
    inputTokens: 1000,
    outputTokens: 500,
    recentToolCalls: [
      { id: 'tc1', name: 'bash', status: 'success', durationMs: 120 },
    ],
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('#given agent ID 已提供', () => {
    describe('#when hook 初始化', () => {
      it('#then 初始状态为 idle', () => {
        const { result } = renderHook(() => useAgentStatus('agent-1'))

        expect(result.current.state).toBe('idle')
        expect(result.current.toolCalls).toBe(0)
      })
    })

    describe('#when API 返回成功', () => {
      it('#then 更新为 API 返回的状态', async () => {
        const { result } = renderHook(() => useAgentStatus('agent-1'))

        await waitFor(() => {
          expect(result.current.state).toBe('running')
        })

        expect(result.current.toolCalls).toBe(5)
        expect(result.current.inputTokens).toBe(1000)
        expect(result.current.outputTokens).toBe(500)
        expect(result.current.recentToolCalls).toHaveLength(1)
        expect(result.current.recentToolCalls[0].name).toBe('bash')
      })
    })

    describe('#when API 请求失败', () => {
      it('#then 状态变为 error', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))

        const { result } = renderHook(() => useAgentStatus('agent-2'))

        await waitFor(() => {
          expect(result.current.state).toBe('error')
        })
      })
    })

    describe('#when API 返回非 ok 响应', () => {
      it('#then 状态保持不变', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({}),
        } as Response)

        const { result } = renderHook(() => useAgentStatus('agent-3'))

        // 给足时间让 fetchStatus 跑完
        await vi.advanceTimersByTimeAsync(100)

        expect(result.current.state).toBe('idle')
      })
    })
  })
})
