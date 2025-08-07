import { connectToDatabase } from '../utils/database'
import { UserModel } from '../models/User'
import { SessionModel } from '../models/Session'
import { TaskModel } from '../models/Task'
import { TaskMessageModel } from '../models/TaskMessage'
import { EnvironmentModel } from '../models/Environment'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../utils/logger'

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
    
    const body = await readBody(event)
    
    // Validation des données
    if (!body.environmentId || !body.message) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: environmentId, message'
      })
    }
    
    // Vérifier que l'environnement appartient à l'utilisateur
    const environment = await EnvironmentModel.findOne({ 
      _id: body.environmentId, 
      userId: user.githubId 
    })
    if (!environment) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Environment not found or not accessible'
      })
    }
    
    // Générer un nom pour la task basé sur le message (premiers mots)
    const taskName = body.message.split(' ').slice(0, 5).join(' ').substring(0, 50)
    
    // Créer la task
    const task = new TaskModel({
      userId: user.githubId,
      environmentId: body.environmentId,
      name: taskName,
      messages: [{
        role: 'user',
        content: body.message,
        timestamp: new Date()
      }],
      merged: false,
      executed: false,
      planMode: body.planMode || false,
      autoMerge: body.autoMerge || false
    })
    
    await task.save()
    
    // Sauvegarder le message initial de l'utilisateur dans TaskMessageModel
    await TaskMessageModel.create({
      id: uuidv4(),
      userId: user.githubId,
      taskId: task._id,
      role: 'user',
      content: body.message
    })
    
    return {
      task: {
        id: task._id,
        userId: task.userId,
        environmentId: task.environmentId,
        name: task.name,
        messages: task.messages,
        dockerId: task.dockerId,
        pr: task.pr,
        merged: task.merged,
        executed: task.executed,
        error: task.error,
        planMode: task.planMode,
        autoMerge: task.autoMerge,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      }
    }
  } catch (error: any) {
    logger.error({ error, userId: session?.userId }, 'Error creating task')
    
    // Si c'est une erreur de validation Mongoose
    if (error.name === 'ValidationError') {
      throw createError({
        statusCode: 400,
        statusMessage: `Validation error: ${error.message}`
      })
    }
    
    // Si c'est une erreur createError (déjà formatée)
    if (error.statusCode) {
      throw error
    }
    
    // Erreur générique
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create task: ${error instanceof Error ? error.message : String(error)}`
    })
  }
})