import { connectToDatabase } from '../utils/database'
import { UserModel } from '../models/User'
import { SessionModel } from '../models/Session'
import { KanbanProjectModel } from '../models/KanbanProject'
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

    const body = await readBody(event)
    const { name, description, environmentId } = body

    if (!name || !environmentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name and environmentId are required'
      })
    }

    const environment = await EnvironmentModel.findById(environmentId)
    if (!environment || environment.userId !== user.githubId) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Environment not found or access denied'
      })
    }

    const project = new KanbanProjectModel({
      userId: user.githubId,
      environmentId,
      name,
      description,
      kanbanTaskIds: []
    })

    await project.save()

    return {
      project: {
        _id: project._id,
        name: project.name,
        description: project.description,
        environmentId: project.environmentId,
        environment: environment.name,
        kanbanTaskIds: project.kanbanTaskIds,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      }
    }
  } catch (error) {
    console.error('Error creating kanban project:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create kanban project: ${error.message}`
    })
  }
})
