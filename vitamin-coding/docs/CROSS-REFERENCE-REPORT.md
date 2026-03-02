# DEVELOPMENT-PLAN.md 交叉引用分析报告

> 生成日期：2026-03-02  
> 分析范围：14 个特性文档 vs DEVELOPMENT-PLAN.md（1519 行）  
> 分析结论：**09-cloud-deployment.md 整体缺失，需新增 Phase 8；其余 5 处局部缺口需补入现有 Phase**

---

## 一、逐文档覆盖状态总表

| # | 文档 | 行数 | 覆盖状态 | 缺失项数 | 说明 |
|---|------|------|----------|----------|------|
| 1 | 01-design-philosophy.md | 44 | ✅ 完全覆盖 | 0 | 设计原则在计划各 Phase 中忠实落地 |
| 2 | 02-monorepo-architecture.md | 91 | ✅ 完全覆盖 | 0 | 13 包 + 技术栈 + 依赖拓扑完全一致 |
| 3 | 03-package-design.md | 1596 | ✅ 完全覆盖 | 0 | 全部 13 包均有对应 Phase，工具/Agent 全覆盖；SQLite/Gist 已在排除范围声明 |
| 4 | 04-core-flows.md | 210 | ✅ 完全覆盖 | 0 | 4 条核心流程（输入→LLM、Plan/Build、多 Agent、Extension 加载）全覆盖 |
| 5 | 05-extension-system.md | 145 | ⚠️ 部分覆盖 | 1 | Git 来源扩展在 Phase 3 推迟到 v0.2.0，但 Phase 6-7（v0.2.0 范围）中未安排 |
| 6 | 06-engineering.md | 178 | ⚠️ 部分覆盖 | 2 | Changeset 发版流程、vitest workspace 配置细节未体现 |
| 7 | 07-roadmap.md | 136 | ✅ 完全覆盖 | 0 | DEVELOPMENT-PLAN 是路线图的完整展开版，含双轨工期估算 |
| 8 | 08-pi-mono-fusion.md | 1770 | ✅ 完全覆盖 | 0 | 7 个融合点全部在计划中有对应实现（分层包/Agent 运行时/队列/Session 树/Extension UI/SDK/TUI） |
| 9 | **09-cloud-deployment.md** | **1985** | **❌ 完全缺失** | **12** | **整个云端部署系统在计划中无任何提及，甚至未列入排除范围** |
| 10 | 10-experimental.md | 503 | ✅ 完全覆盖 | 0 | Phase 6-7 覆盖全部试验性特性（圆桌/Inspector/断点/合成/冒泡/协商） |
| 11 | 10a-inspector-breakpoints.md | — | ✅ 完全覆盖 | 0 | Phase 6.1-6.4 对应 |
| 12 | 10b-dynamic-agents-escalation.md | — | ✅ 完全覆盖 | 0 | Phase 7.1-7.3 对应 |
| 13 | 10c-validation-testing-slo.md | — | ✅ 完全覆盖 | 0 | Phase 6.5 + 7.4 对应 |
| 14 | api-reference.md / extension-guide.md / quick-start.md | — | ✅ 覆盖 | 0 | Phase 5.3 文档站交付 |

---

## 二、缺失特性详细清单

### 🔴 严重缺失：09-cloud-deployment.md（整体未纳入计划）

09-cloud-deployment.md 是 1985 行的完整云端部署方案，涵盖 10 个章节。在 DEVELOPMENT-PLAN.md 中**零提及**——既未安排进任何 Phase，也未列入"排除范围"声明。

