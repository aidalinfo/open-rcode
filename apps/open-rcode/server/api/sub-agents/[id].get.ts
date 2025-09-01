import { defineEventHandler, getRouterParam, createError } from 'h3'
import { SubAgentModel } from '../../models/SubAgent'
import { getUserIdFromSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const userId = await getUserIdFromSession(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'SubAgent ID is required'
    })
  }

  const subAgent = await SubAgentModel.findById(id).select('-__v')

  if (!subAgent) {
    throw createError({
      statusCode: 404,
      statusMessage: 'SubAgent not found'
    })
  }

  // Check permissions: must be public or owned by the user
  if (!subAgent.isPublic && subAgent.userId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Access denied'
    })
  }

  return subAgent
})
