# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2025-07-21

### 🎉 Initial Release

Vitamin Coding v0.1.0 — 首个公开版本。多 Agent 编排的 AI 编程助手框架。

### ✨ 核心功能

- **13 个 npm 包** — 分层架构，每层职责清晰
  - `@vitamin/shared` — 公共工具（Logger、Error、Path）
  - `@vitamin/ai` — 统一 LLM API（6 个 Provider、Fallback 链、费用追踪）
  - `@vitamin/config` — JSONC 配置加载 + Zod v4 验证
  - `@vitamin/agent` — Agent 核心循环（prompt → tool → response）
  - `@vitamin/tools` — 26 个内置工具 + 3 层 preset（minimal/standard/full）
  - `@vitamin/hooks` — 18 事件 × 优先级 Hook 引擎
  - `@vitamin/session` — 会话管理（JSONL 存储、3 种压缩策略、HTML 导出）
  - `@vitamin/orchestrator` — 多 Agent 编排（注册表、委派、DAG 执行、Plan-Build）
  - `@vitamin/extension` — 扩展系统（加载、事件总线、4 个内置 Extension）
  - `@vitamin/mcp` — MCP 协议支持（stdio + HTTP 传输、OAuth、Skill MCP）
  - `@vitamin/tui` — 终端 UI（Ink 组件）
  - `@vitamin/coding-agent` — CLI 入口 + AgentSession + 7 内置命令
  - `@vitamin/sdk` — 嵌入式 SDK（VitaminAgent、AgentStream、JSON-RPC）

### 🤖 多 Agent 编排

- **13 个专业 Agent** — Sisyphus（主）、Explore、Oracle、Librarian、Hephaestus、Prometheus、Atlas、Momus、Metis、Sisyphus-Junior、Multimodal-Looker
- **Plan-Build 管线** — Metis 预分析 → Prometheus 规划 → Momus 审查 → Atlas DAG 执行
- **自动委派** — CategoryResolver 根据任务类型和 Agent 特长自动路由
- **后台执行** — BackgroundManager 支持并行后台任务

### 🔧 工具系统

- **26 个内置工具** — 文件读写、代码编辑（exact + fuzzy + hashline）、Bash 执行、图片查看、AST-Grep、任务管理
- **3 层 preset** — minimal(4) ⊂ standard(10) ⊂ full(26)
- **edit-diff** — 支持精确匹配和模糊匹配的文件编辑工具
- **hashline-edit** — 基于行哈希的精确行替换

### 🔌 扩展系统

- **4 个内置 Extension** — Plan Mode、Skill Loader、Git Master、Tmux Manager
- **事件总线** — 18 个类型化事件 + 自定义扩展间通信
- **工具拦截** — 拦截/修改工具调用和结果

### 🌐 MCP 支持

- **双传输** — stdio + HTTP
- **三层优先级** — builtin > user > skill
- **OAuth 管理** — 自动 token 刷新
- **Skill MCP** — 从 SKILL.md YAML 自动加载

### 📊 会话管理

- **JSONL 存储** — 高效追加写入
- **3 种压缩策略** — Summary、Sliding Window、Incremental
- **Todo 保留** — 压缩时自动保留未完成任务
- **HTML 导出** — 导出为可分享的 HTML 文件

### 🎯 LLM 支持

- **6 个 Provider** — Anthropic、OpenAI(Completions)、OpenAI(Responses)、Google、Bedrock、Ollama
- **Fallback 链** — 自动重试 + 跨 Provider 降级
- **费用追踪** — 实时费用计算和统计
- **Model Resolver** — 3 步模型解析（override → category → fallback）

### 🧪 测试

- **800+ 单元测试** — 全部通过
- **15 个 E2E 集成测试** — 覆盖完整对话、工具、多 Agent、Plan-Build、Session、MCP、Extension
- **覆盖率 ≥ 80%** — v8 Provider

### 📚 文档

- 快速开始指南（5 分钟上手）
- Extension 开发指南（3 个完整示例）
- API 参考（13 个包全覆盖）
- 设计文档（11 章 + 开发规范）
