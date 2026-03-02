const COLORS = {
  gray: '\x1b[90m',
  brightCyan: '\x1b[96m',
  white: '\x1b[97m',
  reset: '\x1b[0m',
}

function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;]*m/g, '')
}

function measureWidth(input: string): number {
  return stripAnsi(input).length
}

function truncateToWidth(input: string, width: number): string {
  if (width <= 0) return ''
  const clean = stripAnsi(input)
  if (clean.length <= width) return input
  return clean.slice(0, width)
}

function padToWidth(input: string, width: number): string {
  const current = measureWidth(input)
  if (current >= width) return input
  return input + ' '.repeat(width - current)
}

function style(input: string, color: string): string {
  return `${color}${input}${COLORS.reset}`
}

interface PageShellSidebar {
  title: string
  lines: string[]
}

type SidebarPosition = 'left' | 'right'

export interface PageShellInput {
  title: string
  width: number
  height?: number
  meta?: string[]
  body: string[]
  bodyMaxWidth?: number
  bodyCenter?: boolean
  sidebar?: PageShellSidebar
  sidebarPosition?: SidebarPosition
  bodyAlign?: 'start' | 'end'
  statusLine?: string
  hints?: string[]
}

function layoutBodyLines(
  body: string[],
  availableWidth: number,
  maxWidth?: number,
  center = false,
): string[] {
  const contentWidth = Math.max(1, Math.min(availableWidth, maxWidth ?? availableWidth))

  return body.map((line) => {
    const clipped = measureWidth(line) > contentWidth ? truncateToWidth(line, contentWidth) : line
    if (!center || contentWidth >= availableWidth) {
      return clipped
    }

    const horizontalPadding = Math.max(0, Math.floor((availableWidth - contentWidth) / 2))
    const lineWidth = measureWidth(clipped)
    return ' '.repeat(horizontalPadding) + padToWidth(clipped, lineWidth)
  })
}

function renderHeader(input: PageShellInput): string[] {
  const lines: string[] = []
  const border = style('┃', COLORS.gray)
  const borderDim = style('╹', COLORS.gray)

  lines.push(`${border} ${style('#', COLORS.brightCyan)} ${style(input.title, COLORS.white)}`)
  for (const metaLine of input.meta ?? []) {
    lines.push(`${border} ${style(metaLine, COLORS.gray)}`)
  }
  lines.push(`${borderDim} ${style('─'.repeat(Math.max(0, input.width - 4)), COLORS.gray)}`)

  return lines
}

function renderFooter(input: PageShellInput): string[] {
  const lines: string[] = []

  lines.push(style('─'.repeat(input.width), COLORS.gray))
  if (input.statusLine) {
    lines.push(style(` ${input.statusLine}`, COLORS.gray))
  }
  for (const hint of input.hints ?? []) {
    lines.push(style(` ${hint}`, COLORS.gray))
  }

  return lines
}

function renderBodyWithSidebar(
  body: string[],
  sidebar: PageShellSidebar,
  width: number,
  position: SidebarPosition,
  bodyMaxWidth?: number,
  bodyCenter = false,
): string[] {
  if (width < 110) {
    return layoutBodyLines(body, width, bodyMaxWidth, bodyCenter)
  }

  const gap = ' │ '
  const minSidebarWidth = 26
  const maxSidebarWidth = 38
  const computedSidebarWidth = Math.floor(width * 0.3)
  const sidebarWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, computedSidebarWidth))
  const mainWidth = Math.max(20, width - sidebarWidth - measureWidth(gap))

  const mainLines = layoutBodyLines(body, mainWidth, bodyMaxWidth, bodyCenter)
  const sidebarTitle = style(sidebar.title, COLORS.brightCyan)
  const sidebarLines = [sidebarTitle, ...sidebar.lines]
  const totalRows = Math.max(mainLines.length, sidebarLines.length)

  const merged: string[] = []
  for (let i = 0; i < totalRows; i++) {
    const mainRaw = mainLines[i] ?? ''
    const sideRaw = sidebarLines[i] ?? ''

    const main = padToWidth(truncateToWidth(mainRaw, mainWidth), mainWidth)
    const side = padToWidth(truncateToWidth(sideRaw, sidebarWidth), sidebarWidth)

    if (position === 'left') {
      merged.push(side + style(gap, COLORS.gray) + main)
    } else {
      merged.push(main + style(gap, COLORS.gray) + side)
    }
  }

  return merged
}

export function renderPageShell(input: PageShellInput): string[] {
  const header = renderHeader(input)
  const body = input.sidebar
    ? renderBodyWithSidebar(
        input.body,
        input.sidebar,
        input.width,
        input.sidebarPosition ?? 'right',
        input.bodyMaxWidth,
        input.bodyCenter ?? false,
      )
    : layoutBodyLines(input.body, input.width, input.bodyMaxWidth, input.bodyCenter ?? false)
  const footer = renderFooter(input)

  if (typeof input.height !== 'number' || input.height <= 0) {
    return [...header, ...body, ...footer]
  }

  const staticRows = header.length + footer.length
  const bodyRows = Math.max(0, input.height - staticRows)
  const clippedBody = input.bodyAlign === 'end' ? body.slice(-bodyRows) : body.slice(0, bodyRows)

  const paddedBody = [...clippedBody]
  while (paddedBody.length < bodyRows) {
    paddedBody.push('')
  }

  return [...header, ...paddedBody, ...footer]
}
