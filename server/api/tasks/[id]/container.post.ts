import { createTaskContainer } from '../../../utils/task-container'
import { TaskModel } from '../../../models/Task'
import { TaskMessageModel } from '../../../models/TaskMessage'
import { connectToDatabase } from '../../../utils/database'
import { v4 as uuidv4 } from 'uuid'

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

    // Vérifier que la tâche existe et n'a pas déjà un conteneur
    const task = await TaskModel.findById(taskId)
    if (!task) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Task not found'
      })
    }

    if (task.dockerId) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Task already has an associated container'
      })
    }

    const body = await readBody(event)
    
    // Créer le conteneur pour la tâche
    const result = await createTaskContainer({
      taskId,
      runtimeVersion: body.runtimeVersion,
      workspaceDir: body.workspaceDir,
      additionalEnvVars: body.environmentVariables
    })

    await TaskMessageModel.create({
      id: uuidv4(),
      userId: task.userId,
      taskId,
      role: 'assistant',
      content: `Container created successfully for task`
    })

    return {
      success: true,
      container: result,
      message: 'Container created successfully for task'
    }
  } catch (error) {
    console.error('Error creating task container:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create container: ${error instanceof Error ? error.message : String(error)}`
    })
  }
})