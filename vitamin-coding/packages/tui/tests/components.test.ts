// 组件测试：Editor / Text / Input / Loader
// 验收 4.1.5: paste 5 行 → editor 内容正确
import { createEditorComponent } from '../src/components/editor'
import { createTextComponent } from '../src/components/text'
import { createInputComponent } from '../src/components/input'
import { createLoaderComponent } from '../src/components/loader'

describe('EditorComponent', () => {
  // 验收 4.1.5
  describe('#given 一个编辑器组件', () => {
    describe('#when paste 5 行文本', () => {
      it('#then editor 内容应正确包含所有 5 行', () => {
        const editor = createEditorComponent()

        const pasteText = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
        editor.paste(pasteText)

        expect(editor.getContent()).toBe(pasteText)
        expect(editor.getLineCount()).toBe(5)
      })
    })

    describe('#when 在中间位置 paste', () => {
      it('#then 应正确拆分并合并行', () => {
        const editor = createEditorComponent()

        editor.insert('Hello World')
        // 光标在末尾 (index 11), 左移 5 次 → 光标在 index 6 ("Hello " 之后)
        for (let i = 0; i < 5; i++) editor.moveLeft()

        editor.paste('AAA\nBBB')

        // "Hello " + "AAA\nBBB" + "World"
        // → "Hello AAA", "BBBWorld"
        const content = editor.getContent()
        expect(content).toContain('Hello AAA')
        expect(content).toContain('BBBWorld')
        expect(editor.getLineCount()).toBe(2)
      })
    })

    describe('#when 输入字符并删除', () => {
      it('#then 应正确处理退格', () => {
        const editor = createEditorComponent()
        editor.insert('abc')
        editor.backspace()
        expect(editor.getContent()).toBe('ab')
      })
    })

    describe('#when 按回车', () => {
      it('#then 应创建新行', () => {
        const editor = createEditorComponent()
        editor.insert('Hello')
        editor.enter()
        editor.insert('World')

        expect(editor.getLineCount()).toBe(2)
        expect(editor.getContent()).toBe('Hello\nWorld')
      })
    })

    describe('#when 按 Tab', () => {
      it('#then 应插入缩进空格', () => {
        const editor = createEditorComponent({ tabSize: 4 })
        editor.tab()
        expect(editor.getContent()).toBe('    ')
      })
    })

    describe('#when 移动光标', () => {
      it('#then 上下左右应正常工作', () => {
        const editor = createEditorComponent()
        editor.insert('Line1')
        editor.enter()
        editor.insert('Line2')

        editor.moveUp()
        expect(editor.getCursor().row).toBe(0)

        editor.moveDown()
        expect(editor.getCursor().row).toBe(1)

        editor.moveLeft()
        expect(editor.getCursor().col).toBe(4)

        editor.moveRight()
        expect(editor.getCursor().col).toBe(5)
      })
    })

    describe('#when setContent', () => {
      it('#then 应替换所有内容', () => {
        const editor = createEditorComponent()
        editor.insert('old')
        editor.setContent('new content\nline2')
        expect(editor.getContent()).toBe('new content\nline2')
        expect(editor.getCursor()).toEqual({ row: 0, col: 0 })
      })
    })

    describe('#when render', () => {
      it('#then 应返回所有行', () => {
        const editor = createEditorComponent()
        editor.setContent('A\nB\nC')
        const lines = editor.render(80)
        expect(lines).toEqual(['A', 'B', 'C'])
      })
    })
  })
})

describe('TextComponent', () => {
  describe('#given 一个文本组件', () => {
    describe('#when 设置文本并渲染', () => {
      it('#then 应按行返回', () => {
        const text = createTextComponent({ text: 'Line1\nLine2' })
        const lines = text.render(80)
        expect(lines).toEqual(['Line1', 'Line2'])
      })
    })

    describe('#when 启用折行', () => {
      it('#then 应在宽度限制处折行', () => {
        const text = createTextComponent({ text: 'ABCDEFGHIJ', wrap: true })
        const lines = text.render(5)
        expect(lines).toEqual(['ABCDE', 'FGHIJ'])
      })
    })

    describe('#when 更新文本', () => {
      it('#then getText 应返回新文本', () => {
        const text = createTextComponent({ text: 'old' })
        text.setText('new')
        expect(text.getText()).toBe('new')
      })
    })
  })
})

describe('InputComponent', () => {
  describe('#given 一个输入组件', () => {
    describe('#when 输入字符并提交', () => {
      it('#then 应返回输入的值', () => {
        const input = createInputComponent()
        input.insert('hello')
        const value = input.submit()
        expect(value).toBe('hello')
        expect(input.getValue()).toBe('')
      })
    })

    describe('#when 使用光标操作', () => {
      it('#then 应正确移动光标', () => {
        const input = createInputComponent()
        input.insert('abcde')
        input.moveLeft()
        input.moveLeft()
        expect(input.getCursorPos()).toBe(3)

        input.moveHome()
        expect(input.getCursorPos()).toBe(0)

        input.moveEnd()
        expect(input.getCursorPos()).toBe(5)
      })
    })

    describe('#when 使用历史导航', () => {
      it('#then 应可以上下翻阅历史', () => {
        const input = createInputComponent()
        input.insert('first')
        input.submit()
        input.insert('second')
        input.submit()

        input.historyUp()
        expect(input.getValue()).toBe('second')

        input.historyUp()
        expect(input.getValue()).toBe('first')

        input.historyDown()
        expect(input.getValue()).toBe('second')
      })
    })

    describe('#when 渲染', () => {
      it('#then 应包含 prompt 和值', () => {
        const input = createInputComponent({ prompt: '$ ' })
        input.insert('test')
        const lines = input.render(80)
        expect(lines[0]).toBe('$ test')
      })
    })

    describe('#when 调用 backspace 和 delete', () => {
      it('#then 应正确删除字符', () => {
        const input = createInputComponent()
        input.insert('abcd')
        input.backspace()
        expect(input.getValue()).toBe('abc')

        input.moveLeft()
        input.delete()
        expect(input.getValue()).toBe('ab')
      })
    })
  })
})

describe('LoaderComponent', () => {
  describe('#given 一个加载组件', () => {
    describe('#when 渲染', () => {
      it('#then 应显示 spinner 帧和文本', () => {
        const loader = createLoaderComponent({ text: 'Loading...' })
        const lines = loader.render(80)
        expect(lines).toHaveLength(1)
        expect(lines[0]).toContain('Loading...')
      })
    })

    describe('#when 手动推进帧', () => {
      it('#then 帧索引应递增', () => {
        const loader = createLoaderComponent()

        expect(loader.getFrameIndex()).toBe(0)
        loader.advance()
        expect(loader.getFrameIndex()).toBe(1)
      })
    })

    describe('#when start 和 stop', () => {
      it('#then isRunning 应正确反映状态', () => {
        const loader = createLoaderComponent()

        expect(loader.isRunning()).toBe(false)
        loader.start()
        expect(loader.isRunning()).toBe(true)
        loader.stop()
        expect(loader.isRunning()).toBe(false)
      })
    })

    describe('#when 更新文本', () => {
      it('#then getText 应返回新文本', () => {
        const loader = createLoaderComponent({ text: 'old' })
        loader.setText('new')
        expect(loader.getText()).toBe('new')
      })
    })
  })
})
