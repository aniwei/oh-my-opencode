import { createContext, createElement, useContext, type ReactNode } from 'react'

export const defaultTheme = {
  // ─── Base ───
  primary: '#fab283',
  secondary: '#47d6ab',
  accent: '#9d7cd8',
  error: '#e06c75',
  warning: '#f5a742',
  success: '#7fd88f',
  info: '#56b6c2',

  // ─── Text ───
  text: '#eeeeee',
  textMuted: '#808080',

  // ─── Backgrounds ───
  background: '#121212',
  backgroundPanel: '#1f1f1f',
  backgroundElement: '#424242',

  // ─── Borders ───
  border: '#484848',
  borderActive: '#606060',
  borderSubtle: '#3c3c3c',

  // ─── Diff ───
  diffAdded: '#4fd6be',
  diffRemoved: '#c53b53',
  diffContext: '#828bb8',
  diffHunkHeader: '#828bb8',
  diffHighlightAdded: '#b8db87',
  diffHighlightRemoved: '#e26a75',
  diffAddedBg: '#20303b',
  diffRemovedBg: '#37222c',
  diffContextBg: '#141414',
  diffLineNumber: '#1e1e1e',
  diffAddedLineNumberBg: '#1b2b34',
  diffRemovedLineNumberBg: '#2d1f26',

  // ─── Markdown ───
  markdownText: '#eeeeee',
  markdownHeading: '#9d7cd8',
  markdownLink: '#fab283',
  markdownLinkText: '#56b6c2',
  markdownCode: '#7fd88f',
  markdownBlockQuote: '#e5c07b',
  markdownEmph: '#e5c07b',
  markdownStrong: '#f5a742',
  markdownHorizontalRule: '#808080',
  markdownListItem: '#fab283',
  markdownListEnumeration: '#56b6c2',
  markdownImage: '#fab283',
  markdownImageText: '#56b6c2',
  markdownCodeBlock: '#eeeeee',

  // ─── Syntax ───
  syntaxComment: '#808080',
  syntaxKeyword: '#9d7cd8',
  syntaxFunction: '#fab283',
  syntaxVariable: '#e06c75',
  syntaxString: '#7fd88f',
  syntaxNumber: '#f5a742',
  syntaxType: '#e5c07b',
  syntaxOperator: '#56b6c2',
  syntaxPunctuation: '#eeeeee',
} as const

export type Theme = typeof defaultTheme

export const theme = defaultTheme

const ThemeContext = createContext<Theme>(defaultTheme)

interface ThemeProviderProps {
  children: ReactNode
  theme?: Theme
}

export function ThemeProvider({ children, theme }: ThemeProviderProps) {
  return createElement(ThemeContext.Provider, { value: theme ?? defaultTheme }, children)
}

export function useTheme() {
  return useContext(ThemeContext)
}

