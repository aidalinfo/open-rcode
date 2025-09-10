import { connectToDatabase } from '../../utils/database'
import { UserModel } from '../../models/User'
import { SessionModel } from '../../models/Session'
import { encrypt } from '../../utils/crypto'

export default defineEventHandler(async (event) => {
  try {
    await connectToDatabase()

    const sessionToken = getCookie(event, 'session')
    if (!sessionToken) {
      throw createError({ statusCode: 401, statusMessage: 'No session found' })
    }

    const session = await SessionModel.findOne({ sessionToken })
    if (!session || session.expires < new Date()) {
      throw createError({ statusCode: 401, statusMessage: 'Session expired' })
    }

    const user = await UserModel.findOne({ githubId: session.userId })
    if (!user) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    const body = await readBody(event)

    // Accept either object or JSON string
    const rawJson = body?.codexOAuthJson

    if (!rawJson) {
      // Delete
      user.codexOAuthJson = undefined
      await user.save()
      return { success: true, message: 'Codex OAuth JSON deleted successfully' }
    }

    const jsonString = typeof rawJson === 'string' ? rawJson : JSON.stringify(rawJson)

    user.codexOAuthJson = encrypt(jsonString)
    await user.save()

    return { success: true, message: 'Codex OAuth JSON saved successfully' }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: `Failed to save Codex OAuth JSON: ${error.message}` })
  }
})

