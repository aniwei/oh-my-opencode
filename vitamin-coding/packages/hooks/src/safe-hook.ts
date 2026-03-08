// 安全 Hook 工厂 — 创建失败不阻塞其他 Hook
import { createLogger } from '@vitamin/shared'

import type { HookRegistration, HookTiming } from './types'

const log = createLogger('hooks')

// 安全创建 Hook — 工厂函数抛异常时返回 null，不阻塞
export function safeCreateHook<T extends HookTiming>(
  name: string,
  factory: () => HookRegistration<T>,
  options: { enabled: boolean },
): HookRegistration<T> | null {
  if (!options.enabled) return null
  try {
    return factory()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(`Hook ${name} creation failed: ${message}`)
    return null
  }
}

// 检查 Hook 是否在配置中启用
export function isHookEnabled(hookName: string, disabledHooks: string[]): boolean {
  return !disabledHooks.includes(hookName)
}

// 兼容旧命名
export const safeHookEnabled = isHookEnabled
