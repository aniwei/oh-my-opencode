// 按键解析（方向键/Ctrl+X/IME）

// 解析后的按键
export interface ParsedKey {
  name: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  raw: string
}

// 特殊键映射
const SPECIAL_KEYS: Record<string, string> = {
  '\x1b[A': 'up',
  '\x1b[B': 'down',
  '\x1b[C': 'right',
  '\x1b[D': 'left',
  '\x1b[H': 'home',
  '\x1b[F': 'end',
  '\x1b[3~': 'delete',
  '\x1b[5~': 'pageup',
  '\x1b[6~': 'pagedown',
  '\x1b[2~': 'insert',
  '\x1bOP': 'f1',
  '\x1bOQ': 'f2',
  '\x1bOR': 'f3',
  '\x1bOS': 'f4',
  '\x1b[15~': 'f5',
  '\x1b[17~': 'f6',
  '\x1b[18~': 'f7',
  '\x1b[19~': 'f8',
  '\x1b[20~': 'f9',
  '\x1b[21~': 'f10',
  '\x1b[23~': 'f11',
  '\x1b[24~': 'f12',
  '\r': 'enter',
  '\n': 'enter',
  '\t': 'tab',
  '\x1b[Z': 'shift-tab',
  '\x7f': 'backspace',
  '\x1b': 'escape',
}

// 解析按键输入
export function parseKey(raw: string): ParsedKey {
  // 检查特殊键
  const specialName = SPECIAL_KEYS[raw]
  if (specialName) {
    return {
      name: specialName,
      ctrl: false,
      alt: false,
      shift: specialName.startsWith('shift'),
      raw,
    }
  }

  // Alt+键 (ESC + char)
  if (raw.length === 2 && raw[0] === '\x1b') {
    const char = raw[1] ?? ''
    return {
      name: char,
      ctrl: false,
      alt: true,
      shift: char === char.toUpperCase() && char !== char.toLowerCase(),
      raw,
    }
  }

  // Ctrl+键 (0x01-0x1a except known specials)
  if (raw.length === 1) {
    const code = raw.charCodeAt(0)
    if (code >= 1 && code <= 26) {
      return {
        name: String.fromCharCode(code + 96), // a-z
        ctrl: true,
        alt: false,
        shift: false,
        raw,
      }
    }
  }

  // 普通字符
  return {
    name: raw,
    ctrl: false,
    alt: false,
    shift: false,
    raw,
  }
}

// 检查是否为可打印字符
export function isPrintable(key: ParsedKey): boolean {
  if (key.ctrl || key.alt) return false
  if (key.name.length === 0) return false
  // 特殊键名不算可打印
  for (const name of Object.values(SPECIAL_KEYS)) {
    if (key.name === name) return false
  }
  return true
}
