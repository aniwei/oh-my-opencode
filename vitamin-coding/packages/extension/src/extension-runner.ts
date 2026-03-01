// Extension 运行器 — 发现 → 加载 → 注入 → 执行（§S9.1 + §S9.2 异常隔离）
import { createLogger } from '@vitamin/shared'

import { buildExtensionApi, createExtensionRegistry } from './api-builder'
import { createExtensionEventBus } from './event-bus'
import { createExtensionLoader } from './extension-loader'
import { createToolWrapper } from './tool-wrapper'

import type { ExtensionRegistry } from './api-builder'
import type { ExtensionEventBus } from './event-bus'
import type { ExtensionLoader } from './extension-loader'
import type { ToolWrapper } from './tool-wrapper'
import type {
  ExtensionDescriptor,
  ExtensionFactory,
  ExtensionLoadResult,
  ExtensionRunnerConfig,
  LoadedExtension,
} from './types'

const logger = createLogger('extension:runner')

// Extension 运行器
export class ExtensionRunner {
  private readonly loader: ExtensionLoader
  private readonly eventBus: ExtensionEventBus
  private readonly registry: ExtensionRegistry
  private readonly toolWrapper: ToolWrapper
  private readonly loaded: Map<string, LoadedExtension> = new Map()

  constructor(config: ExtensionRunnerConfig) {
    this.loader = createExtensionLoader(config)
    this.eventBus = createExtensionEventBus()
    this.registry = createExtensionRegistry()
    this.toolWrapper = createToolWrapper(this.eventBus)
  }

  // 发现并加载所有 Extension
  async discoverAndLoad(): Promise<ExtensionLoadResult[]> {
    const descriptors = await this.loader.discover()
    return this.loadAll(descriptors)
  }

  // 加载一组 Extension
  async loadAll(
    descriptors: ExtensionDescriptor[],
  ): Promise<ExtensionLoadResult[]> {
    const results: ExtensionLoadResult[] = []

    for (const descriptor of descriptors) {
      const result = await this.loadOne(descriptor)
      results.push(result)
    }

    return results
  }

  // 加载单个 Extension（§S9.2 异常隔离）
  async loadOne(descriptor: ExtensionDescriptor): Promise<ExtensionLoadResult> {
    const { name } = descriptor

    try {
      // 1. 加载工厂函数
      let factory: ExtensionFactory
      if (descriptor.factory) {
        // 如果 descriptor 直接提供 factory，不需要 import
        factory = descriptor.factory
      } else {
        factory = await this.loader.load(descriptor)
      }

      // 2. 构建独立的 API 实例
      const { api, dispose } = buildExtensionApi(descriptor, {
        eventBus: this.eventBus,
        registry: this.registry,
      })

      // 3. 执行 Extension 注册（异常隔离）
      try {
        await factory(api)
      } catch (error) {
        // §S9.2: Extension 注册失败不中断启动流程
        logger.error(`Extension ${name} 加载失败: ${String(error)}`)
        dispose()
        return { name, loaded: false, error: error as Error }
      }

      // 4. 记录已加载的 Extension
      this.loaded.set(name, { descriptor, api, dispose })
      logger.info(`Extension ${name} 加载成功`)
      return { name, loaded: true }
    } catch (error) {
      logger.error(`Extension ${name} 加载失败: ${String(error)}`)
      return { name, loaded: false, error: error as Error }
    }
  }

  // 卸载指定 Extension
  unload(name: string): boolean {
    const ext = this.loaded.get(name)
    if (!ext) return false

    ext.dispose()
    this.loaded.delete(name)
    logger.info(`Extension ${name} 已卸载`)
    return true
  }

  // 卸载所有 Extension
  unloadAll(): void {
    for (const [name, ext] of this.loaded) {
      ext.dispose()
      logger.info(`Extension ${name} 已卸载`)
    }
    this.loaded.clear()
    this.eventBus.clear()
  }

  // 获取事件总线（用于触发事件）
  getEventBus(): ExtensionEventBus {
    return this.eventBus
  }

  // 获取注册表（用于获取 Extension 注册的工具/命令/Hook）
  getRegistry(): ExtensionRegistry {
    return this.registry
  }

  // 获取工具包装器（用于拦截工具调用）
  getToolWrapper(): ToolWrapper {
    return this.toolWrapper
  }

  // 获取已加载的 Extension 列表
  getLoadedExtensions(): LoadedExtension[] {
    return [...this.loaded.values()]
  }

  // 获取已加载的 Extension 名称列表
  getLoadedExtensionNames(): string[] {
    return [...this.loaded.keys()]
  }
}

// 工厂函数
export function createExtensionRunner(
  config: ExtensionRunnerConfig = {},
): ExtensionRunner {
  return new ExtensionRunner(config)
}
