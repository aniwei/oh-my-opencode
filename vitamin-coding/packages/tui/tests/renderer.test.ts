// 差异渲染引擎测试
// 验收 4.1.1: 相同内容不产生终端输出
// 验收 4.1.2: 单行变更仅输出该行
// 验收 4.1.3: CSI 2026 同步输出
import { createRenderer, Renderer } from '../src/renderer'
import { SYNC_START, SYNC_END, moveCursor, clearLine } from '../src/utils/ansi'

function createTestRenderer() {
  const output: string[] = []
  const renderer = createRenderer({
    width: 80,
    height: 24,
    output: (data: string) => output.push(data),
  })
  return { renderer, output }
}

describe('Renderer', () => {
  describe('#given 一个差异渲染引擎', () => {
    describe('#when 使用 createRenderer 工厂创建', () => {
      it('#then 应返回 Renderer 实例', () => {
        const { renderer } = createTestRenderer()
        expect(renderer).toBeInstanceOf(Renderer)
      })
    })

    describe('#when 获取尺寸', () => {
      it('#then 应返回配置的宽高', () => {
        const { renderer } = createTestRenderer()
        expect(renderer.getWidth()).toBe(80)
        expect(renderer.getHeight()).toBe(24)
      })
    })
  })

  // 验收 4.1.1
  describe('#given 两帧相同内容', () => {
    describe('#when 连续渲染相同的 string[]', () => {
      it('#then 第二帧应不产生终端输出（CSI 输出为空）', () => {
        const { renderer } = createTestRenderer()
        const lines = ['Hello', 'World']

        const first = renderer.renderFrame(lines)
        const second = renderer.renderFrame(lines)

        // 第一帧有输出
        expect(first.length).toBeGreaterThan(0)
        // 第二帧无输出（相同内容）
        expect(second).toBe('')
      })
    })
  })

  // 验收 4.1.2
  describe('#given 10 行中第 5 行变更', () => {
    describe('#when 渲染变更帧', () => {
      it('#then 仅产生 1 行 CSI 输出', () => {
        const { renderer, output } = createTestRenderer()

        const lines1 = Array.from({ length: 10 }, (_, i) => `Line ${String(i + 1)}`)
        renderer.renderFrame(lines1)
        output.length = 0

        // 修改第 5 行
        const lines2 = [...lines1]
        lines2[4] = 'Changed Line 5'

        const result = renderer.renderFrame(lines2)

        // 输出应只包含第 5 行的变更
        expect(result).toContain(moveCursor(5, 1))
        expect(result).toContain(clearLine())
        expect(result).toContain('Changed Line 5')

        // 不应包含其他行的 moveCursor（除了第 5 行）
        for (let i = 1; i <= 10; i++) {
          if (i === 5) continue
          expect(result).not.toContain(`Line ${String(i)}`)
        }
      })
    })
  })

  // 验收 4.1.3
  describe('#given 任意帧渲染', () => {
    describe('#when 有变更时输出', () => {
      it('#then 输出应包含 CSI 2026 begin/end 序列', () => {
        const { renderer } = createTestRenderer()
        const result = renderer.renderFrame(['Hello'])

        expect(result).toContain(SYNC_START)
        expect(result).toContain(SYNC_END)
        // begin 在前，end 在后
        expect(result.indexOf(SYNC_START)).toBeLessThan(result.indexOf(SYNC_END))
      })
    })
  })

  describe('#given 强制全量重绘', () => {
    describe('#when 调用 fullRedraw', () => {
      it('#then 应输出所有行', () => {
        const { renderer, output } = createTestRenderer()
        const lines = ['A', 'B', 'C']

        const result = renderer.fullRedraw(lines)

        expect(result).toContain(SYNC_START)
        expect(result).toContain(SYNC_END)
        expect(result).toContain('A')
        expect(result).toContain('B')
        expect(result).toContain('C')
      })
    })
  })

  describe('#given resize 事件', () => {
    describe('#when 调用 resize', () => {
      it('#then 应更新尺寸并清除缓存', () => {
        const { renderer } = createTestRenderer()

        renderer.renderFrame(['old content'])
        renderer.resize(120, 40)

        expect(renderer.getWidth()).toBe(120)
        expect(renderer.getHeight()).toBe(40)

        // 重新渲染后，即使内容相同，因为缓存已清除，应该有输出
        const result = renderer.renderFrame(['old content'])
        expect(result.length).toBeGreaterThan(0)
      })
    })
  })

  describe('#given render 事件', () => {
    describe('#when 渲染帧', () => {
      it('#then 应触发 render 事件', () => {
        const { renderer } = createTestRenderer()
        let called = false
        renderer.on('render', () => { called = true })

        renderer.renderFrame(['test'])
        expect(called).toBe(true)
      })
    })
  })

  describe('#given clearCache', () => {
    describe('#when 清除缓存后渲染相同内容', () => {
      it('#then 应产生输出', () => {
        const { renderer } = createTestRenderer()

        renderer.renderFrame(['test'])
        const noOutput = renderer.renderFrame(['test'])
        expect(noOutput).toBe('')

        renderer.clearCache()
        const hasOutput = renderer.renderFrame(['test'])
        expect(hasOutput.length).toBeGreaterThan(0)
      })
    })
  })
})
