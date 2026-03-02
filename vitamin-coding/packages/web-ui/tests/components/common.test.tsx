import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RoleAvatar } from '../../src/components/common/avatar'
import { StatusBadge } from '../../src/components/common/badge'
import { EmptyState } from '../../src/components/common/empty-state'
import { TestWrapper } from './test-wrapper'

describe('RoleAvatar', () => {
  describe('#given user 角色', () => {
    describe('#when 渲染', () => {
      it('#then 显示 "U" 标识', () => {
        render(
          <TestWrapper>
            <RoleAvatar role="user" />
          </TestWrapper>,
        )

        expect(screen.getByText('U')).toBeInTheDocument()
      })
    })
  })

  describe('#given assistant 角色', () => {
    describe('#when 渲染', () => {
      it('#then 显示 "V" 标识', () => {
        render(
          <TestWrapper>
            <RoleAvatar role="assistant" />
          </TestWrapper>,
        )

        expect(screen.getByText('V')).toBeInTheDocument()
      })
    })
  })

  describe('#given 提供了 name', () => {
    describe('#when name 为 "Alice"', () => {
      it('#then 显示首字母 "A"', () => {
        render(
          <TestWrapper>
            <RoleAvatar role="user" name="Alice" />
          </TestWrapper>,
        )

        expect(screen.getByText('A')).toBeInTheDocument()
      })
    })
  })
})

describe('StatusBadge', () => {
  describe('#given 各种状态值', () => {
    describe('#when status 为 success', () => {
      it('#then 显示默认 label "成功"', () => {
        render(
          <TestWrapper>
            <StatusBadge status="success" />
          </TestWrapper>,
        )

        expect(screen.getByText('成功')).toBeInTheDocument()
      })
    })

    describe('#when status 为 running', () => {
      it('#then 显示 "运行中"', () => {
        render(
          <TestWrapper>
            <StatusBadge status="running" />
          </TestWrapper>,
        )

        expect(screen.getByText('运行中')).toBeInTheDocument()
      })
    })

    describe('#when 提供自定义 label', () => {
      it('#then 显示自定义文本', () => {
        render(
          <TestWrapper>
            <StatusBadge status="error" label="出错了" />
          </TestWrapper>,
        )

        expect(screen.getByText('出错了')).toBeInTheDocument()
      })
    })
  })
})

describe('EmptyState', () => {
  describe('#given title 和 description', () => {
    describe('#when 渲染', () => {
      it('#then 显示标题和描述', () => {
        render(
          <TestWrapper>
            <EmptyState title="暂无数据" description="请创建新会话" />
          </TestWrapper>,
        )

        expect(screen.getByText('暂无数据')).toBeInTheDocument()
        expect(screen.getByText('请创建新会话')).toBeInTheDocument()
      })
    })
  })

  describe('#given 包含 icon', () => {
    describe('#when icon 被提供', () => {
      it('#then 渲染图标文本', () => {
        render(
          <TestWrapper>
            <EmptyState icon="📭" title="空" />
          </TestWrapper>,
        )

        expect(screen.getByText('📭')).toBeInTheDocument()
      })
    })
  })

  describe('#given 无 description', () => {
    describe('#when description 为 undefined', () => {
      it('#then 仅渲染标题', () => {
        render(
          <TestWrapper>
            <EmptyState title="无内容" />
          </TestWrapper>,
        )

        expect(screen.getByText('无内容')).toBeInTheDocument()
      })
    })
  })
})
