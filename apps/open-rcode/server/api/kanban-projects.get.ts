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

    const query = getQuery(event)
    const environmentId = query.environmentId as string

    const filter: any = { userId: user.githubId }
    if (environmentId) {
      filter.environmentId = environmentId
    }

    const projects = await KanbanProjectModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .exec()

    const environmentIds = projects.map(p => p.environmentId).filter(Boolean)
    const environments = await EnvironmentModel.find({ _id: { $in: environmentIds } })
    const environmentMap = new Map(environments.map(env => [env._id.toString(), env]))

    const formattedProjects = projects.map(project => ({
      _id: project._id,
      name: project.name,
      description: project.description,
      environmentId: project.environmentId,
      environment: project.environmentId ? environmentMap.get(project.environmentId)?.name : null,
      kanbanTaskIds: project.kanbanTaskIds,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    }))

    return {
      projects: formattedProjects
    }
  } catch (error) {
    console.error('Error fetching kanban projects:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch kanban projects: ${error.message}`
    })
  }
})
