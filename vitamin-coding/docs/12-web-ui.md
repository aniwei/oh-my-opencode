# 第十二部分：Web UI — 浏览器端交互界面

> 新增包：`@vitamin/web-ui`（17 号包）
> 技术栈：React 19 + TypeScript + Vite + Mantine v7
> 定位：vitamin-coding-agent 的浏览器端客户端，作为 TUI 的 Web 替代方案

---

## 12.1 设计目标与定位

### 12.1.1 产品定位

vitamin-coding-agent 当前拥有两种交互界面：

| 界面 | 技术 | 场景 |
|------|------|------|
| TUI（`@vitamin/tui`） | 自研差异渲染 + CSI 2026 | 终端原生用户、SSH 远程、CI/CD |
| DevTools Inspector（`@vitamin/server`） | React + Vite（内嵌） | 开发调试、Agent 状态观测 |

Web UI 作为**第三种界面**，面向以下场景：

- **浏览器原生用户**：偏好图形界面，不习惯终端操作
- **团队协作**：多人共享同一云端实例，通过浏览器访问
- **教育/演示**：零安装体验，分享链接即可使用
- **移动端轻量访问**：平板/手机查看 Agent 执行状态与历史
- **云端部署前端**：配合 Phase 8 云端部署（`@vitamin/cloud` + `@vitamin/sandbox`）提供完整 Web 体验

### 12.1.2 设计原则

1. **对话优先**：核心交互为 AI 对话，所有功能围绕对话流展开
2. **实时响应**：流式输出 + 工具执行进度实时展示
3. **深色主题优先**：以深色为默认，支持浅色切换
4. **渐进增强**：基础对话即可用，高级功能（文件管理、Agent 面板）按需展开
5. **移动端适配**：响应式布局，小屏设备自动折叠侧边栏

---

## 12.2 UI 架构与布局

### 12.2.1 三栏布局

参考 Kimi 等现代 AI 助手界面，采用经典三栏布局：

```
┌──────────────────────────────────────────────────────────┐
│                        顶部栏                             │
│  Logo + 模型选择下拉 + 设置齿轮 + 用户头像               │
├──────────┬──────────────────────────────┬────────────────┤
│          │                              │                │
│  左侧栏   │        主对话区              │   右侧栏       │
│  240px   │        flex-1               │   320px        │
│          │                              │                │
│ ┌──────┐ │ ┌──────────────────────────┐ │ ┌────────────┐ │
│ │新对话 │ │ │  消息流（流式渲染）       │ │ │ 文件面板    │ │
│ │      │ │ │                          │ │ │            │ │
│ │搜索框 │ │ │  • User 消息             │ │ │ • 生成文件  │ │
│ │      │ │ │  • Assistant 消息         │ │ │ • 代码差异  │ │
│ │历史   │ │ │    - Thinking 折叠块     │ │ │ • 下载操作  │ │
│ │ 会话1 │ │ │    - 代码块 + 复制       │ │ │            │ │
│ │ 会话2 │ │ │    - 工具调用卡片        │ │ │ Agent 面板  │ │
│ │ 会话3 │ │ │  • Tool 执行结果         │ │ │ • 状态      │ │
│ │ ...  │ │ │                          │ │ │ • 工具调用  │ │
│ │      │ │ │                          │ │ │ • 进度      │ │
│ │分类   │ │ ├──────────────────────────┤ │ │            │ │
│ │ 代码  │ │ │  输入区                   │ │ └────────────┘ │
│ │ 文档  │ │ │  [文件附件] [输入框] [发送]│ │                │
│ │ ...  │ │ └──────────────────────────┘ │                │
│ └──────┘ │                              │                │
├──────────┴──────────────────────────────┴────────────────┤
│                     状态栏（可选）                         │
│  Token 统计 | 模型信息 | 连接状态 | 延迟                   │
└──────────────────────────────────────────────────────────┘
```

### 12.2.2 响应式断点

| 断点 | 宽度 | 布局 |
|------|------|------|
| Desktop | ≥ 1200px | 三栏完整展示 |
| Tablet | 768-1199px | 左侧栏可折叠，右侧栏抽屉式 |
| Mobile | < 768px | 仅主对话区，侧栏通过汉堡菜单触发 |

