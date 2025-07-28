import { connectToDatabase } from '../../utils/database'
import { UserModel } from '../../models/User'
import { SessionModel } from '../../models/Session'
import { KanbanProjectModel } from '../../models/KanbanProject'
import { EnvironmentModel } from '../../models/Environment'

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
    
    const projectId = getRouterParam(event, 'id')
    if (!projectId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Project ID is required'
      })
    }
    
    const project = await KanbanProjectModel.findById(projectId)
    if (!project || project.userId !== user.githubId) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Project not found or access denied'
      })
    }
    
    const environment = await EnvironmentModel.findById(project.environmentId)
    
    return {
      project: {
        _id: project._id,
        name: project.name,
        description: project.description,
        environmentId: project.environmentId,
        environment: environment?.name || null,
        kanbanTaskIds: project.kanbanTaskIds,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      }
    }
  } catch (error) {
    console.error('Error fetching kanban project:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch kanban project: ${error.message}`
    })
  }
})