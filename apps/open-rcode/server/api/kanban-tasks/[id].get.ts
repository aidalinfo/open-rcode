import { connectToDatabase } from '../../utils/database'
import { UserModel } from '../../models/User'
import { SessionModel } from '../../models/Session'
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

    return {
      task: {
        _id: task._id,
        kanbanProjectId: task.kanbanProjectId,
        taskId: task.taskId,
        title: task.title,
        message: task.message,
        error: task.error,
        status: task.status,
        plannifiedAt: task.plannifiedAt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      }
    }
  } catch (error) {
    console.error('Error fetching kanban task:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch kanban task: ${error.message}`
    })
  }
})
