import { TaskMessageModel } from '../../../models/TaskMessage'
import { connectToDatabase } from '../../../utils/database'

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const taskId = event.context.params?.id

  if (!taskId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Task ID is required'
    })
  }

  try {
    const messages = await TaskMessageModel.find({ taskId }).sort({ createdAt: 1 })

    return { messages }
  } catch (error) {
    console.error('Error fetching messages:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error'
    })
  }
})
