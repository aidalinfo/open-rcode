import { connectToDatabase } from '../../utils/database'
import { EnvironmentModel } from '../../models/Environment'
import { requireUserId } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    await connectToDatabase()

    const { id } = getRouterParams(event)
    const userId = await requireUserId(event)

    const environment = await EnvironmentModel.findOne({
      _id: id,
      userId: userId
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
        model: environment.model,
        defaultBranch: environment.defaultBranch,
        environmentVariables: environment.environmentVariables,
        configurationScript: environment.configurationScript,
        subAgents: environment.subAgents,
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
