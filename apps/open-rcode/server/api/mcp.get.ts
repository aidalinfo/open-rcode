import { defineEventHandler, getQuery } from 'h3'
import { McpModel } from '../models/Mcp'
import { requireUserId } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const query = getQuery(event)

  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 20
  const skip = (page - 1) * limit
  const rawQ = typeof query.q === 'string' ? query.q.trim() : ''

  const filter: Record<string, unknown> = { userId }
  if (rawQ) {
    const escapeRegExp = (value: string) => value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&')
    filter.name = { $regex: escapeRegExp(rawQ), $options: 'i' }
  }

  const [mcps, total] = await Promise.all([
    McpModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v'),
    McpModel.countDocuments(filter)
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
