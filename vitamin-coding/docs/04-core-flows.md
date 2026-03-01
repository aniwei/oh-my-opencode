> [← 返回目录](README.md)

## 第四部分：核心流程与数据流

### 4.1 用户输入到 LLM 响应完整流程

```
用户输入 "Fix the login bug in auth.ts"
  │
  ▼
┌─ AgentSession.prompt(text) ─────────────────────────────────────────────┐
│                                                                         │
│  1. Extension 输入拦截                                                   │
│     └── ExtensionRunner.emitInput(text)                                 │
│         ├── Extension 可拦截/转换/取消                                    │
│         └── 斜杠命令检查 (/command → Extension handler)                  │
│                                                                         │
│  2. Skill/Template 展开                                                  │
│     ├── /skill:name → 读取 SKILL.md 注入上下文                           │
│     └── /template → 变量替换                                             │
│                                                                         │
│  3. Steering/FollowUp 检查                                               │
│     └── Agent 正在运行? → 排入 steer/followUp 队列                       │
│                                                                         │
│  4. Hook: chat.message.before                                            │
│     ├── keyword-detection (检测 "plan", "build" 等)                      │
│     ├── first-message-variant (首次消息特殊处理)                          │
│     └── session-recovery (恢复上下文)                                     │
│                                                                         │
│  5. Extension: before_agent_start                                        │
│     └── 可注入额外消息 + 修改系统提示                                      │
│                                                                         │
│  6. Agent.prompt(messages)                                               │
│     └── ↓↓↓                                                             │
└─────────────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─ Agent Loop ────────────────────────────────────────────────────────────┐
│                                                                         │
│  外循环: while(true) — FollowUp 处理                                     │
│  │                                                                       │
│  │  内循环: while(hasToolCalls || pendingMessages) — 工具 + Steering      │
│  │  │                                                                     │
│  │  │  7. Hook: agent.turn.start                                          │
│  │  │                                                                     │
│  │  │  8. transformContext(messages)                                       │
│  │  │     ├── Hook: context.transform (上下文注入)                        │
│  │  │     ├── 增量压缩检查 → 需要时触发压缩                               │
│  │  │     └── Token 预算检查                                              │
│  │  │                                                                     │
│  │  │  9. convertToLlm(agentMessages) → LLM Messages                     │
│  │  │                                                                     │
│  │  │  10. @vitamin/ai stream(model, context)                             │
│  │  │      ├── Provider 适配器 (Anthropic/OpenAI/Google...)               │
│  │  │      ├── Fallback 链 (重试/降级)                                    │
│  │  │      └── StreamEvent 流式输出 → UI 渲染                             │
│  │  │                                                                     │
│  │  │  11. 工具调用?                                                      │
│  │  │      ├── Hook: tool.execute.before (文件守卫, 规则注入)              │
│  │  │      ├── Extension: tool.call (可阻止)                              │
│  │  │      ├── ToolExecutor.execute(toolCall)                             │
│  │  │      ├── Extension: tool.result (可修改)                            │
│  │  │      ├── Hook: tool.execute.after (输出截断, 元数据)                 │
│  │  │      └── 检查 Steering 队列 → 有则中断剩余工具                      │
│  │  │                                                                     │
│  │  │  12. Hook: agent.turn.end                                           │
│  │  │                                                                     │
│  │  └── 检查: stopReason === "end_turn" && 无 Steering?                   │
│  │         ├── YES → 退出内循环                                           │
│  │         └── NO → 继续内循环                                            │
│  │                                                                         │
│  └── 检查 FollowUp 队列                                                   │
│       ├── 有 → 注入 FollowUp 消息，继续外循环                              │
│       └── 无 → 结束                                                       │
│                                                                         │
└─ Agent Loop End ────────────────────────────────────────────────────────┘
  │
  ▼
┌─ 后处理 ────────────────────────────────────────────────────────────────┐
│                                                                         │
│  13. Hook: chat.message.after                                            │
│  14. SessionManager.persist(entries) — 追加写入 JSONL                     │
│  15. Extension: agent.end                                                │
│  16. 费用计算 + 统计更新                                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Plan/Build 模式流程

```
用户: "Refactor the authentication system to use JWT"
  │
  ▼
Sisyphus Intent Gate → 检测到复杂任务
  │
  ▼
task(subagent: "metis", prompt: "Analyze auth refactoring requirements")
  │
  ▼
┌─ Metis 分析 ──────────────────────────────────────┐
│  1. explore agents (背景) → 搜索 auth 相关代码      │
│  2. librarian agents (背景) → 搜索 JWT 最佳实践    │
│  3. 生成复杂度评估 + 上下文摘要                      │
└───────────────────────────────┬────────────────────┘
                                │
                                ▼
