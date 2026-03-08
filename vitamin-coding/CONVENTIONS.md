# 编码规范

本文档记录 vitamin-coding-agent 项目的全局编码规范，所有新增代码必须遵守。

## 模块引入

- 相对路径引入**不加** `.js` 后缀
- `moduleResolution` 使用 `bundler` 模式，构建工具（tsup）和测试工具（vitest）均原生支持无扩展名解析

```typescript
// 正确
import { foo } from './foo'
import type { Bar } from '../types'

// 错误
import { foo } from './foo.js'
import type { Bar } from '../types.js'
```

## 引入排序

import 语句按以下顺序排列，组间用空行分隔：

1. **包名引入**（node: 内置 → 第三方包 → workspace 包）
2. **相对路径引入**
3. **类型引入**（包名在前 → 相对路径在后）

```typescript
// 1. 包名引入
import { join } from 'node:path'
import { z } from 'zod'
import { createLogger, readText } from '@vitamin/shared'

// 2. 相对路径引入
import { DEFAULT_CONFIG } from './defaults'
import { mergeConfigLayers } from './merger'

// 3. 类型引入（包名在前 → 相对路径在后）
import type { Logger } from '@vitamin/shared'
import type { LoadConfigOptions, LoadConfigResult } from './types'
```

## 注释风格

- 所有注释使用**中文**
- 统一使用 `//` 行注释，不使用 `/** JSDoc */` 块注释
- 注释应简洁准确，避免 AI 生成模式注释

```typescript
// 正确
// 解析配置文件，支持 JSONC 格式
function parseConfig(raw: string): Config {
  // 移除注释后解析
  return JSON.parse(stripComments(raw))
}

// 错误（JSDoc 块注释）
/** 解析配置文件 */
function parseConfig(raw: string): Config { ... }

// 错误（英文注释）
// Parse config file
function parseConfig(raw: string): Config { ... }
```

## 单元测试

- 测试文件放在 `packages/<name>/tests/` 独立目录，不与源码混放
- 文件命名：`<module>.test.ts`
- 引入源码使用 `../src/<module>` 路径
- 测试风格：given/when/then（嵌套 describe，`#given`/`#when`/`#then` 前缀）
- 测试框架：vitest，全局模式（`globals: true`）

```typescript
// packages/shared/tests/string.test.ts
import { truncate } from '../src/string'

describe('truncate', () => {
  describe('#given 一个超长字符串', () => {
    describe('#when 截断到 10 字符', () => {
      it('#then 应返回截断后的字符串加省略号', () => {
        expect(truncate('hello world!', 10)).toBe('hello w...')
      })
    })
  })
})
```

## 文件与目录

- 文件命名：kebab-case（`agent-loop.ts`、`model-resolver.ts`）
- 每个包一个 `index.ts` 桶导出
- 单文件 200 LOC 软上限
- 禁止 catch-all 文件（`utils.ts`、`helpers.ts`、`service.ts`）

## 代码风格

- 格式化工具：Biome
- 单引号、无分号、尾逗号、2 空格缩进、100 字符行宽
- 工厂模式：所有系统组件使用 `createXxx()` 工厂函数
- 错误处理：不允许空 `catch(e) {}`，自定义错误类型继承 `VitaminError`
- 类型安全：严格模式，禁用 `as any` / `@ts-ignore` / `@ts-expect-error`
- 日志：所有运行时模块使用 `@vitamin/shared` 的 pino 日志

## TypeScript 配置

- `target`: ES2024
- `module`: ESNext
- `moduleResolution`: bundler
- `verbatimModuleSyntax`: true（强制显式 `type` 导入）
- `strict`: true + `noUncheckedIndexedAccess` + `noImplicitOverride`

## 构建与工具链

- 包管理器：pnpm（workspace 协议 `workspace:*`）
- 构建编排：Turborepo
- 包构建：tsup（ESM + dts + sourcemap + target node22）
- 测试：vitest + @vitest/coverage-v8（80% 行覆盖率阈值）
- lint/format：Biome
