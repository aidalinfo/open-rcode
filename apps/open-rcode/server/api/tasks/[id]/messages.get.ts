import { TaskMessageModel } from '../../../models/TaskMessage'
import { TaskModel } from '../../../models/Task'
import { connectToDatabase } from '../../../utils/database'
import { logger } from '../../../utils/logger'
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
    // Vérifier que la tâche appartient à l'utilisateur
    const task = await TaskModel.findOne({ _id: taskId, userId: user.githubId })
    if (!task) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Task not found'
      })
    }

    // Optional incremental fetch: only return messages created after `since` timestamp (ISO string)
    const query = getQuery(event)
    let since: Date | undefined
    if (query.since && typeof query.since === 'string') {
      const date = new Date(query.since)
      if (!isNaN(date.getTime())) {
        since = date
      }
    }

    const filter: any = { taskId }
    if (since) {
      filter.createdAt = { $gt: since }
    }

    const messages = await TaskMessageModel.find(filter)
      .select('id userId taskId role content type createdAt')
      .sort({ createdAt: 1 })
      .lean()

    return { messages }
  } catch (error) {
    logger.error({ error, taskId }, 'Error fetching messages')
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error'
    })
  }
})
