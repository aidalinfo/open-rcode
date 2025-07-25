import { connectToDatabase } from '../utils/database'
import { UserModel } from '../models/User'
import { SessionModel } from '../models/Session'
import { EnvironmentModel } from '../models/Environment'

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
    
    const query = getQuery(event)
    const repository = query.repository as string
    
    // Construire le filtre
    const filter: any = { userId: user.githubId }
    if (repository) {
      filter.repositoryFullName = repository
    }
    
    const environments = await EnvironmentModel.find(filter)
      .sort({ createdAt: -1 })
      .lean()
    
    return {
      environments: environments.map(env => ({
        id: env._id,
        organization: env.organization,
        repository: env.repository,
        repositoryFullName: env.repositoryFullName,
        name: env.name,
        description: env.description,
        runtime: env.runtime,
        aiProvider: env.aiProvider,
        model: env.model,
        defaultBranch: env.defaultBranch,
        environmentVariables: env.environmentVariables,
        configurationScript: env.configurationScript,
        createdAt: env.createdAt,
        updatedAt: env.updatedAt
      })),
      total_count: environments.length
    }
  } catch (error) {
    console.error('Error fetching environments:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch environments'
    })
  }
})