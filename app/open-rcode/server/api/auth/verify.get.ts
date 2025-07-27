import { Session } from '~/server/models/Session'
import type { User } from '~/server/models/User'
import { verifySession } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Récupérer le cookie de session
    const sessionCookie = getCookie(event, 'session')
    
    if (!sessionCookie) {
      return { valid: false }
    }

    // Vérifier la session
    const session = await verifySession(event)
    
    if (!session) {
      return { valid: false }
    }

    // La session est valide
    return { valid: true }
  } catch (error) {
    console.error('Session verification error:', error)
    return { valid: false }
  }
})