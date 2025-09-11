import { connectToDatabase } from '../utils/database'
import { UserModel } from '../models/User'
import { SessionModel } from '../models/Session'
import { EnvironmentModel } from '../models/Environment'
import { logger } from '../utils/logger'

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
    logger.debug({ body, userId: user.githubId }, 'Environment POST body')

    // Validation des données
    if (!body.organization || !body.repository || !body.name || !body.runtime || !body.defaultBranch) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: organization, repository, name, runtime, defaultBranch'
      })
    }

    if (!['node', 'python', 'bun', 'java', 'swift', 'ruby', 'rust', 'go', 'php'].includes(body.runtime)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Runtime must be one of: node, python, bun, java, swift, ruby, rust, go, php'
      })
    }

    // Validation du provider AI si fourni
    if (body.aiProvider && !['anthropic-api', 'claude-oauth', 'gemini-cli'].includes(body.aiProvider)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'aiProvider must be one of: anthropic-api, claude-oauth, gemini-cli'
      })
    }

    // Validation du modèle si fourni
    if (body.model && !['opus', 'sonnet', 'opus-4-1'].includes(body.model)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'model must be one of: opus, sonnet, opus-4-1'
      })
    }

    // Créer l'environnement
    const environment = new EnvironmentModel({
      userId: user.githubId,
      organization: body.organization,
      repository: body.repository,
      repositoryFullName: `${body.organization}/${body.repository}`,
      name: body.name,
      description: body.description,
      runtime: body.runtime,
      aiProvider: body.aiProvider || 'anthropic-api',
      model: body.model || 'sonnet',
      defaultBranch: body.defaultBranch,
      environmentVariables: body.environmentVariables || [],
      configurationScript: body.configurationScript,
      subAgents: body.subAgents || [],
      // MCP: disabled by default; accept optional initial selection
      mcpEnabled: typeof body.mcpEnabled === 'boolean' ? body.mcpEnabled : false,
      mcpIds: Array.isArray(body.mcpIds) ? body.mcpIds : []
    })

    await environment.save()

    return {
      environment: {
        _id: environment._id,
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
        mcpEnabled: environment.mcpEnabled,
        mcpIds: environment.mcpIds,
        createdAt: environment.createdAt,
        updatedAt: environment.updatedAt
      }
    }
  } catch (error) {
    logger.error({ error, userId: user?.githubId }, 'Error creating environment')

    // Si c'est une erreur de validation Mongoose
    if (error.name === 'ValidationError') {
      throw createError({
        statusCode: 400,
        statusMessage: `Validation error: ${error.message}`
      })
    }

    // Si c'est une erreur createError (déjà formatée)
    if (error.statusCode) {
      throw error
    }

    // Erreur générique
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create environment: ${error.message}`
    })
  }
})
