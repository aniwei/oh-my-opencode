import { useEffect, useMemo, useState } from 'react'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

function detectBreakpoint(width: number): Breakpoint {
  if (width < 768) {
    return 'mobile'
  }

  if (width < 1200) {
    return 'tablet'
  }

  return 'desktop'
}

export function useResponsive() {
  const [width, setWidth] = useState<number>(typeof window === 'undefined' ? 1200 : window.innerWidth)

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const breakpoint = useMemo(() => detectBreakpoint(width), [width])

  return {
    width,
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
  }
}
