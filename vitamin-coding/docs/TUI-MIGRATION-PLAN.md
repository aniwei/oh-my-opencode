# TUI 移植技术方案：SolidJS/@opentui → React/Ink

> 版本：v3.0 | 日期：2026-03-04
> 源码：`vitamin-coding/tui/`（SolidJS + @opentui/solid）
> 目标：`packages/coding-agent/src/modes/interactive/`（React 19 + Ink 6）
> 约束：仅 UI 移植、单主题、react-router 路由、useReducer + useContext（无 Zustand、无 useSyncExternalStore）

---

## 目录

- [1. 总览](#1-总览)
- [2. 架构对比](#2-架构对比)
- [3. 技术方案详细设计](#3-技术方案详细设计)
  - [3.1 主题系统（单主题）](#31-主题系统单主题)
  - [3.2 路由系统（react-router 原生 API）](#32-路由系统react-router-原生-api)
  - [3.3 状态管理（useReducer + useContext）](#33-状态管理usereducer--usecontext)
  - [3.4 组件层映射](#34-组件层映射)
  - [3.5 UI 基础组件](#35-ui-基础组件)
- [4. 目录结构](#4-目录结构)
- [5. 分阶段实施计划](#5-分阶段实施计划)
- [6. SolidJS → React 转换规则](#6-solidjs--react-转换规则)
- [7. @opentui → Ink 组件映射](#7-opentui--ink-组件映射)
- [8. 裁剪清单](#8-裁剪清单)
- [9. 风险与缓解](#9-风险与缓解)

---

## 1. 总览

### 1.1 迁移目标

将 `tui/` 中基于 SolidJS + @opentui/solid 的终端 UI 完整移植到 `packages/coding-agent/src/modes/interactive/`，技术栈切换为 **React 19 + Ink 6**，并执行三项简化：

| 简化项 | 原始方案 | 目标方案 | 收益 |
|--------|---------|---------|------|
| 主题 | 33 个 JSON 主题 + dark/light 双模式 | **1 个硬编码主题**（opencode dark） | 删除 ~1200 行主题解析代码 |
| 路由 | `createSimpleContext` 自定义路由 | **react-router `MemoryRouter`** 直接使用原生 API | 零包装，标准生态 |
| 状态 | 17 层 SolidJS Context 嵌套 | **1 个 AppContext**（`useReducer` + `useContext`）| 零第三方状态库，1 层 Provider |

### 1.2 核心原则

1. **仅 UI 移植** — 只迁移 UI 组件和交互逻辑，数据状态（SDK、SSE 事件流、bootstrap 初始化）不在本次范围
2. **不用 Zustand / useSyncExternalStore** — 使用 React 原生 `useReducer` + `useContext`
3. **不包装 react-router** — 组件中直接调用 `useNavigate`/`useParams`/`useLocation`，不做 `useRoute`/`useRouteData` 兼容层
4. **不处理 Win32** — 暂不考虑 Windows 平台特殊处理
5. **标准 React 目录结构** — `components/`、`pages/`、`context/`、`hooks/`、`ui/`

### 1.3 规模估算

| 源文件类别 | 文件数 | 总行数 | 迁移后估算行数 | 说明 |
|-----------|--------|--------|-------------|------|
| context/ (14 个) | 14 | ~2,200 | ~300 | 仅保留 UI 状态，合并为 1 个 AppContext |
| component/ | 18 | ~3,500 | ~2,800 | 1:1 移植，语法转换 |
| routes/ | 12 | ~2,600 | ~2,000 | 简化为 pages/ |
| ui/ | 10 | ~1,100 | ~900 | dialog/toast 系统 |
| shared/ | 6 | ~400 | ~350 | 基本不变 |
| app.tsx | 1 | ~846 | ~150 | 大幅简化 |
| **合计** | **61** | **~10,700** | **~6,600** | **-38%** |

---

## 2. 架构对比

### 2.1 原始架构（SolidJS + @opentui）

```
tui(input) → render(() =>
  ArgsProvider                     ← 1
    ExitProvider                   ← 2
      StateProvider                ← 3  ┐
      ┌ KVProvider                       │ 合并为 StateProvider
      ├ SDKProvider (SSE 事件流)          │ （KV + SDK + Sync 统一管理）
      └ SyncProvider (核心数据)           ┘
        ToastProvider              ← 4
          RouteProvider            ← 5  自定义路由
            ConfigProvider         ← 6  (原 TuiConfigProvider)
              ThemeProvider        ← 7  33 主题
                LocalProvider      ← 8  agent/model
                  KeybindProvider        ← 9
                    PromptStashProvider   ← 10
                      DialogProvider      ← 11
                        CommandProvider   ← 12
                          PromptProvider         ← 13 ┐
                          ┌ FrecencyProvider            │ 合并为 PromptProvider
                          ├ PromptHistoryProvider       │ （频率 + 历史 + Ref）
                          └ PromptRefProvider           ┘
                              App
)
```

**原始 17 层 → 归并后 13 层 Provider**：
- `KVProvider` + `SDKProvider` + `SyncProvider` → **`StateProvider`**（数据 + 事件流 + KV 统一管理）
- `FrecencyProvider` + `PromptHistoryProvider` + `PromptRefProvider` → **`PromptProvider`**（输入相关统一管理）
- `TuiConfigProvider` → **`ConfigProvider`**（更通用命名）

### 2.2 目标架构（React + Ink）

```
<MemoryRouter>                     ← react-router（无需 Context）
  <AppProvider>                    ← 唯一 Provider（useReducer + useContext）
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/session/:sessionID" element={<SessionPage />} />
    </Routes>
  </AppProvider>
</MemoryRouter>
```

**2 层总共**：MemoryRouter（react-router 必需）+ AppProvider（UI 状态）。

关键变化：
- **Theme** → 常量 import，不需要 Provider
- **Route** → react-router 原生 API，组件内直接 `useNavigate()`
- **数据状态**（SDK/Sync/KV/Provider/Session/Message/Part...）→ **不移植**，留待后续接入
- **UI 状态**（Dialog/Toast/Sidebar/Scroll...）→ 全部合入 1 个 AppContext（`useReducer`）

---

## 3. 技术方案详细设计

### 3.1 主题系统（单主题）

只保留 `opencode` dark 模式，导出为常量：

```typescript
// theme.ts
export const theme = {
  primary: '#fab283',
  secondary: '#5c9cf5',
  accent: '#9d7cd8',
  error: '#e06c75',
  warning: '#f5a742',
  success: '#7fd88f',
  info: '#56b6c2',
  text: '#eeeeee',
  textMuted: '#808080',
  background: '#0a0a0a',
  backgroundPanel: '#141414',
  backgroundElement: '#1e1e1e',
  border: '#484848',
  borderActive: '#606060',
  borderSubtle: '#3c3c3c',
  diffAdded: '#4fd6be',
  diffRemoved: '#c53b53',
  diffContext: '#828bb8',
  diffAddedBg: '#20303b',
  diffRemovedBg: '#37222c',
  diffContextBg: '#141414',
  // ...（完整色板）
} as const

export type Theme = typeof theme
```

使用方式：直接 import 常量，不需要 hook 或 Context：

```tsx
import { theme } from '../theme'

// 在 Ink 组件中
<Text color={theme.text}>Hello</Text>
<Box borderColor={theme.border}>...</Box>
```

**裁剪**：删除全部 `context/theme.tsx`（1153 行）+ 33 个 JSON 主题文件 + dark/light 解析 + 主题切换命令。

---

### 3.2 路由系统（react-router 原生 API）

#### 设计决策

- 直接使用 `react-router` 的 `MemoryRouter` + `Routes` + `Route`
- 组件中直接调用 `useNavigate()` / `useParams()` / `useLocation()`
- **不做任何兼容包装**（无 `useRoute`、`useRouteData`）

#### 路由表

```tsx
// App.tsx
import { MemoryRouter, Routes, Route } from 'react-router'
import { AppProvider } from './context/app-context'
import { HomePage } from './pages/HomePage'
import { SessionPage } from './pages/SessionPage'

export function App() {
  return (
    <MemoryRouter>
      <AppProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/session/:sessionID" element={<SessionPage />} />
        </Routes>
      </AppProvider>
    </MemoryRouter>
  )
}
```

#### 导航示例

```tsx
// 组件内直接使用 react-router API
import { useNavigate, useParams } from 'react-router'

function SomeComponent() {
  const navigate = useNavigate()
  const { sessionID } = useParams()

  // 创建新 session 后跳转
  const handleNewSession = (id: string) => {
    navigate(`/session/${id}`)
  }

  // 回首页
  const handleGoHome = () => {
    navigate('/')
  }

  // 通过 location state 传递临时数据（如 initialPrompt）
  navigate(`/session/${id}`, { state: { initialPrompt } })
}
```

#### 原始 → 目标 API 映射

| 原始 SolidJS API | 目标 react-router API |
|---------|---------|
| `route.navigate({ type: 'session', sessionID })` | `navigate('/session/${sessionID}')` |
| `route.navigate({ type: 'home' })` | `navigate('/')` |
| `route.data.type === 'home'` | `location.pathname === '/'` |
| `useRouteData('session').sessionID` | `useParams().sessionID` |
| `route.data.type` 判断当前页 | `useLocation().pathname` |
| `route.navigate({ ..., initialPrompt })` | `navigate(path, { state: { initialPrompt } })` |
| 读取 `initialPrompt` | `useLocation().state?.initialPrompt` |

---

### 3.3 状态管理（useReducer + useContext）

#### 设计决策

- **不使用 Zustand、useSyncExternalStore 或任何第三方状态库**
- 使用 React 原生 `useReducer` + `useContext`
- 整个 App 只有 **1 个 AppContext**
- **仅管理 UI 状态**，数据状态（SDK/SSE/Session/Message/Part 等）不在本次移植范围
- 组件通过 `useApp()` 获取 `{ state, dispatch }`

#### 3.3.1 UIState 类型（仅 UI 状态）

```typescript
// context/types.ts

export interface DialogEntry {
  id: string
  element: React.ReactNode
  onClose?: () => void
}

export interface ToastOptions {
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
  duration?: number
}

export interface UIState {
  // ─── Dialog 栈 ───
  dialog: {
    stack: DialogEntry[]
    size: 'medium' | 'large'
  }

  // ─── Toast 通知 ───
  toast: ToastOptions | null

  // ─── Sidebar ───
  sidebarOpen: boolean

  // ─── Prompt 输入状态 ───
  promptMode: 'normal' | 'shell' | 'search'
  promptFocused: boolean

  // ─── 滚动 ───
  scrollLocked: boolean
}
```

#### 3.3.2 Action 类型

```typescript
// context/actions.ts

export type UIAction =
  // Dialog
  | { type: 'dialog/push'; entry: DialogEntry }
  | { type: 'dialog/pop' }
  | { type: 'dialog/clear' }
  | { type: 'dialog/setSize'; size: 'medium' | 'large' }
  // Toast
  | { type: 'toast/show'; toast: ToastOptions }
  | { type: 'toast/dismiss' }
  // Sidebar
  | { type: 'sidebar/toggle' }
  | { type: 'sidebar/set'; open: boolean }
  // Prompt
  | { type: 'prompt/setMode'; mode: UIState['promptMode'] }
  | { type: 'prompt/setFocused'; focused: boolean }
  // Scroll
  | { type: 'scroll/lock'; locked: boolean }
```

#### 3.3.3 Reducer

```typescript
// context/reducer.ts

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'dialog/push':
      return {
        ...state,
        dialog: { ...state.dialog, stack: [...state.dialog.stack, action.entry] },
      }
    case 'dialog/pop': {
      const stack = [...state.dialog.stack]
      const removed = stack.pop()
      removed?.onClose?.()
      return { ...state, dialog: { ...state.dialog, stack } }
    }
    case 'dialog/clear':
      return { ...state, dialog: { ...state.dialog, stack: [] } }
    case 'dialog/setSize':
      return { ...state, dialog: { ...state.dialog, size: action.size } }
    case 'toast/show':
      return { ...state, toast: action.toast }
    case 'toast/dismiss':
      return { ...state, toast: null }
    case 'sidebar/toggle':
      return { ...state, sidebarOpen: !state.sidebarOpen }
    case 'sidebar/set':
      return { ...state, sidebarOpen: action.open }
    case 'prompt/setMode':
      return { ...state, promptMode: action.mode }
    case 'prompt/setFocused':
      return { ...state, promptFocused: action.focused }
    case 'scroll/lock':
      return { ...state, scrollLocked: action.locked }
    default:
      return state
  }
}
```

#### 3.3.4 AppContext + AppProvider

```tsx
// context/app-context.tsx
import { createContext, useContext, useReducer } from 'react'
import { uiReducer } from './reducer'
import type { UIState, UIAction } from './types'

interface AppContextValue {
  state: UIState
  dispatch: React.Dispatch<UIAction>
}

const AppContext = createContext<AppContextValue | null>(null)

const initialState: UIState = {
  dialog: { stack: [], size: 'medium' },
  toast: null,
  sidebarOpen: false,
  promptMode: 'normal',
  promptFocused: true,
  scrollLocked: true,
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(uiReducer, initialState)
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
```

#### 3.3.5 使用示例

```tsx
// 组件中
import { useApp } from '../context/app-context'

function SomeComponent() {
  const { state, dispatch } = useApp()

  const openDialog = (element: React.ReactNode) => {
    dispatch({ type: 'dialog/push', entry: { id: crypto.randomUUID(), element } })
  }

  const showToast = (message: string) => {
    dispatch({ type: 'toast/show', toast: { message, type: 'info' } })
  }

  return (
    <>
      {state.toast && <Toast {...state.toast} />}
      {state.dialog.stack.length > 0 && <Dialog />}
    </>
  )
}
```

#### 3.3.6 原始 17 个 Context → 迁移映射

| 原始 Context | 行数 | 去向 | 说明 |
|-------------|------|------|------|
| `args.tsx` | 16 | props 传入 | 启动参数 |
| `exit.tsx` | 50 | `hooks/use-exit.ts` | 纯逻辑 hook |
| `kv.tsx` | 54 | **不移植** | 数据层，待后续接入 |
| `sdk.tsx` | 97 | **不移植** | 数据层，待后续接入 |
| `sync.tsx` | 489 | **不移植** | 数据层，待后续接入 |
| `local.tsx` | 407 | **不移植** | 数据层（agent/model），待后续接入 |
| `theme.tsx` | 1153 | `theme.ts` 常量 | 无需 Provider |
| `route.tsx` | 51 | react-router 原生 | 无需 Provider |
| `keybind.tsx` | 103 | `hooks/use-keybind.ts` | 纯逻辑 hook |
| `prompt.tsx` | 20 | `hooks/use-prompt-ref.ts` | ref 管理 |
| `directory.ts` | 15 | `hooks/use-directory.ts` | 派生计算 |
| `tui-config.tsx` | 10 | **不移植** | 数据层，待后续接入 |
| `helper.tsx` | 29 | **删除** | SolidJS 工厂 |
| `dialog.tsx` (ui) | 200 | `UIState.dialog` + `ui/Dialog.tsx` | useReducer 管理 |
| `dialog-command.tsx` | 200 | `components/CommandDialog.tsx` | dispatch action |
| `toast.tsx` (ui) | 96 | `UIState.toast` + `ui/Toast.tsx` | useReducer 管理 |
| `prompt/history.tsx` | ~100 | `hooks/use-prompt-history.ts` | 自管理文件读写 |
| `prompt/frecency.tsx` | ~50 | `hooks/use-frecency.ts` | 自管理 |
| `prompt/stash.tsx` | ~50 | `hooks/use-prompt-stash.ts` | 自管理 |

---

### 3.4 组件层映射

#### 3.4.1 pages/ 目录（原 routes/）

| 源文件 | 行数 | 目标 | 说明 |
|--------|------|------|------|
| `routes/home.tsx` | 146 | `pages/HomePage.tsx` | 首页 |
| `routes/session/index.tsx` | 2188 | **拆分** → `pages/SessionPage/` | 最大文件，拆为子组件 |
| `routes/session/header.tsx` | 136 | `pages/SessionPage/Header.tsx` | |
| `routes/session/sidebar.tsx` | 322 | `pages/SessionPage/Sidebar.tsx` | |
| `routes/session/footer.tsx` | 101 | `pages/SessionPage/Footer.tsx` | |
| `routes/session/permission.tsx` | ~100 | `pages/SessionPage/Permission.tsx` | |
| `routes/session/question.tsx` | ~100 | `pages/SessionPage/Question.tsx` | |
| `routes/session/dialog-*.tsx` | ~400 | `pages/SessionPage/dialogs/` | |

**SessionPage 拆分**：

```
pages/SessionPage/
├── index.tsx              # 主容器（布局 + useParams 取 sessionID）
├── Header.tsx
├── Footer.tsx
├── Sidebar.tsx
├── MessageList.tsx        # 消息滚动列表
├── UserMessage.tsx
├── AssistantMessage.tsx
├── Permission.tsx
├── Question.tsx
├── parts/                 # Part 渲染器（15 个工具）
│   ├── TextPart.tsx
│   ├── ReasoningPart.tsx
│   ├── ToolPart.tsx       # 路由分发
│   ├── BashTool.tsx
│   ├── ReadTool.tsx
│   ├── WriteTool.tsx
│   ├── EditTool.tsx
│   ├── ApplyPatchTool.tsx
│   ├── GrepTool.tsx
│   ├── GlobTool.tsx
│   ├── ListTool.tsx
│   ├── TaskTool.tsx
│   ├── WebFetchTool.tsx
│   ├── TodoWriteTool.tsx
│   ├── QuestionTool.tsx
│   ├── SkillTool.tsx
│   ├── InlineTool.tsx
│   └── BlockTool.tsx
└── dialogs/
    ├── MessageDialog.tsx
    ├── TimelineDialog.tsx
    ├── ForkDialog.tsx
    └── SubagentDialog.tsx
```

#### 3.4.2 components/ 目录（原 component/）

| 源文件 | 目标 | 说明 |
|--------|------|------|
| `prompt/index.tsx` (1156) | `components/Prompt/index.tsx` | 输入框核心 |
| `prompt/autocomplete.tsx` (668) | `components/Prompt/Autocomplete.tsx` | @ 文件补全 |
| `logo.tsx` (86) | `components/Logo.tsx` | Logo 渲染 |
| `spinner.tsx` (27) | `components/Spinner.tsx` | ink-spinner |
| `tips.tsx` (~60) | `components/Tips.tsx` | 提示文本 |
| `border.tsx` (~40) | `components/Border.tsx` | 自定义边框 |
| `todo-item.tsx` (~30) | `components/TodoItem.tsx` | |
| `dialog-command.tsx` (200) | `components/CommandDialog.tsx` | 命令面板 |
| `dialog-model.tsx` (~300) | `components/ModelDialog.tsx` | |
| `dialog-agent.tsx` (~100) | `components/AgentDialog.tsx` | |
| `dialog-session-list.tsx` (~200) | `components/SessionListDialog.tsx` | |
| `dialog-provider.tsx` (~150) | `components/ProviderDialog.tsx` | |
| `dialog-mcp.tsx` (~150) | `components/McpDialog.tsx` | |
| `dialog-status.tsx` (~100) | `components/StatusDialog.tsx` | |
| `dialog-session-rename.tsx` | `components/SessionRenameDialog.tsx` | |
| `dialog-stash.tsx` | `components/StashDialog.tsx` | |
| `dialog-skill.tsx` | `components/SkillDialog.tsx` | |
| `dialog-theme-list.tsx` | **删除** | 单主题 |

#### 3.4.3 ui/ 目录（基础 UI 组件）

| 源文件 | 目标 | 说明 |
|--------|------|------|
| `ui/dialog.tsx` | `ui/Dialog.tsx` | 模态容器 |
| `ui/dialog-select.tsx` | `ui/DialogSelect.tsx` | 模糊搜索选择 |
| `ui/dialog-confirm.tsx` | `ui/DialogConfirm.tsx` | 确认弹窗 |
| `ui/dialog-alert.tsx` | `ui/DialogAlert.tsx` | 提示 |
| `ui/dialog-prompt.tsx` | `ui/DialogPrompt.tsx` | 文本输入弹窗 |
| `ui/dialog-export-options.tsx` | `ui/DialogExportOptions.tsx` | 导出选项 |
| `ui/dialog-help.tsx` | `ui/DialogHelp.tsx` | 帮助 |
| `ui/toast.tsx` | `ui/Toast.tsx` | 通知 |
| `ui/link.tsx` | `ui/Link.tsx` | 终端超链接 |
| `ui/spinner.ts` | **删除** | → ink-spinner |

---

### 3.5 UI 基础组件

Ink 缺少 @opentui 的部分能力，优先使用开源社区库替代：

| @opentui 能力 | Ink 替代 | 来源 |
|--------------|---------|------|
| `<scrollbox>` | `ink-scroll-view` (0.3.6) — 支持 Ink 5/6 + React 18/19，自动测量子元素高度，动态内容，通过 ref + `useInput` 控制 | 社区 |
| `<code filetype="markdown">` | `ink-markdown` (1.0.4) — 内部封装 `marked` + `marked-terminal`，直出 Ink 兼容节点 | 社区 |
| `<diff>` | `diff` 库解析 + `chalk` 着色 + 薄包装 `<DiffViewer>` 组件（无 Ink 原生 diff 社区库） | 社区 + 薄包装 |
| `<spinner>` | `ink-spinner` | 社区 |
| `position="absolute"` | `<Box position="absolute">` ✅ | Ink 内置 |
| `<textarea>` | `ink-text-input` + 多行扩展 | 社区 |
| 鼠标事件 | `useInput` 键盘优先；Ink 6 实验鼠标可选 | Ink 内置 |
| `useKeyboard` | `useInput` from ink | Ink 内置 |
| `useTerminalDimensions` | `useStdout()` → `stdout.columns/rows` | Ink 内置 |

---

## 4. 目录结构

```
src/modes/interactive/
├── index.tsx                    # 入口：render(<App>)
├── App.tsx                      # MemoryRouter + AppProvider + Routes
├── theme.ts                     # 硬编码 opencode dark 常量
│
├── context/
│   ├── app-context.tsx          # AppProvider + useApp（useReducer + useContext）
│   ├── types.ts                 # UIState 类型定义
│   ├── actions.ts               # UIAction 类型定义
│   └── reducer.ts               # uiReducer 纯函数
│
├── hooks/
│   ├── use-keybind.ts           # 键绑定匹配
│   ├── use-exit.ts              # 退出逻辑
│   ├── use-directory.ts         # 目录显示
│   ├── use-prompt-ref.ts        # prompt ref 管理
│   ├── use-prompt-history.ts    # prompt 历史
│   ├── use-prompt-stash.ts      # prompt 暂存
│   ├── use-frecency.ts          # 频率排序
│   └── use-scroll.ts            # 滚动控制
│
├── pages/
│   ├── HomePage.tsx
│   └── SessionPage/
│       ├── index.tsx
│       ├── Header.tsx
│       ├── Footer.tsx
│       ├── Sidebar.tsx
│       ├── MessageList.tsx
│       ├── UserMessage.tsx
│       ├── AssistantMessage.tsx
│       ├── Permission.tsx
│       ├── Question.tsx
│       ├── parts/               # 15+ 工具渲染器
│       └── dialogs/             # session 相关弹窗
│
├── components/
│   ├── Prompt/
│   │   ├── index.tsx
│   │   └── Autocomplete.tsx
│   ├── Logo.tsx
│   ├── Spinner.tsx
│   ├── Tips.tsx
│   ├── TodoItem.tsx
│   ├── Border.tsx
│   ├── CommandDialog.tsx
│   ├── ModelDialog.tsx
│   ├── AgentDialog.tsx
│   ├── SessionListDialog.tsx
│   ├── ProviderDialog.tsx
│   ├── McpDialog.tsx
│   ├── StatusDialog.tsx
│   └── HelpDialog.tsx
│
├── ui/
│   ├── Dialog.tsx
│   ├── DialogSelect.tsx
│   ├── DialogConfirm.tsx
│   ├── DialogAlert.tsx
│   ├── Toast.tsx
│   ├── DiffViewer.tsx           # diff + chalk 薄包装（unified/split）
│   └── Link.tsx
│
└── shared/
    ├── binary-search.ts
    ├── clipboard.ts
    ├── editor.ts
    ├── transcript.ts
    └── format.ts
```

与标准 React 项目结构对齐：
- `pages/` — 路由页面组件（绑定 URL）
- `components/` — 可复用业务组件
- `ui/` — 无业务含义的通用 UI 组件
- `context/` — 状态管理（useReducer + useContext，仅 UI 状态）
- `hooks/` — 自定义 hooks
- `shared/` — 纯函数工具

---

## 5. 分阶段实施计划

### Phase 1：基础骨架（2 天）

| 任务 | 输出 |
|------|------|
| `theme.ts` 硬编码主题常量 | `theme.ts` |
| `context/types.ts` + `context/actions.ts` | UIState / UIAction 类型 |
| `context/reducer.ts` — uiReducer 纯函数 | `context/reducer.ts` |
| `context/app-context.tsx` — AppProvider + useApp | `context/app-context.tsx` |
| `App.tsx` — MemoryRouter + AppProvider + Routes 骨架 | `App.tsx` |
| `index.tsx` — 入口 `render(<App>)` | `index.tsx` |
| `pages/HomePage.tsx` + `pages/SessionPage/index.tsx` 空壳 | |
| **验收**：`tsc --noEmit` 通过，Ink 渲染显示 "Hello" | |

### Phase 2：首页（2 天）

| 任务 | 输出 |
|------|------|
| `components/Logo.tsx` | |
| `components/Spinner.tsx` | |
| `components/Tips.tsx` | |
| `components/Prompt/index.tsx`（基础版：输入 + 提交） | |
| `pages/HomePage.tsx` 完整实现 | |
| **验收**：首页显示 Logo + Prompt，输入提交后 navigate 到 session | |

### Phase 3：Session 消息渲染（4–5 天）

| 任务 | 输出 |
|------|------|
| 接入 `ink-scroll-view`（替代自定义 ScrollBox） | |
| 接入 `ink-markdown`（替代自定义 MarkdownRenderer） | |
| `pages/SessionPage/MessageList.tsx` | |
| `pages/SessionPage/UserMessage.tsx` | |
| `pages/SessionPage/AssistantMessage.tsx` | |
| `pages/SessionPage/parts/*.tsx`（15 个工具渲染器） | |
| `pages/SessionPage/Header.tsx` + `Footer.tsx` + `Sidebar.tsx` | |
| **验收**：进入 session 可看到消息列表 + 工具输出 + sidebar（数据用 mock/props 传入） | |

### Phase 4：交互系统（3–4 天）

| 任务 | 输出 |
|------|------|
| `ui/Dialog.tsx` 模态系统 | |
| `ui/DialogSelect.tsx` 模糊搜索 | |
| `ui/DialogConfirm.tsx` + `ui/Toast.tsx` | |
| `components/CommandDialog.tsx` 命令面板 | |
| `components/ModelDialog.tsx` / `AgentDialog.tsx` | |
| `components/ProviderDialog.tsx` / `McpDialog.tsx` | |
| `pages/SessionPage/Permission.tsx` + `Question.tsx` | |
| `hooks/use-keybind.ts` | |
| **验收**：Ctrl+K 打开命令面板，弹窗交互正常 | |

### Phase 5：Prompt 高级功能（2–3 天）

| 任务 | 输出 |
|------|------|
| `components/Prompt/Autocomplete.tsx` — @文件/agent 补全 | |
| `hooks/use-prompt-history.ts` + `use-frecency.ts` + `use-prompt-stash.ts` | |
| Prompt shell mode / paste / image 附件 | |
| **验收**：@ 触发文件补全，/ 触发命令，历史可回溯 | |

### Phase 6：收尾（2–3 天）

| 任务 |
|------|
| session compact / fork / timeline / undo / redo |
| share / unshare / export transcript |
| 子 session 导航 |
| 剩余弹窗（status / help / skill / stash） |
| 错误边界 |
| **验收**：UI 组件与原始 TUI 视觉等价（除主题切换） |

### 工期汇总

| Phase | 天数 | 累计 |
|-------|------|------|
| 1 骨架 | 2 | 2 |
| 2 首页 | 2 | 4 |
| 3 Session 渲染 | 4–5 | 8–9 |
| 4 交互系统 | 3–4 | 11–13 |
| 5 Prompt 补全 | 2–3 | 13–16 |
| 6 收尾 | 2–3 | 15–19 |

---

## 6. SolidJS → React 转换规则

### 6.1 响应式原语

| SolidJS | React | 说明 |
|---------|-------|------|
| `createSignal(v)` | `useState(v)` | 1:1 |
| `createEffect(() => ...)` | `useEffect(() => ..., [deps])` | 显式声明依赖 |
| `createMemo(() => ...)` | `useMemo(() => ..., [deps])` | 显式声明依赖 |
| `onMount(() => ...)` | `useEffect(() => ..., [])` | 空依赖 |
| `onCleanup(() => ...)` | `useEffect` return | |
| `batch(() => ...)` | React 19 自动 batch | 无需 |
| `untrack(() => ...)` | ref 或外部变量 | |
| `createStore(obj)` + `produce` | `useReducer` + dispatch | |
| `reconcile(obj)` | 对象替换（`...spread`） | |

### 6.2 JSX 差异

| SolidJS | React (Ink) |
|---------|-------------|
| `<Show when={x}>` | `{x && <...>}` |
| `<Show when={x} fallback={...}>` | `{x ? <A/> : <B/>}` |
| `<For each={arr}>{(item) => ...}` | `{arr.map((item) => ...)}` |
| `<Switch><Match when={...}>` | if/else 或 switch |
| `<Dynamic component={c}>` | `<C {...props}/>` |
| `<box>` | `<Box>` (Ink) |
| `<text>` | `<Text>` (Ink) |
| `<span style={{fg}}>` | `<Text color={fg}>` |
| `ref={(el) => ...}` | `useRef` + `ref={ref}` |

### 6.3 颜色

| @opentui | Ink |
|---------|----|
| `RGBA.fromHex('#fab283')` | `'#fab283'` 字符串 |
| `fg={theme.primary}` | `color={theme.primary}` |
| `bg={theme.background}` | `backgroundColor={theme.background}` |
| `TextAttributes.BOLD` | `<Text bold>` |

### 6.4 输入

| @opentui | Ink |
|---------|----|
| `useKeyboard((evt) => ...)` | `useInput((input, key) => ...)` |
| `evt.name === 'escape'` | `key.escape` |
| `evt.ctrl && evt.name === 'c'` | `input === 'c' && key.ctrl` |
| `useTerminalDimensions()` | `useStdout()` → `stdout.columns/rows` |

---

## 7. @opentui → Ink 组件映射

| @opentui | Ink | 备注 |
|----------|-----|------|
| `<box>` | `<Box>` | flex 布局兼容 |
| `<text>` | `<Text>` | |
| `<scrollbox>` | `ink-scroll-view` | 社区库，Ink 5/6 兼容 |
| `<code>` | `ink-markdown` | 社区库，封装 marked + marked-terminal |
| `<diff>` | `diff` + `chalk` + 薄包装 `<DiffViewer>` | 无 Ink 原生 diff 社区库 |
| `<spinner>` | `ink-spinner` | |
| `<input>` | `ink-text-input` | |
| `position="absolute"` | `<Box position="absolute">` | ✅ |
| `border` | `<Box borderStyle="single">` | ✅ |
| `gap` / `flexGrow` | `<Box gap={n} flexGrow={n}>` | ✅ Ink 6 |

### 社区库 vs 薄包装

| 组件 | 方案 | 说明 |
|------|------|------|
| ScrollBox | **`ink-scroll-view`** (社区) | 直接使用，支持自动测量、动态内容、ref 控制 |
| MarkdownRenderer | **`ink-markdown`** (社区) | 直接使用，内部封装 marked + marked-terminal |
| DiffViewer | **薄包装** `diff` + `chalk` | 社区无 Ink 原生 diff，需 ~80 行包装组件 |

---

## 8. 裁剪清单

| 功能 | 原始代码 | 裁剪原因 |
|------|---------|---------|
| 多主题 | theme.tsx (1153行) + 33 JSON | 单主题 |
| Dark/Light 切换 | resolveTheme() | 只保留 dark |
| 自定义主题文件 | Glob + fs.watch | 删除 |
| `/themes` 命令 | command 注册 | 删除 |
| `createSimpleContext` | helper.tsx | SolidJS 专用 |
| `@opentui/core` RGBA | 全局替换为 hex 字符串 | |
| Win32 特殊处理 | win32.ts | **暂不处理**，后续按需补充 |
| Terminal 背景检测 | getTerminalBackgroundColor() | 单主题不需要 |
| Copy-on-select | Flag.OPENCODE_EXPERIMENTAL | Ink 不支持 |
| Console/Debug overlay | renderer 特有 | opentui 特有 |
| 自定义滚动加速度 | MacOSScrollAccel | 简化固定速度 |
| opentui-spinner | 动画帧 | → ink-spinner |
| SDK 初始化 / 连接 | sdk.ts, bootstrap.ts | **不移植** — 数据层，待后续接入 |
| SSE 事件流 | event-handler.ts | **不移植** — 数据层 |
| Session/Message/Part 同步 | sync-actions.ts, session-sync.ts | **不移植** — 数据层 |
| KV 持久化 | kv-actions.ts | **不移植** — 数据层 |
| Agent/Model 切换逻辑 | local-actions.ts | **不移植** — 数据层 |

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| Ink 无 `<scrollbox>` | Session 消息体验 | `ink-scroll-view` 社区库 |
| Ink 无 Markdown/代码高亮 | AI 回复显示 | `ink-markdown` 社区库 |
| Ink 无 diff 视图 | 代码变更显示 | `diff` + `chalk` 薄包装 DiffViewer |
| `ink-text-input` 无多行 | Prompt 限制 | 自定义 MultilineInput |
| 鼠标交互有限 | Ink 6 实验特性 | 键盘优先设计 |
| Prompt 自动补全 | Ink 实现复杂 | Phase 5 专项；初期简化为列表 |
| 数据层缺失 | 组件无真实数据 | 用 mock/props 占位，后续接入真实数据层 |

---

## 附录 A：UI 数据流

```
┌──────────────────────────────────────────────┐
│   context/app-context.tsx                    │
│                                              │
│   useReducer(uiReducer, initialState)        │
│   → { state: UIState, dispatch }             │
│   → <AppContext.Provider value={…}>          │
└────────────────────┬─────────────────────────┘
                     │ Context
                     ▼
┌──────────────────────────────────────────────┐
│   React 组件树                                │
│                                              │
│   <MemoryRouter>                             │
│     <AppProvider>                            │
│       <Routes>                               │
│         <Route path="/" element={HomePage}>  │  ← useApp().state.dialog
│         <Route path="/session/:id"           │  ← useApp().dispatch({ type: … })
│                element={SessionPage}>        │  ← useParams().sessionID
│       </Routes>                              │     useNavigate()
│     </AppProvider>                           │
│   </MemoryRouter>                            │
└──────────────────────────────────────────────┘

用户交互 → dispatch(UIAction) → uiReducer → 新 UIState → React re-render

注：Session / Message / Part 等业务数据暂不在此流中，
    后续接入数据层时再扩展 Context 或引入独立 Provider。
```

## 附录 B：依赖清单

### 保留

```json
{
  "react": "^19.2.4",
  "react-router": "^7.13.1",
  "ink": "^6.8.0",
  "ink-text-input": "^6.0.0",
  "ink-spinner": "^5.0.0",
  "fuzzysort": "^3.1.0",
  "clipboardy": "^5.3.1",
  "diff": "^7.0.0",
  "remeda": "^2.0.0"
}
```

### 新增

```json
{
  "ink-scroll-view": "^0.3.6",
  "ink-markdown": "^1.0.4",
  "chalk": "^5.4.0",
  "strip-ansi": "^7.0.0"
}
```

### 删除

```
zustand               ← 不使用
@opencode-ai/sdk      ← 不移植数据层
@opentui/core
@opentui/solid
opentui-spinner
solid-js
solid-js/store
@solid-primitives/event-bus
```