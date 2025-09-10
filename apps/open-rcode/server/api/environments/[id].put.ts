import { connectToDatabase } from '../../utils/database'
import { EnvironmentModel } from '../../models/Environment'
import { requireUserId } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    await connectToDatabase()

    const { id } = getRouterParams(event)
    const userId = await requireUserId(event)

    const body = await readBody(event)

    // Validation du runtime si fourni
    if (body.runtime && !['node', 'python', 'bun', 'java', 'swift', 'ruby', 'rust', 'go', 'php'].includes(body.runtime)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Runtime must be one of: node, python, bun, java, swift, ruby, rust, go, php'
      })
    }

    // Validation du provider AI si fourni
    if (body.aiProvider && !['anthropic-api', 'claude-oauth', 'gemini-cli', 'codex-api', 'codex-oauth'].includes(body.aiProvider)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'aiProvider must be one of: anthropic-api, claude-oauth, gemini-cli, codex-api, codex-oauth'
      })
    }

    // Validation du modèle si fourni
    if (body.model && !['opus', 'sonnet', 'opus-4-1'].includes(body.model)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'model must be one of: opus, sonnet, opus-4-1'
      })
    }

    // Construire l'objet de mise à jour
    const updateData: any = {}
    if (body.name) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.runtime) updateData.runtime = body.runtime
    if (body.aiProvider) updateData.aiProvider = body.aiProvider
    if (body.model) updateData.model = body.model
    if (body.defaultBranch) updateData.defaultBranch = body.defaultBranch
    if (body.environmentVariables) updateData.environmentVariables = body.environmentVariables
    if (body.configurationScript !== undefined) updateData.configurationScript = body.configurationScript
    if (body.subAgents !== undefined) updateData.subAgents = body.subAgents
    if (body.organization && body.repository) {
      updateData.organization = body.organization
      updateData.repository = body.repository
      updateData.repositoryFullName = `${body.organization}/${body.repository}`
    }

    const environment = await EnvironmentModel.findOneAndUpdate(
      {
        _id: id,
        userId: userId
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
    console.error('Error updating environment:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update environment'
    })
  }
})
