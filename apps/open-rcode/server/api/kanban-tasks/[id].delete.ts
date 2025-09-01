import { connectToDatabase } from '../../utils/database'
import { UserModel } from '../../models/User'
import { SessionModel } from '../../models/Session'
import { KanbanTaskModel } from '../../models/KanbanTask'
import { KanbanProjectModel } from '../../models/KanbanProject'

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

    const taskId = getRouterParam(event, 'id')
    if (!taskId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Task ID is required'
      })
    }

    const task = await KanbanTaskModel.findById(taskId)
    if (!task || task.userId !== user.githubId) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Task not found or access denied'
      })
    }

    // Retirer l'ID de la tâche du projet
    const project = await KanbanProjectModel.findById(task.kanbanProjectId)
    if (project) {
      project.kanbanTaskIds = project.kanbanTaskIds.filter(id => id !== taskId)
      await project.save()
    }

    // Supprimer la tâche
    await KanbanTaskModel.deleteOne({ _id: taskId })

    return {
      success: true,
      message: 'Task deleted successfully'
    }
  } catch (error) {
    console.error('Error deleting kanban task:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to delete kanban task: ${error.message}`
    })
  }
})
