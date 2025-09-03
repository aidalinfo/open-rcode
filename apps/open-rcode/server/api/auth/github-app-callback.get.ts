import { connectToDatabase } from '../../utils/database'
import { UserModel } from '../../models/User'
import { logger } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  try {
    await connectToDatabase()

    const query = getQuery(event)
    logger.info({ query }, 'GitHub App callback received')

    const { installation_id, setup_action, state } = query

    // Gérer les installations, mises à jour et modifications
    if (installation_id && state) {
      const { userId } = JSON.parse(Buffer.from(state as string, 'base64').toString())

      const user = await UserModel.findOne({ githubId: userId })
      if (user) {
        // Ajouter l'installation ID s'il n'existe pas déjà
        if (!user.githubAppInstallationIds) {
          user.githubAppInstallationIds = []
        }

        if (!user.githubAppInstallationIds.includes(installation_id as string)) {
          user.githubAppInstallationIds.push(installation_id as string)
          user.githubAppInstalledAt = new Date()
          await user.save()

          logger.info({
            userId,
            installationId: installation_id,
            action: setup_action || 'updated',
            totalInstallations: user.githubAppInstallationIds.length,
            installationIds: user.githubAppInstallationIds
          }, 'GitHub App installation added')
        } else {
          logger.debug({ installationId: installation_id, userId }, 'Installation ID already exists')
        }

        return sendRedirect(event, '/app?success=github_app_installed')
      }
    }

    logger.warn('GitHub App callback failed - missing parameters or user not found')
    return sendRedirect(event, '/app?error=github_app_install_failed')
  } catch (error) {
    logger.error({ error }, 'GitHub App callback error')
    return sendRedirect(event, '/app?error=github_app_install_failed')
  }
})
