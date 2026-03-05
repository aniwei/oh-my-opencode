# Inspector / Web-UI 改造技术方案

**基于 Mantine UI 框架，参考 Dify Light 主题布局**

---

## 1. 现状分析

### 1.1 当前 Web-UI (`@vitamin/web-ui`)

| 维度 | 现状 |
|------|------|
| UI 框架 | Mantine v7 (`@mantine/core` + `@mantine/hooks`) |
| 路由 | react-router-dom v7（BrowserRouter） |
| 状态管理 | Zustand v5（3 个 store：settings / ui / draft） |
| 数据请求 | @tanstack/react-query v5 + 手写 SSE StreamClient |
| 虚拟列表 | @tanstack/react-virtual v3 |
| 构建 | Vite 7 + @vitejs/plugin-react-swc |
| 布局 | Mantine AppShell（Header 56px + Navbar 240px + Aside 320px + Footer 28px） |
| 主题 | 暗色为主（chatBg: #1a1b1e），仅 settings 有 light/dark 切换 |
| 组件数量 | 6 目录 44 组件 |

**问题:**
- 暗色主题硬编码（`var(--mantine-color-dark-6)` 等直接内联）
- Light 主题样式基本缺失，切换后视觉效果差
- 侧栏/面板/输入区样式与 Dify 风格差距大
- Inspector 完全独立，使用原生 HTML + inline style，无 Mantine 集成

### 1.2 当前 Inspector (`@vitamin/server/inspector`)

| 维度 | 现状 |
|------|------|
| UI 框架 | 无（纯 React + inline styles） |
| 依赖 | react / react-dom（server 的 devDependencies） |
| 构建 | Vite（独立 vite.config.ts，root=inspector） |
| 组件 | 6 个页面组件 + 1 个 App 壳 |
| 数据 | 直接 fetch + EventSource 轮询 |
| 样式 | 所有样式以 `style={{}}` 硬编码 |

**问题:**
- 无统一设计语言，与 Web-UI 完全脱节
- 无响应式设计
- 无主题系统
- 代码量少但全是 `any` 类型 + 硬编码颜色

---

## 2. 改造目标

### 2.1 核心目标

1. **统一技术栈** — Inspector 迁移到 Mantine，共享 Web-UI 设计 token
2. **Light 主题优先** — 参考 Dify Light 设计规范，建立完整 light/dark 双主题
3. **Dify 风格布局** — 采用 Dify 的左导航 + 中心内容 + 右侧面板三栏布局
4. **设计 Token 系统** — 基于 Dify CSS 变量体系，在 Mantine 层实现语义化 token
5. **组件复用** — 提取公共组件包 `@vitamin/ui-kit`，Inspector 和 Web-UI 共享

### 2.2 非目标

- 不引入 Tailwind CSS（维持 Mantine 的 CSS-in-JS 范式）
- 不改变 Server API 接口
- 不重构业务逻辑层（hooks / stores / services 保持不变）

---

## 3. 架构设计

### 3.1 包结构变更

```
packages/
├── ui-kit/                  # [新增] 共享设计系统 + 基础组件
│   ├── src/
│   │   ├── tokens/          # 语义化设计 token
│   │   │   ├── colors.ts    # light/dark 色板（参考 Dify）
│   │   │   ├── spacing.ts   # 间距尺度
│   │   │   ├── typography.ts # 字体尺度
│   │   │   └── shadows.ts   # 阴影定义
│   │   ├── theme/           # Mantine theme 配置
│   │   │   ├── light.ts     # light 主题
│   │   │   ├── dark.ts      # dark 主题
│   │   │   └── create-vitamin-theme.ts  # 工厂函数
│   │   ├── components/      # 共享基础组件
│   │   │   ├── app-layout/  # 三栏布局壳
│   │   │   ├── nav-sidebar/ # 左导航
│   │   │   ├── page-header/ # 页面头
│   │   │   ├── status-badge/
│   │   │   ├── code-viewer/
│   │   │   ├── diff-viewer/
│   │   │   └── timeline/
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── web-ui/                  # [改造] 聊天界面
│   └── src/
│       ├── theme.ts         # → import from @vitamin/ui-kit
│       └── ...
└── server/
    └── inspector/           # [改造] DevTools 界面
        ├── package.json     # → 新增 @vitamin/ui-kit 依赖
        └── ...
```

