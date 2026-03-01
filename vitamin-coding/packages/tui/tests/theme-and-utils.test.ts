// 主题 + ANSI 工具 + 按键解析 + IME + Box + Overlay + Image 测试
// 验收 4.1.8: resize 事件触发重绘
// 验收 4.1.9: 主题热重载
import { createThemeManager, DARK_THEME, LIGHT_THEME } from '../src/theme'
import {
  COLORS, style, color256, colorRgb, SYNC_START, SYNC_END,
  moveCursor, clearLine, clearScreen, hideCursor, showCursor,
} from '../src/utils/ansi'
import { parseKey, isPrintable } from '../src/input/key-parser'
import { createImeHandler } from '../src/input/ime-handler'
import { createBoxComponent, ROUNDED_BORDER } from '../src/components/box'
import { createTextComponent } from '../src/components/text'
import { createOverlayManager } from '../src/overlays/overlay-manager'
import { createImageComponent } from '../src/components/image'
import { createRenderer } from '../src/renderer'

// 验收 4.1.9
describe('ThemeManager', () => {
  describe('#given 一个主题管理器', () => {
    describe('#when 更新主题配置', () => {
      it('#then 应触发 change 事件（热重载）', () => {
        const tm = createThemeManager(DARK_THEME)
        let changedTheme: unknown = null
        tm.on('change', (theme) => { changedTheme = theme })

        tm.setTheme(LIGHT_THEME)

        expect(changedTheme).toBe(LIGHT_THEME)
        expect(tm.getTheme()).toBe(LIGHT_THEME)
      })
    })

    describe('#when updateColors 部分更新', () => {
      it('#then 应只更新指定颜色并触发事件', () => {
        const tm = createThemeManager(DARK_THEME)
        let eventFired = false
        tm.on('change', () => { eventFired = true })

        tm.updateColors({ primary: COLORS.red })
        expect(tm.getTheme().colors.primary).toBe(COLORS.red)
        expect(eventFired).toBe(true)
      })
    })

    describe('#when styled 使用主题色格式化', () => {
      it('#then 应返回含 ANSI 的文本', () => {
        const tm = createThemeManager(DARK_THEME)
        const result = tm.styled('hello', 'primary')
        expect(result).toContain(DARK_THEME.colors.primary)
        expect(result).toContain(COLORS.reset)
      })
    })
  })
})

describe('ANSI 工具', () => {
  describe('#given style 函数', () => {
    describe('#when 组合样式', () => {
      it('#then 应正确包裹 reset', () => {
        const result = style('test', COLORS.red, COLORS.bold)
        expect(result).toBe(COLORS.red + COLORS.bold + 'test' + COLORS.reset)
      })
    })

    describe('#when 无样式', () => {
      it('#then 应原样返回', () => {
        expect(style('text')).toBe('text')
      })
    })
  })

  describe('#given 颜色函数', () => {
    it('#then color256 应生成正确的 ANSI', () => {
      expect(color256(196)).toBe('\x1b[38;5;196m')
    })

    it('#then colorRgb 应生成正确的 ANSI', () => {
      expect(colorRgb(255, 0, 128)).toBe('\x1b[38;2;255;0;128m')
    })
  })

  describe('#given CSI 常量', () => {
    it('#then SYNC_START/END 应是 CSI 2026', () => {
      expect(SYNC_START).toBe('\x1b[?2026h')
      expect(SYNC_END).toBe('\x1b[?2026l')
    })
  })

  describe('#given 光标操作', () => {
    it('#then moveCursor 应生成正确序列', () => {
      expect(moveCursor(5, 1)).toBe('\x1b[5;1H')
    })

    it('#then clearLine/clearScreen 应是标准序列', () => {
      expect(clearLine()).toBe('\x1b[2K')
      expect(clearScreen()).toBe('\x1b[2J')
    })

    it('#then hideCursor/showCursor 正确', () => {
      expect(hideCursor()).toBe('\x1b[?25l')
      expect(showCursor()).toBe('\x1b[?25h')
    })
  })
})

