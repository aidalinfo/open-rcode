import { requireUser } from '../utils/auth'

export default defineEventHandler(async (event) => {
  // Authentification requise
  const user = await requireUser(event)
  
  return {
    hello: 'world',
    user: user.githubId
  }
})
