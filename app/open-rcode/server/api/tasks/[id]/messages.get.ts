import { TaskMessageModel } from '../../../models/TaskMessage'
import { connectToDatabase } from '../../../utils/database'
import { logger } from '../../../utils/logger'

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
    logger.error({ error, taskId }, 'Error fetching messages')
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error'
    })
  }
})