### 3.2 依赖关系

```
@vitamin/ui-kit
    ├── @mantine/core
    └── @mantine/hooks

@vitamin/web-ui
    ├── @vitamin/ui-kit
    ├── @mantine/core
    └── ...（现有依赖不变）

@vitamin/server (inspector)
    ├── @vitamin/ui-kit
    ├── @mantine/core       # → 从 devDep 提升
    └── @mantine/hooks      # → 新增
```

---

## 4. 设计 Token 系统

### 4.1 色板定义（参考 Dify Light 主题）

基于 Dify 的 `light.css` 变量体系，转译为 Mantine `theme.other` 语义 token：

```typescript
// packages/ui-kit/src/tokens/colors.ts

export const lightColors = {
  // 背景层级
  bg: {
    body: '#f2f4f7',              // Dify --color-background-body
    surface: '#ffffff',            // Dify --color-background-default
    surfaceSubtle: '#fcfcfd',      // Dify --color-background-default-subtle
    soft: '#f9fafb',               // Dify --color-background-soft
    hover: '#f9fafb',              // Dify --color-background-default-hover
    burn: '#e9ebf0',               // Dify --color-background-default-burn
    section: '#f9fafb',            // Dify --color-background-section
    overlay: 'rgb(16 24 40 / 0.6)',
  },

  // 文本层级
  text: {
    primary: '#101828',            // Dify --color-text-primary
    secondary: '#354052',          // Dify --color-text-secondary
    tertiary: '#676f83',           // Dify --color-text-tertiary
    quaternary: 'rgb(16 24 40 / 0.3)',
    placeholder: '#98a2b2',        // Dify --color-text-placeholder
    disabled: '#d0d5dc',           // Dify --color-text-disabled
    accent: '#155aef',             // Dify --color-text-accent
    destructive: '#d92d20',
    success: '#079455',
    warning: '#dc6803',
    onSurface: '#ffffff',
  },

  // 分割线
  divider: {
    subtle: 'rgb(16 24 40 / 0.04)',   // Dify --color-divider-subtle
    regular: 'rgb(16 24 40 / 0.08)',   // Dify --color-divider-regular
    deep: 'rgb(16 24 40 / 0.14)',      // Dify --color-divider-deep
    intense: 'rgb(16 24 40 / 0.3)',
    solid: '#d0d5dc',
  },

  // 组件 token
  panel: {
    bg: '#ffffff',                     // Dify --color-components-panel-bg
    bgBlur: 'rgb(255 255 255 / 0.95)',
    bgAlt: '#f9fafb',
    border: 'rgb(16 24 40 / 0.08)',
    borderSubtle: 'rgb(16 24 40 / 0.08)',
  },

  card: {
    bg: '#fcfcfd',                     // Dify --color-components-card-bg
    bgAlt: '#ffffff',
    border: '#ffffff',
  },

  input: {
    bg: 'rgb(200 206 218 / 0.25)',
    bgHover: 'rgb(200 206 218 / 0.14)',
    bgActive: '#f9fafb',
    borderActive: '#d0d5dc',
    text: '#101828',
    placeholder: '#98a2b2',
  },

  nav: {
    bg: 'rgb(255 255 255 / 0.8)',      // Dify --color-background-sidenav-bg
    text: '#495464',
    textActive: '#155aef',
    buttonBg: 'rgb(255 255 255 / 0)',
    buttonBgActive: '#fcfcfd',
    buttonBgHover: 'rgb(16 24 40 / 0.04)',
  },

  // 状态
  state: {
    hover: 'rgb(200 206 218 / 0.2)',
    active: 'rgb(200 206 218 / 0.4)',
    accentHover: '#eff4ff',
    accentActive: 'rgb(21 90 239 / 0.08)',
    destructiveHover: '#fef3f2',
    successHover: '#ecfdf3',
    warningHover: '#fffaeb',
  },

  // 品牌色（Dify blue-brand 色阶）
  brand: {
    50: '#f5f7ff',
    100: '#d1e0ff',
    200: '#b2caff',
    300: '#84abff',
    400: '#5289ff',
    500: '#296dff',
    600: '#155aef',
    700: '#004aeb',
  },

  // 状态指示灯
  status: {
    success: '#47cd89',
    warning: '#fdb022',
    error: '#f97066',
    running: '#36bffa',
    idle: '#98a2b2',
  },

  // Chat 专用
  chat: {
    bgGradient1: '#f9fafb',
    bgGradient2: '#f2f4f7',
    bubbleBg1: '#ffffff',
    bubbleBg2: 'rgb(255 255 255 / 0.6)',
    inputBorderColor: '#ffffff',
    inputBgMask: '#f2f4f7',
  },

  // 阴影
  shadow: {
    sm: 'rgb(9 9 11 / 0.03)',
    md: 'rgb(9 9 11 / 0.05)',
    lg: 'rgb(9 9 11 / 0.08)',
    xl: 'rgb(9 9 11 / 0.12)',
  },
} as const

export type VitaminColorTokens = typeof lightColors
```

