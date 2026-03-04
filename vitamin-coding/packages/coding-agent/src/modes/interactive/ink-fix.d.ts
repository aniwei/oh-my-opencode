/**
 * Fix for React 19 @types/react v19 + Ink v6 type incompatibility.
 *
 * React 19's JSX types require components to return `ReactNode | Promise<ReactNode>`,
 * but Ink's ForwardRefExoticComponent returns `ReactElement | null`, which fails
 * structural assignability because `ReactElement` is missing the `children` property
 * that `ReactPortal` (part of the `ReactNode` union) requires.
 *
 * This module augmentation re-declares Box and Text as FC returning ReactNode.
 */
import type { BoxProps, TextProps } from 'ink'
import type { FC, ReactNode } from 'react'

declare module 'ink' {
  export const Box: FC<BoxProps & { children?: ReactNode }>
  export const Text: FC<TextProps & { children?: ReactNode }>
}
