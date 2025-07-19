import { startContainerMonitoring } from '../utils/container-monitor'

export default async () => {
  // Démarrer le monitoring des conteneurs au démarrage du serveur
  console.log('🐳 Starting container monitoring service...')
  
  try {
    const monitor = startContainerMonitoring()
    const status = monitor.getStatus()
    
    console.log('✅ Container monitoring started successfully')
    console.log(`📅 Next check scheduled at: ${status.nextRun}`)
    
    // Nettoyer les conteneurs orphelins au démarrage
    setTimeout(async () => {
      try {
        const cleanedCount = await monitor.cleanupOrphanedContainers()
        if (cleanedCount > 0) {
          console.log(`🧹 Cleaned up ${cleanedCount} orphaned containers on startup`)
        }
      } catch (error) {
        console.error('Error during startup cleanup:', error)
      }
    }, 5000) // Attendre 5 secondes après le démarrage
    
  } catch (error) {
    console.error('❌ Failed to start container monitoring:', error)
  }
}