| # | 缺失模块 | 来源章节 | 说明 | 复杂度 | 建议工期 |
|---|----------|----------|------|--------|----------|
| M1 | **SessionStorage 抽象接口** | §9.2 | 从 JSONL 硬编码改为接口注入（`SessionStorage` interface），支持多后端 | 中 | 2 天 |
| M2 | **PostgresStorage 实现** | §9.3 | PostgreSQL 存储后端：5 张表（sessions / session_entries / compaction_records / audit_logs）+ 递归 CTE 树查询 | 高 | 4 天 |
| M3 | **CachedStorage Redis 缓存层** | §9.4 | 装饰器模式：包装任何 SessionStorage，添加 Redis 路径/树/元数据缓存 + Pub/Sub 多实例同步 | 中 | 3 天 |
| M4 | **审计日志 Hook** | §9.5.3 | `cloud:audit-logger` Hook — 所有工具执行记录到 PostgreSQL audit_logs，不可禁用 | 低 | 1 天 |
| M5 | **云端日志配置** | §9.5.1-9.5.2 | Logger 双模式（local: file + pretty / cloud: stdout JSON + redact + trace），Loki/ES 集成 | 低 | 1 天 |
| M6 | **createStorage 工厂** | §9.6 | 根据环境变量（`DATABASE_URL` / `REDIS_URL`）自动选择存储后端，对 SDK 透明 | 低 | 1 天 |
| M7 | **数据生命周期管理** | §9.7 | Hot→Warm→Cold 三级存储 + S3 归档（`SessionArchiver`）+ 恢复功能 | 中 | 3 天 |
| M8 | **Sandbox 抽象接口** | §9.8.1-9.8.2 | `Sandbox` 统一接口（exec + fs + limits + MCP 代理通道），屏蔽底层实现 | 中 | 2 天 |
| M9 | **OS-native Sandbox** | §9.8.3 | Linux cgroups + seccomp + chroot 沙箱后端，命令拦截（含间接执行检测） | 高 | 4 天 |
| M10 | **Server Wasm Sandbox** | §9.8.4 | Wasmtime/WasmEdge WASI 沙箱后端，冷启动 <10ms，能力白名单 | 高 | 5 天 |
| M11 | **Browser Wasm Sandbox** | §9.8.5 | BrowserPod/WebVM 浏览器内沙箱，零服务器成本 | 高 | 5 天 |
| M12 | **CloudConfigSchema** | §9.9 | `cloud` 配置字段（storage_backend / database_url / redis_url / sandbox / audit / logging） | 低 | 1 天 |

**总计**：约 32 天（理想） / 42 天（保守 +30% 缓冲，涉及外部依赖 Wasm/PG/Redis）

---

### 🟡 局部缺失：5 处需补入现有 Phase

| # | 缺失项 | 来源文档 | 当前状态 | 建议归入 | 工期 |
|---|--------|----------|----------|----------|------|
| L1 | **Git 来源扩展加载** | 05-extension-system.md §5.2 | Phase 3 声明"推迟到 v0.2.0"，但 Phase 6-7（v0.2.0 范围）中未安排交付 | Phase 6 或 7 追加 1 个子任务 | 2 天 |
| L2 | **@changesets/cli 版本管理流程** | 06-engineering.md 根 package.json | devDependencies 含 `@changesets/cli`，但计划中无发版流程说明 | Phase 5.3（发布）补充 changeset workflow | 1 天 |
| L3 | **vitest workspace 完整配置** | 06-engineering.md §6.5 | `vitest.workspace.ts` 定义了 workspace 模式，Phase 0 仅提"vitest 配置" | Phase 0.1 验收标准补充 | 0.5 天 |
| L4 | **测试目录规范统一** | 06-engineering.md §6.6 | 文档明确 `packages/<name>/tests/` 独立目录，但 Phase 1-5 验收标准中混用 co-located 描述 | 各 Phase 验收标准统一措辞 | 0 天（仅文档修正） |
| L5 | **xAI/Groq/OpenRouter/DeepSeek Provider 的 OpenAI-compatible 降级路径** | 03-package-design.md §3.1.1，排除范围 | 排除范围声明"通过 OpenAI-compatible 间接支持"，但计划中未体现该降级路径实现 | Phase 1.1（Week 4 Provider 注册表）补充通用 OpenAI-compatible 适配器 | 1 天 |

---

## 三、覆盖文档详细分析

### 3.1 01-design-philosophy.md — ✅ 完全覆盖

6 项设计原则在计划中的映射：

| 原则 | 计划对应 |
|------|---------|
| 分层自治 | 13 包独立发布（Phase 0-4 按依赖层逐层构建） |
| 丰富内置 + 可卸载 | `disabled_*` 配置 + 工具预设 minimal/standard/full（Phase 0.3 + Phase 1.3） |
| 正确模型做正确事 | Category 系统（Phase 1.1）+ Category→Agent 映射（Phase 2.3） |
| 激进可扩展 | Extension 系统（Phase 3.2）+ 5 种来源加载 |
| 渐进复杂度 | 3 种工具预设 + 零配置可运行（Phase 4.2） |
| SDK-first | @vitamin/sdk 4 种模式（Phase 4.3） |

