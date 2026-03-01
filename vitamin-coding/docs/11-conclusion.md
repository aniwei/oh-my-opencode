> [← 返回目录](README.md)

## 总结

vitamin-coding-agent 的核心设计思路是：

1. **架构借鉴 pi-mono**：分层包设计确保每层可独立使用，极简 Agent 核心保持清晰
2. **功能继承 oh-my-opencode**：11 Agent 矩阵、Plan/Build、Category→Model、46 Hook、26 工具、三层 MCP——全部保留
3. **独创性整合**：
   - 统一调度总线（Task Dispatcher）统一 category/subagent/background 三种路由
   - 双模式扩展系统（Hook 数据流拦截 + Extension UI 控制）合二为一
   - 增量压缩策略（保留近期原文 + 增量摘要旧消息）
   - Session 树 + 依赖拓扑并行执行
   - SDK-first 设计（CLI/Web/RPC 多前端）

最终目标：**像 pi-mono 一样轻量可组合，像 oh-my-opencode 一样开箱即用**。
