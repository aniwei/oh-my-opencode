import { useContext } from 'react'
import { Context } from './Context'

export default function useRouter() {
  return useContext(Context)
}

export const useNavigate = () => {
  const context = useContext(Context)

  return (to: string) => {
    context.setCurrentPath?.(to)
  }
}

export const useParams = () => {
  const context = useContext(Context)
  return context.params
}

export const useLocation = () => {
  const context = useContext(Context)
  return {
    pathname: context.currentPath,
  }
}