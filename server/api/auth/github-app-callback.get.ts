import { connectToDatabase } from '../../utils/database'
import { UserModel } from '../../models/User'

export default defineEventHandler(async (event) => {
  try {
    await connectToDatabase()
    
    const query = getQuery(event)
    console.log('GitHub App callback received:', query)
    
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
          
          console.log(`GitHub App ${setup_action || 'updated'} for user ${userId} with installation ID ${installation_id}`)
          console.log(`User now has ${user.githubAppInstallationIds.length} installation(s): ${user.githubAppInstallationIds.join(', ')}`)
        } else {
          console.log(`Installation ID ${installation_id} already exists for user ${userId}`)
        }
        
        return sendRedirect(event, '/app?success=github_app_installed')
      }
    }
    
    console.log('GitHub App callback failed - missing parameters or user not found')
    return sendRedirect(event, '/app?error=github_app_install_failed')
  } catch (error) {
    console.error('GitHub App callback error:', error)
    return sendRedirect(event, '/app?error=github_app_install_failed')
  }
})