### 4.2 Mantine Theme 工厂

```typescript
// packages/ui-kit/src/theme/create-vitamin-theme.ts

import { createTheme, type MantineThemeOverride } from '@mantine/core'
import { lightColors } from '../tokens/colors'

// Mantine primaryColor 从 Dify blue-brand 色阶映射
const brandPalette = [
  '#f5f7ff',  // 0 → brand.50
  '#eff4ff',  // 1
  '#d1e0ff',  // 2 → brand.100
  '#b2caff',  // 3 → brand.200
  '#84abff',  // 4 → brand.300
  '#5289ff',  // 5 → brand.400
  '#296dff',  // 6 → brand.500
  '#155aef',  // 7 → brand.600 (primary)
  '#004aeb',  // 8 → brand.700
  '#00329e',  // 9
] as const

export function createVitaminTheme(
  colorScheme: 'light' | 'dark' = 'light',
): MantineThemeOverride {
  // TODO: dark 版 tokens 从 Dify dark.css 翻译
  const tokens = colorScheme === 'light' ? lightColors : lightColors

  return createTheme({
    primaryColor: 'brand',
    colors: {
      brand: brandPalette,
    },
    defaultRadius: 'md',
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    fontFamilyMonospace:
      "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', monospace",
    headings: {
      fontWeight: '600',
    },
    other: tokens,
  })
}
```

### 4.3 使用方式

组件中通过 `useMantineTheme()` 访问语义 token：

```tsx
import { useMantineTheme } from '@mantine/core'

function MyComponent() {
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  return (
    <Paper style={{ background: tokens.card.bg, borderColor: tokens.divider.regular }}>
      <Text style={{ color: tokens.text.secondary }}>...</Text>
    </Paper>
  )
}
```

---

## 5. 布局改造

### 5.1 目标布局（Dify 风格三栏 Layout）

```
┌──────────────────────────────────────────────────────────┐
│  [Logo]  [模型选择]                    [主题] [设置] [用户] │ ← Header 56px
├────────┬──────────────────────────────────┬───────────────┤
│        │                                  │               │
│ 新建   │        Chat / Inspector          │  Agent 面板   │
│ 搜索   │        主内容区                    │  文件面板     │
│        │                                  │  Token 统计   │
│ ──── │                                  │               │
│ 今天   │  ┌─────────────────────────┐     │  ─────────  │
│  会话1 │  │  消息列表 (虚拟滚动)     │     │  工具历史    │
│  会话2 │  │                          │     │               │
│ ──── │  │                          │     │               │
│ 昨天   │  └─────────────────────────┘     │               │
│  会话3 │                                  │               │
│        │  ┌─────────────────────────┐     │               │
│        │  │  输入区 + 命令面板       │     │               │
│        │  └─────────────────────────┘     │               │
├────────┴──────────────────────────────────┴───────────────┤
│  模型: claude-sonnet-4          已连接                     │ ← Footer 28px
└──────────────────────────────────────────────────────────┘
```

### 5.2 布局参数（对标 Dify）

