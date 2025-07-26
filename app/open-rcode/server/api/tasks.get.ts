import { connectToDatabase } from '../utils/database'
import { UserModel } from '../models/User'
import { SessionModel } from '../models/Session'
import { TaskModel } from '../models/Task'
import { EnvironmentModel } from '../models/Environment'

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
    
    // Récupérer les tâches de l'utilisateur avec l'environnement
    const tasks = await TaskModel.find({ userId: user.githubId })
      .populate('environmentId', 'name')
      .sort({ createdAt: -1 })
      .limit(50)
      .exec()
    
    // Formater les données pour le frontend
    const formattedTasks = tasks.map(task => {
      // Extraire le numéro de PR de l'URL si elle existe
      let prData = null
      if (task.pr) {
        const prMatch = task.pr.match(/\/pull\/(\d+)/)
        if (prMatch) {
          prData = {
            url: task.pr,
            number: parseInt(prMatch[1])
          }
        }
      }
      
      return {
        _id: task._id,
        name: task.name,
        status: task.status,
        executed: task.executed,
        merged: task.merged,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        environment: task.environmentId ? {
          name: task.environmentId.name
        } : null,
        pr: prData,
        dockerId: task.dockerId,
        error: task.error
      }
    })
    
    return {
      tasks: formattedTasks
    }
  } catch (error) {
    console.error('Error fetching tasks:', error)
    
    // Si c'est une erreur createError (déjà formatée)
    if (error.statusCode) {
      throw error
    }
    
    // Erreur générique
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch tasks: ${error.message}`
    })
  }
})