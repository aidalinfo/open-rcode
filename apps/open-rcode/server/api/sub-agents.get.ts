import { defineEventHandler, getQuery } from 'h3'
import { SubAgentModel } from '../models/SubAgent'
import { getUserIdFromSession } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await getUserIdFromSession(event)
  const query = getQuery(event)
  
  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 20
  const skip = (page - 1) * limit
  
  // Build query to fetch public sub-agents and user's private sub-agents
  const dbQuery: any = {
    $or: [
      { isPublic: true }
    ]
  }
  
  // If user is logged in, also include their private sub-agents
  if (userId) {
    dbQuery.$or.push({ userId, isPublic: false })
  }
  
  // Execute query with pagination
  const [subAgents, total] = await Promise.all([
    SubAgentModel.find(dbQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v'),
    SubAgentModel.countDocuments(dbQuery)
  ])
  
  return {
    subAgents,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
})