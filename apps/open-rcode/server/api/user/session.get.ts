import { getUserIdFromSession } from '../../utils/auth'
import { connectToDatabase } from '../../utils/database'

export default defineEventHandler(async (event) => {
  try {
    await connectToDatabase()
    const userId = await getUserIdFromSession(event)

    if (!userId) {
      return { valid: false }
    }

    return { valid: true }
  } catch (error) {
    console.error('Session verification error:', error)
    return { valid: false }
  }
})
