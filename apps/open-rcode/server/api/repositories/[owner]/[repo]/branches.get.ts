import { connectToDatabase } from '../../../../utils/database'
import { UserModel } from '../../../../models/User'
import { SessionModel } from '../../../../models/Session'
import { getRepositoryBranches } from '../../../../utils/github-app'
import { logger } from '../../../../utils/logger'

export default defineEventHandler(async (event) => {
  try {
    await connectToDatabase()

    const { owner, repo } = getRouterParams(event)

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

    if (!user.githubAppInstallationIds || user.githubAppInstallationIds.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'GitHub App not installed'
      })
    }

    // Essayer de récupérer les branches avec chaque installation ID
    let branches = []
    for (const installationId of user.githubAppInstallationIds) {
      try {
        branches = await getRepositoryBranches(installationId, owner, repo)
        logger.info({ branchCount: branches.length, owner, repo, installationId }, 'Found branches for repository')
        break // Si on trouve, on arrête
      } catch (error) {
        logger.debug({ installationId, owner, repo }, 'Installation does not have access to repository')
        continue
      }
    }

    if (branches.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Repository not found or no access'
      })
    }

    return {
      branches: branches.map((branch: any) => ({
        name: branch.name,
        commit: {
          sha: branch.commit.sha,
          url: branch.commit.url
        },
        protected: branch.protected
      })),
      total_count: branches.length
    }
  } catch (error) {
    logger.error({ error }, 'Error fetching branches')
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch branches'
    })
  }
})
