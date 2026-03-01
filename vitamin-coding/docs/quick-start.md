# Vitamin Coding — 快速开始

> 5 分钟内从零搭建并运行 Vitamin Coding Agent

## 前置条件

- **Node.js** ≥ 22.0.0
- **pnpm** ≥ 9.x（推荐）或 npm
- 任一 LLM API 密钥（Anthropic / OpenAI / Google / Ollama）

## 安装

### 方式一：全局工具（推荐）

```bash
npm install -g @vitamin/coding-agent
```

### 方式二：npx 直接运行

```bash
npx @vitamin/coding-agent
```

### 方式三：嵌入式 SDK

```bash
npm install @vitamin/sdk
```

## 配置 API 密钥

设置环境变量：

```bash
# 任选其一
export ANTHROPIC_API_KEY=sk-ant-xxx     # Claude
export OPENAI_API_KEY=sk-xxx            # GPT-4
export GOOGLE_API_KEY=xxx               # Gemini
```

或创建 `.env` 文件：

```bash
echo "ANTHROPIC_API_KEY=sk-ant-xxx" > .env
```

## 第一次运行

### CLI 交互模式

```bash
# 在项目目录下运行
cd your-project
vitamin-coding
```

### 非交互模式（单次 Prompt）

```bash
vitamin-coding --print "解释这个项目的架构"
```

### JSON 输出模式

```bash
vitamin-coding --json "列出所有测试文件" | jq .
```

## 项目配置（可选）

在项目根目录创建 `.vitamin/config.jsonc`：

```jsonc
{
  // 默认模型
  "model": "claude-sonnet-4-20250514",

  // 类别配置（控制不同 Agent 使用的模型）
  "categories": {
    "quick": {
      "model": "claude-haiku",
      "description": "轻量级快速任务"
    }
  },

  // 禁用特定 Agent
  "disabled_agents": []
}
```

## SDK 嵌入使用

```typescript
import { createVitaminAgent } from '@vitamin/sdk'

const agent = await createVitaminAgent({
  projectDir: process.cwd(),
  model: 'claude-sonnet-4-20250514',
})

// 流式对话
const stream = agent.prompt('重构 auth 模块的错误处理')

for await (const event of stream) {
  switch (event.type) {
    case 'text_delta':
      process.stdout.write(event.text)
      break
    case 'tool_call':
      console.log(`\n🔧 ${event.name}(${JSON.stringify(event.args)})`)
      break
    case 'done':
      console.log(`\n✅ 完成 (${event.result.tokens.input + event.result.tokens.output} tokens)`)
      break
  }
}

await agent.dispose()
```

## 内置命令

在交互模式下，使用斜杠命令：

| 命令 | 说明 |
|------|------|
| `/model <name>` | 切换模型 |
| `/clear` | 清空对话历史 |
| `/compact` | 压缩上下文 |
| `/session list` | 列出会话 |
| `/export` | 导出对话为 HTML |
| `/help` | 显示帮助 |
| `/cost` | 显示费用统计 |

## 多 Agent 编排

Vitamin Coding 内置多个专业 Agent：

| Agent | 职责 | 触发方式 |
|-------|------|---------|
| **Sisyphus** | 主 Agent，处理通用编程任务 | 默认 |
| **Explore** | 代码探索与搜索 | 自动委派 |
| **Oracle** | 文档和知识查询 | 自动委派 |
| **Librarian** | 代码库分析与结构理解 | 自动委派 |
| **Hephaestus** | 复杂编辑和重构 | 自动委派 |
| **Prometheus** | 计划生成（Plan 模式） | `/plan` |
| **Atlas** | 计划执行（多步并行） | `/start-work` |
| **Momus** | 代码审查 | Plan 审批 |
| **Metis** | 预分析和上下文收集 | Plan 管线 |

## 下一步

- 📖 [Extension 开发指南](./extension-guide.md) — 学习如何编写自定义扩展
- 📚 [API 参考](./api-reference.md) — 完整 API 文档
- 🔧 [配置参考](./configuration.md) — 所有配置项说明
- 🏥 运行 `vitamin-coding doctor` 诊断环境问题
