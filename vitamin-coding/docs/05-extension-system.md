> [← 返回目录](README.md)

## 第五部分：扩展系统设计

### 5.1 扩展开发示例

#### 5.1.1 基础扩展：自定义工具

```typescript
// extensions/my-search/index.ts
import type { ExtensionFactory } from "@vitamin/extension"
import { z } from "zod"

const mySearchExtension: ExtensionFactory = (api) => {
  api.registerTool({
    name: "my_search",
    description: "Search internal documentation",
    parameters: z.object({
      query: z.string().describe("Search query"),
      limit: z.number().default(10),
    }),
    async execute(id, args, signal) {
      const results = await searchInternalDocs(args.query, args.limit, signal)
      return { content: [{ type: "text", text: JSON.stringify(results) }] }
    }
  })
}

export default mySearchExtension
```

#### 5.1.2 高级扩展：Plan Mode（从 oh-my-opencode 移植）

```typescript
// extensions/plan-mode/index.ts
import type { ExtensionFactory } from "@vitamin/extension"

const planModeExtension: ExtensionFactory = (api) => {
  // 注册 /plan 命令
  api.registerCommand("plan", {
    description: "Enter plan mode for complex tasks",
    async handler(args, context) {
      // 1. 调用 Metis 预分析
      const analysis = await api.agent.dispatch({
        subagent: "metis",
        prompt: args.join(" "),
        mode: "sync"
      })

      // 2. 调用 Prometheus 生成计划
      const plan = await api.agent.dispatch({
        subagent: "prometheus",
        prompt: `${analysis.output}\n\nUser request: ${args.join(" ")}`,
        mode: "sync"
      })

      // 3. 调用 Momus 审查
      const review = await api.agent.dispatch({
        subagent: "momus",
        prompt: plan.output,
        mode: "sync"
      })

      // 4. UI 展示计划
      api.ui.notify(`Plan generated: ${plan.output?.split("\n")[0]}`, "info")
    }
  })

  // 注册 /start-work 命令
  api.registerCommand("start-work", {
    description: "Execute a plan",
    async handler(args) {
      // Atlas 并行执行
      // ...
    }
  })

  // 关键词检测
  api.on("input", async (event) => {
    if (event.text.match(/\b(plan|refactor|redesign|architect)\b/i)) {
      api.ui.setStatus("plan-hint", "Tip: Use /plan for complex tasks")
    }
  })
}

export default planModeExtension
```

#### 5.1.3 UI 扩展：自定义状态面板

```typescript
// extensions/cost-tracker/index.ts
import type { ExtensionFactory } from "@vitamin/extension"

const costTrackerExtension: ExtensionFactory = (api) => {
  let totalCost = 0
  let totalTokens = 0

  api.on("agent.turn.end", async (event) => {
    totalCost += event.usage?.cost ?? 0
    totalTokens += event.usage?.totalTokens ?? 0

    api.ui.setStatus("cost", `$${totalCost.toFixed(4)} | ${totalTokens} tokens`)
  })

  api.ui.setWidget("cost-panel", (width) => {
    return [
      `Cost: $${totalCost.toFixed(4)}`,
      `Tokens: ${totalTokens}`,
      `Model: ${api.agent.state.model.name}`
    ]
  })
}

export default costTrackerExtension
```

### 5.2 扩展分发

```
扩展来源（优先级高→低）:
  1. 内置扩展（coding-agent/src/extensions/）
  2. npm 包 (@vitamin/ext-*)
  3. 本地目录 (.vitamin/extensions/)
  4. Git 仓库 (config.extensions.git[])
  5. 配置路径 (config.extensions.paths[])
```

#### package.json 示例

```json
{
  "name": "@vitamin/ext-plan-mode",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "vitamin": {
    "name": "Plan Mode",
    "description": "Plan/Build orchestration for complex tasks",
    "version": ">=0.1.0",
    "capabilities": ["tools", "commands", "hooks"]
  }
}
```
