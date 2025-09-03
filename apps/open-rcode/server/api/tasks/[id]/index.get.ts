import { TaskModel } from '../../../models/Task'
import { connectToDatabase } from '../../../utils/database'
import { requireUser } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const user = await requireUser(event)
  const taskId = event.context.params?.id

  if (!taskId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Task ID is required'
    })
  }

  try {
    const task = await TaskModel.findOne({ _id: taskId, userId: user.githubId })

    if (!task) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Task not found'
      })
    }

    return { task }
  } catch (error) {
    console.error('Error fetching task:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error'
    })
  }
})
