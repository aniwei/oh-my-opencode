import { useContext } from 'react'
import { Context } from './c'

export const useParams = () => {
  const context = useContext(Context)
  return context.params
}