### 3.2 02-monorepo-architecture.md — ✅ 完全覆盖

- 13 个包 + 4 个 extensions 目录结构 → Phase 0 骨架
- 依赖拓扑图 → 计划总览完全一致
- 技术栈选型表（Node 22 / TS 5.7 / pnpm 9 / Turborepo / tsup / vitest / Biome / Zod v4 / Commander / pino / undici）→ Phase 0 全部交付

### 3.3 03-package-design.md — ✅ 完全覆盖

13 个包逐一检查：

| 包 | 设计文档章节 | 计划 Phase | 交付文件匹配 |
|----|------------|-----------|-------------|
| @vitamin/shared | §3.13 | 0.2 | 10/10 文件全覆盖 |
| @vitamin/config | §3.8 | 0.3 | 7/7 文件全覆盖 + 9 子模块 Schema |
| @vitamin/ai | §3.1 | 1.1 | Week 3(8 文件) + Week 4(10 文件) 全覆盖 |
| @vitamin/agent | §3.2 | 1.2 | 6/6 文件全覆盖 |
| @vitamin/tools | §3.4 | 1.3 + 2.2 + 5.2 | minimal(4) → standard(10) → full(26+) 渐进交付 |
| @vitamin/hooks | §3.5 | 2.1 | 14 核心 Hook（Phase 2）+ 剩余随子系统交付（Phase 3-5） |
| @vitamin/orchestrator | §3.3 | 2.3 + 5.1 | Week 7-8(注册表+6 Agent) + Week 14(Plan/Build 5 Agent) |
| @vitamin/session | §3.7 | 3.1 | 9 文件全覆盖；SQLite/Gist 声明推迟 v0.3.0 |
| @vitamin/extension | §3.6 | 3.2 | 4 文件 + 工具包装器全覆盖 |
| @vitamin/mcp | §3.9 | 3.3 | 8 文件全覆盖（三层 MCP + OAuth） |
| @vitamin/tui | §3.10 | 4.1 | Week 11(9 文件) + Week 12(7 文件) 全覆盖 |
| @vitamin/coding-agent | §3.11 | 4.2 | 核心/模式/命令/扩展 4 目录全覆盖 |
| @vitamin/sdk | §3.12 | 4.3 | 4 文件全覆盖（工厂 + stream + RPC） |

特别值得注意的完整工具覆盖：

| 工具类型 | 文件数 | 交付阶段 |
|----------|--------|----------|
| 基础 4 (read/write/edit/bash) | 4 | Phase 1.3 |
| 搜索 6 (grep/glob/find/ls/ast-grep/delegate-task) | 6 | Phase 2.2 |
| 高级 (edit-diff/look-at/interactive-bash/hashline-edit) | 4 | Phase 5.2 |
| 编排 (delegate-task/start-work/background-output/background-cancel/call-agent) | 5 | Phase 5.2 |
| Skill (skill-executor/skill-mcp/skill-loader) | 3 | Phase 5.2 |
| 会话 (session-manager) | 1 | Phase 5.2 |
| 任务 (task-create/task-get/task-list/task-update) | 4 | Phase 5.2 |
| **合计** | **27** | ≥ 26 验收标准已满足 |

### 3.4 04-core-flows.md — ✅ 完全覆盖

4 条数据流全部在计划中有对应实现：
- §4.1 用户输入→LLM 流程（16 步） → Phase 1-3 全链路构建
- §4.2 Plan/Build 流程 → Phase 5.1 完整交付
- §4.3 多 Agent 编排数据流 → Phase 2.3 统一调度总线
- §4.4 Extension 加载与绑定 → Phase 3.2 五源发现 + API 构建

### 3.5 05-extension-system.md — ⚠️ 部分覆盖

