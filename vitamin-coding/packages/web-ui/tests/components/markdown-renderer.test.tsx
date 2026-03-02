import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownRenderer } from '../../src/components/chat/markdown-renderer'
import { TestWrapper } from './test-wrapper'

describe('MarkdownRenderer', () => {
  describe('#given 纯文本', () => {
    describe('#when 渲染', () => {
      it('#then 正常显示文本', () => {
        render(
          <TestWrapper>
            <MarkdownRenderer content="Hello World" />
          </TestWrapper>,
        )

        expect(screen.getByText('Hello World')).toBeInTheDocument()
      })
    })
  })

  describe('#given GFM 表格语法', () => {
    describe('#when 渲染 Markdown 表格', () => {
      it('#then 生成 HTML table 元素', () => {
        const markdown = `| ColA | ColB |\n|------|------|\n| a1   | b1   |`

        const { container } = render(
          <TestWrapper>
            <MarkdownRenderer content={markdown} />
          </TestWrapper>,
        )

        expect(container.querySelector('table')).toBeInTheDocument()
        expect(screen.getByText('ColA')).toBeInTheDocument()
        expect(screen.getByText('a1')).toBeInTheDocument()
      })
    })
  })

  describe('#given 内联代码', () => {
    describe('#when 渲染包含 `code` 的文本', () => {
      it('#then 生成 code 元素', () => {
        const { container } = render(
          <TestWrapper>
            <MarkdownRenderer content="Use `const x = 1` in your code" />
          </TestWrapper>,
        )

        expect(container.querySelector('code')).toBeInTheDocument()
        expect(screen.getByText('const x = 1')).toBeInTheDocument()
      })
    })
  })

  describe('#given 加粗和斜体语法', () => {
    describe('#when 渲染 **bold** 和 *italic*', () => {
      it('#then 生成 strong/em 元素', () => {
        const { container } = render(
          <TestWrapper>
            <MarkdownRenderer content="This is **bold** and *italic*" />
          </TestWrapper>,
        )

        expect(container.querySelector('strong')).toBeInTheDocument()
        expect(container.querySelector('em')).toBeInTheDocument()
      })
    })
  })

  describe('#given 代码块语法', () => {
    describe('#when 渲染 fenced code block', () => {
      it('#then 将代码内容传递给 CodeBlock 组件', () => {
        render(
          <TestWrapper>
            <MarkdownRenderer content={'```typescript\nconst x = 42\n```'} />
          </TestWrapper>,
        )

        expect(screen.getByText(/const x = 42/)).toBeInTheDocument()
      })
    })
  })

  describe('#given 链接语法', () => {
    describe('#when 渲染 [text](url)', () => {
      it('#then 生成 a 元素', () => {
        const { container } = render(
          <TestWrapper>
            <MarkdownRenderer content="Visit [Google](https://google.com)" />
          </TestWrapper>,
        )

        const link = container.querySelector('a')
        expect(link).toBeInTheDocument()
        expect(link?.getAttribute('href')).toBe('https://google.com')
      })
    })
  })
})