---

## 12.3 核心页面与组件

### 12.3.1 左侧栏 — 会话管理

```
packages/web-ui/src/components/sidebar/
├── sidebar.tsx                    # 侧边栏容器
├── new-chat-button.tsx            # 新建对话按钮
├── search-input.tsx               # 会话搜索（标题 + 内容全文）
├── session-list.tsx               # 会话列表（虚拟滚动）
├── session-item.tsx               # 单条会话卡片（标题 + 时间 + 预览）
├── session-group.tsx              # 按日期/分类分组（今天/昨天/更早）
└── session-context-menu.tsx       # 右键菜单（重命名/删除/归档/导出）
```

**功能**：

- 会话按时间倒序排列，分组显示（今天 / 昨天 / 最近 7 天 / 更早）
- 支持搜索过滤（标题 + 消息内容全文搜索）
- 支持拖拽排序与固定置顶
- 会话卡片显示：标题（自动生成或手动命名）、最后消息时间、消息预览、Agent 标识
- 右键上下文菜单：重命名、删除、归档、导出为 Markdown
- 新建对话时可选择 Agent 类型

### 12.3.2 主对话区 — 消息流

```
packages/web-ui/src/components/chat/
├── chat-container.tsx             # 对话容器（自动滚动 + 虚拟列表）
├── message-list.tsx               # 消息列表
├── message-bubble.tsx             # 消息气泡（根据角色分发）
├── user-message.tsx               # 用户消息（文本 + 附件预览）
├── assistant-message.tsx          # Assistant 消息（流式渲染）
├── thinking-block.tsx             # Thinking 折叠块（可展开查看推理过程）
├── code-block.tsx                 # 代码块（语法高亮 + 复制 + 行号）
├── tool-call-card.tsx             # 工具调用卡片（名称 + 参数 + 状态 + 耗时）
├── tool-result.tsx                # 工具执行结果展示
├── markdown-renderer.tsx          # Markdown 渲染器（GFM + 数学公式 + Mermaid）
├── image-preview.tsx              # 图片预览（缩放 + 灯箱）
├── progress-indicator.tsx         # Agent 执行进度条（步骤列表 + 完成状态）
└── error-message.tsx              # 错误消息（重试按钮）
```

**流式渲染规范**：

- **文本流式**：逐 token 追加，使用 `requestAnimationFrame` 节流渲染
- **Thinking Block**：默认折叠，显示"正在思考..."动画，点击展开实时流
- **工具调用**：显示为卡片，实时更新状态（pending → running → success/error）
- **代码块**：实时语法高亮（使用 Shiki），支持复制、折叠长代码
- **进度指示器**：多步骤任务显示为带勾选的步骤列表（类似 Kimi 的 10/10 进度展示）

### 12.3.3 输入区

```
packages/web-ui/src/components/input/
├── chat-input.tsx                 # 输入区容器
├── message-composer.tsx           # 可自适应高度的输入框（Mantine Textarea）
├── file-upload.tsx                # 文件上传（拖放 + 点击）
├── attachment-preview.tsx         # 附件预览条（图片缩略图 + 文件图标）
├── model-selector.tsx             # 模型选择器（下拉 + 快捷键切换）
├── command-palette.tsx            # 命令面板（/ 触发，类似 VS Code）
└── send-button.tsx                # 发送按钮（Enter 发送 / Shift+Enter 换行）
```

**交互规范**：

- 输入框随内容自适应高度，最大 300px
- `/` 触发命令面板（`/plan`、`/roundtable`、`/compact` 等）
- `@` 触发 Agent 选择器
- 拖放文件自动添加为附件
- 支持图片粘贴
- 快捷键：`Cmd+Enter` 发送（可配置为 `Enter` 发送）
- 模型选择器显示当前模型，点击切换

### 12.3.4 右侧栏 — 文件与 Agent 面板

```
packages/web-ui/src/components/panel/
├── right-panel.tsx                # 右侧面板容器（标签页切换）
├── file-panel.tsx                 # 文件面板
├── file-tree.tsx                  # 生成文件树
├── file-diff-viewer.tsx           # 代码差异查看器（unified diff）
├── file-preview.tsx               # 文件内容预览
├── file-download.tsx              # 批量下载（zip）
├── agent-panel.tsx                # Agent 状态面板
├── agent-status.tsx               # Agent 当前状态（运行中/就绪/错误）
├── tool-history.tsx               # 工具调用历史列表
└── token-stats.tsx                # Token 使用统计（本次/累计 + 费用估算）
```

