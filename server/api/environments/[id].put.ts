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
    
    const body = await readBody(event)
    
    // Validation du runtime si fourni
    if (body.runtime && !['node', 'php', 'python'].includes(body.runtime)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Runtime must be one of: node, php, python'
      })
    }
    
    // Construire l'objet de mise à jour
    const updateData: any = {}
    if (body.name) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.runtime) updateData.runtime = body.runtime
    if (body.environmentVariables) updateData.environmentVariables = body.environmentVariables
    if (body.configurationScript !== undefined) updateData.configurationScript = body.configurationScript
    if (body.organization && body.repository) {
      updateData.organization = body.organization
      updateData.repository = body.repository
      updateData.repositoryFullName = `${body.organization}/${body.repository}`
    }
    
    const environment = await EnvironmentModel.findOneAndUpdate(
      {
        _id: id,
        userId: user.githubId
      },
      updateData,
      { new: true, lean: true }
    )
    
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
        environmentVariables: environment.environmentVariables,
        configurationScript: environment.configurationScript,
        createdAt: environment.createdAt,
        updatedAt: environment.updatedAt
      }
    }
  } catch (error) {
    console.error('Error updating environment:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update environment'
    })
  }
})