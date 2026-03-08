# Part 14：交互层对标 OpenCode 设计

> 版本：v0.2 | 日期：2026-03-09  
> 目标：参考 `anomalyco/opencode` 的交互链路，统一 vitamin 当前的终端交互、Inspector 服务与 Web UI 设计

---

## 1. 现状澄清（先于设计）

当前仓库中不存在独立 `@vitamin/tui` 包。交互相关能力分布如下：

1. `@vitamin/coding-agent`：Interactive 模式（Ink）
2. `@vitamin/server`：Inspector HTTP/WebSocket 与静态资源托管
3. `@vitamin/web-ui`：浏览器端 UI
4. `@vitamin/ui-kit`：共享 React 组件

关键证据：

- `vitamin-coding/packages/coding-agent/src/modes/interactive/index.tsx`
- `vitamin-coding/packages/server/src/http-server.ts`

因此本章从“独立 TUI 包设计”调整为“交互层整体架构设计”。

---

## 2. OpenCode 参考实现（抽象）

基于 `anomalyco/opencode` README 与贡献文档，可抽象出以下原则：

### 2.1 client/server 分离

- TUI 只是 client 之一，后端能力可被 Web/桌面等客户端复用。
- 协议与会话管理优先稳定，再考虑 UI 外观演进。

### 2.2 键盘与命令语义稳定

- 交互系统先定义输入语义，再由页面消费。
- 模式切换和中断逻辑要统一，避免“同一按键在不同页面语义冲突”。

### 2.3 可观测与调试优先

- 需要可独立运行的服务层（健康检查、日志流、会话接口）。
- 前端应通过明确 API 获取状态，而非直接耦合内部运行时。

---

## 3. vitamin 目标架构（pi-mono + oh-my-opencode 结合）

### 3.1 三端统一交互面

1. 终端端：`coding-agent interactive`（pi-mono 风格可编程交互）
2. 服务端：`server`（oh-my-opencode 风格 Inspector/日志/会话观测）
3. Web 端：`web-ui + ui-kit`（对接服务端 API）

### 3.2 统一能力边界

- `coding-agent` 负责本地交互与模式调度（print/json/rpc/interactive）。
- `sdk` 提供可嵌入 API 与 RPC client/server。
- `server` 负责 HTTP/WS、日志回放与实时流、会话接口聚合。
- `web-ui` 负责展示与操作，不直接持有底层 agent 执行权。

### 3.3 对齐策略

- 吸收 **pi-mono**：四模式运行、SDK/RPC、可嵌入优先。
- 吸收 **oh-my-opencode**：Inspector 观测链路、会话/日志 API 组织方式。

---

## 4. 分阶段落地

### Phase A（已完成/在库）

1. 交互模式入口已落地：`coding-agent` 的 `interactive` 模式。
2. 多模式并存已落地：`print/json/rpc/interactive`。
3. Inspector 服务已落地：`/api/health`、日志流、会话/模型等 API。

### Phase B（短期）

1. 将终端快捷键语义与 Web 快捷操作抽象成统一命令层。
2. 将 Inspector 事件模型与 SDK 事件模型对齐（事件字段统一）。
3. 增加交互链路回归测试（输入中断、模式切换、流式输出）。

### Phase C（中期）

1. 评估是否拆分独立 `@vitamin/tui` 包。
2. 如果拆分，保持 `coding-agent` 仅编排，不再承载具体 UI 实现细节。
3. 支持更完整的调试面板能力（断点、重放、事件过滤）。

---

## 5. 验收标准（专项）

1. 终端与 Web 端可共享同一套核心会话/日志语义。
2. `sdk rpc` 与 `coding-agent --rpc` 的协议行为一致。
3. Inspector API 可独立被第三方客户端消费。
4. 文档不再出现“已实现独立 `@vitamin/tui`”的表述偏差。

---

## 6. 风险与边界

1. 本轮不承诺独立 `@vitamin/tui` 包交付。
2. 本轮重点是“交互层统一抽象”，不是重写 UI 技术栈。
3. 若未来拆包，需要优先保证现有 `coding-agent` 交互兼容性。
