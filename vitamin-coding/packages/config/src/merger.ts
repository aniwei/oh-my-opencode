// 配置对象的深度合并策略
// - 对象字段：深度合并
// - disabled_* 数组：Set 并集
// - 标量字段：高优先级覆盖
import type { VitaminConfig } from './types'

// 合并两个配置对象
// higher 的值优先于 lower
export function mergeConfigs(
  lower: Partial<VitaminConfig>,
  higher: Partial<VitaminConfig>,
): Partial<VitaminConfig> {
  const result = { ...lower }

  for (const [key, value] of Object.entries(higher)) {
    if (value === undefined) continue

    const typedKey = key as keyof VitaminConfig

    if (isDisabledArray(typedKey)) {
      // disabled_* 数组：Set 并集
      const existing = (result[typedKey] as string[] | undefined) ?? []
      const incoming = value as string[]
      result[typedKey] = [...new Set([...existing, ...incoming])] as never
    } else if (isPlainObject(value) && isPlainObject(result[typedKey])) {
      // 对象深度合并（agents、categories）
      result[typedKey] = deepMerge(
        result[typedKey] as Record<string, unknown>,
        value as Record<string, unknown>,
      ) as never
    } else {
      // 标量：高优先级覆盖
      result[typedKey] = value as never
    }
  }

  return result
}

// 合并多个配置层，从最低优先级到最高优先级
export function mergeConfigLayers(...layers: Partial<VitaminConfig>[]): Partial<VitaminConfig> {
  let result: Partial<VitaminConfig> = {}
  for (const layer of layers) {
    result = mergeConfigs(result, layer)
  }
  return result
}

const DISABLED_KEYS = new Set([
  'disabled_agents',
  'disabled_hooks',
  'disabled_mcps',
  'disabled_skills',
  'disabled_tools',
])

function isDisabledArray(key: string): boolean {
  return DISABLED_KEYS.has(key)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// 递归深度合并两个对象，source 值覆盖 target
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target }
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, value)
    } else {
      result[key] = value
    }
  }
  return result
}
