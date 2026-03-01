// Hook 执行引擎 — 注册、优先级排序、链式执行
import { createLogger } from '@vitamin/shared'

import type { HookHandler, HookInput, HookOutput, HookRegistration, HookTiming } from './types'

const log = createLogger('hooks')

export class HookEngine {
  private readonly hooks = new Map<HookTiming, HookRegistration[]>()
  private readonly disabled = new Set<string>()

  // 注册 Hook
  register<T extends HookTiming>(registration: HookRegistration<T>): void {
    const list = this.hooks.get(registration.timing) ?? []
    list.push(registration as unknown as HookRegistration)
    this.hooks.set(registration.timing, list)
    log.debug(`Hook registered: ${registration.name} (timing=${registration.timing}, priority=${registration.priority})`)
  }

  // 注销 Hook
  unregister(name: string): boolean {
    let removed = false
    for (const [timing, list] of this.hooks) {
      const filtered = list.filter((hook) => hook.name !== name)
      if (filtered.length < list.length) {
        this.hooks.set(timing, filtered)
        removed = true
      }
    }
    return removed
  }

  // 运行时禁用 Hook
  disable(name: string): void {
    this.disabled.add(name)
  }

  // 运行时启用 Hook
  enable(name: string): void {
    this.disabled.delete(name)
  }

  // 查询指定时机已注册的 Hook
  getRegistered(timing?: HookTiming): HookRegistration[] {
    if (timing) {
      return [...(this.hooks.get(timing) ?? [])]
    }
    const all: HookRegistration[] = []
    for (const list of this.hooks.values()) {
      all.push(...list)
    }
    return all
  }

  // 执行有输出的 Hook 链（链式处理）
  async execute<T extends HookTiming>(
    timing: T,
    input: HookInput<T>,
    output: HookOutput<T>,
  ): Promise<void> {
    const hooks = this.getSortedHooks(timing)
    if (hooks.length === 0) return

    for (const hook of hooks) {
      try {
        await (hook.handler as HookHandler<T>)(input, output as never)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        log.error(`Hook ${hook.name} (timing=${timing}) failed: ${message}`)
        // 继续执行下一个 Hook — 单个 Hook 失败不阻塞
      }
    }
  }

  // 执行无输出的 Hook (event 类型)
  async emit<T extends HookTiming>(
    timing: T,
    input: HookInput<T>,
  ): Promise<void> {
    const hooks = this.getSortedHooks(timing)
    if (hooks.length === 0) return

    for (const hook of hooks) {
      try {
        await (hook.handler as (input: HookInput<T>) => void | Promise<void>)(input)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        log.error(`Hook ${hook.name} (timing=${timing}) failed: ${message}`)
      }
    }
  }

  // 清空所有 Hook
  clear(): void {
    this.hooks.clear()
    this.disabled.clear()
  }

  // 按 priority 排序，排除已禁用的 Hook
  private getSortedHooks(timing: HookTiming): HookRegistration[] {
    const list = this.hooks.get(timing) ?? []
    return list
      .filter((hook) => hook.enabled && !this.disabled.has(hook.name))
      .sort((a, b) => a.priority - b.priority)
  }
}

export function createHookEngine(): HookEngine {
  return new HookEngine()
}
