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
    
    const environment = await EnvironmentModel.findOne({
      _id: id,
      userId: user.githubId
    }).lean()
    
    if (!environment) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Environment not found'
      })
    }
    
    return {
      environment: {
        id: environment._id,
        organization: environment.organization,
        repository: environment.repository,
        repositoryFullName: environment.repositoryFullName,
        name: environment.name,
        description: environment.description,
        runtime: environment.runtime,
        aiProvider: environment.aiProvider,
        defaultBranch: environment.defaultBranch,
        environmentVariables: environment.environmentVariables,
        configurationScript: environment.configurationScript,
        createdAt: environment.createdAt,
        updatedAt: environment.updatedAt
      }
    }
  } catch (error) {
    console.error('Error fetching environment:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch environment'
    })
  }
})