---

## 12.4 技术架构

### 12.4.1 技术栈选型

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19 | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| Vite | 6.x | 构建工具（dev server + HMR + 生产构建） |
| Mantine | 7.x | UI 组件库（深色主题原生支持 + 高定制性） |
| TanStack Query | 5.x | 服务端状态管理（会话列表、历史消息缓存） |
| Zustand | 5.x | 客户端状态管理（UI 状态、设置） |
| React Router | 7.x | SPA 路由 |
| Shiki | 1.x | 代码语法高亮 |
| KaTeX | 0.16.x | 数学公式渲染 |
| Mermaid | 11.x | 流程图 / 时序图渲染 |

### 12.4.2 目录结构

```
packages/web-ui/
├── package.json                   # @vitamin/web-ui
├── tsconfig.json
├── vite.config.ts                 # Vite 配置（React + SWC）
├── index.html                     # SPA 入口
│
├── public/
│   └── favicon.svg
│
├── src/
│   ├── main.tsx                   # React 入口
│   ├── app.tsx                    # App 根组件（Router + Provider）
│   ├── theme.ts                   # Mantine 主题定制（深色优先）
│   ├── routes.tsx                 # 路由定义
│   │
│   ├── components/                # UI 组件（按功能模块分目录）
│   │   ├── sidebar/               # 左侧栏（见 12.3.1）
│   │   ├── chat/                  # 主对话区（见 12.3.2）
│   │   ├── input/                 # 输入区（见 12.3.3）
│   │   ├── panel/                 # 右侧面板（见 12.3.4）
│   │   ├── layout/                # 布局组件
│   │   │   ├── app-shell.tsx      # 三栏布局外壳
│   │   │   ├── header.tsx         # 顶部栏
│   │   │   └── status-bar.tsx     # 底部状态栏
│   │   └── common/                # 通用组件
│   │       ├── avatar.tsx         # 角色头像（User/Agent/Tool）
│   │       ├── badge.tsx          # 状态标签
│   │       ├── empty-state.tsx    # 空状态占位
│   │       └── loading.tsx        # 加载态
│   │
│   ├── hooks/                     # React Hooks
│   │   ├── use-chat.ts            # 对话核心 Hook（发送/流式接收/中断）
│   │   ├── use-sessions.ts        # 会话列表 CRUD（TanStack Query）
│   │   ├── use-stream.ts          # SSE/WebSocket 流式数据 Hook
│   │   ├── use-agent-status.ts    # Agent 实时状态订阅
│   │   ├── use-keyboard.ts        # 全局快捷键
│   │   └── use-responsive.ts      # 响应式断点检测
│   │
│   ├── stores/                    # 客户端状态（Zustand）
│   │   ├── ui-store.ts            # UI 状态（侧栏展开/折叠、主题、面板选中）
│   │   ├── settings-store.ts      # 用户设置（模型偏好、快捷键方案）
│   │   └── draft-store.ts         # 输入草稿暂存
│   │
│   ├── services/                  # API 对接层
│   │   ├── api-client.ts          # HTTP 客户端（axios/fetch 封装、认证头注入）
│   │   ├── session-api.ts         # 会话 CRUD API
│   │   ├── chat-api.ts            # 消息发送 + 流式响应 API
│   │   ├── agent-api.ts           # Agent 状态查询 API
│   │   └── stream-client.ts       # SSE / WebSocket 统一流客户端
│   │
│   ├── utils/                     # 工具函数
│   │   ├── format-time.ts         # 时间格式化（相对时间）
│   │   ├── format-token.ts        # Token 数格式化
│   │   ├── markdown-plugins.ts    # Markdown 渲染插件（代码块增强、数学公式）
│   │   └── stream-parser.ts       # SSE 事件解析
│   │
│   └── types/                     # 类型定义
│       ├── session.ts             # 会话类型
│       ├── message.ts             # 消息类型（与 @vitamin/session 对齐）
│       ├── agent.ts               # Agent 状态类型
│       └── api.ts                 # API 请求/响应类型
│
└── tests/
    ├── components/                # 组件测试（Vitest + Testing Library）
    ├── hooks/                     # Hook 测试
    └── e2e/                       # E2E 测试（Playwright）
```

