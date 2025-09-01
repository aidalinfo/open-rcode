import { connectToDatabase } from '../utils/database'
import { UserModel } from '../models/User'
import { SessionModel } from '../models/Session'
import { KanbanTaskModel } from '../models/KanbanTask'
import { KanbanProjectModel } from '../models/KanbanProject'

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
    const { kanbanProjectId, title, message, taskId, status, plannifiedAt } = body

    if (!kanbanProjectId || !title) {
      throw createError({
        statusCode: 400,
        statusMessage: 'kanbanProjectId and title are required'
      })
    }

    const project = await KanbanProjectModel.findById(kanbanProjectId)
    if (!project || project.userId !== user.githubId) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Project not found or access denied'
      })
    }

    const task = new KanbanTaskModel({
      kanbanProjectId,
      userId: user.githubId,
      taskId,
      title,
      message,
      status: status || 'todo',
      plannifiedAt
    })

    await task.save()

    // Ajouter l'ID de la tâche au projet
    project.kanbanTaskIds.push(task._id.toString())
    await project.save()

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
    console.error('Error creating kanban task:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create kanban task: ${error.message}`
    })
  }
})
