/**
 * Border configuration constants for session layout.
 *
 * EmptyBorder clears all border characters; SplitBorder renders a vertical
 * separator line between content areas.
 */
export const EmptyBorder = {
  topLeft: '',
  bottomLeft: '',
  vertical: '',
  topRight: '',
  bottomRight: '',
  horizontal: ' ',
  bottomT: '',
  topT: '',
  cross: '',
  leftT: '',
  rightT: '',
} as const

export const SplitBorder = {
  border: ['left', 'right'] as const,
  customBorderChars: {
    ...EmptyBorder,
    vertical: '┃',
  },
} as const
