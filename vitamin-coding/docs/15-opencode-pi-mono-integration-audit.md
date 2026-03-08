# Part 15：OpenCode + pi-mono 融合审计与文档重构蓝图

> 版本：v0.1 | 日期：2026-03-09
> 范围：`analysis/` 全量文档 + `anomalyco/opencode` + `badlogic/pi-mono` + vitamin 当前源码

---

## 1. 审计输入来源

1. `analysis/` 全量 Markdown（00-11 + 报告类文档）
2. `anomalyco/opencode`（README、AGENTS、CONTRIBUTING 等公开文档）
3. `badlogic/pi-mono`（README、`packages/ai`、`packages/agent`、`packages/coding-agent`）
4. vitamin 当前实现（重点：`packages/agent`、`packages/orchestrator`、`packages/mcp`、`packages/coding-agent`、`packages/sdk`、`packages/server`）

---

## 2. 关键结论（先结论后细节）

1. vitamin 的核心方向正确：已经形成“pi-mono 可嵌入运行时 + oh-my-opencode 复杂编排”的组合骨架。
2. 文档最大问题不是技术路线，而是“设计文档状态”与“源码状态”混写，导致读者无法区分“已实现”与“目标态”。
3. 需要把文档改成双层表达：
- `Implemented`：仅写可在源码中直接验证的事实
- `Planned`：写目标方案、风险、里程碑，不伪装成已实现

---

## 3. 融合点核验（组合视角）

| 主题 | 来自 pi-mono | 来自 oh-my-opencode | vitamin 当前状态 |
|---|---|---|---|
| 运行时可嵌入 | SDK/RPC/多模式 | 插件生态兼容 | 已实现（`coding-agent` + `sdk`） |
| Agent 循环控制 | steering/followUp 队列 | 任务治理与守卫 | 已实现（双队列 + Plan Family guard） |
| 编排复杂度 | 扩展优先、核心精简 | 多 Agent + Plan/Build | 已实现关键骨架（`orchestrator`） |
| MCP 策略 | 倾向外置扩展 | 三层 MCP（builtin/user/skill） | 已实现（`mcp` 类型与注册表） |
| 交互层形态 | 终端交互可编程 | client/server 可观测 | 已实现组合形态（interactive + server + web-ui） |

---

## 4. 文档层面的结构性问题

1. 包结构叙述过时
- 旧文档长期使用“13 包 + 独立 `@vitamin/tui`”叙述。
- 当前真实目录是 15 包，且没有独立 `@vitamin/tui`。

2. 交互文档假设与实现不一致
- 旧文档把交互层绑定到不存在的独立包。
- 当前实现是 `coding-agent interactive` + `server` + `web-ui` + `ui-kit`。

3. 融合文档缺少“核验层”
- 只讲理念与对标，不标注“已实现/计划中”。
- 评审和执行会把计划误读为完成状态。

---

## 5. 已执行修订（本轮）

1. `02-monorepo-architecture.md`
- 更新为真实 15 包结构
- 替换错误依赖拓扑
- 明确 pi-mono + oh-my-opencode 的组合定位

2. `08-pi-mono-fusion.md`
- 修正融合总览中的失真项
- 新增 8.1.1 源码核验矩阵

3. `14-tui-opencode-alignment.md`
- 重写为“交互层对标 OpenCode”
- 从虚构的独立 TUI 包切换到真实三端架构

4. `README.md`
- 更新 14 的描述
- 增加“融合审计”阅读路径

---

## 6. 下一步文档治理建议

1. 在 `03-package-design.md` 增加每章状态头
- `Status: Implemented | Partial | Planned`
- `Evidence: path/to/source`

2. 建立“文档一致性检查”
- 对 `packages/*` 目录自动生成包清单
- 与文档声称的包列表比对，CI 中提示漂移

3. 给每个“对标章节”增加同构矩阵
- 列：`source project` / `borrowed idea` / `vitamin adaptation` / `code evidence` / `gap`

4. 将第 10 部分实验性内容区分为两类
- 已落地实验能力（可用）
- 研究中能力（不可承诺）

### 6.1 待同步文件清单（已识别）

以下文档仍包含“13 包”或“独立 `@vitamin/tui` 已落地”叙述，建议后续批次统一修订：

1. `vitamin-coding/docs/03-package-design.md`
2. `vitamin-coding/docs/07-roadmap.md`
3. `vitamin-coding/docs/12-web-ui.md`
4. `vitamin-coding/docs/DEVELOPMENT-PLAN.md`
5. `vitamin-coding/docs/DEVELOPMENT-SPEC.md`
6. `vitamin-coding/docs/api-reference.md`
7. `vitamin-coding/docs/CROSS-REFERENCE-REPORT.md`

---

## 7. 风险与边界

1. 本文档仅覆盖当前仓库和公开文档可见信息，不替代运行时行为测试。
2. 某些章节仍有示例代码与实际 API 命名不一致问题，建议后续统一用可编译片段替换。
3. 交互层后续是否拆出独立 `@vitamin/tui`，应由阶段目标与维护成本共同决定，不应先文档化为既成事实。
