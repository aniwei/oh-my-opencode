import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { ToolCallCard } from '../../src/components/chat/tool-call-card'
import { TestWrapper } from './test-wrapper'
import type { ToolCall } from '../../src/types/message'

function createToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    id: 'tc-1',
    name: 'bash',
    status: 'success',
    durationMs: 1200,
    input: { command: 'ls -la' },
    output: 'total 128\ndrwxr-xr-x  10 user staff ...',
    ...overrides,
  }
}

describe('ToolCallCard', () => {
  describe('#given 成功状态的工具调用', () => {
    describe('#when 渲染卡片', () => {
      it('#then 显示工具名称和成功标签', () => {
        render(
          <TestWrapper>
            <ToolCallCard tool={createToolCall()} />
          </TestWrapper>,
        )

        expect(screen.getByText('bash')).toBeInTheDocument()
        expect(screen.getByText('成功')).toBeInTheDocument()
      })

      it('#then 显示耗时', () => {
        render(
          <TestWrapper>
            <ToolCallCard tool={createToolCall({ durationMs: 1200 })} />
          </TestWrapper>,
        )

        expect(screen.getByText('1.2s')).toBeInTheDocument()
      })
    })

    describe('#when 点击展开', () => {
      it('#then 显示输入参数和执行结果', async () => {
        const user = userEvent.setup()

        render(
          <TestWrapper>
            <ToolCallCard tool={createToolCall()} />
          </TestWrapper>,
        )

        const header = screen.getByText('bash')
        await user.click(header)

        expect(screen.getByText('输入参数')).toBeInTheDocument()
        expect(screen.getByText('执行结果')).toBeInTheDocument()
      })
    })
  })

  describe('#given 运行中状态', () => {
    describe('#when 渲染卡片', () => {
      it('#then 显示运行中标签', () => {
        render(
          <TestWrapper>
            <ToolCallCard tool={createToolCall({ status: 'running', durationMs: undefined })} />
          </TestWrapper>,
        )

        expect(screen.getByText('运行中')).toBeInTheDocument()
      })
    })
  })

  describe('#given 错误状态', () => {
    describe('#when 渲染卡片', () => {
      it('#then 显示失败标签', () => {
        render(
          <TestWrapper>
            <ToolCallCard tool={createToolCall({ status: 'error' })} />
          </TestWrapper>,
        )

        expect(screen.getByText('失败')).toBeInTheDocument()
      })
    })
  })

  describe('#given 无 input/output 的工具调用', () => {
    describe('#when 渲染卡片', () => {
      it('#then 不显示展开箭头', () => {
        render(
          <TestWrapper>
            <ToolCallCard tool={createToolCall({ input: undefined, output: undefined })} />
          </TestWrapper>,
        )

        expect(screen.queryByText('▶')).not.toBeInTheDocument()
      })
    })
  })
})
