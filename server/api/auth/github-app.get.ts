import { connectToDatabase } from '../../utils/database'
import { UserModel } from '../../models/User'
import { SessionModel } from '../../models/Session'

export default defineEventHandler(async (event) => {
  try {
    await connectToDatabase()
    
    const sessionToken = getCookie(event, 'session')
    if (!sessionToken) {
      return sendRedirect(event, '/login?error=no_session')
    }
    
    const session = await SessionModel.findOne({ sessionToken })
    if (!session || session.expires < new Date()) {
      return sendRedirect(event, '/login?error=expired_session')
    }
    
    const user = await UserModel.findOne({ githubId: session.userId })
    if (!user) {
      return sendRedirect(event, '/login?error=user_not_found')
    }
    
    const state = Buffer.from(JSON.stringify({ userId: user.githubId })).toString('base64')
    
    const installUrl = `https://github.com/apps/${process.env.GITHUB_APP_NAME}/installations/new?state=${state}`
    
    return sendRedirect(event, installUrl)
  } catch (error) {
    console.error('GitHub App installation error:', error)
    return sendRedirect(event, '/app?error=github_app_install_failed')
  }
})