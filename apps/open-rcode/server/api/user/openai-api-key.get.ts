import { connectToDatabase } from '../../utils/database'
import { UserModel } from '../../models/User'
import { SessionModel } from '../../models/Session'

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

    return { hasApiKey: !!user.openaiApiKey }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: `Failed to check OpenAI API key: ${error.message}` })
  }
})