| 内容 | 状态 | 说明 |
|------|------|------|
| 基础扩展示例（自定义工具） | ✅ | Phase 3.2 |
| 高级扩展示例（Plan Mode） | ✅ | Phase 5.2 |
| UI 扩展示例（Cost Tracker） | ✅ | Phase 3.2 ExtensionUIContext |
| 5 种扩展来源 | ⚠️ | 内置/npm/local 已覆盖；**Git 来源声明推迟 v0.2.0 但未排入 Phase 6-7** |
| Extension package.json 规范 | ✅ | Phase 3.2 + 5.3 文档 |

**缺口 L1**：Git 来源扩展（`config.extensions.git[]`）在 Phase 3 明确标注"推迟到 v0.2.0"，但 Phase 6-7（v0.2.0 交付范围）中无任何提及。需要在 Phase 6 或 7 中补入一个子任务。

### 3.6 06-engineering.md — ⚠️ 部分覆盖

| 内容 | 状态 | 说明 |
|------|------|------|
| pnpm workspace 配置 | ✅ | Phase 0.1 |
| Turborepo turbo.json | ✅ | Phase 0.1 |
| tsup 构建模板 | ✅ | Phase 0.1 |
| TypeScript tsconfig.base.json | ✅ | Phase 0.1 |
| vitest workspace 配置 | ⚠️ | Phase 0.1 提"vitest 配置"，但未提 workspace 模式细节 (**L3**) |
| 测试策略（4 类型） | ✅ | 单测/集成/E2E/性能 分布在各 Phase |
| 开发规范（11 条） | ✅ | 贯穿全计划的"实现约束"章节 |
| CI/CD pipeline | ✅ | Phase 0.1 |
| @changesets/cli 发版 | ⚠️ | devDependencies 中含 changeset，但计划无发版流程说明 (**L2**) |
| 测试目录位置 | ⚠️ | 文档规定 `packages/<name>/tests/`，计划中用 "单测" 模糊处理 (**L4**) |

### 3.7 07-roadmap.md — ✅ 完全覆盖

DEVELOPMENT-PLAN.md 是 07-roadmap.md 的完整展开版本。路线图中的每个 Week 条目在计划中都有详细交付物和验收标准。额外增加了：
- Phase 6-7（试验性特性，路线图中未定义）
- 每个模块的实现约束（引用 DEVELOPMENT-SPEC.md）
- 验收标准按模块粒度定义（功能/质量/文档三类门槛）
- 双轨工期估算（理想 33 周 / 保守 38 周）

### 3.8 08-pi-mono-fusion.md — ✅ 完全覆盖

7 个融合点与计划对应：

| 融合点 | 计划位置 |
|--------|---------|
| 1. 分层包设计 | Phase 0 骨架（13 包 monorepo） |
| 2. 极简 Agent 运行时 | Phase 1.2（@vitamin/agent，6 文件 Agent Loop） |
| 3. Steering/FollowUp 队列 | Phase 1.2 验收标准 1.2.2-1.2.3 |
| 4. Session 树（分支/导航） | Phase 3.1（JSONL 树 + fork + navigateTo） |
| 5. Extension UI 控制 | Phase 3.2 ExtensionAPI + Phase 4.1 TUI 组件 |
| 6. SDK/RPC 多前端模式 | Phase 4.3（createVitaminAgent + RPC） |
| 7. 差异渲染 TUI | Phase 4.1（DiffRenderer + CSI 2026） |

### 3.9 09-cloud-deployment.md — ❌ 完全缺失

**这是本报告最重要的发现。** 一份 1985 行的完整云端部署方案在开发计划中完全不存在。

该文档包含以下子系统，均未纳入任何 Phase：

```
09-cloud-deployment.md 结构：
├── §9.1  部署架构总览（单机→云端矛盾、单实例架构图）
├── §9.2  Storage Backend 抽象层（SessionStorage interface）
├── §9.3  PostgreSQL 存储（5 张表 SQL Schema + PostgresStorage 实现 + 递归 CTE）
├── §9.4  Redis 缓存层（CachedStorage 装饰器 + 6 种 Key + TTL 策略）
├── §9.5  日志持久化（3 层日志设计 + 审计 Hook + 日志收集架构）
├── §9.6  Storage 工厂（createStorage + inferStorageConfig 自动选择）
├── §9.7  数据生命周期（Hot/Warm/Cold + S3 归档 + 恢复）
├── §9.8  Sandbox 抽象接口 + 3 个后端
│   ├── 9.8.2  Sandbox 统一接口（exec + fs + limits + MCP proxy）
│   ├── 9.8.3  OS-native（cgroups + seccomp + chroot）
│   ├── 9.8.4  Server Wasm（Wasmtime/WasmEdge + WASI）
│   ├── 9.8.5  Browser Wasm（BrowserPod/WebVM）
│   ├── 9.8.6  Sandbox 工厂（自动检测最佳后端）
│   └── 9.8.7  沙箱工具创建（createSandboxedTools）
├── §9.9  CloudConfigSchema（Zod v4）
└── §9.10 云端 vs 单机对照表
```

