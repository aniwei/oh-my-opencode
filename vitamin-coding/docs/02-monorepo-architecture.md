> [← 返回目录](README.md)

## 第二部分：Monorepo 总体架构

> 核验日期：2026-03-09（基于 `vitamin-coding/packages` 实际目录）

### 2.1 包结构

```
vitamin-coding-agent/
├── pnpm-workspace.yaml
├── package.json                    # Root: scripts, devDependencies
├── tsconfig.base.json              # Base TypeScript config
├── biome.json                      # Linter + Formatter
├── vitest.config.ts                # 统一测试配置
├── turbo.json                      # Turborepo 构建编排
│
├── packages/
│   ├── ai/                         # @vitamin/ai         — 统一 LLM API 层
│   ├── agent/                      # @vitamin/agent      — 最小化 Agent 运行时
│   ├── orchestrator/               # @vitamin/orchestrator — 多 Agent 编排引擎
│   ├── tools/                      # @vitamin/tools      — 工具注册表 + 内置工具
│   ├── hooks/                      # @vitamin/hooks      — 生命周期 Hook 引擎
│   ├── extension/                  # @vitamin/extension  — 扩展系统（Hook + 工具接入）
│   ├── session/                    # @vitamin/session    — 会话管理（树结构 + 持久化）
│   ├── config/                     # @vitamin/config     — 多级配置系统
│   ├── mcp/                        # @vitamin/mcp        — MCP 协议支持
│   ├── server/                     # @vitamin/server     — Inspector HTTP/WebSocket 服务
│   ├── ui-kit/                     # @vitamin/ui-kit     — React UI 组件库
│   ├── web-ui/                     # @vitamin/web-ui     — Inspector/Web 前端
│   ├── coding-agent/               # @vitamin/coding-agent — 主产品 CLI
│   ├── sdk/                        # @vitamin/sdk        — 嵌入式 SDK
│   └── shared/                     # @vitamin/shared     — 共享工具库
│
├── docs/                           # 文档站点
├── benchmarks/                     # 性能基准测试
└── scripts/                        # 构建/发布脚本
```

当前是 **15 包** 架构，不包含独立 `@vitamin/tui` 包。交互层能力目前位于：

- `@vitamin/coding-agent`：Interactive 模式（Ink）
- `@vitamin/web-ui`：Web 客户端
- `@vitamin/server`：Inspector API + WebSocket + 静态资源托管
- `@vitamin/ui-kit`：共享 UI 组件

### 2.2 包依赖拓扑

```
                      @vitamin/shared
                 ┌──────────┴──────────┐
                 ▼                     ▼
          @vitamin/config         @vitamin/ai
                 │                     │
                 └──────────┬──────────┘
                            ▼
                      @vitamin/agent
                   ┌────────┼─────────┐
                   ▼        ▼         ▼
           @vitamin/hooks @vitamin/tools @vitamin/session
                                │
                                ▼
                       @vitamin/orchestrator
                         ┌──────┴──────┐
                         ▼             ▼
                   @vitamin/mcp   @vitamin/extension

      交互与对外层：
      @vitamin/coding-agent (interactive/print/json/rpc)
      @vitamin/sdk          (embeddable + rpc client/server)
      @vitamin/server       (inspector api + ws + static)
      @vitamin/ui-kit       (shared react components)
      @vitamin/web-ui       (browser frontend)
```

### 2.3 与 pi-mono / oh-my-opencode 的结合定位

- 来自 **pi-mono**：分层包思路、`Agent` 双队列（steering/followUp）、SDK/RPC 双通道。
- 来自 **oh-my-opencode**：多 Agent 编排、Plan/Build、三层 MCP 优先级（builtin/user/skill）。
- vitamin 的落地策略：保持运行时可嵌入（pi-mono 优势），同时保留编排复杂度与工作流治理（oh-my-opencode 优势）。

### 2.4 技术栈选型

| 层面 | 选择 | 理由 |
|------|------|------|
| **Runtime** | Node.js 22+ | 用户要求；LTS；原生 ESM；`--experimental-strip-types` 支持 TS 直接运行 |
| **Language** | TypeScript 5.7+ | 严格模式；`satisfies`；装饰器 |
| **Package Manager** | pnpm 9+ | 用户要求；严格依赖；workspace protocol |
| **Monorepo 编排** | Turborepo | 增量构建；远程缓存；拓扑排序 |
| **构建** | tsup (esbuild) | ESM + CJS 双输出；声明文件；tree-shaking |
| **测试** | vitest | 快速；workspace 模式；coverage；与 TypeScript 天然集成 |
| **Lint/Format** | Biome | 比 ESLint+Prettier 快 25x；零配置 |
| **Schema 验证** | Zod v4 | oh-my-opencode 已验证；JSON Schema 导出；coerce |
| **CLI 框架** | Commander.js | 成熟；子命令；自动帮助 |
| **日志** | pino | 结构化 JSON 日志；低开销 |
| **HTTP 客户端** | undici (原生 fetch) | Node.js 内置；性能优于 axios |
