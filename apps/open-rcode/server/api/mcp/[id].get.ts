import { defineEventHandler, getRouterParam, createError } from 'h3'
import { McpModel } from '../../models/Mcp'
import { requireUserId } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'MCP id is required' })
  }

  const mcp = await McpModel.findById(id).select('-__v')
  if (!mcp) {
    throw createError({ statusCode: 404, statusMessage: 'MCP not found' })
  }
  if (mcp.userId !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }

  return mcp
})

