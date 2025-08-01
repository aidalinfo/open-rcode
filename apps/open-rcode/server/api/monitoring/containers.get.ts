import { getContainerMonitor } from '../../utils/container-monitor'

export default defineEventHandler(async (event) => {
  try {
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