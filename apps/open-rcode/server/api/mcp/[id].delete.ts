import { defineEventHandler, getRouterParam, createError } from 'h3'
import { McpModel } from '../../models/Mcp'
import { requireUserId } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'MCP id is required' })
  }

  const mcp = await McpModel.findById(id)
  if (!mcp) {
    throw createError({ statusCode: 404, statusMessage: 'MCP not found' })
  }
  if (mcp.userId !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'You can only delete your own MCP entries' })
  }

  await McpModel.deleteOne({ _id: id })

  return { success: true }
})

