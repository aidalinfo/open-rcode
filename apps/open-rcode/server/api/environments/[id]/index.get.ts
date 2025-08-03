import { defineEventHandler, getCookie, createError } from 'h3'
import { EnvironmentModel } from '~/server/models/Environment'
import { IndexExecutor } from '~/server/utils/index-executor'
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
  const indexInfo = await indexExecutor.getIndexInfo(environmentId)

  if (!indexInfo) {
    return {
      indexed: false,
      paths: [],
      indexedAt: null,
    }
  }

  return {
    indexed: true,
    paths: indexInfo.paths,
    indexedAt: indexInfo.indexedAt,
    totalFiles: indexInfo.paths.length,
  }
})