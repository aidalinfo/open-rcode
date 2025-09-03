import { startContainerMonitoring } from '../utils/container-monitor'
import { logger } from '../utils/logger'

export default async () => {
  // Démarrer le monitoring des conteneurs au démarrage du serveur
  logger.info('Starting container monitoring service...')

  try {
    const monitor = startContainerMonitoring()
    const status = monitor.getStatus()

    logger.info('Container monitoring started successfully')
    logger.info({ nextRun: status.nextRun }, 'Next check scheduled')

    // Nettoyer les conteneurs orphelins au démarrage
    setTimeout(async () => {
      try {
        const cleanedCount = await monitor.cleanupOrphanedContainers()
        if (cleanedCount > 0) {
          logger.info({ cleanedCount }, 'Cleaned up orphaned containers on startup')
        }
      } catch (error) {
        logger.error({ error }, 'Error during startup cleanup')
      }
    }, 5000) // Attendre 5 secondes après le démarrage
  } catch (error) {
    logger.error({ error }, 'Failed to start container monitoring')
  }
}
