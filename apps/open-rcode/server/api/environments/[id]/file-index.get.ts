import { defineEventHandler, getCookie, createError } from 'h3'
import { EnvironmentModel } from '../../../models/Environment'
import { IndexExecutor } from '../../../utils/index-executor'
import { SessionModel } from '../../../models/Session'
import { connectToDatabase } from '../../../utils/database'

export default defineEventHandler(async (event) => {
  const environmentId = getRouterParam(event, 'id')
  await connectToDatabase()
  if (!environmentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Environment ID is required'
    })
  }

  const sessionToken = getCookie(event, 'session')
  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const session = await SessionModel.findOne({ sessionToken })
  if (!session || session.expires < new Date()) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Session expired'
    })
  }

  const environment = await EnvironmentModel.findById(environmentId)
  if (!environment) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Environment not found'
    })
  }

  if (environment.userId !== session.userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const indexExecutor = new IndexExecutor()
  const indexInfo = await indexExecutor.getIndexInfo(environmentId)

  if (!indexInfo) {
    return {
      indexed: false,
      paths: [],
      indexedAt: null
    }
  }

  return {
    indexed: true,
    paths: indexInfo.paths,
    indexedAt: indexInfo.indexedAt,
    totalFiles: indexInfo.paths.length
  }
})
