import { useContext } from 'react'
import { Context } from './context'

export const useParams = () => {
  const context = useContext(Context)
  return context.params
}
