import { defineEventHandler, getCookie, createError, getRouterParam, setResponseStatus } from 'h3'
import { EnvironmentModel } from '../../../models/Environment'
import { IndexExecutor } from '../../../utils/index-executor'
import jwt from 'jsonwebtoken'

export default defineEventHandler(async (event) => {
  const environmentId = getRouterParam(event, 'id')
  
  if (!environmentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Environment ID is required',
    })
  }

  const sessionToken = getCookie(event, 'session')
  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  let userId: string
  try {
    const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET || 'secret') as any
    userId = decoded.userId
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid session',
    })
  }

  const environment = await EnvironmentModel.findById(environmentId)
  if (!environment) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Environment not found',
    })
  }

  if (environment.userId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }

  const indexExecutor = new IndexExecutor()

  setResponseStatus(event, 202)
  
  indexExecutor.executeIndexing(environmentId, userId).catch((error) => {
    console.error('Background indexing failed:', error)
  })

  return {
    message: 'Indexing started',
    environmentId,
  }
})