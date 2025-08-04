import { defineEventHandler, getRouterParam, createError } from 'h3'
import { SubAgentModel } from '../../models/SubAgent'
import { requireUserId } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')
  
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
      statusMessage: 'You can only delete your own sub-agents'
    })
  }
  
  await SubAgentModel.deleteOne({ _id: id })
  
  return {
    success: true,
    message: 'SubAgent deleted successfully'
  }
})