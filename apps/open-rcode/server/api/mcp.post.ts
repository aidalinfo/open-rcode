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
  // Normalize args: accept string or array, split by spaces, support quotes
  const parseArgs = (input: unknown): string[] => {
    const tokens: string[] = []
    const pushTokens = (s: string) => {
      const re = /"([^"]*)"|'([^']*)'|[^\s]+/g
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
    }
    return tokens
  }
  const args = parseArgs(body?.args)
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
