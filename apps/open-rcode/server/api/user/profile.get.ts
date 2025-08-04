import { UserModel } from '../../models/User'

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, 'session')
  
  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const user = await UserModel.findOne({ githubId: sessionToken })
  
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
