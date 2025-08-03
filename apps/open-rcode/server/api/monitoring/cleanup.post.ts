import { getContainerMonitor } from '../../utils/container-monitor'
import { requireUser } from '../../utils/auth'
import { logger } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  try {
    // Authentification requise
    const user = await requireUser(event)
    
    // Vérifier que l'utilisateur est admin
    if (user.role !== 'admin') {
      logger.warn({ userId: user.githubId, role: user.role }, 'Unauthorized monitoring cleanup attempt')
      throw createError({
        statusCode: 403,
        statusMessage: 'Admin access required'
      })
    }
    
    const monitor = getContainerMonitor()
    
    if (!monitor) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Container monitoring is not running'
      })
    }
    
    const cleanedCount = await monitor.cleanupOrphanedContainers()
    
    logger.info({ userId: user.githubId, cleanedCount }, 'Admin performed container cleanup')
    
    return {
      success: true,
      cleanedContainers: cleanedCount,
      message: `Successfully cleaned up ${cleanedCount} orphaned containers`
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to cleanup containers: ${error instanceof Error ? error.message : String(error)}`
    })
  }
})