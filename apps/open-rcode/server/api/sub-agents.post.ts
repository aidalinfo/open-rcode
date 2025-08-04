import { defineEventHandler, readBody, createError } from 'h3'
import { SubAgentModel } from '../models/SubAgent'
import { requireUserId } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await readBody(event)
  
  // Validate required fields
  if (!body.name || typeof body.name !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Name is required and must be a string'
    })
  }
  
  if (!body.prompt || typeof body.prompt !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Prompt is required and must be a string'
    })
  }
  
  // Create new sub-agent
  const subAgent = new SubAgentModel({
    name: body.name.trim(),
    description: body.description?.trim(),
    prompt: body.prompt.trim(),
    isPublic: body.isPublic === true,
    userId
  })
  
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