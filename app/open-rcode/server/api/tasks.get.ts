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
    
    // Récupérer les paramètres de pagination
    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10
    const skip = (page - 1) * limit
    
    // Récupérer le nombre total de tâches pour la pagination
    const total = await TaskModel.countDocuments({ userId: user.githubId })
    
    // Récupérer les tâches de l'utilisateur avec pagination
    const tasks = await TaskModel.find({ userId: user.githubId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec()
    
    // Récupérer tous les environnements en une seule requête
    const environmentIds = tasks.map(task => task.environmentId).filter(Boolean)
    const environments = await EnvironmentModel.find({ _id: { $in: environmentIds } })
    const environmentMap = new Map(environments.map(env => [env._id.toString(), env]))
    
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
      
      // Récupérer l'environnement depuis le map
      const environment = task.environmentId ? environmentMap.get(task.environmentId) : null
      
      return {
        _id: task._id,
        name: task.name,
        status: task.status,
        executed: task.executed,
        merged: task.merged,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        environment: environment ? {
          name: environment.name
        } : null,
        pr: prData,
        dockerId: task.dockerId,
        error: task.error
      }
    })
    
    return {
      tasks: formattedTasks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
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