**新增包需求**：
- `@vitamin/sandbox`（或作为 `@vitamin/tools` 的子模块）
- PostgresStorage / CachedStorage（扩展 `@vitamin/session`）
- CloudConfigSchema（扩展 `@vitamin/config`）

### 3.10 10-experimental.md + 分册 A/B/C — ✅ 完全覆盖

Phase 6-7 与 Part 10 的映射极为精确：

| Part 10 章节 | Phase | 工期 |
|-------------|-------|------|
| 10.1 三模式圆桌 | 6.3 (Week 18-20) | 11 天 |
| 10.2 实时日志 | 6.1 (Week 16-17) | 8 天 |
| 10.3 Inspector | 6.2 (Week 18-20) | 10 天 |
| 10.4 断点调试 | 6.4 (Week 21-23) | 12 天 |
| 10.5 Agent 合成 | 7.1 (Week 26-29) | 14 天 |
| 10.6 上行反馈冒泡 | 7.2 (Week 30-32) | 12 天 |
| 10.6.16 同级协商 | 7.3 (Week 32-33) | 5 天 |
| 10.8 性能基准 | 6.5 (Week 24-25) | 8 天 |
| 10.9 测试策略 | 7.4 (Week 33) | 5 天 |
| 10.10 错误重试 | 6.5 (Week 24-25) | 含在 8 天中 |

---

## 四、建议方案

### 方案 A：新增 Phase 8 — 云端部署与沙箱（推荐）

将 09-cloud-deployment.md 的内容作为**独立 Phase 8**（v0.3.0 范围）安排在 Phase 7 之后：

```
Phase 8：云端部署与沙箱（Week 34-41）
├── 8.1 Storage Backend 抽象层改造          Week 34         2 天
│   ├── SessionStorage interface 定义
│   ├── @vitamin/session 改造为接口注入
│   └── createStorage 工厂 + inferStorageConfig
│
├── 8.2 PostgreSQL 存储后端                  Week 34-35      4 天
│   ├── SQL Schema（5 张表 + 索引）
│   ├── PostgresStorage 实现
│   ├── 数据库迁移脚本
│   └── 递归 CTE 树查询优化
│
├── 8.3 Redis 缓存层                        Week 35-36      3 天
│   ├── CachedStorage 装饰器
│   ├── 6 种 Key 策略 + TTL
│   └── Pub/Sub 多实例通知
│
├── 8.4 云端日志 + 审计                      Week 36         2 天
│   ├── Logger 双模式（local/cloud）
│   ├── cloud:audit-logger Hook
│   └── CloudConfigSchema
│
├── 8.5 数据生命周期                         Week 37         3 天
│   ├── SessionArchiver（S3 归档 + 恢复）
│   └── Hot/Warm/Cold 分层策略
│
├── 8.6 Sandbox 抽象 + OS-native             Week 38-39      6 天
│   ├── Sandbox 统一接口
│   ├── SandboxFileSystem + SandboxMcpProxy
│   ├── OsNativeSandbox（cgroups + seccomp）
│   ├── createSandboxedTools
│   └── Sandbox 工厂 + 自动检测
│
├── 8.7 Server Wasm Sandbox                  Week 39-40      5 天
│   ├── ServerWasmSandbox（Wasmtime/WasmEdge）
│   ├── WASI 能力白名单
│   └── Fuel 机制 CPU 限制
│
├── 8.8 Browser Wasm Sandbox                 Week 40-41      5 天
│   ├── BrowserWasmSandbox（BrowserPod/WebVM）
│   ├── 虚拟文件系统适配
│   └── Web 前端集成
│
└── 8.9 集成测试 + 文档                      Week 41         2 天
    ├── Docker Compose 示例
    ├── 云端 E2E 测试
    └── 部署指南
```

