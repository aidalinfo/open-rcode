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
    
    const query = getQuery(event)
    const kanbanProjectId = query.kanbanProjectId as string
    const status = query.status as string
    
    const filter: any = { userId: user.githubId }
    if (kanbanProjectId) {
      const project = await KanbanProjectModel.findById(kanbanProjectId)
      if (!project || project.userId !== user.githubId) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Project not found or access denied'
        })
      }
      filter.kanbanProjectId = kanbanProjectId
    }
    if (status) {
      filter.status = status
    }
    
    const tasks = await KanbanTaskModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .exec()
    
    const formattedTasks = tasks.map(task => ({
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
    }))
    
    return {
      tasks: formattedTasks
    }
  } catch (error) {
    console.error('Error fetching kanban tasks:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch kanban tasks: ${error.message}`
    })
  }
})