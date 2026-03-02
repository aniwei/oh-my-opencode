# Part 14：TUI 对标 OpenCode 设计

> 版本：v0.1 | 日期：2026-03-02  
> 目标：参考 `anomalyco/opencode` 的交互式终端体验，完善 `@vitamin/tui` 与 `@vitamin/coding-agent` 的接入链路

---

## 1. 设计目标

1. 对齐 OpenCode 在交互链路上的核心原则：输入响应及时、键盘语义稳定、页面切换一致。  
2. 保持 `@vitamin/tui` 的“字符串帧 + 差异渲染”架构，不引入 React/Ink 依赖。  
3. 优先修复交互模式中的关键断点（监听、快捷键调度、键名语义不一致），确保 TUI 可稳定使用。

规范落点：本设计对应 [DEVELOPMENT-SPEC.md §S11.3 与 §S12.4](DEVELOPMENT-SPEC.md#s113-tui-事件循环与输入规范opencode-对齐点)。

---

## 2. OpenCode 参考实现（抽象）

基于 `anomalyco/opencode` 的 TUI 行为可抽象为以下模式：

### 2.1 事件循环先于页面逻辑

- 终端输入监听与 raw mode 生命周期必须显式启动/停止。  
- 页面组件仅处理语义按键，不直接承担底层终端订阅。

### 2.2 键盘语义层（Key Semantic Layer）

- 原始字节序列需先映射为稳定的语义键（如 `ctrl+c`、`tab`、`shift+tab`）。  
- 全局快捷键优先级高于页面局部输入，避免冲突。

### 2.3 页面路由与尺寸同步

- 页面切换应独立于输入组件实现。  
- 终端 resize 后，渲染器和页面宽度需要同时更新，避免布局撕裂。

---

## 3. vitamin-coding 目标架构

### 3.1 三层交互链路

1. **Terminal Layer**：`createTerminal()` 管理 raw mode + data/resize 生命周期。  
2. **Key Routing Layer**：`sequenceToKeyId()` + `KeyBindingRegistry` 处理全局快捷键。  
3. **Page Layer**：`ConversationPage` / `SessionListPage` / `SettingsPage` 处理页面内输入。

执行顺序：`raw input -> key semantic match -> global keybinding -> page.handleInput -> renderFrame`。

### 3.2 语义一致性要求

- Enter 语义统一：页面层必须接受 `enter`（兼容 `return` 别名）。  
- Shift+Tab 语义统一：用于反向页面切换。  
- Ctrl+C 语义统一：若 Agent 在运行则中断，否则退出应用。

### 3.3 可靠性约束

- `start()` 必须调用终端监听启动。  
- `cleanup()` 必须停止监听并恢复终端状态（光标、raw mode）。  
- resize 事件必须同时更新 renderer 与所有页面宽度。

---

## 4. 分阶段落地

### Phase A（本轮）

1. 补齐 interactive 模式事件循环闭环（startListening/stopListening）。  
2. 接入全局快捷键执行链（`sequenceToKeyId -> keyBindings.handle`）。  
3. 修复页面 Enter 键名不一致问题。

### Phase B

1. 引入 TUI 事件总线（输入、渲染、会话事件统一分发）。  
2. 页面级导航状态持久化（最近页面、滚动偏移）。

### Phase C

1. 对齐 OpenCode 的更完整交互能力（命令面板、快捷帮助层、可观测调试面板）。

---

## 5. 验收标准（专项）

1. 交互模式启动后可稳定接收键盘输入与 resize 事件。  
2. 全局快捷键（Ctrl+C/Ctrl+D/Ctrl+L/Tab/Shift+Tab）可被执行。  
3. 页面 Enter 操作在会话页与设置页均可触发。  
4. 文档与计划、SPEC 形成双向链接（本文件 ↔ DEVELOPMENT-PLAN ↔ DEVELOPMENT-SPEC）。

---

## 6. 风险与边界

- 本轮不重写 `@vitamin/tui` 渲染架构，不引入新 UI 框架。  
- 本轮不实现完整会话管理后端，仅保证前端交互链路可用。  
- 本轮以稳定可用为主，复杂交互（命令面板/overlay 工作流）放入后续阶段。