task(subagent: "prometheus", prompt: metis_output + user_request)
  │
  ▼
┌─ Prometheus 规划 ─────────────────────────────────┐
│  Phase 1: Interview 需求访谈                       │
│  ├── 自动预研（explore + librarian 并行）          │
│  ├── 向用户提问 → 6 项清关检查                     │
│  └── 记录到 .vitamin/drafts/{name}.md              │
│                                                    │
│  Phase 2: Plan Generation                          │
│  ├── 生成结构化计划                                │
│  ├── 依赖拓扑分析                                  │
│  └── 写入 .vitamin/plans/{name}.md                 │
└───────────────────────────────┬────────────────────┘
                                │
                                ▼
task(subagent: "momus", prompt: plan_file)
  │
  ▼
┌─ Momus 审查 ──────────────────────────────────────┐
│  验证: 可行性 + 完整性 + 风险 + 优化建议            │
│  └── 通过 → 批注计划 / 拒绝 → 反馈给 Prometheus   │
└───────────────────────────────┬────────────────────┘
                                │
                                ▼
/start-work {name} → Atlas 执行
  │
  ▼
┌─ Atlas 并行执行 ──────────────────────────────────┐
│  1. 解析计划步骤 → 构建依赖 DAG                     │
│  2. 拓扑排序 → 确定可并行的步骤组                    │
│  3. 每组步骤:                                       │
│     ├── task(category: "quick") → Haiku 处理简单步骤│
│     ├── task(category: "ui") → Gemini 处理 UI 步骤  │
│     ├── task(category: "deep") → GPT-5.3 深度步骤   │
│     └── 等待依赖完成后启动下一组                     │
│  4. 收集所有步骤结果                                 │
│  5. 生成执行报告                                     │
└────────────────────────────────────────────────────┘
```

### 4.3 多 Agent 编排数据流

```
┌──────────────────────────────────────────────────────────────────┐
│                     统一调度总线 (Task Dispatcher)                 │
│                                                                  │
│     ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐       │
│     │ Category│  │Subagent │  │ Plan/   │  │Background│       │
│     │ Route   │  │ Route   │  │ Build   │  │  Route   │       │
│     └────┬────┘  └────┬────┘  └────┬────┘  └────┬─────┘       │
│          │            │            │            │               │
│     ┌────▼────┐  ┌────▼────┐  ┌────▼────┐  ┌────▼─────┐       │
│     │ Model   │  │ Agent   │  │Pipeline │  │ BG Mgr   │       │
│     │Resolver │  │Registry │  │ Engine  │  │(限流+池) │       │
│     └────┬────┘  └────┬────┘  └────┬────┘  └────┬─────┘       │
│          │            │            │            │               │
│     ┌────▼────────────▼────────────▼────────────▼─────┐         │
│     │              Agent 实例工厂                       │         │
│     │  Agent(model, tools, systemPrompt, hooks)        │         │
│     └──────────────────────┬──────────────────────────┘         │
│                            │                                    │
│     ┌──────────────────────▼──────────────────────────┐         │
│     │             Agent Loop Executor                  │         │
│     │  stream → toolCalls → steering → followUp        │         │
│     └──────────────────────┬──────────────────────────┘         │
│                            │                                    │
│     ┌──────────────────────▼──────────────────────────┐         │
│     │         SessionManager (JSONL Tree)              │         │
│     │  每个 Agent 运行记录持久化到会话树               │         │
│     └─────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────┘
```

### 4.4 Extension 加载与绑定流程

```
vitamin 启动
  │
  ├── ExtensionLoader.discover()
  │   ├── 内置扩展 (packages/coding-agent/src/extensions/)
  │   ├── node_modules/@vitamin/ext-* (npm 发布)
  │   ├── .vitamin/extensions/ (本地扩展)
  │   └── config.extensions.paths[] (配置指定)
  │
  ├── 对每个发现的扩展:
  │   ├── import() 加载模块
  │   ├── 构建 ExtensionAPI 实例
  │   │   ├── 注入: HookEngine 引用
  │   │   ├── 注入: ToolRegistry 引用
  │   │   ├── 注入: AgentSession 引用
  │   │   ├── 注入: ExtensionUIContext (仅 TUI 模式)
  │   │   └── 注入: Config + Logger
  │   └── 调用 extensionFactory(api)
  │       └── 扩展注册事件监听器、工具、命令等
  │
  └── ExtensionRunner 就绪
      ├── 工具注册表已更新（含扩展工具）
      ├── Hook 引擎已更新（含扩展 Hook）
      ├── 命令系统已更新（含扩展命令）
      └── 所有工具已包装（Extension 可拦截）
```