| 区域 | Dify 参考值 | Vitamin 取值 |
|------|------------|-------------|
| Header 高度 | 56px | 56px（不变） |
| 左导航宽度 | 60px icon 模式 / 240px 展开 | 240px（可折叠至 60px） |
| 右侧面板宽度 | 320px-400px | 320px（可折叠） |
| 内容区最小宽度 | 480px | 480px |
| Footer 高度 | 无 | 28px（保留状态栏） |
| 断点 mobile | < 768px | < 768px |
| 断点 tablet | 768-1199px | 768-1199px |
| 断点 desktop | >= 1200px | >= 1200px |
| 圆角 | 8px (md) / 12px (lg) | md=8px, lg=12px |
| 间距基准 | 4px 倍数 | 4px (Mantine spacing scale) |

### 5.3 左导航改造

当前 Sidebar 为会话列表，改造为 Dify 风格的垂直导航：

```
┌────────────────────┐
│  🍊 Vitamin         │  ← Logo + 品牌
│                     │
│  [+] 新建对话        │  ← Primary Action
│  🔍 搜索...          │  ← Search Input
│                     │
│  ──── 今天 ────    │  ← 时间分组
│  ○ Mock 对话示例    │  ← SessionItem (active)
│                     │
│  ──── 昨天 ────    │
│  ○ 另一个会话       │
│                     │
│  ──── 更早 ────    │
│  ○ ...              │
│                     │
│  ────────────────  │
│  ⚙ 设置            │  ← 底部 Nav
│  📊 Inspector       │  ← 跳转到 Inspector
└────────────────────┘
```

**变更点:**
- 底部增加固定导航项（Settings / Inspector）
- 折叠模式：仅显示图标，宽度收缩至 60px
- 背景色采用 `nav.bg`（半透明白色 + backdrop-blur）

### 5.4 Inspector 布局

将 Inspector 从独立 Tab 式布局改为 Dify 风格的侧边导航 + 主面板：

```
┌──────────────────────────────────────────────────────┐
│  Vitamin DevTools                    [主题] [← 返回]  │
├─────────┬────────────────────────────────────────────┤
│         │                                             │
│ Sessions│   ┌── Session Explorer ──────────────┐    │
│ Monitor │   │                                    │    │
│ Messages│   │  ID: mock-session-1                │    │
│ Thinking│   │  Status: ACTIVE                    │    │
│ Tools   │   │  Created: 2026-03-06 10:30         │    │
│ Logs    │   │                                    │    │
│         │   └────────────────────────────────────┘    │
│         │                                             │
│         │   ┌── Agent Monitor ─────────────────┐    │
│         │   │  ┌──────────┐ ┌──────────┐       │    │
│         │   │  │Sisyphus  │ │Hephaestus│       │    │
│         │   │  │  idle    │ │ running  │       │    │
│         │   │  └──────────┘ └──────────┘       │    │
│         │   └────────────────────────────────────┘    │
└─────────┴────────────────────────────────────────────┘
```

---

## 6. 组件改造清单

### 6.1 Phase 1: 基础设施 (`@vitamin/ui-kit`)

| 组件/模块 | 说明 | 优先级 |
|-----------|------|--------|
| `tokens/colors.ts` | Light/Dark 语义色 token | P0 |
| `tokens/spacing.ts` | 间距尺度 (xs=4, sm=8, md=16, lg=24, xl=32) | P0 |
| `tokens/typography.ts` | Dify 风格字体尺度 (system-xs → system-xl) | P0 |
| `tokens/shadows.ts` | 10 级阴影 (参考 Dify shadow-1 → shadow-10) | P1 |
| `theme/light.ts` | Mantine Light 主题配置 | P0 |
| `theme/dark.ts` | Mantine Dark 主题配置 | P1 |
| `theme/create-vitamin-theme.ts` | 主题工厂函数 | P0 |
| `components/app-layout/` | Dify 风格三栏 AppShell | P0 |
| `components/nav-sidebar/` | 可折叠左导航 | P0 |
| `components/page-header/` | 页面 Header | P0 |
| `components/status-badge/` | 状态指示 Badge | P1 |
| `components/code-viewer/` | 代码高亮查看器 | P1 |
| `components/diff-viewer/` | Diff 查看器 | P1 |
| `components/timeline/` | 时间线组件 | P2 |