### 12.4.3 构建与部署模式

Web UI 支持两种部署模式：

| 模式 | 说明 | 命令 |
|------|------|------|
| **独立 SPA** | Vite dev server 或静态部署（Vercel / Nginx） | `pnpm --filter @vitamin/web-ui dev` |
| **内嵌到 @vitamin/server** | 构建产物复制到 `@vitamin/server/dist/web-ui/`，由 HTTP 服务静态托管 | `pnpm build:embed` |

**独立 SPA 模式**：

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:9229",      // 代理到 @vitamin/server
      "/ws": { target: "ws://localhost:9229", ws: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
})
```

**内嵌模式**（生产）：

```typescript
// @vitamin/server 侧
// 自动检测 dist/web-ui/ 目录，若存在则注册静态文件路由
if (existsSync(resolve(__dirname, "web-ui/index.html"))) {
  app.use("/app", serveStatic(resolve(__dirname, "web-ui")))
  app.get("/app/*", (req, res) => res.sendFile("web-ui/index.html"))
}
```

访问方式：
- 开发：`http://localhost:5173`（Vite dev server）
- 生产：`http://localhost:9229/app`（@vitamin/server 托管）

---

## 12.5 与后端 API 对接

### 12.5.1 API 端点

Web UI 通过 `@vitamin/server` 提供的 REST + SSE/WebSocket API 通信：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/sessions` | GET | 获取会话列表 |
| `/api/sessions` | POST | 创建新会话 |
| `/api/sessions/:id` | GET | 获取会话详情 + 消息历史 |
| `/api/sessions/:id` | DELETE | 删除会话 |
| `/api/sessions/:id` | PATCH | 更新会话（重命名/归档） |
| `/api/sessions/:id/messages` | POST | 发送消息（返回 SSE 流） |
| `/api/sessions/:id/messages/:mid/stop` | POST | 中断 Agent 执行 |
| `/api/sessions/:id/fork` | POST | 从指定消息分叉 |
| `/api/agents` | GET | 获取可用 Agent 列表 |
| `/api/agents/:id/status` | GET | 获取 Agent 实时状态 |
| `/api/models` | GET | 获取可用模型列表 |
| `/api/config` | GET | 获取客户端配置 |
| `/api/files/:sessionId` | GET | 获取会话关联文件列表 |
| `/api/files/:sessionId/:path` | GET | 获取文件内容 / diff |
| `/ws/stream` | WebSocket | 实时事件推送（Agent 状态、日志、进度） |

### 12.5.2 实时数据流

```typescript
// services/stream-client.ts
export class StreamClient {
  private eventSource: EventSource | WebSocket

  /**
   * 订阅会话消息流（SSE）
   * 事件类型：
   *   text_delta   — 文本增量
   *   thinking_delta — Thinking 增量
   *   tool_start   — 工具调用开始
   *   tool_end     — 工具调用结束
   *   done         — 消息完成
   *   error        — 错误
   */
  subscribeMessages(sessionId: string, onEvent: (event: StreamEvent) => void): Unsubscribe

