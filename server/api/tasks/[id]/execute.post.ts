import { executeClaudeInTask } from '../../../utils/task-container'
import { TaskModel } from '../../../models/Task'
import { connectToDatabase } from '../../../utils/database'

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
    task.messages.push({
      role: 'user',
      content: body.prompt,
      timestamp: new Date()
    })

    task.messages.push({
      role: 'assistant',
      content: `**Résultat de l'exécution:**\n\`\`\`\n${output}\n\`\`\``,
      timestamp: new Date()
    })

    await task.save()

    return {
      success: true,
      output,
      message: 'Command executed successfully'
    }
  } catch (error) {
    console.error('Error executing command in task container:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to execute command: ${error instanceof Error ? error.message : String(error)}`
    })
  }
})