# Extension 开发指南

> 学习如何为 Vitamin Coding 开发自定义扩展，包含基础、高级和 UI 三种完整示例。

## 概述

Extension 是 Vitamin Coding 的插件系统，支持：

- **注册工具** — 为 Agent 添加新工具
- **注册命令** — 添加斜杠命令
- **监听事件** — 拦截输入/输出/工具调用
- **扩展间通信** — 通过事件总线交换数据

## Extension 生命周期

```
加载 → activate(api) → 注册工具/命令/事件 → 运行中 → unload → 清理
```

## 基础示例：自定义工具 Extension

创建一个提供 `word-count` 工具的扩展：

```typescript
// extensions/word-count/index.ts
import { z } from 'zod'
import { readFile } from 'node:fs/promises'
import type { ExtensionFactory, ExtensionAPI } from '@vitamin/extension'
import type { AgentTool } from '@vitamin/agent'

const WordCountSchema = z.object({
  path: z.string().describe('要统计的文件路径'),
})

export const activate: ExtensionFactory = (api: ExtensionAPI) => {
  // 注册工具
  api.registerTool({
    name: 'word-count',
    description: '统计文件的字数、行数和字符数',
    parameters: WordCountSchema,
    execute: async (_id, rawArgs, _signal) => {
      const args = WordCountSchema.parse(rawArgs)

      try {
        const content = await readFile(args.path, 'utf-8')
        const lines = content.split('\n').length
        const words = content.split(/\s+/).filter(Boolean).length
        const chars = content.length

        return {
          content: [{
            type: 'text',
            text: `📊 ${args.path}\n行数: ${lines}\n字数: ${words}\n字符数: ${chars}`,
          }],
        }
      } catch {
        return {
          content: [{ type: 'text', text: `无法读取文件: ${args.path}` }],
          isError: true,
        }
      }
    },
  } as AgentTool)

  api.log('word-count 工具已注册')
}
```

**使用方式**：

在 `.vitamin/extensions.json` 中注册：

```json
{
  "extensions": [
    { "name": "word-count", "path": "./extensions/word-count" }
  ]
}
```

Agent 即可使用 `word-count` 工具统计文件字数。

---

## 高级示例：事件拦截 Extension

创建一个自动为所有工具调用添加审计日志的扩展：

```typescript
// extensions/audit-logger/index.ts
import { appendFile } from 'node:fs/promises'
import type { ExtensionFactory, ExtensionAPI } from '@vitamin/extension'

const LOG_PATH = '.vitamin/audit.log'

export const activate: ExtensionFactory = (api: ExtensionAPI) => {
  // 监听工具调用前事件
  const unsubBefore = api.on('tool.before', async (event) => {
    const timestamp = new Date().toISOString()
    const line = `[${timestamp}] CALL ${event.toolName}(${JSON.stringify(event.args)})\n`
    await appendFile(LOG_PATH, line).catch(() => {})
  })

  // 监听工具调用后事件
  const unsubAfter = api.on('tool.after', async (event) => {
    const timestamp = new Date().toISOString()
    const status = event.result.isError ? 'ERROR' : 'OK'
    const line = `[${timestamp}] RESULT ${event.toolName} → ${status}\n`
    await appendFile(LOG_PATH, line).catch(() => {})
  })

  // 监听用户输入事件
  const unsubInput = api.on('input', async (event) => {
    const timestamp = new Date().toISOString()
    const line = `[${timestamp}] INPUT "${event.text.slice(0, 100)}"\n`
    await appendFile(LOG_PATH, line).catch(() => {})
  })

  // 注册斜杠命令查看日志
  api.registerCommand({
    name: 'audit',
    description: '查看审计日志',
    handler: async () => {
      try {
        const { readFile } = await import('node:fs/promises')
        const content = await readFile(LOG_PATH, 'utf-8')
        const lines = content.trim().split('\n')
        const recent = lines.slice(-20).join('\n')
        return `最近 20 条审计记录:\n\n${recent}`
      } catch {
        return '暂无审计记录'
      }
    },
  })

  // 扩展间通信：响应其他扩展的日志查询
  api.onBus('audit:query', (data) => {
    api.emitBus('audit:response', { logPath: LOG_PATH })
  })

  api.log('audit-logger 扩展已启用')

  // 返回清理函数（可选）
  return () => {
    unsubBefore()
    unsubAfter()
    unsubInput()
    api.log('audit-logger 扩展已卸载')
  }
}
```

**功能**：

1. 自动记录所有工具调用和用户输入到 `.vitamin/audit.log`
2. 提供 `/audit` 命令查看最近的审计记录
3. 通过 `audit:query` 事件支持其他扩展查询日志路径

---

## UI 输出 Extension

创建一个增强终端输出的扩展，提供进度条和格式化：