**工期估算**：
- 理想：8 周（Week 34-41）
- 保守：10.5 周（+30%，涉及 PG/Redis/Wasm 外部依赖）
- 新增总工期：Phase 0-8 理想 41 周 / 保守 48.5 周

### 方案 B：拆分并入现有 Phase（替代方案）

如果不想延长总工期，可将云端部署分为两批：

| 批次 | 范围 | 归入 Phase | 额外工期 |
|------|------|-----------|----------|
| 批次 1：存储抽象 | M1 + M6 + M12 | Phase 3（Session + config） | +4 天 |
| 批次 2：PG + Redis | M2 + M3 + M4 + M5 | Phase 5 或 v0.2.0 早期 | +9 天 |
| 批次 3：数据生命周期 | M7 | v0.2.0 | +3 天 |
| 批次 4：Sandbox | M8 + M9 + M10 + M11 | v0.3.0 | +16 天 |

**方案 B 的问题**：Sandbox 系统工期长（16 天）且涉及 Wasm 外部依赖（+40% 风险缓冲→22 天），单独推到 v0.3.0 可能导致云端部署长期缺乏工具隔离能力。

### 局部缺口修复

| 缺口 | 修复动作 | 影响范围 |
|------|---------|----------|
| L1: Git 来源扩展 | Phase 6 或 7 追加子任务（extension-loader.ts 增加 git clone + watch） | +2 天 |
| L2: Changeset 发版流程 | Phase 5.3 补充 changeset init + 发版步骤 | +1 天 |
| L3: vitest workspace | Phase 0.1 验收标准增加 `vitest.workspace.ts` 验证 | +0.5 天 |
| L4: 测试目录规范 | 纯文档修正，各 Phase 统一为 `packages/<name>/tests/` | 0 天 |
| L5: OpenAI-compatible 通用适配器 | Phase 1.1 Week 4 补充一个通用适配器用于 xAI/Groq/OpenRouter/DeepSeek | +1 天 |

---

## 五、排除范围声明修正建议

当前 DEVELOPMENT-PLAN.md 的"排除范围"章节列出了 5 项推迟到 v0.3.0+ 的特性。建议补充以下条目（如采用方案 A）：

```markdown
## 排除范围（v0.2.0 不包含）— 建议追加

| 特性 | 来源 | 推迟原因 |
|------|------|---------|
| 云端部署（PG + Redis + 审计） | 09-cloud-deployment.md §9.1-§9.7 | 需要独立 Phase，v0.3.0 交付 |
| Sandbox 系统（3 后端） | 09-cloud-deployment.md §9.8 | 涉及 Wasm 外部依赖，v0.3.0 交付 |
| Browser Wasm 前端模式 | 09-cloud-deployment.md §9.8.5 | 浏览器 Wasm 生态尚在成熟，v0.4.0+ |
| Git 来源扩展加载 | 05-extension-system.md §5.2 | v0.2.0 安排 |
```

或者如果确认 09 的内容将在 Phase 8 交付，则应在"排除范围"中移除大部分 09 项目，仅保留 Browser Wasm（作为最后优先级）。

---

## 六、结论

| 指标 | 数值 |
|------|------|
| 文档覆盖率 | 11/14 完全覆盖，2/14 部分覆盖，**1/14 完全缺失** |
| 缺失特性总数 | 12 个（严重）+ 5 个（局部） |
| 缺失工期影响 | +32 天（理想）/ +42 天（保守） |
| 建议措施 | 新增 Phase 8（v0.3.0）承接 09-cloud-deployment.md |

DEVELOPMENT-PLAN.md 对核心功能（Phase 0-5）和试验性特性（Phase 6-7）的覆盖极为完整，每个包的交付物、验收标准、实现约束都有详细定义。唯一的重大遗漏是 **09-cloud-deployment.md 整体缺失**——这份 1985 行的云端部署方案涉及存储抽象、PostgreSQL、Redis、审计日志、数据归档和 3 种 Sandbox 后端，需要一个专门的 Phase 来承接。
