// 键绑定系统（§S12 Week 13）— Ctrl+C/D/Z/L、方向键、Tab
import { createLogger } from '@vitamin/shared'

const logger = createLogger('coding-agent:keybindings')

// 按键标识符
export type KeyId =
  | 'ctrl+c' | 'ctrl+d' | 'ctrl+z' | 'ctrl+l'
  | 'ctrl+a' | 'ctrl+e' | 'ctrl+k' | 'ctrl+u'
  | 'up' | 'down' | 'left' | 'right'
  | 'tab' | 'shift+tab'
  | 'enter' | 'escape' | 'backspace' | 'delete'
  | 'pageup' | 'pagedown'
  | 'home' | 'end'

// 按键处理器
export type KeyHandler = () => Promise<void> | void

// 键绑定描述
export interface KeyBinding {
  key: KeyId
  description: string
  handler: KeyHandler
  context?: string
}

// 键绑定注册表
export interface KeyBindingRegistry {
  register: (key: KeyId, handler: KeyHandler, description?: string) => void
  unregister: (key: KeyId) => void
  handle: (key: KeyId) => Promise<boolean>
  listAll: () => ReadonlyArray<{ key: KeyId; description: string }>
  hasBinding: (key: KeyId) => boolean
}

// 创建键绑定注册表
export function createKeyBindings(): KeyBindingRegistry {
  const bindings = new Map<KeyId, KeyBinding>()

  return {
    register(key: KeyId, handler: KeyHandler, description?: string): void {
      bindings.set(key, {
        key,
        description: description ?? key,
        handler,
      })
      logger.debug('Registered key binding: %s', key)
    },

    unregister(key: KeyId): void {
      bindings.delete(key)
    },

    async handle(key: KeyId): Promise<boolean> {
      const binding = bindings.get(key)
      if (!binding) return false

      try {
        await binding.handler()
        return true
      } catch (error) {
        logger.error('Key handler error for %s: %s', key, error instanceof Error ? error.message : String(error))
        return false
      }
    },

    listAll(): ReadonlyArray<{ key: KeyId; description: string }> {
      return Array.from(bindings.values()).map(b => ({
        key: b.key,
        description: b.description,
      }))
    },

    hasBinding(key: KeyId): boolean {
      return bindings.has(key)
    },
  }
}

// 默认键绑定描述
export const DEFAULT_KEY_DESCRIPTIONS: Record<string, string> = {
  'ctrl+c': 'Interrupt / Cancel current operation',
  'ctrl+d': 'Exit vitamin',
  'ctrl+l': 'Clear screen',
  'ctrl+z': 'Suspend process',
  'tab': 'Switch page / Tab completion',
  'shift+tab': 'Switch page (reverse)',
  'up': 'Previous message / Navigate up',
  'down': 'Next message / Navigate down',
  'enter': 'Submit input / Confirm',
  'escape': 'Cancel editing / Close overlay',
  'pageup': 'Scroll up',
  'pagedown': 'Scroll down',
}

// 序列-to-KeyId 映射（raw mode 中的转义序列）
const SEQUENCE_MAP: Record<string, KeyId> = {
  '\x03': 'ctrl+c',
  '\x04': 'ctrl+d',
  '\x1a': 'ctrl+z',
  '\x0c': 'ctrl+l',
  '\x01': 'ctrl+a',
  '\x05': 'ctrl+e',
  '\x0b': 'ctrl+k',
  '\x15': 'ctrl+u',
  '\x1b[A': 'up',
  '\x1b[B': 'down',
  '\x1b[C': 'right',
  '\x1b[D': 'left',
  '\t': 'tab',
  '\x1b[Z': 'shift+tab',
  '\r': 'enter',
  '\x1b': 'escape',
  '\x7f': 'backspace',
  '\x1b[3~': 'delete',
  '\x1b[5~': 'pageup',
  '\x1b[6~': 'pagedown',
  '\x1b[H': 'home',
  '\x1b[F': 'end',
}

// 将原始终端序列解析为 KeyId
export function sequenceToKeyId(sequence: string): KeyId | null {
  return (SEQUENCE_MAP[sequence] as KeyId) ?? null
}
