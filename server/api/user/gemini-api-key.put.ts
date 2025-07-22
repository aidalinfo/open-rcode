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
    
    if (!body.geminiApiKey) {
      // Suppression de la clé API
      user.geminiApiKey = undefined
      await user.save()
      return {
        success: true,
        message: 'Gemini API key deleted successfully'
      }
    }
    
    // Chiffrer la clé API
    const encryptedKey = encrypt(body.geminiApiKey)
    
    // Sauvegarder
    user.geminiApiKey = encryptedKey
    await user.save()
    
    return {
      success: true,
      message: 'Gemini API key saved successfully'
    }
  } catch (error) {
    console.error('Error saving Gemini API key:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to save Gemini API key: ${error.message}`
    })
  }
})