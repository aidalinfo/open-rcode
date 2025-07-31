import { connectToDatabase } from '../../utils/database'
import { UserModel } from '../../models/User'
import { SessionModel } from '../../models/Session'
import { encrypt } from '../../utils/crypto'

export default defineEventHandler(async (event) => {
  try {
    await connectToDatabase()
    
    const sessionToken = getCookie(event, 'session')
    if (!sessionToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'No session found'
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
    
    const body = await readBody(event)
    
    if (!body.claudeOAuthToken) {
      // Suppression du token OAuth
      user.claudeOAuthToken = undefined
      await user.save()
      return {
        success: true,
        message: 'OAuth token deleted successfully'
      }
    }
    
    // Chiffrer le token OAuth
    const encryptedToken = encrypt(body.claudeOAuthToken)
    
    // Sauvegarder
    user.claudeOAuthToken = encryptedToken
    await user.save()
    
    return {
      success: true,
      message: 'OAuth token saved successfully'
    }
  } catch (error) {
    console.error('Error saving Claude OAuth token:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to save OAuth token: ${error.message}`
    })
  }
})