### 6.2 Phase 2: Web-UI 改造

| 改造项 | 改动范围 | 说明 |
|--------|---------|------|
| 主题切换 | `app.tsx` / `theme.ts` | 替换为 `createVitaminTheme()`，默认 light |
| 去除暗色硬编码 | 所有组件 | 将 `var(--mantine-color-dark-*)` 替换为语义 token |
| AppShell 布局 | `layout/app-shell.tsx` | 采用新 `AppLayout` 组件 |
| 左导航 | `sidebar/sidebar.tsx` | 增加底部固定导航 + 折叠支持 |
| Header | `layout/header.tsx` | Dify 风格 Header（logo + 模型选择 + actions） |
| 消息气泡 | `chat/user-message.tsx` / `chat/assistant-message.tsx` | light 主题样式：白色卡片 + subtle 阴影 |
| 代码块 | `chat/code-block.tsx` | Shiki 双主题（github-light / one-dark-pro） |
| 输入区 | `input/chat-input.tsx` / `input/message-composer.tsx` | Dify 风格圆角输入区 + gradient mask |
| 右侧面板 | `panel/right-panel.tsx` | 统一面板背景 + 分割线 |
| 文件树 | `panel/file-tree.tsx` | 参考 Dify app-sidebar 样式 |
| Settings 页 | `routes/settings.tsx` 等 | Light 主题下卡片阴影 + 边框样式 |

### 6.3 Phase 3: Inspector 改造

| 改造项 | 改动范围 | 说明 |
|--------|---------|------|
| 引入 Mantine | `inspector/app.tsx` + `inspector/index.tsx` | MantineProvider + VitaminTheme |
| 导航重构 | `inspector/app.tsx` | 从顶部 tab 改为左侧 NavSidebar |
| SessionExplorer | `inspector/components/session-explorer.tsx` | Mantine Table + StatusBadge |
| AgentMonitor | `inspector/components/agent-monitor.tsx` | Card 网格 + 实时状态指示灯 |
| MessageInspector | `inspector/components/message-inspector.tsx` | 左右分栏 + 角色色带 |
| ThinkingLog | `inspector/components/thinking-log.tsx` | 时间线 + 展开/收起 + 自动滚动 |
| ToolsTimeline | `inspector/components/tools-timeline.tsx` | 甘特图风格时间线 |
| LogsConsole | `inspector/components/logs-console.tsx` | 等宽字体终端风格 + 级别过滤 |
| 类型安全 | 所有组件 | 消除 `any`，定义接口 |

---

## 7. Light 主题视觉规范

### 7.1 背景色层级

参考 Dify 的 3 层背景层级结构：

```
Layer 0 (body):     #f2f4f7  → 最底层页面背景
Layer 1 (surface):  #ffffff  → 卡片/面板/主内容区
Layer 2 (subtle):   #f9fafb  → 嵌套区域/section
Layer 3 (burn):     #e9ebf0  → 强调区域/hover
```

### 7.2 文本色层级

```
Primary:    #101828  → 标题/关键文本
Secondary:  #354052  → 正文
Tertiary:   #676f83  → 辅助说明
Quaternary: rgba(16,24,40,0.3) → 次要辅助
Placeholder:#98a2b2  → 占位文本
Disabled:   #d0d5dc  → 禁用状态
```

### 7.3 分割线规范

```
Subtle:   rgba(16,24,40,0.04) → Section 间分割
Regular:  rgba(16,24,40,0.08) → 组件间分割
Deep:     rgba(16,24,40,0.14) → 强分割/输入框边框
Solid:    #d0d5dc              → 实线边框
```

### 7.4 交互状态

```
Hover:     rgba(200,206,218,0.2)   → 默认 hover 背景
Active:    rgba(200,206,218,0.4)   → 默认 active 背景
AccentHov: #eff4ff                  → 品牌色 hover
AccentAct: rgba(21,90,239,0.08)    → 品牌色 active
```

### 7.5 阴影尺度

