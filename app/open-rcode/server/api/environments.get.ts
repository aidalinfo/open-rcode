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
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10
    const skip = (page - 1) * limit
    
    // Construire le filtre
    const filter: any = { userId: user.githubId }
    if (repository) {
      filter.repositoryFullName = repository
    }
    
    // Compter le total d'éléments
    const total = await EnvironmentModel.countDocuments(filter)
    
    // Récupérer les environnements avec pagination
    const environments = await EnvironmentModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
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
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  } catch (error) {
    console.error('Error fetching environments:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch environments'
    })
  }
})