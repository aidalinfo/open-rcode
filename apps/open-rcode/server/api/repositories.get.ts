import { connectToDatabase } from '../utils/database'
import { UserModel } from '../models/User'
import { SessionModel } from '../models/Session'
import { getInstallationRepositories } from '../utils/github-app'
import { logger } from '../utils/logger'

export default defineEventHandler(async (event) => {
  try {
    await connectToDatabase()

    const sessionToken = getCookie(event, 'session')
    if (!sessionToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'No session found'
      })
    }

    const session = await SessionModel.findOne({ sessionToken })
    if (!session || session.expires < new Date()) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Session expired'
      })
    }

    const user = await UserModel.findOne({ githubId: session.userId })
    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      })
    }

    logger.debug({ userId: user.githubId, installationIds: user.githubAppInstallationIds }, 'User installation IDs in DB')

    if (!user.githubAppInstallationIds || user.githubAppInstallationIds.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'GitHub App not installed'
      })
    }

    // Récupérer les repositories de toutes les installations
    const allRepositories = []
    let totalCount = 0

    for (const installationId of user.githubAppInstallationIds) {
      try {
        const repositories = await getInstallationRepositories(installationId)
        allRepositories.push(...repositories.repositories)
        totalCount += repositories.total_count
        logger.info({ installationId, count: repositories.total_count }, 'Fetched repositories for installation')
      } catch (error) {
        logger.error({ error, installationId }, 'Error fetching repositories for installation')
      }
    }

    logger.info({ totalCount, repositories: allRepositories.map((r: any) => r.full_name) }, 'Total repositories found across all installations')

    return {
      repositories: allRepositories.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        description: repo.description,
        html_url: repo.html_url,
        default_branch: repo.default_branch,
        language: repo.language,
        updated_at: repo.updated_at
      })),
      total_count: totalCount
    }
  } catch (error) {
    logger.error({ error }, 'Error fetching repositories')
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch repositories'
    })
  }
})
