> [← 返回目录](README.md)

## 第七部分：实施路线图

### Phase 0: 基础设施（2 周）

```
Week 1:
  ├── 初始化 pnpm monorepo
  ├── 配置 Turborepo + tsup + vitest + Biome
  ├── 创建所有包骨架（package.json + tsconfig.json + src/index.ts）
  └── CI/CD 基础 pipeline

Week 2:
  ├── @vitamin/shared — 日志、FS工具、错误类型、事件发射器
  └── @vitamin/config — Schema 定义、JSONC 加载、多级合并
```

### Phase 1: AI + Agent 核心（3 周）

```
Week 3:
  ├── @vitamin/ai — 类型系统、EventStream、模型注册表
  └── @vitamin/ai — Anthropic + OpenAI 适配器

Week 4:
  ├── @vitamin/ai — Google + Ollama 适配器、fallback 链
  ├── @vitamin/ai — Category→Model 解析、费用计算
  └── @vitamin/agent — 核心类型、Agent 类、Agent 循环

Week 5:
  ├── @vitamin/agent — Steering/FollowUp 队列、工具执行器
  └── @vitamin/tools — 工具注册表 + 基础 4 工具 (read, write, edit, bash)
```

### Phase 2: 编排引擎（3 周）

```
Week 6:
  ├── @vitamin/hooks — Hook 引擎、安全执行、核心 Hook
  └── @vitamin/tools — 扩展工具 (grep, glob, find, ls, ast-grep)

Week 7:
  ├── @vitamin/orchestrator — Agent 注册表、task() 调度器
  ├── @vitamin/orchestrator — Category→Agent 映射
  └── @vitamin/orchestrator — 后台 Agent 管理器

Week 8:
  ├── @vitamin/orchestrator — 内置 Agent (sisyphus, explore, oracle, librarian, hephaestus)
  └── @vitamin/orchestrator — 动态 Prompt 构建器
```

### Phase 3: 会话 + 扩展（2 周）

```
Week 9:
  ├── @vitamin/session — JSONL 树存储、SessionManager
  ├── @vitamin/session — 增量压缩策略
  └── @vitamin/extension — ExtensionAPI、ExtensionRunner

Week 10:
  ├── @vitamin/extension — 工具包装器、扩展加载器
  └── @vitamin/mcp — MCP 客户端、三层 MCP 加载
```

### Phase 4: TUI + CLI（3 周）

```
Week 11:
  ├── @vitamin/tui — 差异渲染引擎、终端抽象
  └── @vitamin/tui — 基础组件 (Text, Editor, Markdown, Input)

Week 12:
  ├── @vitamin/tui — 高级组件 (SelectList, Image, Overlay)
  └── @vitamin/coding-agent — AgentSession、系统提示构建

Week 13:
  ├── @vitamin/coding-agent — 交互模式 TUI 应用
  ├── @vitamin/coding-agent — CLI 命令 (run, doctor, install)
  └── @vitamin/sdk — SDK 接口 + RPC 模式
```

### Phase 5: Plan/Build + 高级功能（2 周）

```
Week 14:
  ├── @vitamin/orchestrator — Prometheus (规划) + Momus (审查) + Atlas (执行)
  ├── @vitamin/orchestrator — Plan/Build 管线
  └── 内置扩展: plan-mode, skill-loader

Week 15:
  ├── 内置扩展: git-master, tmux-manager
  ├── E2E 测试套件
  ├── 文档站点
  └── v0.1.0 发布
```

### 里程碑总结

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M0 | Week 2 | 基础设施就绪，可以开始开发 |
| M1 | Week 5 | 单 Agent 可工作（LLM 对话 + 4 基础工具） |
| **MVP** | **Week 5** | **单 Agent CLI 可用——最小可交付产品** |
| M2 | Week 8 | 多 Agent 编排可工作（task() 委派 + 5 Agent） |
| M3 | Week 10 | Extension 系统可用，Session 树可用 |
| M4 | Week 13 | 完整 CLI 产品可用（TUI + SDK） |
| **GA** | **Week 13** | **多 Agent + Extension 可用——正式发布候选** |
| M5 | Week 15 | Plan/Build + 所有高级功能，v0.1.0 发布 |

### 7.1 工期双轨估算（理想 / 保守）

为避免路线图被误读为“承诺排期”，本提案给出双轨估算：

| 范围 | 理想工期（全职、低返工） | 保守工期（含风险缓冲） | 缓冲系数 |
|------|------------------------|------------------------|----------|
| Part 1-6 核心功能 | 15 周 | 19 周 | +25% |
| 10.2 实时日志 | 2 天 | 3 天 | +50% |
| 10.3 Inspector | 15 天 | 20 天 | +33% |
| 10.4 断点系统 | 16 天 | 21 天 | +31% |
| 10.5 Agent 合成 | 22 天 | 29 天 | +32% |
| 10.6 上行反馈 + 协商 | 31 天 | 40 天 | +29% |
| 全量（含试验特性） | 34 周 | 43 周 | +26% |

风险缓冲规则：

1. 设计性特性（Inspector/断点/协商）默认 +30%
2. 外部依赖特性（Wasm 运行时/浏览器沙箱）默认 +40%
3. 跨包联动变更（涉及 3 个以上包）额外 +10%

执行建议：

- 里程碑承诺使用“保守工期”
- 内部冲刺计划使用“理想工期”
- 每完成一个 Phase 后滚动重估剩余工期
