import type { BlessedIntrinsicElements, BlessedIntrinsicElementsPrefixed } from 'react-blessed'

declare global {
  namespace JSX {
    interface IntrinsicElements
      extends BlessedIntrinsicElements,
        BlessedIntrinsicElementsPrefixed {}
  }
}

export {}