  /**
   * 订阅 Agent 状态变化（WebSocket）
   * 事件类型：
   *   agent:state_change — Agent 状态转换
   *   agent:tool_call    — 工具调用详情
   *   agent:progress     — 执行进度更新
   */
  subscribeAgentStatus(agentId: string, onEvent: (event: AgentEvent) => void): Unsubscribe
}
```

### 12.5.3 核心 Hook 实现

```typescript
// hooks/use-chat.ts
export function useChat(sessionId: string) {
  const queryClient = useQueryClient()
  const streamClient = useStreamClient()

  // 历史消息（TanStack Query 缓存）
  const messages = useQuery({
    queryKey: ["messages", sessionId],
    queryFn: () => sessionApi.getMessages(sessionId),
    staleTime: 30_000,
  })

  // 流式消息状态
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null)

  // 发送消息
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const stream = await chatApi.sendMessage(sessionId, { content })
      for await (const event of stream) {
        switch (event.type) {
          case "text_delta":
            setStreamingMessage(prev => appendText(prev, event.data))
            break
          case "thinking_delta":
            setStreamingMessage(prev => appendThinking(prev, event.data))
            break
          case "tool_start":
            setStreamingMessage(prev => addToolCall(prev, event.data))
            break
          case "tool_end":
            setStreamingMessage(prev => updateToolResult(prev, event.data))
            break
          case "done":
            // 流结束 → 刷新消息缓存
            queryClient.invalidateQueries({ queryKey: ["messages", sessionId] })
            setStreamingMessage(null)
            break
        }
      }
    },
  })

  // 中断
  const stop = () => chatApi.stopMessage(sessionId)

  return { messages, streamingMessage, sendMessage, stop }
}
```

---

## 12.6 主题与视觉规范

### 12.6.1 Mantine 主题定制

```typescript
// src/theme.ts
import { createTheme, MantineColorsTuple } from "@mantine/core"

const brand: MantineColorsTuple = [
  "#f0f4ff", "#dbe4ff", "#bac8ff", "#91a7ff",
  "#748ffc", "#5c7cfa", "#4c6ef5", "#4263eb",
  "#3b5bdb", "#364fc7",
]

export const theme = createTheme({
  primaryColor: "brand",
  colors: { brand },
  defaultRadius: "md",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",

  other: {
    // 深色模式配色（参考 Kimi 深色风格）
    chatBg: "#1a1b1e",               // 对话区背景
    sidebarBg: "#141517",            // 侧边栏背景
    messageBgUser: "#2c2e33",        // 用户消息背景
    messageBgAssistant: "transparent",// Assistant 消息背景
    codeBlockBg: "#25262b",          // 代码块背景
    thinkingBg: "#1f2024",           // Thinking 区域背景
    borderSubtle: "#373a40",         // 细线边框
  },
})
```

### 12.6.2 视觉设计要点

参考 Kimi 截图的核心视觉特征：

1. **深色主基调**：背景 `#1a1b1e` 系，避免纯黑（`#000`），保持柔和深色
2. **低对比度层次**：侧边栏稍深于主区域，面板稍浅于背景，形成微妙层次感
3. **圆角卡片**：消息气泡、工具调用卡片、文件卡片均使用 `border-radius: 12px`
4. **渐变强调**：选中状态与主要按钮使用品牌色渐变
5. **状态颜色**：
   - 成功/完成：`#51cf66`（绿色 ✓）
   - 运行中：品牌蓝 + 脉冲动画
   - 错误：`#ff6b6b`
   - 警告：`#fcc419`
6. **代码块**：深灰背景 + Shiki 基于 One Dark Pro 主题的语法高亮
7. **进度展示**：多步骤任务使用带数字的进度列表（如 Kimi 的 "当前进度 10/10" 样式）
8. **Thinking 折叠**：灰色背景折叠区域，点击展开显示推理过程，带淡入动画
9. **工具调用卡片**：左侧彩色竖条标识状态 + 图标 + 名称 + 耗时
10. **头像系统**：User 头像（用户设置）、Agent 头像（品牌图标 + 类型标识）

### 12.6.3 动画规范

| 场景 | 动画 | 时长 | 缓动 |
|------|------|------|------|
| 侧边栏展开/折叠 | width + opacity | 200ms | ease-out |
| 消息出现 | translateY + opacity | 150ms | ease-out |
| Thinking 折叠/展开 | max-height + opacity | 250ms | ease-in-out |
| 工具调用状态变化 | 左侧色条颜色过渡 | 300ms | ease |
| 流式文本 | 无动画，逐字追加 | — | — |
| 进度勾选 | scale + opacity | 200ms | spring |
| 右侧面板滑入 | translateX + opacity | 200ms | ease-out |

---

## 12.7 扩展的 Server API

Web UI 需要对 `@vitamin/server` 进行 API 扩展：

### 12.7.1 新增 API 端点

以下端点需要在 `@vitamin/server` 中新增（Phase 6.1 已有基础 API）：

