import { Children, cloneElement, isValidElement, useEffect, useMemo, useState } from 'react'

import { Context } from './Context'
import useRouter, { useNavigate } from './hooks'

import type { ReactElement, ReactNode } from 'react'

interface MatchedRoute {
  element: ReactElement
  params: Record<string, string>
}

interface RouteProps {
  path?: string
  index?: boolean
  element: ReactElement
}

interface RouterProps {
  children: ReactNode
  defaultUrl?: string
}

interface LinkProps {
  to: string
  children: ReactElement
}

interface NavigateProps {
  to: string
  replace?: boolean
}

function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const normalizedPattern = pattern === '' ? '/' : pattern
  const normalizedPathname = pathname === '' ? '/' : pathname

  if (normalizedPattern === '*') {
    return {}
  }

  const patternParts = normalizedPattern.split('/').filter(Boolean)
  const pathnameParts = normalizedPathname.split('/').filter(Boolean)

  if (normalizedPattern === '/' && normalizedPathname === '/') {
    return {}
  }

  if (patternParts.length !== pathnameParts.length) {
    return null
  }

  const params: Record<string, string> = {}

  for (let index = 0; index < patternParts.length; index++) {
    const patternPart = patternParts[index]
    const pathnamePart = pathnameParts[index]

    if (!patternPart || !pathnamePart) {
      return null
    }

    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = pathnamePart
      continue
    }

    if (patternPart !== pathnamePart) {
      return null
    }
  }

  return params
}

function resolveMatchedRoute(children: ReactNode, pathname: string): MatchedRoute | null {
  let indexRoute: MatchedRoute | null = null

  for (const child of Children.toArray(children)) {
    if (!isValidElement<RouteProps>(child)) {
      continue
    }

    const routeProps = child.props

    if (routeProps.index) {
      indexRoute = {
        element: routeProps.element,
        params: {},
      }
      continue
    }

    if (!routeProps.path) {
      continue
    }

    const params = matchPath(routeProps.path, pathname)
    if (params) {
      return {
        element: routeProps.element,
        params,
      }
    }
  }

  if (pathname === '/') {
    return indexRoute
  }

  return null
}

export const Route = (_props: RouteProps) => {
  return null
}

export const IndexRoute = ({ element }: { element: ReactElement }) => {
  return <Route index={true} element={element} />
}

export const Routes = ({ children }: { children: ReactNode }) => {
  const router = useRouter()

  const matched = useMemo(() => {
    return resolveMatchedRoute(children, router.currentPath)
  }, [children, router.currentPath])

  if (!matched) {
    return null
  }

  return (
    <Context.Provider
      value={{
        currentPath: router.currentPath,
        setCurrentPath: router.setCurrentPath,
        params: matched.params,
      }}>
      {matched.element}
    </Context.Provider>
  )
}

export const Navigate = ({ to }: NavigateProps) => {
  const navigate = useNavigate()

  useEffect(() => {
    navigate(to)
  }, [navigate, to])

  return null
}

export const Link = ({ to, children }: LinkProps) => {
  const navigate = useNavigate()

  if (!isValidElement(children)) {
    return null
  }

  return cloneElement(children, {
    onPress: () => navigate(to),
  } as { onPress: () => void })
}

export const Router = ({ children, defaultUrl = '/' }: RouterProps) => {
  const [currentPath, setCurrentPathValue] = useState(defaultUrl)

  const setCurrentPath = (to: string) => {
    if (!to) {
      return
    }
    setCurrentPathValue(to)
  }

  return (
    <Context.Provider value={{ currentPath, setCurrentPath, params: {} }}>
      {children}
    </Context.Provider>
  )
}

export default Router
