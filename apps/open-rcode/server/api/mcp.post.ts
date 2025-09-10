import { defineEventHandler, readBody, createError } from 'h3'
import { McpModel, type McpType } from '../models/Mcp'
import { requireUserId } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await readBody(event)

  // Basic validation
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const type = body?.type as McpType | undefined
  const url = typeof body?.url === 'string' ? body.url.trim() : undefined
  const command = typeof body?.command === 'string' ? body.command.trim() : undefined
  const args = Array.isArray(body?.args) ? body.args.map((a: any) => String(a)) : []
  const description = typeof body?.description === 'string' ? body.description.trim() : undefined

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }
  if (!type || !['sse', 'stdio'].includes(type)) {
    throw createError({ statusCode: 400, statusMessage: 'Type must be "sse" or "stdio"' })
  }
  if (type === 'sse' && !url) {
    throw createError({ statusCode: 400, statusMessage: 'URL is required for type "sse"' })
  }
  if (type === 'stdio' && !command) {
    throw createError({ statusCode: 400, statusMessage: 'Command is required for type "stdio"' })
  }

  const mcp = new McpModel({
    userId,
    name,
    type,
    url,
    command,
    args,
    description
  })

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

