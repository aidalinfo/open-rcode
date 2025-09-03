import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { SubAgentModel } from '../../models/SubAgent'
import { requireUserId } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'SubAgent ID is required'
    })
  }

  const subAgent = await SubAgentModel.findById(id)

  if (!subAgent) {
    throw createError({
      statusCode: 404,
      statusMessage: 'SubAgent not found'
    })
  }

  // Check ownership
  if (subAgent.userId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You can only modify your own sub-agents'
    })
  }

  // Update fields if provided
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name must be a non-empty string'
      })
    }
    subAgent.name = body.name.trim()
  }

  if (body.description !== undefined) {
    subAgent.description = body.description?.trim() || undefined
  }

  if (body.prompt !== undefined) {
    if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Prompt must be a non-empty string'
      })
    }
    subAgent.prompt = body.prompt.trim()
  }

  if (body.isPublic !== undefined) {
    subAgent.isPublic = body.isPublic === true
  }

  await subAgent.save()

  return {
    id: subAgent._id,
    name: subAgent.name,
    description: subAgent.description,
    prompt: subAgent.prompt,
    isPublic: subAgent.isPublic,
    userId: subAgent.userId,
    createdAt: subAgent.createdAt,
    updatedAt: subAgent.updatedAt
  }
})
