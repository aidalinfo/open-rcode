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

    if (!body.anthropicKey) {
      // Suppression de la clé API
      user.anthropicKey = undefined
      await user.save()
      return {
        success: true,
        message: 'API key deleted successfully'
      }
    }

    // Vérifier que l'API key commence par sk-ant-
    if (!body.anthropicKey.startsWith('sk-ant-')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid Anthropic API key format'
      })
    }

    // Chiffrer l'API key
    const encryptedKey = encrypt(body.anthropicKey)

    // Sauvegarder
    user.anthropicKey = encryptedKey
    await user.save()

    return {
      success: true,
      message: 'API key saved successfully'
    }
  } catch (error) {
    console.error('Error saving Anthropic API key:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to save API key: ${error.message}`
    })
  }
})