```typescript
// packages/server/src/api/web-ui.ts

/**
 * 消息发送 + 流式响应
 * POST /api/sessions/:id/messages
 * Body: { content: string, attachments?: File[], agentId?: string }
 * Response: SSE stream
 */
export function createMessageEndpoint(ctx: ServerContext): RequestHandler

/**
 * 中断 Agent 执行
 * POST /api/sessions/:id/messages/:mid/stop
 * Response: { stopped: true }
 */
export function createStopEndpoint(ctx: ServerContext): RequestHandler

/**
 * 会话分叉
 * POST /api/sessions/:id/fork
 * Body: { fromMessageId: string }
 * Response: { sessionId: string }
 */
export function createForkEndpoint(ctx: ServerContext): RequestHandler

/**
 * 文件管理
 * GET /api/files/:sessionId — 文件列表
 * GET /api/files/:sessionId/:path — 文件内容 + diff
 */
export function createFileEndpoints(ctx: ServerContext): RequestHandler[]

/**
 * 可用模型列表
 * GET /api/models
 * Response: { models: ModelInfo[] }
 */
export function createModelsEndpoint(ctx: ServerContext): RequestHandler

/**
 * 客户端配置
 * GET /api/config
 * Response: { theme, features, limits }
 */
export function createConfigEndpoint(ctx: ServerContext): RequestHandler
```

### 12.7.2 认证方案

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| 无认证 | `--web-ui --no-auth` | 本地开发、受信网络 |
| Token 认证 | 启动时生成随机 token，首次访问输入 | 单人使用、简单保护 |
| OAuth 认证 | 接入 GitHub / Google OAuth | 团队共享、云端部署 |

---

## 12.8 页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/app` | 主页（新对话） | 空对话 + 快速开始引导 |
| `/app/chat/:sessionId` | 对话页 | 载入历史会话 |
| `/app/settings` | 设置页 | 模型配置、主题、快捷键 |
| `/app/settings/models` | 模型管理 | Provider 配置 + API Key |
| `/app/settings/agents` | Agent 管理 | Agent 列表 + 自定义 Agent |

---

## 12.9 性能要求

| 指标 | 目标 | 说明 |
|------|------|------|
| 首屏加载（LCP） | < 1.5s | Vite 产物 code-split + lazy load |
| 流式首 token 展示 | < 100ms | SSE 建连后首个 text_delta 到界面 |
| 消息列表滚动 | 60fps | 虚拟列表（@tanstack/react-virtual） |
| 长对话渲染（1000+ 消息） | 无卡顿 | 虚拟滚动 + 离屏消息卸载 |
| 代码高亮渲染 | < 50ms/块 | Shiki WASM + Web Worker |
| 构建产物体积（gzip） | < 500KB 初始 | 组件库 tree-shake + 动态导入 |
| Dev HMR | < 200ms | Vite SWC 插件 |

---

## 12.10 测试策略

| 类型 | 工具 | 覆盖目标 |
|------|------|---------|
| 组件单测 | Vitest + Testing Library | 核心组件渲染 + 交互 |
| Hook 单测 | Vitest + renderHook | useChat / useStream / useSessions |
| 视觉回归 | Playwright + 截图对比 | 关键页面深色/浅色两种主题 |
| E2E 测试 | Playwright | 完整对话流程（发送→流式→工具→完成） |
| 性能基准 | Lighthouse CI | LCP / CLS / Bundle size |

---

## 12.11 与现有模块关系

```
@vitamin/web-ui（新 17 号包）
     │
     │ HTTP + SSE + WebSocket
     ▼
@vitamin/server（14 号包，Phase 6）
     │
     ├── @vitamin/session（会话数据）
     ├── @vitamin/agent（Agent 运行时）
     ├── @vitamin/tools（工具执行）
     ├── @vitamin/ai（LLM 调用）
     └── @vitamin/cloud（可选，云端存储）
```

**关键点**：

- Web UI **不直接依赖** Agent/Tools/AI 等核心包，仅通过 `@vitamin/server` HTTP API 通信
- DevTools Inspector（Phase 6.2）面向**开发者调试**，Web UI 面向**终端用户交互**
- 两个前端可共存：Inspector 挂载在 `/`（端口 9229），Web UI 挂载在 `/app`
- Web UI 复用 `@vitamin/server` 已有的 Session、Agent、Log API 端点，并扩展消息发送/文件管理等端点
