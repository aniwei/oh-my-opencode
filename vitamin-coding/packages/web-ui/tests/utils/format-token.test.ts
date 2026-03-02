import { describe, it, expect } from 'vitest'
import { formatTokenCount, estimateCost, formatCost } from '../../src/utils/format-token'

describe('format-token', () => {
  describe('formatTokenCount', () => {
    describe('#given 小数量 token', () => {
      describe('#when count < 1000', () => {
        it('#then 返回原始数字字符串', () => {
          expect(formatTokenCount(42)).toBe('42')
          expect(formatTokenCount(999)).toBe('999')
        })
      })
    })

    describe('#given 千级别 token', () => {
      describe('#when 1000 <= count < 1_000_000', () => {
        it('#then 返回 K 格式', () => {
          expect(formatTokenCount(1500)).toBe('1.5K')
          expect(formatTokenCount(25_000)).toBe('25.0K')
        })
      })
    })

    describe('#given 百万级别 token', () => {
      describe('#when count >= 1_000_000', () => {
        it('#then 返回 M 格式', () => {
          expect(formatTokenCount(1_500_000)).toBe('1.50M')
        })
      })
    })
  })

  describe('estimateCost', () => {
    describe('#given 已知模型定价', () => {
      describe('#when 使用 claude-sonnet-4 模型', () => {
        it('#then 按 $3/M input + $15/M output 计算', () => {
          const cost = estimateCost(1_000_000, 500_000, 'claude-sonnet-4')
          expect(cost).toBeCloseTo(3 + 7.5)
        })
      })
    })

    describe('#given 未知模型', () => {
      describe('#when modelId 不在定价表中', () => {
        it('#then 使用默认定价', () => {
          const cost = estimateCost(1_000_000, 1_000_000, 'unknown-model')
          expect(cost).toBeCloseTo(3 + 15)
        })
      })
    })

    describe('#given 未指定模型', () => {
      describe('#when modelId 为 undefined', () => {
        it('#then 使用默认定价', () => {
          const cost = estimateCost(1_000_000, 1_000_000)
          expect(cost).toBeCloseTo(3 + 15)
        })
      })
    })
  })

  describe('formatCost', () => {
    describe('#given 极小费用', () => {
      describe('#when cost < 0.001', () => {
        it('#then 返回 "< $0.001"', () => {
          expect(formatCost(0.0001)).toBe('< $0.001')
        })
      })
    })

    describe('#given 正常费用', () => {
      describe('#when cost >= 0.001', () => {
        it('#then 返回 $ 格式 (4 位小数)', () => {
          expect(formatCost(1.2345)).toBe('$1.2345')
          expect(formatCost(0.05)).toBe('$0.0500')
        })
      })
    })
  })
})
