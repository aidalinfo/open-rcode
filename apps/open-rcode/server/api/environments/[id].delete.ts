import { connectToDatabase } from '../../utils/database'
import { UserModel } from '../../models/User'
import { SessionModel } from '../../models/Session'
import { EnvironmentModel } from '../../models/Environment'

export default defineEventHandler(async (event) => {
  try {
    await connectToDatabase()
    
    const { id } = getRouterParams(event)
    
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
    
    const environment = await EnvironmentModel.findOneAndDelete({
      _id: id,
      userId: user.githubId
    })
    
    if (!environment) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Environment not found'
      })
    }
    
    return {
      message: 'Environment deleted successfully',
      deletedEnvironment: {
        id: environment._id,
        name: environment.name,
        repositoryFullName: environment.repositoryFullName
      }
    }
  } catch (error) {
    console.error('Error deleting environment:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete environment'
    })
  }
})