```typescript
// extensions/rich-output/index.ts
import type { ExtensionFactory, ExtensionAPI } from '@vitamin/extension'

interface ProgressState {
  total: number
  current: number
  label: string
}

export const activate: ExtensionFactory = (api: ExtensionAPI) => {
  const progressStates = new Map<string, ProgressState>()

  // 注册进度管理工具
  api.registerTool({
    name: 'progress-update',
    description: '更新任务进度条（供 Agent 在多步骤任务中使用）',
    parameters: {
      parse: (input: unknown) => input as { taskId: string; current: number; total: number; label: string },
      safeParse: (input: unknown) => ({ success: true, data: input as { taskId: string; current: number; total: number; label: string } }),
    },
    execute: async (_id, rawArgs) => {
      const args = rawArgs as { taskId: string; current: number; total: number; label: string }
      progressStates.set(args.taskId, {
        total: args.total,
        current: args.current,
        label: args.label,
      })

      const percent = Math.round((args.current / args.total) * 100)
      const filled = Math.round(percent / 5)
      const bar = '█'.repeat(filled) + '░'.repeat(20 - filled)

      return {
        content: [{
          type: 'text',
          text: `\n[${bar}] ${percent}% — ${args.label} (${args.current}/${args.total})\n`,
        }],
      }
    },
  } as never)

  // 监听工具结果，自动格式化文件操作
  api.on('tool.after', async (event) => {
    if (event.toolName === 'write' || event.toolName === 'edit') {
      // 在日志中标记文件修改
      api.emitBus('file:modified', {
        tool: event.toolName,
        timestamp: Date.now(),
      })
    }
  })

  // 注册总结命令
  api.registerCommand({
    name: 'progress',
    description: '查看所有进行中的任务进度',
    handler: async () => {
      if (progressStates.size === 0) {
        return '当前没有进行中的任务'
      }

      const lines: string[] = ['📊 任务进度:']
      for (const [id, state] of progressStates) {
        const percent = Math.round((state.current / state.total) * 100)
        lines.push(`  ${id}: ${percent}% — ${state.label}`)
      }
      return lines.join('\n')
    },
  })

  api.log('rich-output 扩展已启用')
}
```

**功能**：

1. 提供 `progress-update` 工具供 Agent 汇报任务进度
2. 自动追踪文件修改事件
3. `/progress` 命令查看所有任务进度

---

## API 参考

### ExtensionAPI

Extension 工厂函数接收的 API 对象：

```typescript
interface ExtensionAPI {
  // 工具注册
  registerTool(tool: AgentTool): void

  // 斜杠命令注册
  registerCommand(command: SlashCommand): void

  // 事件监听（类型化）
  on(event: ExtensionEventName, handler: EventHandler): () => void

  // 扩展间通信
  onBus(event: string, handler: (data: unknown) => void): () => void
  emitBus(event: string, data: unknown): void

  // 日志
  log(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}
```

### 事件类型

| 事件 | 触发时机 | Payload |
|------|---------|---------|
| `input` | 用户输入前 | `{ text, cancelled }` |
| `tool.before` | 工具调用前 | `{ toolName, args, cancel() }` |
| `tool.after` | 工具调用后 | `{ toolName, args, result }` |
| `session.start` | 会话开始 | `{ sessionId }` |
| `session.end` | 会话结束 | `{ sessionId, summary }` |
| `resources.discover` | 资源发现 | `{ resources[] }` |

### 扩展描述符

通过 `factory` 字段可内联注册（无需文件系统加载）：

```typescript
const descriptor: ExtensionDescriptor = {
  name: 'my-extension',
  source: 'local',
  entryPoint: './extensions/my-ext',
  // 可选：直接提供工厂函数（跳过文件加载）
  factory: activate,
}
```

## 最佳实践

1. **始终返回清理函数** — 取消订阅事件、释放资源
2. **使用 Zod 验证工具参数** — 在 `execute` 内部 `parse(rawArgs)` 确保类型安全
3. **错误隔离** — 扩展错误不会影响主 Agent，但应提供友好的错误消息
4. **使用 bus 事件通信** — 避免扩展间直接引用，使用 `onBus/emitBus` 解耦
5. **尊重 AbortSignal** — 长时间操作应检查 `signal.aborted`
6. **日志而非 console** — 使用 `api.log()` 而不是 `console.log()`

## 发布扩展

将你的 Extension 发布为 npm 包：

```json
{
  "name": "vitamin-ext-my-tool",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["vitamin-coding-extension"],
  "peerDependencies": {
    "@vitamin/extension": "^0.1.0"
  }
}
```

用户安装后在 `.vitamin/extensions.json` 中引用：

```json
{
  "extensions": [
    { "name": "my-tool", "package": "vitamin-ext-my-tool" }
  ]
}
```
