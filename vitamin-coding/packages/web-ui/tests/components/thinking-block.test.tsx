import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { ThinkingBlock } from '../../src/components/chat/thinking-block'
import { TestWrapper } from './test-wrapper'

describe('ThinkingBlock', () => {
  describe('#given 思考内容', () => {
    describe('#when 初始渲染', () => {
      it('#then 显示折叠状态的标签', () => {
        render(
          <TestWrapper>
            <ThinkingBlock content="这是思考过程" />
          </TestWrapper>,
        )

        expect(screen.getByText(/思考过程/)).toBeInTheDocument()
      })
    })

    describe('#when 点击展开按钮', () => {
      it('#then 显示思考内容', async () => {
        const user = userEvent.setup()

        render(
          <TestWrapper>
            <ThinkingBlock content="深入分析问题" />
          </TestWrapper>,
        )

        const toggle = screen.getByText(/思考过程/)
        await user.click(toggle)

        expect(screen.getByText('深入分析问题')).toBeInTheDocument()
      })
    })
  })
})