describe('parseKey', () => {
  describe('#given 方向键', () => {
    it('#then 应识别为 up/down/left/right', () => {
      expect(parseKey('\x1b[A').name).toBe('up')
      expect(parseKey('\x1b[B').name).toBe('down')
      expect(parseKey('\x1b[C').name).toBe('right')
      expect(parseKey('\x1b[D').name).toBe('left')
    })
  })

  describe('#given Ctrl+C', () => {
    it('#then 应识别 ctrl=true name=c', () => {
      const key = parseKey('\x03')
      expect(key.ctrl).toBe(true)
      expect(key.name).toBe('c')
    })
  })

  describe('#given Alt+x', () => {
    it('#then 应识别 alt=true name=x', () => {
      const key = parseKey('\x1bx')
      expect(key.alt).toBe(true)
      expect(key.name).toBe('x')
    })
  })

  describe('#given 普通字符', () => {
    it('#then 应识别为可打印', () => {
      const key = parseKey('a')
      expect(key.name).toBe('a')
      expect(key.ctrl).toBe(false)
      expect(key.alt).toBe(false)
      expect(isPrintable(key)).toBe(true)
    })
  })

  describe('#given Enter', () => {
    it('#then 应识别', () => {
      expect(parseKey('\r').name).toBe('enter')
      expect(isPrintable(parseKey('\r'))).toBe(false)
    })
  })

  describe('#given Tab', () => {
    it('#then 应识别', () => {
      expect(parseKey('\t').name).toBe('tab')
    })
  })
})

describe('ImeHandler', () => {
  describe('#given IME 组合流程', () => {
    describe('#when 开始→更新→提交', () => {
      it('#then 应返回组合文本', () => {
        const ime = createImeHandler()

        expect(ime.isComposing()).toBe(false)

        ime.startComposition()
        expect(ime.isComposing()).toBe(true)

        ime.updateComposition('你')
        expect(ime.getCompositionWidth()).toBe(2)

        ime.updateComposition('你好')
        expect(ime.getCompositionWidth()).toBe(4)

        const result = ime.commitComposition()
        expect(result).toBe('你好')
        expect(ime.isComposing()).toBe(false)
      })
    })

    describe('#when 取消组合', () => {
      it('#then 应清空状态', () => {
        const ime = createImeHandler()
        ime.startComposition()
        ime.updateComposition('测试')
        ime.cancelComposition()
        expect(ime.isComposing()).toBe(false)
        expect(ime.getState().text).toBe('')
      })
    })
  })
})

describe('BoxComponent', () => {
  describe('#given 一个盒子组件', () => {
    describe('#when 添加子组件并渲染', () => {
      it('#then 应包含边框和内容', () => {
        const box = createBoxComponent({ border: true, width: 20 })
        box.addChild(createTextComponent({ text: 'Hello', wrap: false }))

        const lines = box.render(20)

        // 第一行是上边框
        expect(lines[0]).toContain(ROUNDED_BORDER.topLeft)
        expect(lines[0]).toContain(ROUNDED_BORDER.topRight)

        // 中间行含内容
        const contentLine = lines[1]
        expect(contentLine).toContain('Hello')
        expect(contentLine).toContain(ROUNDED_BORDER.vertical)

        // 最后一行是下边框
        const lastLine = lines[lines.length - 1]
        expect(lastLine).toContain(ROUNDED_BORDER.bottomLeft)
      })
    })

    describe('#when 带标题', () => {
      it('#then 上边框应包含标题', () => {
        const box = createBoxComponent({ border: true, title: 'Title', width: 30 })
        const lines = box.render(30)
        expect(lines[0]).toContain('Title')
      })
    })

    describe('#when clearChildren', () => {
      it('#then 子组件数应为 0', () => {
        const box = createBoxComponent()
        box.addChild(createTextComponent({ text: 'A' }))
        expect(box.getChildCount()).toBe(1)

        box.clearChildren()
        expect(box.getChildCount()).toBe(0)
      })
    })
  })
})