```
shadow-sm:  0 1px 2px rgba(9,9,11,0.03)
shadow-md:  0 2px 4px rgba(9,9,11,0.05)
shadow-lg:  0 4px 8px rgba(9,9,11,0.08)
shadow-xl:  0 8px 16px rgba(9,9,11,0.12)
```

### 7.6 圆角规范

```
xs:  4px  → Badge, 小按钮
sm:  6px  → 标签, 小卡片
md:  8px  → 默认（输入框, 卡片, 面板）
lg:  10px → 大卡片
xl:  12px → 对话框, 模态框
2xl: 16px → 大圆角容器
```

---

## 8. 关键组件改造示例

### 8.1 AppLayout（Dify 三栏）

```tsx
// packages/ui-kit/src/components/app-layout/app-layout.tsx

import { AppShell, Box } from '@mantine/core'
import { useMantineTheme } from '@mantine/core'
import type { ReactNode } from 'react'
import type { VitaminColorTokens } from '../../tokens/colors'

interface AppLayoutProps {
  header: ReactNode
  navbar: ReactNode
  aside?: ReactNode
  footer?: ReactNode
  children: ReactNode
  navbarCollapsed?: boolean
  asideCollapsed?: boolean
}

export function AppLayout(props: AppLayoutProps) {
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  const navWidth = props.navbarCollapsed ? 60 : 240

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: navWidth, breakpoint: 'sm' }}
      aside={props.aside && !props.asideCollapsed
        ? { width: 320, breakpoint: 'lg' }
        : undefined
      }
      footer={props.footer ? { height: 28 } : undefined}
      styles={{
        main: {
          background: tokens.bg.body,
          minHeight: '100vh',
        },
        navbar: {
          background: tokens.nav.bg,
          backdropFilter: 'blur(12px)',
          borderRight: `1px solid ${tokens.divider.subtle}`,
        },
        header: {
          background: tokens.panel.bg,
          borderBottom: `1px solid ${tokens.divider.regular}`,
        },
        aside: {
          background: tokens.panel.bg,
          borderLeft: `1px solid ${tokens.divider.subtle}`,
        },
      }}
    >
      <AppShell.Header>{props.header}</AppShell.Header>
      <AppShell.Navbar>{props.navbar}</AppShell.Navbar>
      {props.aside && !props.asideCollapsed ? (
        <AppShell.Aside>{props.aside}</AppShell.Aside>
      ) : null}
      <AppShell.Main>{props.children}</AppShell.Main>
      {props.footer ? <AppShell.Footer>{props.footer}</AppShell.Footer> : null}
    </AppShell>
  )
}
```

### 8.2 消息气泡 Light 版

```tsx
// web-ui/src/components/chat/user-message.tsx 改造示例

import { Group, Image, Paper, Text, useMantineTheme } from '@mantine/core'
import type { ChatMessage } from '../../types/message'
import type { VitaminColorTokens } from '@vitamin/ui-kit'
import { MarkdownRenderer } from './markdown-renderer'

export function UserMessage(props: { message: ChatMessage }) {
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens

  return (
    <Paper
      p="sm"
      radius="lg"
      shadow="xs"
      style={{
        background: tokens.card.bg,
        border: `1px solid ${tokens.divider.regular}`,
      }}
    >
      {/* 消息内容 */}
    </Paper>
  )
}
```

### 8.3 Inspector SessionExplorer 改造

