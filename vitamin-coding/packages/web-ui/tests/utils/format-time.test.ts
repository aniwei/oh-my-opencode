import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatRelativeTime, formatDuration, formatTimestamp } from '../../src/utils/format-time'

describe('format-time', () => {
  describe('formatRelativeTime', () => {
    describe('#given 当前时间被固定', () => {
      const NOW = 1_700_000_000_000

      beforeEach(() => {
        vi.spyOn(Date, 'now').mockReturnValue(NOW)
      })

      afterEach(() => {
        vi.restoreAllMocks()
      })

      describe('#when 时间差小于 1 分钟', () => {
        it('#then 返回 "刚刚"', () => {
          expect(formatRelativeTime(NOW - 30_000)).toBe('刚刚')
        })
      })

      describe('#when 时间差为 5 分钟', () => {
        it('#then 返回 "5 分钟前"', () => {
          expect(formatRelativeTime(NOW - 5 * 60 * 1000)).toBe('5 分钟前')
        })
      })

      describe('#when 时间差为 3 小时', () => {
        it('#then 返回 "3 小时前"', () => {
          expect(formatRelativeTime(NOW - 3 * 60 * 60 * 1000)).toBe('3 小时前')
        })
      })

      describe('#when 时间差为 2 天', () => {
        it('#then 返回 "2 天前"', () => {
          expect(formatRelativeTime(NOW - 2 * 24 * 60 * 60 * 1000)).toBe('2 天前')
        })
      })

      describe('#when 时间差超过 1 周', () => {
        it('#then 返回本地化日期字符串', () => {
          const result = formatRelativeTime(NOW - 30 * 24 * 60 * 60 * 1000)
          expect(result).toMatch(/\d/)
        })
      })
    })
  })

  describe('formatDuration', () => {
    describe('#given 毫秒级耗时', () => {
      describe('#when 耗时 < 1000ms', () => {
        it('#then 返回 ms 格式', () => {
          expect(formatDuration(250)).toBe('250ms')
        })
      })
    })

    describe('#given 秒级耗时', () => {
      describe('#when 耗时为 2500ms', () => {
        it('#then 返回秒格式 (保留一位小数)', () => {
          expect(formatDuration(2500)).toBe('2.5s')
        })
      })
    })

    describe('#given 分钟级耗时', () => {
      describe('#when 耗时为 125000ms (2m 5s)', () => {
        it('#then 返回 "2m 5s"', () => {
          expect(formatDuration(125_000)).toBe('2m 5s')
        })
      })
    })
  })

  describe('formatTimestamp', () => {
    describe('#given 一个有效时间戳', () => {
      describe('#when 格式化输出', () => {
        it('#then 返回包含月/日/时/分的字符串', () => {
          const result = formatTimestamp(1_700_000_000_000)
          expect(result).toMatch(/\d/)
          expect(typeof result).toBe('string')
        })
      })
    })
  })
})
