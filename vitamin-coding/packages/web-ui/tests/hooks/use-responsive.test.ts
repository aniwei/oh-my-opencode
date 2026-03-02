import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResponsive } from '../../src/hooks/use-responsive'

describe('use-responsive', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('#given 窗口宽度 < 768', () => {
    describe('#when 初始化 hook', () => {
      it('#then breakpoint 为 mobile', () => {
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(375)

        const { result } = renderHook(() => useResponsive())

        expect(result.current.breakpoint).toBe('mobile')
        expect(result.current.isMobile).toBe(true)
        expect(result.current.isTablet).toBe(false)
        expect(result.current.isDesktop).toBe(false)
      })
    })
  })

  describe('#given 窗口宽度在 768-1199 之间', () => {
    describe('#when 初始化 hook', () => {
      it('#then breakpoint 为 tablet', () => {
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024)

        const { result } = renderHook(() => useResponsive())

        expect(result.current.breakpoint).toBe('tablet')
        expect(result.current.isTablet).toBe(true)
      })
    })
  })

  describe('#given 窗口宽度 >= 1200', () => {
    describe('#when 初始化 hook', () => {
      it('#then breakpoint 为 desktop', () => {
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440)

        const { result } = renderHook(() => useResponsive())

        expect(result.current.breakpoint).toBe('desktop')
        expect(result.current.isDesktop).toBe(true)
      })
    })
  })

  describe('#given 窗口大小发生变化', () => {
    describe('#when 触发 resize 事件', () => {
      it('#then breakpoint 随之更新', () => {
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440)

        const { result } = renderHook(() => useResponsive())
        expect(result.current.isDesktop).toBe(true)

        act(() => {
          vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(600)
          window.dispatchEvent(new Event('resize'))
        })

        expect(result.current.isMobile).toBe(true)
      })
    })
  })
})
