import { getUserIdFromSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Vérifier la session
    const userId = await getUserIdFromSession(event)

    if (!userId) {
      return { valid: false }
    }

    // La session est valide
    return { valid: true }
  } catch (error) {
    console.error('Session verification error:', error)
    return { valid: false }
  }
})
