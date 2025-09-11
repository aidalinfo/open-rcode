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
    const parseArgs = (input: unknown): string[] => {
      const tokens: string[] = []
      const re = /"([^"]*)"|'([^']*)'|[^\s]+/g
      const pushTokens = (s: string) => {
        let m: RegExpExecArray | null
        while ((m = re.exec(s)) !== null) {
          const val = (m[1] ?? m[2] ?? m[0]).trim()
          if (val) tokens.push(val)
        }
      }
      if (typeof input === 'string') {
        pushTokens(input)
      } else if (Array.isArray(input)) {
        for (const part of input) {
          if (typeof part === 'string') pushTokens(part)
          else if (part != null) pushTokens(String(part))
        }
      } else if (input != null) {
        pushTokens(String(input))
      }
      return tokens
    }
    mcp.args = parseArgs(body.args)
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
