> [← 返回目录](README.md)

## 第二部分：Monorepo 总体架构

### 2.1 包结构

```
vitamin-coding-agent/
├── pnpm-workspace.yaml
├── package.json                    # Root: scripts, devDependencies
├── tsconfig.base.json              # Base TypeScript config
├── biome.json                      # Linter + Formatter
├── vitest.workspace.ts             # 统一测试配置
├── turbo.json                      # Turborepo 构建编排
│
├── packages/
│   ├── ai/                         # @vitamin/ai         — 统一 LLM API 层
│   ├── agent/                      # @vitamin/agent      — 最小化 Agent 运行时
│   ├── orchestrator/               # @vitamin/orchestrator — 多 Agent 编排引擎
│   ├── tools/                      # @vitamin/tools      — 工具注册表 + 内置工具
│   ├── hooks/                      # @vitamin/hooks      — 生命周期 Hook 引擎
│   ├── extension/                  # @vitamin/extension   — 扩展系统（Hook + UI 控制）
│   ├── session/                    # @vitamin/session    — 会话管理（树结构 + 持久化）
│   ├── config/                     # @vitamin/config     — 多级配置系统
│   ├── mcp/                        # @vitamin/mcp        — MCP 协议支持
│   ├── tui/                        # @vitamin/tui        — 终端 UI 框架
│   ├── coding-agent/               # @vitamin/coding-agent — 主产品 CLI
│   ├── sdk/                        # @vitamin/sdk        — 嵌入式 SDK
│   └── shared/                     # @vitamin/shared     — 共享工具库
│
├── extensions/                     # 官方 Extension 集合
│   ├── plan-mode/                  # Plan/Build 模式（从 oh-my-opencode 移植）
│   ├── git-master/                 # Git 高级操作
│   ├── skill-loader/               # Skill 系统
│   └── tmux-manager/               # Tmux 会话管理
│
├── docs/                           # 文档站点
├── benchmarks/                     # 性能基准测试
└── scripts/                        # 构建/发布脚本
```

### 2.2 包依赖拓扑

```
                         @vitamin/shared (0 dependencies)
                              │
                ┌─────────────┼───────────────┐
                ▼             ▼               ▼
          @vitamin/ai    @vitamin/config   @vitamin/tui
                │             │
                ▼             │
         @vitamin/agent ◄─────┘
           │    │
           │    ▼
           │  @vitamin/hooks
           │    │
           ▼    ▼
      @vitamin/tools
           │
           ▼
    @vitamin/orchestrator
           │
     ┌─────┼──────┐
     ▼     ▼      ▼
@vitamin/ @vitamin/ @vitamin/
session   mcp      extension
     │     │        │
     └─────┼────────┘
           ▼
    @vitamin/coding-agent ──→ @vitamin/tui
           │
           ▼
       @vitamin/sdk
```

### 2.3 技术栈选型

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
