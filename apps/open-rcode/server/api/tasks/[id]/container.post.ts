import { createTaskContainer } from '../../../utils/task-container'
import { TaskModel } from '../../../models/Task'
import { EnvironmentModel } from '../../../models/Environment'
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

    const environment = await EnvironmentModel.findById(task.environmentId)
    if (!environment) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Environment not found for this task'
      })
    }

    // Lance la création du container en arrière-plan
    setImmediate(async () => {
      try {
        await createTaskContainer({
          taskId,
          runtimeVersion: environment.runtime,
          additionalEnvVars: environment.environmentVariables.reduce((acc: Record<string, string>, v: any) => {
            acc[v.key] = v.value
            return acc
          }, {} as Record<string, string>)
        })

        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId,
          role: 'assistant',
          content: `Container created successfully for task`
        })
      } catch (error) {
        logger.error({ error, taskId }, 'Background container creation failed')
        // Optionnel: créer un message d'erreur
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId,
          role: 'assistant',
          content: `Container creation failed: ${error instanceof Error ? error.message : String(error)}`
        })
      }
    })

    return {
      success: true,
      message: 'Container creation started in background'
    }
  } catch (error: any) {
    logger.error({ error, taskId }, 'Error creating task container')

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create container: ${error instanceof Error ? error.message : String(error)}`
    })
  }
})
