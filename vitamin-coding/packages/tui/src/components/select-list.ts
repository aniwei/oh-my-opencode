// 交互式选择列表（搜索过滤）— 验收 4.1.7
import { truncateToWidth } from '../utils/measure'

import type { Component } from '../renderer'

// 选项
export interface SelectItem {
  label: string
  value: string
  description?: string
}

// 选择列表配置
export interface SelectListConfig {
  items: SelectItem[]
  maxVisible?: number
  searchable?: boolean
}

// 交互式选择列表组件
export class SelectListComponent implements Component {
  private items: SelectItem[]
  private filteredItems: SelectItem[]
  private selectedIndex = 0
  private searchQuery = ''
  private readonly maxVisible: number
  private readonly searchable: boolean
  private scrollOffset = 0

  constructor(config: SelectListConfig) {
    this.items = config.items
    this.filteredItems = [...config.items]
    this.maxVisible = config.maxVisible ?? 10
    this.searchable = config.searchable ?? true
  }

  render(width: number): string[] {
    const lines: string[] = []

    // 搜索栏
    if (this.searchable) {
      const searchLine = this.searchQuery.length > 0
        ? `🔍 ${this.searchQuery}`
        : '🔍 (type to search)'
      lines.push(truncateToWidth(searchLine, width))
    }

    // 可见选项
    const visible = this.getVisibleItems()

    if (visible.length === 0) {
      lines.push('  (no results)')
      return lines
    }

    for (let i = 0; i < visible.length; i++) {
      const item = visible[i]
      if (!item) continue

      const actualIndex = this.scrollOffset + i
      const prefix = actualIndex === this.selectedIndex ? '❯ ' : '  '
      const label = item.label
      const desc = item.description ? ` — ${item.description}` : ''

      lines.push(truncateToWidth(`${prefix}${label}${desc}`, width))
    }

    // 滚动指示器
    if (this.filteredItems.length > this.maxVisible) {
      const total = this.filteredItems.length
      const pos = this.scrollOffset + 1
      lines.push(`  (${String(pos)}-${String(Math.min(pos + this.maxVisible - 1, total))} of ${String(total)})`)
    }

    return lines
  }

  // 获取可见区间的选项
  private getVisibleItems(): SelectItem[] {
    return this.filteredItems.slice(this.scrollOffset, this.scrollOffset + this.maxVisible)
  }

  // 搜索过滤
  search(query: string): void {
    this.searchQuery = query
    this.applyFilter()
  }

  // 追加搜索字符
  appendSearch(char: string): void {
    this.searchQuery += char
    this.applyFilter()
  }

  // 删除搜索字符
  backspaceSearch(): void {
    this.searchQuery = this.searchQuery.slice(0, -1)
    this.applyFilter()
  }

  // 清空搜索
  clearSearch(): void {
    this.searchQuery = ''
    this.applyFilter()
  }

  // 应用过滤
  private applyFilter(): void {
    if (this.searchQuery.length === 0) {
      this.filteredItems = [...this.items]
    } else {
      const lowerQuery = this.searchQuery.toLowerCase()
      this.filteredItems = this.items.filter(item =>
        item.label.toLowerCase().includes(lowerQuery) ||
        (item.description?.toLowerCase().includes(lowerQuery) ?? false),
      )
    }
    this.selectedIndex = 0
    this.scrollOffset = 0
  }

  // 上移选择
  moveUp(): void {
    if (this.filteredItems.length === 0) return
    this.selectedIndex = Math.max(0, this.selectedIndex - 1)
    this.ensureVisible()
  }

  // 下移选择
  moveDown(): void {
    if (this.filteredItems.length === 0) return
    this.selectedIndex = Math.min(this.filteredItems.length - 1, this.selectedIndex + 1)
    this.ensureVisible()
  }

  // 确保选中项可见
  private ensureVisible(): void {
    if (this.selectedIndex < this.scrollOffset) {
      this.scrollOffset = this.selectedIndex
    }
    if (this.selectedIndex >= this.scrollOffset + this.maxVisible) {
      this.scrollOffset = this.selectedIndex - this.maxVisible + 1
    }
  }

  // 获取当前选中的选项
  getSelected(): SelectItem | undefined {
    return this.filteredItems[this.selectedIndex]
  }

  // 获取当前选中的索引
  getSelectedIndex(): number {
    return this.selectedIndex
  }

  // 获取过滤后的选项
  getFilteredItems(): SelectItem[] {
    return [...this.filteredItems]
  }

  // 获取搜索查询
  getSearchQuery(): string {
    return this.searchQuery
  }

  // 设置选项（重置搜索状态）
  setItems(items: SelectItem[]): void {
    this.items = items
    this.searchQuery = ''
    this.applyFilter()
  }
}

// 工厂函数
export function createSelectListComponent(config: SelectListConfig): SelectListComponent {
  return new SelectListComponent(config)
}
