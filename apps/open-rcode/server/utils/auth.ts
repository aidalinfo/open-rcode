import type { H3Event } from 'h3'
import { SessionModel } from '../models/Session'
import { UserModel } from '../models/User'

export async function getUserIdFromSession(event: H3Event): Promise<string | null> {
  const sessionToken = getCookie(event, 'session')
  if (!sessionToken) {
    return null
  }

  const session = await SessionModel.findOne({ sessionToken })
  if (!session || session.expires < new Date()) {
    return null
  }

  return session.userId
}

export async function requireUserId(event: H3Event): Promise<string> {
  const userId = await getUserIdFromSession(event)

  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'No valid session found'
    })
  }

  return userId
}

export async function requireUser(event: H3Event) {
  const userId = await requireUserId(event)

  const user = await UserModel.findOne({ githubId: userId })
  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    })
  }

  return user
}
