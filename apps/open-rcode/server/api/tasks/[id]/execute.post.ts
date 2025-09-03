import { executeClaudeInTask } from '../../../utils/task-container'
import { TaskModel } from '../../../models/Task'
import { TaskMessageModel } from '../../../models/TaskMessage'
import { connectToDatabase } from '../../../utils/database'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../../../utils/logger'

export default defineEventHandler(async (event) => {
  try {
    await connectToDatabase()

    const taskId = getRouterParam(event, 'id')
    if (!taskId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Task ID is required'
      })
    }

    const body = await readBody(event)

    if (!body.prompt) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Prompt is required'
      })
    }

    // Vérifier que la tâche existe et a un conteneur
    const task = await TaskModel.findById(taskId)
    if (!task) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Task not found'
      })
    }

    if (!task.dockerId) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Task has no associated container. Create one first.'
      })
    }

    // Exécuter la commande Claude
    const output = await executeClaudeInTask(taskId, body.prompt)

    // Ajouter la commande et le résultat aux messages de la tâche
    await TaskMessageModel.create({
      id: uuidv4(),
      userId: task.userId,
      taskId,
      role: 'user',
      content: body.prompt
    })

    await TaskMessageModel.create({
      id: uuidv4(),
      userId: task.userId,
      taskId,
      role: 'assistant',
      content: `**Résultat de l'exécution:**\n\`\`\`\n${output}\n\`\`\``
    })

    return {
      success: true,
      output,
      message: 'Command executed successfully'
    }
  } catch (error) {
    logger.error({ error, taskId }, 'Error executing command in task container')

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to execute command: ${error instanceof Error ? error.message : String(error)}`
    })
  }
})
