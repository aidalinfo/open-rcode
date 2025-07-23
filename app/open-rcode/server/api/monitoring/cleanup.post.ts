import { getContainerMonitor } from '../../utils/container-monitor'

export default defineEventHandler(async (event) => {
  try {
    const monitor = getContainerMonitor()
    
    if (!monitor) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Container monitoring is not running'
      })
    }
    
    const cleanedCount = await monitor.cleanupOrphanedContainers()
    
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