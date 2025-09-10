import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { McpModel, type McpType } from '../../models/Mcp'
import { requireUserId } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'MCP id is required' })
  }

  const mcp = await McpModel.findById(id)
  if (!mcp) {
    throw createError({ statusCode: 404, statusMessage: 'MCP not found' })
  }
  if (mcp.userId !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'You can only modify your own MCP entries' })
  }

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Name must be a non-empty string' })
    }
    mcp.name = body.name.trim()
  }

  if (body.type !== undefined) {
    const type = body.type as McpType
    if (!['sse', 'stdio'].includes(type)) {
      throw createError({ statusCode: 400, statusMessage: 'Type must be "sse" or "stdio"' })
    }
    mcp.type = type
  }

  if (body.url !== undefined) {
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    mcp.url = url || undefined
  }

  if (body.command !== undefined) {
    const command = typeof body.command === 'string' ? body.command.trim() : ''
    mcp.command = command || undefined
  }

  if (body.args !== undefined) {
    if (!Array.isArray(body.args)) {
      throw createError({ statusCode: 400, statusMessage: 'Args must be an array of strings' })
    }
    mcp.args = body.args.map((a: any) => String(a))
  }

  if (body.description !== undefined) {
    mcp.description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : undefined
  }

  // Additional type-specific validation
  if (mcp.type === 'sse' && !mcp.url) {
    throw createError({ statusCode: 400, statusMessage: 'URL is required for type "sse"' })
  }
  if (mcp.type === 'stdio' && !mcp.command) {
    throw createError({ statusCode: 400, statusMessage: 'Command is required for type "stdio"' })
  }

  await mcp.save()

  return {
    id: mcp._id,
    userId: mcp.userId,
    name: mcp.name,
    type: mcp.type,
    url: mcp.url,
    command: mcp.command,
    args: mcp.args,
    description: mcp.description,
    createdAt: mcp.createdAt,
    updatedAt: mcp.updatedAt
  }
})

