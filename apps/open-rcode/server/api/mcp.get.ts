import { defineEventHandler, getQuery } from 'h3'
import { McpModel } from '../models/Mcp'
import { requireUserId } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const query = getQuery(event)

  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 20
  const skip = (page - 1) * limit

  const [mcps, total] = await Promise.all([
    McpModel.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v'),
    McpModel.countDocuments({ userId })
  ])

  return {
    mcps,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
})

