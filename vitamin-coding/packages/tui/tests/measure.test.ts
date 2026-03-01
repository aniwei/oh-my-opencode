// CJK 宽度测量测试
// 验收 4.1.6: "你好" → width === 4
import {
  stripAnsi,
  isFullWidth,
  measureWidth,
  truncateToWidth,
  padToWidth,
  wrapText,
} from '../src/utils/measure'

describe('measure', () => {
  describe('stripAnsi', () => {
    describe('#given 含 ANSI 转义的字符串', () => {
      describe('#when 调用 stripAnsi', () => {
        it('#then 应去除所有 ANSI 序列', () => {
          expect(stripAnsi('\x1b[31mRed\x1b[0m')).toBe('Red')
          expect(stripAnsi('\x1b[1m\x1b[32mBold Green\x1b[0m')).toBe('Bold Green')
        })
      })
    })

    describe('#given 无 ANSI 的普通文本', () => {
      describe('#when 调用 stripAnsi', () => {
        it('#then 应原样返回', () => {
          expect(stripAnsi('Hello World')).toBe('Hello World')
        })
      })
    })
  })

  describe('isFullWidth', () => {
    describe('#given CJK 统一表意文字', () => {
      it('#then 应判定为全角', () => {
        expect(isFullWidth('你'.codePointAt(0)!)).toBe(true)
        expect(isFullWidth('好'.codePointAt(0)!)).toBe(true)
        expect(isFullWidth('世'.codePointAt(0)!)).toBe(true)
      })
    })

    describe('#given ASCII 字符', () => {
      it('#then 应判定为非全角', () => {
        expect(isFullWidth('A'.codePointAt(0)!)).toBe(false)
        expect(isFullWidth(' '.codePointAt(0)!)).toBe(false)
      })
    })

    describe('#given 日文平假名', () => {
      it('#then 应判定为全角', () => {
        expect(isFullWidth('あ'.codePointAt(0)!)).toBe(true)
      })
    })

    describe('#given 韩文音节', () => {
      it('#then 应判定为全角', () => {
        expect(isFullWidth('한'.codePointAt(0)!)).toBe(true)
      })
    })
  })

  // 验收 4.1.6
  describe('measureWidth', () => {
    describe('#given 中文字符串 "你好"', () => {
      describe('#when 测量宽度', () => {
        it('#then width === 4（每个中文字符占 2 列）', () => {
          expect(measureWidth('你好')).toBe(4)
        })
      })
    })

    describe('#given 纯 ASCII 字符串', () => {
      describe('#when 测量宽度', () => {
        it('#then 宽度等于字符数', () => {
          expect(measureWidth('Hello')).toBe(5)
          expect(measureWidth('abc')).toBe(3)
        })
      })
    })

    describe('#given 混合 CJK 和 ASCII', () => {
      describe('#when 测量宽度', () => {
        it('#then 应正确计算混合宽度', () => {
          // "A你B好C" = 1 + 2 + 1 + 2 + 1 = 7
          expect(measureWidth('A你B好C')).toBe(7)
        })
      })
    })

    describe('#given 含 ANSI 转义的字符串', () => {
      describe('#when 测量宽度', () => {
        it('#then 应忽略 ANSI 序列宽度', () => {
          expect(measureWidth('\x1b[31m你好\x1b[0m')).toBe(4)
        })
      })
    })

    describe('#given 空字符串', () => {
      it('#then 应返回 0', () => {
        expect(measureWidth('')).toBe(0)
      })
    })
  })

  describe('truncateToWidth', () => {
    describe('#given 超过最大宽度的字符串', () => {
      describe('#when 截断', () => {
        it('#then 应截断并添加省略号', () => {
          const result = truncateToWidth('Hello World', 8)
          expect(measureWidth(stripAnsi(result))).toBeLessThanOrEqual(8)
        })
      })
    })

    describe('#given 未超过最大宽度的字符串', () => {
      describe('#when 截断', () => {
        it('#then 应原样返回', () => {
          expect(truncateToWidth('Hi', 10)).toBe('Hi')
        })
      })
    })
  })

  describe('padToWidth', () => {
    describe('#given 短于目标宽度的字符串', () => {
      describe('#when 填充', () => {
        it('#then 应用空格填充到目标宽度', () => {
          const result = padToWidth('Hi', 10)
          expect(result).toBe('Hi        ')
          expect(measureWidth(result)).toBe(10)
        })
      })
    })
  })

  describe('wrapText', () => {
    describe('#given 超过宽度的长文本', () => {
      describe('#when 折行', () => {
        it('#then 应在宽度限制处折行', () => {
          const result = wrapText('ABCDEFGHIJ', 5)
          expect(result).toEqual(['ABCDE', 'FGHIJ'])
        })
      })
    })

    describe('#given 含换行符的文本', () => {
      describe('#when 折行', () => {
        it('#then 应在换行符处分行', () => {
          const result = wrapText('Line1\nLine2', 80)
          expect(result).toEqual(['Line1', 'Line2'])
        })
      })
    })

    describe('#given CJK 文本折行', () => {
      describe('#when 宽度为 5', () => {
        it('#then 应考虑双宽度字符', () => {
          // "你好世界" = 2+2+2+2 = 8, width=5 → "你好" (4) 和 "世界" (4)
          const result = wrapText('你好世界', 5)
          expect(result).toEqual(['你好', '世界'])
        })
      })
    })
  })
})
