import { connectToDatabase } from '../../utils/database'
import { UserModel } from '../../models/User'
import { SessionModel } from '../../models/Session'
import { KanbanProjectModel } from '../../models/KanbanProject'
import { KanbanTaskModel } from '../../models/KanbanTask'

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

    // Supprimer toutes les tâches associées
    await KanbanTaskModel.deleteMany({ kanbanProjectId: projectId })

    // Supprimer le projet
    await KanbanProjectModel.deleteOne({ _id: projectId })

    return {
      success: true,
      message: 'Project deleted successfully'
    }
  } catch (error) {
    console.error('Error deleting kanban project:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to delete kanban project: ${error.message}`
    })
  }
})
