# Part 10 分册索引

本目录用于承载 `09-vitamin-coding-agent-technical-proposal.md` 第十部分的拆分文档。

## 分册列表

- [A: Inspector 与断点系统](./10a-inspector-breakpoints.md)
  - 来源章节：10.2 + 10.3 + 10.4
  - 目标读者：平台开发、前端调试工具开发
- [B: 动态 Agent 与上行反馈](./10b-dynamic-agents-escalation.md)
  - 来源章节：10.5 + 10.6
  - 目标读者：编排引擎、Agent Runtime 开发
- [C: 验证、测试与 SLO](./10c-validation-testing-slo.md)
  - 来源章节：10.8 + 10.9 + 10.10
  - 目标读者：测试工程、SRE

## 迁移规则

1. 主提案保留：架构决策、核心接口、最小示例。
2. 分册承载：完整实现草案、流程细节、边界条件。
3. 每次改动先改分册，再回填主提案摘要。
4. 跨分册引用格式：`文档名 + 节编号`（例如 `10b §10.6.16`）。
