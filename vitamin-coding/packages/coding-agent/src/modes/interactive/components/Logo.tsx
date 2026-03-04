import { Box, Text } from 'ink'
import { theme } from '../theme.js'

/**
 * ASCII logo with shadow rendering.
 *
 * Shadow markers in the art strings:
 * - `_` → full shadow cell (space with background color)
 * - `^` → letter top with shadow bottom (▀ char)
 * - `~` → shadow top only (▀ char in shadow color)
 */

function tint(bg: string, fg: string, amount: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '')
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ] as const
  }
  const [br, bg2, bb] = parse(bg)
  const [fr, fg2, fb] = parse(fg)
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount)
  const r = mix(br, fr)
  const g = mix(bg2, fg2)
  const b = mix(bb, fb)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

const SHADOW_MARKER = /[_^~]/

const logoLeft = [
  '        _    _ _   ',
  '  _   _(_)_ ^~     ',
  ' ^~ |_   _^~_ ___ ',
  '  \\ V / _^~ _ ^~_\\',
]

const logoRight = [
  '             _ _             ',
  '  ___ ___  _| (_)_ __   __ _',
  ' / __/ _ \\/ _` | | \'_ \\ / _` |',
  '| (_| (_) | (_| | | | | | (_| |',
  ' \\___\\___/ \\__,_|_|_| |_|\\__, |',
  '                          |___/ ',
]

interface LineSegment {
  text: string
  color: string
  bold?: boolean
  backgroundColor?: string
}

function renderLineSegments(
  line: string,
  fg: string,
  bold: boolean,
): LineSegment[] {
  const shadow = tint(theme.background, fg, 0.25)
  const segments: LineSegment[] = []
  let i = 0

  while (i < line.length) {
    const rest = line.slice(i)
    const markerIndex = rest.search(SHADOW_MARKER)

    if (markerIndex === -1) {
      segments.push({ text: rest, color: fg, bold })
      break
    }

    if (markerIndex > 0) {
      segments.push({ text: rest.slice(0, markerIndex), color: fg, bold })
    }

    const marker = rest[markerIndex]
    switch (marker) {
      case '_':
        segments.push({ text: ' ', color: fg, backgroundColor: shadow, bold })
        break
      case '^':
        segments.push({ text: '▀', color: fg, backgroundColor: shadow, bold })
        break
      case '~':
        segments.push({ text: '▀', color: shadow, bold: false })
        break
    }

    i += markerIndex + 1
  }

  return segments
}

export function Logo() {
  const maxLines = Math.max(logoLeft.length, logoRight.length)
  const lines = Array.from({ length: maxLines }, (_, i) => ({
    left: logoLeft[i] ?? '',
    right: logoRight[i] ?? '',
  }))

  return (
    <Box flexDirection="column">
      {lines.map((line, index) => (
        <Box key={index} flexDirection="row">
          <Box flexDirection="row">
            {renderLineSegments(line.left, theme.textMuted, false).map(
              (seg, j) => (
                <Text
                  key={j}
                  color={seg.color}
                  backgroundColor={seg.backgroundColor}
                  bold={seg.bold}
                >
                  {seg.text}
                </Text>
              ),
            )}
          </Box>
          <Text> </Text>
          <Box flexDirection="row">
            {renderLineSegments(line.right, theme.text, true).map(
              (seg, j) => (
                <Text
                  key={j}
                  color={seg.color}
                  backgroundColor={seg.backgroundColor}
                  bold={seg.bold}
                >
                  {seg.text}
                </Text>
              ),
            )}
          </Box>
        </Box>
      ))}
    </Box>
  )
}
