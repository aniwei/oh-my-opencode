// SelectList 测试
// 验收 4.1.7: 3 选项 → 输入 "ab" → 仅显示含 "ab" 的选项
import { createSelectListComponent } from '../src/components/select-list'

import type { SelectItem } from '../src/components/select-list'

const TEST_ITEMS: SelectItem[] = [
  { label: 'abc', value: 'abc', description: 'first item' },
  { label: 'abd', value: 'abd', description: 'second item' },
  { label: 'xyz', value: 'xyz', description: 'third item' },
]

describe('SelectListComponent', () => {
  // 验收 4.1.7
  describe('#given 3 个选项的选择列表', () => {
    describe('#when 输入搜索 "ab"', () => {
      it('#then 仅显示含 "ab" 的选项', () => {
        const list = createSelectListComponent({ items: TEST_ITEMS })

        list.search('ab')

        const filtered = list.getFilteredItems()
        expect(filtered).toHaveLength(2)
        expect(filtered[0]!.label).toBe('abc')
        expect(filtered[1]!.label).toBe('abd')

        // xyz 应被过滤掉
        expect(filtered.find(i => i.label === 'xyz')).toBeUndefined()
      })
    })

    describe('#when 搜索 "xyz"', () => {
      it('#then 仅显示 xyz', () => {
        const list = createSelectListComponent({ items: TEST_ITEMS })
        list.search('xyz')

        const filtered = list.getFilteredItems()
        expect(filtered).toHaveLength(1)
        expect(filtered[0]!.label).toBe('xyz')
      })
    })

    describe('#when 清空搜索', () => {
      it('#then 应恢复所有选项', () => {
        const list = createSelectListComponent({ items: TEST_ITEMS })
        list.search('ab')
        expect(list.getFilteredItems()).toHaveLength(2)

        list.clearSearch()
        expect(list.getFilteredItems()).toHaveLength(3)
      })
    })
  })

  describe('#given 键盘导航', () => {
    describe('#when 上下移动', () => {
      it('#then 应更新选中项', () => {
        const list = createSelectListComponent({ items: TEST_ITEMS })

        expect(list.getSelectedIndex()).toBe(0)
        expect(list.getSelected()!.label).toBe('abc')

        list.moveDown()
        expect(list.getSelectedIndex()).toBe(1)
        expect(list.getSelected()!.label).toBe('abd')

        list.moveDown()
        expect(list.getSelectedIndex()).toBe(2)

        // 不应超过边界
        list.moveDown()
        expect(list.getSelectedIndex()).toBe(2)

        list.moveUp()
        expect(list.getSelectedIndex()).toBe(1)
      })
    })
  })

  describe('#given 渲染', () => {
    describe('#when 渲染带搜索栏的列表', () => {
      it('#then 应包含搜索指示和选项', () => {
        const list = createSelectListComponent({ items: TEST_ITEMS, searchable: true })
        const lines = list.render(80)

        // 第一行是搜索栏
        expect(lines[0]).toContain('🔍')

        // 包含选项
        const joined = lines.join('\n')
        expect(joined).toContain('abc')
        expect(joined).toContain('abd')
        expect(joined).toContain('xyz')
      })
    })
  })

  describe('#given append 和 backspace 搜索', () => {
    describe('#when 追加搜索字符后删除', () => {
      it('#then 搜索应正确更新', () => {
        const list = createSelectListComponent({ items: TEST_ITEMS })

        list.appendSearch('a')
        list.appendSearch('b')
        expect(list.getSearchQuery()).toBe('ab')
        expect(list.getFilteredItems()).toHaveLength(2)

        list.backspaceSearch()
        expect(list.getSearchQuery()).toBe('a')
        expect(list.getFilteredItems()).toHaveLength(2) // abc, abd 都含 a
      })
    })
  })

  describe('#given 描述搜索', () => {
    describe('#when 按描述过滤', () => {
      it('#then 应匹配描述文本', () => {
        const list = createSelectListComponent({ items: TEST_ITEMS })
        list.search('first')

        const filtered = list.getFilteredItems()
        expect(filtered).toHaveLength(1)
        expect(filtered[0]!.label).toBe('abc')
      })
    })
  })

  describe('#given setItems', () => {
    describe('#when 更新选项', () => {
      it('#then 应重置过滤和选择', () => {
        const list = createSelectListComponent({ items: TEST_ITEMS })
        list.search('ab')
        list.moveDown()

        list.setItems([{ label: 'new', value: 'new' }])
        expect(list.getFilteredItems()).toHaveLength(1)
        expect(list.getSelectedIndex()).toBe(0)
      })
    })
  })
})