```tsx
// server/inspector/components/session-explorer.tsx 改造示例

import { Badge, Group, Paper, Stack, Table, Text, useMantineTheme } from '@mantine/core'
import { useEffect, useState } from 'react'
import type { VitaminColorTokens } from '@vitamin/ui-kit'

interface SessionEntry {
  id: string
  status: 'active' | 'archived' | 'deleted'
  createdAt: number
  messageCount: number
}

const STATUS_COLOR: Record<string, string> = {
  active: 'green',
  archived: 'gray',
  deleted: 'red',
}

export function SessionExplorer() {
  const theme = useMantineTheme()
  const tokens = theme.other as VitaminColorTokens
  const [sessions, setSessions] = useState<SessionEntry[]>([])

  useEffect(() => {
    const fetchSessions = async () => {
      const res = await fetch('/api/sessions')
      if (res.ok) {
        setSessions(await res.json() as SessionEntry[])
      }
    }
    void fetchSessions()
    const interval = setInterval(() => void fetchSessions(), 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600} style={{ color: tokens.text.primary }}>
          Session Explorer
        </Text>
        <Badge variant="light" color="gray">{sessions.length} sessions</Badge>
      </Group>
      <Paper
        radius="md"
        style={{
          background: tokens.card.bg,
          border: `1px solid ${tokens.divider.regular}`,
          overflow: 'hidden',
        }}
      >
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Session ID</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th>Messages</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sessions.map((s) => (
              <Table.Tr key={s.id}>
                <Table.Td>
                  <Text size="sm" ff="monospace">{s.id}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={STATUS_COLOR[s.status]} variant="light" size="sm">
                    {s.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {new Date(s.createdAt).toLocaleString('zh-CN')}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{s.messageCount}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  )
}
```

---

## 9. 迁移策略

### 9.1 三阶段渐进迁移

```
Phase 1: 基础设施 (1-2 周)
├── 创建 @vitamin/ui-kit 包
├── 实现 light/dark token
├── 实现 createVitaminTheme()
├── 实现 AppLayout / NavSidebar / PageHeader
└── 编写 Storybook 或测试页面验证

Phase 2: Web-UI 改造 (2-3 周)
├── 替换 theme.ts → @vitamin/ui-kit
├── AppShellLayout → AppLayout
├── 逐组件去除暗色硬编码
├── Chat 区域 Light 样式
├── 输入区 Dify 风格
└── Settings 页 Light 样式

Phase 3: Inspector 改造 (1-2 周)
├── 引入 Mantine + @vitamin/ui-kit
├── 重构 App 壳 → AppLayout
├── 逐组件 Mantine 化
├── 类型安全修复
└── WebSocket / SSE 轮询逻辑统一
```

### 9.2 兼容性保障

- **渐进式替换**: 每个组件独立替换，不一次性全部切换
- **Feature Flag**: `useSettingsStore.colorScheme` 控制 light/dark，默认改为 `light`
- **回退机制**: 保留 `dark` 主题的 `theme.other` fallback
- **视觉回归**: 每个组件改造后截图对比

### 9.3 Inspector 独立部署保障

Inspector 目前作为 Server 的子构建（`vite build --root=inspector`），改造后：

- 新增 `@mantine/core` 和 `@vitamin/ui-kit` 为 `server` 的 `devDependencies`
- Vite 构建配置不变（`root: 'inspector'`）
- Inspector 打包产物仍输出到 `dist/inspector/`
- Server 的 `tsconfig.inspector.json` 新增 `@vitamin/ui-kit` 路径映射

---

## 10. 文件变更清单

### 新增文件

```
packages/ui-kit/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── tokens/
│   │   ├── colors.ts
│   │   ├── spacing.ts
│   │   ├── typography.ts
│   │   └── shadows.ts
│   ├── theme/
│   │   ├── light.ts
│   │   ├── dark.ts
│   │   └── create-vitamin-theme.ts
│   └── components/
│       ├── app-layout/
│       │   └── app-layout.tsx
│       ├── nav-sidebar/
│       │   └── nav-sidebar.tsx
│       ├── page-header/
│       │   └── page-header.tsx
│       ├── status-badge/
│       │   └── status-badge.tsx
│       ├── code-viewer/
│       │   └── code-viewer.tsx
│       ├── diff-viewer/
│       │   └── diff-viewer.tsx
│       └── timeline/
│           └── timeline.tsx
└── tests/
    ├── create-vitamin-theme.test.ts
    └── colors.test.ts
```

### 修改文件

