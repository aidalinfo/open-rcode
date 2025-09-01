import { defineEventHandler, getCookie, createError, getRouterParam, setResponseStatus } from 'h3'
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

  let userId: string
  const session = await SessionModel.findOne({ sessionToken })
  if (!session || session.expires < new Date()) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Session expired'
    })
  }
  userId = session.userId

  const environment = await EnvironmentModel.findById(environmentId)
  if (!environment) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Environment not found'
    })
  }

  if (environment.userId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  const indexExecutor = new IndexExecutor()

  setResponseStatus(event, 202)

  indexExecutor.executeIndexing(environmentId, userId).catch((error) => {
    console.error('Background indexing failed:', error)
  })

  return {
    message: 'Indexing started',
    environmentId
  }
})
