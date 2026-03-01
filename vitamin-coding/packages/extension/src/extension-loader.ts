// Extension 加载器 — 五源发现（§S9.1: 内置/npm/local/config, Git 推迟到 v0.2.0）
import { createLogger } from '@vitamin/shared'

import type { ExtensionDescriptor, ExtensionFactory, ExtensionRunnerConfig, ExtensionSource } from './types'

const logger = createLogger('extension:loader')

// 从指定目录发现 Extension 入口文件
async function discoverFromDirectory(
  dir: string,
  source: ExtensionSource,
): Promise<ExtensionDescriptor[]> {
  const { readdir, stat } = await import('node:fs/promises')
  const { join } = await import('node:path')

  const descriptors: ExtensionDescriptor[] = []

  try {
    const entries = await readdir(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const fileStat = await stat(fullPath)

      if (fileStat.isDirectory()) {
        // 目录: 查找 index.ts / index.js
        const indexTs = join(fullPath, 'index.ts')
        const indexJs = join(fullPath, 'index.js')
        try {
          await stat(indexTs)
          descriptors.push({
            name: entry,
            source,
            entryPoint: indexTs,
          })
          continue
        } catch {
          // index.ts 不存在，尝试 index.js
        }
        try {
          await stat(indexJs)
          descriptors.push({
            name: entry,
            source,
            entryPoint: indexJs,
          })
        } catch {
          // 该目录不是有效的 Extension
        }
      } else if (entry.endsWith('.ts') || entry.endsWith('.js')) {
        // 单文件 Extension
        const name = entry.replace(/\.[tj]s$/, '')
        descriptors.push({
          name,
          source,
          entryPoint: fullPath,
        })
      }
    }
  } catch {
    // 目录不存在或不可读
    logger.info(`Extension 目录不存在或不可读: ${dir}`)
  }

  return descriptors
}

// 从 npm 包发现 Extension (node_modules/@vitamin/ext-*)
async function discoverFromNpm(
  prefix: string,
): Promise<ExtensionDescriptor[]> {
  const { readdir } = await import('node:fs/promises')
  const { join } = await import('node:path')

  const descriptors: ExtensionDescriptor[] = []

  // 查找 node_modules 下匹配前缀的包
  const nodeModulesDir = join(process.cwd(), 'node_modules')
  const scope = prefix.includes('/') ? prefix.split('/')[0] : undefined
  const pkgPrefix = prefix.includes('/') ? prefix.split('/')[1] : prefix

  try {
    const searchDir = scope ? join(nodeModulesDir, scope) : nodeModulesDir
    const entries = await readdir(searchDir)

    for (const entry of entries) {
      const nameToCheck = pkgPrefix ?? ''
      if (!entry.startsWith(nameToCheck)) continue

      const pkgPath = scope
        ? join(nodeModulesDir, scope, entry)
        : join(nodeModulesDir, entry)
      const fullName = scope ? `${scope}/${entry}` : entry

      descriptors.push({
        name: fullName,
        source: 'npm',
        entryPoint: pkgPath,
      })
    }
  } catch {
    // node_modules 不可访问或作用域不存在
  }

  return descriptors
}

// 从配置路径数组发现 Extension
async function discoverFromConfigPaths(
  paths: string[],
): Promise<ExtensionDescriptor[]> {
  const { stat } = await import('node:fs/promises')
  const { basename } = await import('node:path')

  const descriptors: ExtensionDescriptor[] = []

  for (const entryPoint of paths) {
    try {
      await stat(entryPoint)
      const name = basename(entryPoint).replace(/\.[tj]s$/, '')
      descriptors.push({
        name,
        source: 'config',
        entryPoint,
      })
    } catch {
      logger.warn(`配置的 Extension 路径无效: ${entryPoint}`)
    }
  }

  return descriptors
}

// Extension 加载器
export class ExtensionLoader {
  constructor(private readonly config: ExtensionRunnerConfig) {}

  // 从 5 种来源发现所有 Extension（§S9.1）
  async discover(): Promise<ExtensionDescriptor[]> {
    const descriptors: ExtensionDescriptor[] = []

    // 1. 内置扩展
    if (this.config.builtinDir) {
      const builtin = await discoverFromDirectory(this.config.builtinDir, 'builtin')
      descriptors.push(...builtin)
    }

    // 2. npm 包
    const npmPrefix = this.config.npmPrefix ?? '@vitamin/ext-'
    const npm = await discoverFromNpm(npmPrefix)
    descriptors.push(...npm)

    // 3. 本地扩展
    if (this.config.localDir) {
      const local = await discoverFromDirectory(this.config.localDir, 'local')
      descriptors.push(...local)
    }

    // 4. 配置路径
    if (this.config.configPaths && this.config.configPaths.length > 0) {
      const config = await discoverFromConfigPaths(this.config.configPaths)
      descriptors.push(...config)
    }

    // 5. Git 来源 — 推迟到 v0.2.0
    // 暂不实现

    logger.info(`发现 ${String(descriptors.length)} 个 Extension`)
    return descriptors
  }

  // 动态加载 Extension 模块，获取工厂函数
  async load(descriptor: ExtensionDescriptor): Promise<ExtensionFactory> {
    try {
      const module = await import(descriptor.entryPoint) as Record<string, unknown>
      // 支持 default export 或 activate/setup 命名导出
      const factory = (module.default ?? module.activate ?? module.setup) as
        | ExtensionFactory
        | undefined

      if (typeof factory !== 'function') {
        throw new Error(
          `Extension ${descriptor.name} 没有导出有效的工厂函数 (default/activate/setup)`,
        )
      }

      return factory
    } catch (error) {
      throw new Error(
        `加载 Extension ${descriptor.name} 失败: ${String(error)}`,
      )
    }
  }
}

// 工厂函数
export function createExtensionLoader(
  config: ExtensionRunnerConfig,
): ExtensionLoader {
  return new ExtensionLoader(config)
}
