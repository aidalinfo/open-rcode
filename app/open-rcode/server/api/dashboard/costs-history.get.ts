import { connectToDatabase } from '../../utils/database'
import { UserModel } from '../../models/User'
import { SessionModel } from '../../models/Session'
import { UserCostModel } from '../../models/UserCost'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from 'date-fns'

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
    
    const query = getQuery(event)
    const period = query.period as 'daily' | 'weekly' | 'monthly' || 'daily'
    const days = parseInt(query.days as string) || 30
    
    let startDate: Date
    let endDate = new Date()
    let groupBy: any
    
    switch (period) {
      case 'daily':
        startDate = subDays(endDate, days)
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        }
        break
      case 'weekly':
        startDate = subWeeks(endDate, Math.ceil(days / 7))
        groupBy = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' }
        }
        break
      case 'monthly':
        startDate = subMonths(endDate, Math.ceil(days / 30))
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        }
        break
    }
    
    const costs = await UserCostModel.aggregate([
      {
        $match: {
          userId: user.githubId,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: groupBy,
          amount: { $sum: '$costUsd' },
          date: { $first: '$createdAt' }
        }
      },
      {
        $sort: { date: 1 }
      }
    ])
    
    return {
      costs: costs.map(c => ({
        date: c.date,
        amount: c.amount
      })),
      period,
      startDate,
      endDate
    }
  } catch (error) {
    console.error('Error fetching costs history:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch costs history: ${error.message}`
    })
  }
})