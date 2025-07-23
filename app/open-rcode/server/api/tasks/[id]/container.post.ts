import { createTaskContainer } from '../../../utils/task-container'
import { TaskModel } from '../../../models/Task'
import { EnvironmentModel } from '../../../models/Environment'
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
    
    const result = await createTaskContainer({
      taskId,
      runtime: environment.runtime,
      repositoryUrl: `https://github.com/${environment.repositoryFullName}.git`,
      additionalEnvVars: environment.environmentVariables.reduce((acc, v) => {
        acc[v.key] = v.value
        return acc
      }, {} as Record<string, string>)
    })


    return {
      success: true,
      container: result,
      message: 'Container created successfully for task'
    }
  } catch (error: any) {
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