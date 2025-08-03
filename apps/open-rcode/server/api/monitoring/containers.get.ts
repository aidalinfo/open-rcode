import { getContainerMonitor } from '../../utils/container-monitor'
import { requireUser } from '../../utils/auth'
import { logger } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  try {
    // Authentification requise
    const user = await requireUser(event)
    
    // Vérifier que l'utilisateur est admin
    if (user.role !== 'admin') {
      logger.warn({ userId: user.githubId, role: user.role }, 'Unauthorized monitoring access attempt')
      throw createError({
        statusCode: 403,
        statusMessage: 'Admin access required'
      })
    }
    
    const monitor = getContainerMonitor()
    
    if (!monitor) {
      return {
        status: 'stopped',
        message: 'Container monitoring is not running'
      }
    }
    
    const status = monitor.getStatus()
    
    return {
      status: status.isRunning ? 'running' : 'stopped',
      nextRun: status.nextRun,
      message: status.isRunning 
        ? `Monitoring active, next check at ${status.nextRun}` 
        : 'Monitoring is stopped'
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to get monitoring status: ${error instanceof Error ? error.message : String(error)}`
    })
  }
})