```
packages/web-ui/
├── package.json                    # 新增 @vitamin/ui-kit 依赖
├── src/
│   ├── app.tsx                     # MantineProvider theme → createVitaminTheme()
│   ├── theme.ts                    # 简化为 re-export from ui-kit
│   ├── components/
│   │   ├── layout/app-shell.tsx    # 替换为 AppLayout
│   │   ├── layout/header.tsx       # Dify 风格 Header
│   │   ├── layout/status-bar.tsx   # token 化
│   │   ├── sidebar/sidebar.tsx     # 增加底部导航 + 折叠
│   │   ├── sidebar/session-item.tsx # token 化
│   │   ├── chat/user-message.tsx   # light 样式
│   │   ├── chat/assistant-message.tsx
│   │   ├── chat/code-block.tsx     # 双主题
│   │   ├── chat/tool-call-card.tsx # token 化
│   │   ├── chat/thinking-block.tsx # token 化
│   │   ├── chat/tool-result.tsx    # token 化
│   │   ├── input/chat-input.tsx    # Dify 风格
│   │   ├── input/message-composer.tsx
│   │   ├── panel/right-panel.tsx   # token 化
│   │   ├── panel/file-preview.tsx  # token 化
│   │   ├── panel/file-diff-viewer.tsx # token 化
│   │   └── panel/file-tree.tsx     # token 化
│   └── stores/settings-store.ts    # 默认值改为 'light'

packages/server/
├── package.json                    # devDep: @mantine/core, @vitamin/ui-kit
├── tsconfig.inspector.json         # paths 更新
├── inspector/
│   ├── index.tsx                   # 增加 MantineProvider
│   ├── app.tsx                     # 完全重写 → AppLayout + NavSidebar
│   └── components/
│       ├── session-explorer.tsx    # Mantine Table
│       ├── agent-monitor.tsx       # Mantine Card Grid
│       ├── message-inspector.tsx   # Mantine Split View
│       ├── thinking-log.tsx        # Mantine Timeline
│       ├── tools-timeline.tsx      # Mantine Timeline + Progress
│       └── logs-console.tsx        # Mantine Code + ScrollArea

pnpm-workspace.yaml                # 新增 packages/ui-kit
turbo.json                          # 新增 @vitamin/ui-kit 构建任务
```

---

## 11. 工作量预估

| Phase | 任务 | 预计耗时 | 人力 |
|-------|------|---------|------|
| Phase 1 | `@vitamin/ui-kit` 基础设施 | 5-7 天 | 1 人 |
| Phase 2 | Web-UI 改造 | 8-12 天 | 1-2 人 |
| Phase 3 | Inspector 改造 | 5-7 天 | 1 人 |
| 测试/调优 | 视觉回归 + 响应式测试 | 3-5 天 | 1 人 |
| **总计** | | **21-31 天** | **1-2 人** |

---

## 12. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| Mantine v7 的 CSS 变量与 Dify token 映射不完全 | Light 模式下部分组件颜色不一致 | 使用 `styles` prop 覆盖 + `theme.other` 语义 token |
| Inspector 与 Web-UI CSS 冲突 | 两个 Vite 入口的 `@mantine/core/styles.css` 可能重复打包 | Inspector 使用独立 Mantine 实例，通过 Vite 的 `build.cssCodeSplit` 配置隔离 |
| Dark 主题回退不完善 | 用户切换 dark 后视觉异常 | Phase 1 期间同步翻译 Dify dark.css token，确保双主题 token 完整性 |
| 组件内联样式遗留 | 改造遗漏导致 light 主题下出现暗色块 | 编写 ESLint 自定义规则，检测 `var(--mantine-color-dark-*)` 引用 |
| Inspector hot reload 变慢 | Mantine + ui-kit 依赖增加 | 使用 Vite 的 `optimizeDeps.include` 预构建 Mantine |

---

## 13. 验收标准

1. **Light 主题完整性** — Web-UI 和 Inspector 在 `colorScheme=light` 下所有页面视觉一致，无暗色块遗留
2. **Dark 主题兼容** — 切换到 `dark` 不出现白色闪屏或不可读文本
3. **响应式** — mobile / tablet / desktop 三断点均可正常使用
4. **Inspector 独立运行** — `pnpm dev:inspector` 可独立启动，使用 Mantine 组件
5. **类型安全** — Inspector 组件无 `any` 类型
6. **Token 覆盖率** — 组件中无直接硬编码颜色值（除 Shiki 主题名）
7. **构建成功** — `pnpm build` 和 `pnpm build:inspector` 均通过
8. **测试通过** — 现有 vitest 测试全部通过
