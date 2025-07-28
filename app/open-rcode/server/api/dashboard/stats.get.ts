import { connectToDatabase } from '../../utils/database'
import { UserModel } from '../../models/User'
import { SessionModel } from '../../models/Session'
import { TaskModel } from '../../models/Task'
import { EnvironmentModel } from '../../models/Environment'
import { UserCostModel } from '../../models/UserCost'

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
    
    // Récupérer les statistiques en parallèle
    const [taskCount, totalCost, pullRequestCount, environmentCount] = await Promise.all([
      // Nombre total de tâches
      TaskModel.countDocuments({ userId: user.githubId }),
      
      // Coût total en USD
      UserCostModel.aggregate([
        { $match: { userId: user.githubId } },
        { $group: { _id: null, total: { $sum: '$costUsd' } } }
      ]).then(result => result[0]?.total || 0),
      
      // Nombre de pull requests (tâches avec PR)
      TaskModel.countDocuments({ 
        userId: user.githubId, 
        pr: { $exists: true, $ne: null } 
      }),
      
      // Nombre d'environnements
      EnvironmentModel.countDocuments({ userId: user.githubId })
    ])
    
    return {
      stats: {
        taskCount,
        totalCostUSD: totalCost,
        pullRequestCount,
        environmentCount
      }
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    
    // Si c'est une erreur createError (déjà formatée)
    if (error.statusCode) {
      throw error
    }
    
    // Erreur générique
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch dashboard stats: ${error.message}`
    })
  }
})