describe('OverlayManager', () => {
  describe('#given 一个 overlay 管理器', () => {
    describe('#when 注册并显示 overlay', () => {
      it('#then 应可见并获得焦点', () => {
        const manager = createOverlayManager()
        const comp = createTextComponent({ text: 'overlay' })

        manager.register({
          id: 'dlg1',
          component: comp,
          zIndex: 10,
          visible: false,
          x: 0, y: 0,
          width: 20, height: 5,
        })

        expect(manager.getCount()).toBe(1)
        expect(manager.getVisibleOverlays()).toHaveLength(0)

        manager.show('dlg1')
        expect(manager.getVisibleOverlays()).toHaveLength(1)
        expect(manager.getFocused()!.id).toBe('dlg1')
      })
    })

    describe('#when 隐藏 overlay', () => {
      it('#then 应不可见', () => {
        const manager = createOverlayManager()
        manager.register({
          id: 'dlg1',
          component: createTextComponent({ text: 'test' }),
          zIndex: 10, visible: true,
          x: 0, y: 0, width: 20, height: 5,
        })
        manager.show('dlg1')
        manager.hide('dlg1')
        expect(manager.getVisibleOverlays()).toHaveLength(0)
      })
    })

    describe('#when clear', () => {
      it('#then 应移除所有 overlay', () => {
        const manager = createOverlayManager()
        manager.register({
          id: 'a', component: createTextComponent({ text: '' }),
          zIndex: 1, visible: true,
          x: 0, y: 0, width: 10, height: 5,
        })
        manager.clear()
        expect(manager.getCount()).toBe(0)
      })
    })

    describe('#when z-index 排序', () => {
      it('#then 应按 z-index 升序返回', () => {
        const manager = createOverlayManager()
        manager.register({
          id: 'high', component: createTextComponent({ text: '' }),
          zIndex: 100, visible: true,
          x: 0, y: 0, width: 10, height: 5,
        })
        manager.register({
          id: 'low', component: createTextComponent({ text: '' }),
          zIndex: 1, visible: true,
          x: 0, y: 0, width: 10, height: 5,
        })

        const visible = manager.getVisibleOverlays()
        expect(visible[0]!.id).toBe('low')
        expect(visible[1]!.id).toBe('high')
      })
    })
  })
})

// 验收 4.1.8
describe('Terminal resize → Renderer 重绘', () => {
  describe('#given renderer 监听 resize 事件', () => {
    describe('#when 调用 resize', () => {
      it('#then 应触发 resize 事件并清除缓存', () => {
        const renderer = createRenderer({
          width: 80, height: 24,
          output: () => {},
        })

        let resizeCalled = false
        renderer.on('resize', () => { resizeCalled = true })

        // 渲染一帧
        renderer.renderFrame(['test line'])

        // 触发 resize
        renderer.resize(120, 40)
        expect(resizeCalled).toBe(true)

        // 相同内容重新渲染应有输出（缓存已清除）
        const result = renderer.renderFrame(['test line'])
        expect(result.length).toBeGreaterThan(0)
      })
    })
  })
})

describe('ImageComponent', () => {
  describe('#given 不支持图片的终端', () => {
    describe('#when 渲染', () => {
      it('#then 应显示 fallback 文本', () => {
        const img = createImageComponent({
          data: Buffer.from('test'),
          protocol: 'none',
        })
        const lines = img.render(80)
        expect(lines[0]).toContain('does not support')
      })
    })
  })

  describe('#given kitty 协议', () => {
    describe('#when 渲染', () => {
      it('#then 应输出 Kitty APC 序列', () => {
        const img = createImageComponent({
          data: Buffer.from('tiny'),
          protocol: 'kitty',
        })
        const lines = img.render(80)
        // Kitty 使用 ESC _ ... ESC \
        expect(lines[0]).toContain('\x1b_G')
      })
    })
  })

  describe('#given iterm2 协议', () => {
    describe('#when 渲染', () => {
      it('#then 应输出 iTerm2 OSC 1337 序列', () => {
        const img = createImageComponent({
          data: Buffer.from('tiny'),
          protocol: 'iterm2',
        })
        const lines = img.render(80)
        expect(lines[0]).toContain('\x1b]1337')
      })
    })
  })
})
