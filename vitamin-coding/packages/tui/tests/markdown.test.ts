// Markdown 渲染测试
// 验收 4.1.4: ```ts 块 → 输出含 ANSI 颜色码
import { createMarkdownComponent } from '../src/components/markdown'
import { stripAnsi } from '../src/utils/measure'

describe('MarkdownComponent', () => {
  // 验收 4.1.4
  describe('#given Markdown 含 TypeScript 代码块', () => {
    describe('#when 渲染 ```ts 代码块', () => {
      it('#then 输出应含 ANSI 颜色码', () => {
        const md = createMarkdownComponent()
        md.setContent('# Title\n\n```ts\nconst x = 42\n```')

        const lines = md.render(80)

        // 找到代码行（应该含有颜色码）
        const codeLine = lines.find(l => stripAnsi(l).includes('const'))

        expect(codeLine).toBeDefined()
        // 代码行应该比纯文本长（含 ANSI 序列）
        expect(codeLine!.length).toBeGreaterThan(stripAnsi(codeLine!).length)
        // 应包含 ESC 序列
        expect(codeLine).toMatch(/\x1b\[/)
      })
    })
  })

  describe('#given Markdown 标题', () => {
    describe('#when 渲染 # 标题', () => {
      it('#then 应含有颜色', () => {
        const md = createMarkdownComponent()
        md.setContent('# Hello')

        const lines = md.render(80)
        expect(lines).toHaveLength(1)
        // 应含有 ANSI 颜色码
        expect(lines[0]).toMatch(/\x1b\[/)
        expect(stripAnsi(lines[0]!)).toBe('Hello')
      })
    })
  })

  describe('#given Markdown 列表', () => {
    describe('#when 渲染无序列表', () => {
      it('#then 应将 - 替换为 ●', () => {
        const md = createMarkdownComponent()
        md.setContent('- item 1\n- item 2')

        const lines = md.render(80)
        expect(stripAnsi(lines[0]!)).toContain('●')
        expect(stripAnsi(lines[1]!)).toContain('●')
      })
    })
  })

  describe('#given Markdown 引用', () => {
    describe('#when 渲染 > 引用', () => {
      it('#then 应添加竖线前缀', () => {
        const md = createMarkdownComponent()
        md.setContent('> quote text')

        const lines = md.render(80)
        expect(stripAnsi(lines[0]!)).toContain('│')
        expect(stripAnsi(lines[0]!)).toContain('quote text')
      })
    })
  })

  describe('#given Markdown 行内代码', () => {
    describe('#when 渲染 `code` 反引号', () => {
      it('#then 应含有颜色', () => {
        const md = createMarkdownComponent()
        md.setContent('Use `console.log` here')

        const lines = md.render(80)
        expect(lines[0]).toMatch(/\x1b\[/)
      })
    })
  })

  describe('#given Markdown 粗体', () => {
    describe('#when 渲染 **bold**', () => {
      it('#then 应含有粗体样式', () => {
        const md = createMarkdownComponent()
        md.setContent('This is **bold** text')

        const lines = md.render(80)
        expect(lines[0]).toMatch(/\x1b\[/)
      })
    })
  })

  describe('#given 分隔线', () => {
    describe('#when 渲染 ---', () => {
      it('#then 应输出横线', () => {
        const md = createMarkdownComponent()
        md.setContent('---')

        const lines = md.render(80)
        expect(stripAnsi(lines[0]!)).toContain('─')
      })
    })
  })

  describe('#given setContent/getContent', () => {
    describe('#when 更新内容', () => {
      it('#then getContent 应返回新内容', () => {
        const md = createMarkdownComponent()
        md.setContent('new content')
        expect(md.getContent()).toBe('new content')
      })
    })
  })

  describe('#given JavaScript 代码块', () => {
    describe('#when 渲染包含关键字的 js 代码', () => {
      it('#then 关键字应有颜色', () => {
        const md = createMarkdownComponent()
        md.setContent('```js\nfunction hello() {\n  return 42\n}\n```')

        const lines = md.render(80)
        const funcLine = lines.find(l => stripAnsi(l).includes('function'))
        expect(funcLine).toBeDefined()
        expect(funcLine!).toMatch(/\x1b\[/)
      })
    })
  })
})
