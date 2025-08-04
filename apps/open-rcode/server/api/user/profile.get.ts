import { UserModel } from '../../models/User'
import { SessionModel } from '../../models/Session'
import { connectToDatabase } from '../../utils/database'

export default defineEventHandler(async (event) => {
  await connectToDatabase()
  
  const sessionToken = getCookie(event, 'session')
  
  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const session = await SessionModel.findOne({ sessionToken })
  if (!session || session.expires < new Date()) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Session expired'
    })
  }

  const user = await UserModel.findOne({ githubId: session.userId })
  
  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    })
  }

  // Ne retourner que les informations publiques
  return {
    githubId: user.githubId,
    username: user.username,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    bio: user.bio,
    location: user.location,
    role: user.role,
    hasAnthropicKey: !!user.anthropicKey,
    hasClaudeOAuthToken: !!user.claudeOAuthToken,
    hasGeminiApiKey: !!user.geminiApiKey,
    githubAppInstalled: user.githubAppInstallationIds && user.githubAppInstallationIds.length > 0
  }
})
