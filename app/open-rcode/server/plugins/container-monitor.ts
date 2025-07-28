import { startContainerMonitoring } from '../utils/container-monitor'

export default async () => {
  // Démarrer le monitoring des conteneurs au démarrage du serveur
  if (process.dev) console.log('🐳 Starting container monitoring service...')
  
  try {
    const monitor = startContainerMonitoring()
    const status = monitor.getStatus()
    
    if (process.dev) {
      console.log('✅ Container monitoring started successfully')
      console.log(`📅 Next check scheduled at: ${status.nextRun}`)
    }
    
    // Nettoyer les conteneurs orphelins au démarrage
    setTimeout(async () => {
      try {
        const cleanedCount = await monitor.cleanupOrphanedContainers()
        if (cleanedCount > 0) {
          if (process.dev) console.log(`🧹 Cleaned up ${cleanedCount} orphaned containers on startup`)
        }
      } catch (error) {
        if (process.dev) console.error('Error during startup cleanup:', error)
      }
    }, 5000) // Attendre 5 secondes après le démarrage
    
  } catch (error) {
    if (process.dev) console.error('❌ Failed to start container monitoring:', error)
  }
}