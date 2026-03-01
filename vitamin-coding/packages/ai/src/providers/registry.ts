// Provider 注册表 — 管理所有 LLM 提供商适配器
import { ProviderError } from '@vitamin/shared'

import type { ApiType } from '../types'
import type { ProviderAdapter, ProviderFactory } from './types'

// Provider 注册表
export class ProviderRegistry {
  private readonly factories = new Map<ApiType, ProviderFactory>()
  private readonly instances = new Map<ApiType, ProviderAdapter>()

  // 注册 Provider 工厂
  register(apiType: ApiType, factory: ProviderFactory): void {
    this.factories.set(apiType, factory)
    // 清除缓存实例（如果有）
    this.instances.delete(apiType)
  }

  // 获取 Provider 实例（惰性创建）
  get(apiType: ApiType): ProviderAdapter {
    const cached = this.instances.get(apiType)
    if (cached) return cached

    const factory = this.factories.get(apiType)
    if (!factory) {
      throw new ProviderError(`Provider not registered: ${apiType}`, {
        code: 'PROVIDER_NOT_FOUND',
      })
    }

    const instance = factory()
    this.instances.set(apiType, instance)
    return instance
  }

  // 检查 Provider 是否已注册
  has(apiType: ApiType): boolean {
    return this.factories.has(apiType)
  }

  // 列出所有已注册的 API 类型
  list(): ApiType[] {
    return [...this.factories.keys()]
  }

  // 移除 Provider 注册
  unregister(apiType: ApiType): void {
    this.factories.delete(apiType)
    this.instances.delete(apiType)
  }

  // 清除所有注册
  clear(): void {
    this.factories.clear()
    this.instances.clear()
  }
}

// 创建 Provider 注册表
export function createProviderRegistry(): ProviderRegistry {
  return new ProviderRegistry()
}
