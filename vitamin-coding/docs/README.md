# vitamin-coding-agent 技术方案

> 版本：v0.1.0-draft | 日期：2026-02-27
> 定位：基于 Node.js 的下一代 AI 编码代理框架

---

## 文档结构

本方案按模块拆分为独立文档，便于按需阅读和协作维护。

| 文档 | 内容 | 行数 |
|------|------|------|
| [01-design-philosophy.md](01-design-philosophy.md) | 第一部分：设计理念与定位 | ~44 |
| [02-monorepo-architecture.md](02-monorepo-architecture.md) | 第二部分：Monorepo 总体架构 | ~91 |
| [03-package-design.md](03-package-design.md) | 第三部分：各包详细设计 | ~1596 |
| [04-core-flows.md](04-core-flows.md) | 第四部分：核心流程与数据流 | ~210 |
| [05-extension-system.md](05-extension-system.md) | 第五部分：扩展系统设计 | ~145 |
| [06-engineering.md](06-engineering.md) | 第六部分：工程基建与开发规范 | ~174 |
| [07-roadmap.md](07-roadmap.md) | 第七部分：实施路线图 | ~136 |
| [08-pi-mono-fusion.md](08-pi-mono-fusion.md) | 第八部分：pi-mono 融合详解——原因、目的与实现 | ~1770 |
| [09-cloud-deployment.md](09-cloud-deployment.md) | 第九部分：云端部署——数据持久化与缓存 | ~1985 |
| [10-experimental.md](10-experimental.md) | 第十部分：试验性特性讨论 | ~504 |
| [11-conclusion.md](11-conclusion.md) | 总结 | ~14 |

### 第十部分分册

| 分册 | 覆盖范围 |
|------|----------|
| [10a-inspector-breakpoints.md](10a-inspector-breakpoints.md) | 10.2 日志推送 + 10.3 Inspector + 10.4 断点 |
| [10b-dynamic-agents-escalation.md](10b-dynamic-agents-escalation.md) | 10.5 Agent 合成 + 10.5.15 配置 Schema + 10.6 上行反馈 |
| [10c-validation-testing-slo.md](10c-validation-testing-slo.md) | 10.8 性能基准 + 10.9 测试策略 + 10.10 错误路径 |

### 开发计划

| 文档 | 说明 |
|------|------|
| [DEVELOPMENT-PLAN.md](DEVELOPMENT-PLAN.md) | 按 Phase/模块拆分的开发计划，含验收标准 |

---

## 快速导读

- **架构评审者**：先读 [01](01-design-philosophy.md) → [02](02-monorepo-architecture.md) → [03](03-package-design.md) → [04](04-core-flows.md)
- **扩展开发者**：[05](05-extension-system.md) → [03](03-package-design.md)（重点 3.5~3.6）
- **DevOps / SRE**：[09](09-cloud-deployment.md) → [06](06-engineering.md)
- **试验性探索**：[10](10-experimental.md) → 分册 A/B/C
- **实施规划**：[07](07-roadmap.md) → [08](08-pi-mono-fusion.md)

## 维护原则

1. 每个文件对应一个独立模块，避免跨文件内容重复
2. 跨模块引用使用「文件名 + 节编号」双锚点
3. PR 修改某模块时，仅需 review 对应文件
4. 分册承载完整实现细节，主模块文件保留架构决策与最小示例
