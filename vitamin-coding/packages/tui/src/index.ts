// @vitamin/tui — 终端 UI 框架

// 渲染引擎
export { Renderer, createRenderer } from './renderer'
export type { Component } from './renderer'

// 终端抽象
export { Terminal, createTerminal } from './terminal'
export type { TerminalConfig } from './terminal'

// 主题系统
export { ThemeManager, createThemeManager, DARK_THEME, LIGHT_THEME } from './theme'
export type { ThemeConfig, ThemeColors } from './theme'

// 工具
export { stripAnsi, isFullWidth, measureWidth, truncateToWidth, padToWidth, wrapText } from './utils/measure'
export {
  COLORS, color256, bgColor256, colorRgb, bgColorRgb, style,
  SYNC_START, SYNC_END, moveCursor, moveUp, moveDown, clearLine, clearScreen,
  hideCursor, showCursor,
} from './utils/ansi'

// 输入处理
export { parseKey, isPrintable } from './input/key-parser'
export type { ParsedKey } from './input/key-parser'
export { ImeHandler, createImeHandler } from './input/ime-handler'
export type { ImeState } from './input/ime-handler'

// 组件
export { TextComponent, createTextComponent } from './components/text'
export type { TextConfig } from './components/text'
export { InputComponent, createInputComponent } from './components/input'
export type { InputConfig } from './components/input'
export { EditorComponent, createEditorComponent } from './components/editor'
export type { EditorConfig } from './components/editor'
export { MarkdownComponent, createMarkdownComponent } from './components/markdown'
export type { MarkdownConfig } from './components/markdown'
export { LoaderComponent, createLoaderComponent } from './components/loader'
export type { LoaderConfig } from './components/loader'
export { SelectListComponent, createSelectListComponent } from './components/select-list'
export type { SelectListConfig, SelectItem } from './components/select-list'
export { BoxComponent, createBoxComponent, ROUNDED_BORDER, SQUARE_BORDER } from './components/box'
export type { BoxConfig, BorderStyle } from './components/box'
export { ImageComponent, createImageComponent, detectImageProtocol } from './components/image'
export type { ImageConfig, ImageProtocol } from './components/image'

// 业务级渲染组件
export { ToolOutputComponent, createToolOutputComponent } from './components/tool-output'
export type { ToolOutputConfig } from './components/tool-output'
export { AgentHeaderComponent, createAgentHeaderComponent } from './components/agent-header'
export type { AgentHeaderConfig } from './components/agent-header'
export { SessionListComponent, createSessionListComponent } from './components/session-list'
export type { SessionListConfig, SessionEntry } from './components/session-list'
export { MessageDisplayComponent, createMessageDisplayComponent } from './components/message-display'
export type { MessageDisplayConfig, MessageEntry, MessageRole } from './components/message-display'

// Overlay 系统
export { OverlayManager, createOverlayManager } from './overlays/overlay-manager'
export type { Overlay } from './overlays/overlay-manager'
