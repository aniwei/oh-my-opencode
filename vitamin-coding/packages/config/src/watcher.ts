// 配置文件监视器，支持变更事件发射
import { type FSWatcher, watch as nodeWatch } from 'node:fs'
import { TypedEventEmitter, createLogger } from '@vitamin/shared'
import type { Disposable, EventMap } from '@vitamin/shared'
import type { VitaminConfig } from './types'

const log = createLogger('config:watcher')

interface ConfigWatcherEvents extends EventMap {
  change: (config: Partial<VitaminConfig>, path: string) => void
  error: (error: Error) => void
}

export interface ConfigWatcherOptions {
  // 要监视的文件路径
  paths: string[]
  // 重新加载回调 —— 文件变更时调用，返回新配置
  reload: (path: string) => Promise<Partial<VitaminConfig>>
  // 防抖间隔（毫秒，默认 300）
  debounceMs?: number
}

// 监视配置文件变更并发射事件
export function createConfigWatcher(options: ConfigWatcherOptions): ConfigWatcher {
  return new ConfigWatcher(options)
}

export class ConfigWatcher extends TypedEventEmitter<ConfigWatcherEvents> implements Disposable {
  private watchers: FSWatcher[] = []
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly debounceMs: number
  private readonly reload: (path: string) => Promise<Partial<VitaminConfig>>

  constructor(options: ConfigWatcherOptions) {
    super()
    this.debounceMs = options.debounceMs ?? 300
    this.reload = options.reload
    this.start(options.paths)
  }

  private start(paths: string[]): void {
    for (const path of paths) {
      try {
        const watcher = nodeWatch(path, () => {
          this.handleChange(path)
        })
        watcher.on('error', (error) => {
          log.error({ path, err: error }, 'Watcher error')
          this.emit('error', error)
        })
        this.watchers.push(watcher)
        log.debug({ path }, 'Watching config file')
      } catch (error) {
        log.debug({ path, err: error }, 'Cannot watch path (may not exist yet)')
      }
    }
  }

  private handleChange(path: string): void {
    // 防抖快速变更
    const existing = this.debounceTimers.get(path)
    if (existing) clearTimeout(existing)

    this.debounceTimers.set(
      path,
      setTimeout(async () => {
        this.debounceTimers.delete(path)
        try {
          const config = await this.reload(path)
          this.emit('change', config, path)
          log.info({ path }, 'Config reloaded')
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error))
          log.error({ path, err }, 'Failed to reload config')
          this.emit('error', err)
        }
      }, this.debounceMs),
    )
  }

  [Symbol.dispose](): void {
    for (const watcher of this.watchers) {
      watcher.close()
    }
    this.watchers = []

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()

    this.removeAllListeners()
  }
}
