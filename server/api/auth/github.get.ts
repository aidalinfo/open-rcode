import { connectToDatabase } from '../../utils/database'
import { UserModel } from '../../models/User'
import { SessionModel } from '../../models/Session'

export default defineEventHandler(async (event) => {
  const { code } = getQuery(event)
  
  if (!code) {
    const clientId = process.env.GITHUB_CLIENT_ID
    const redirectUri = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/api/auth/github'
    const scope = 'user:email'
    
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`
    
    return sendRedirect(event, githubAuthUrl)
  }
  
  try {
    await connectToDatabase()
    
    const tokenResponse = await $fetch<{access_token: string}>('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      }
    })
    
    const userResponse = await $fetch<{
      id: number,
      login: string,
      name: string,
      email: string,
      avatar_url: string,
      bio: string,
      location: string
    }>('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${tokenResponse.access_token}`,
        'User-Agent': 'ccweb-app'
      }
    })
    
    const userData = {
      githubId: userResponse.id.toString(),
      username: userResponse.login,
      email: userResponse.email,
      name: userResponse.name,
      avatar: userResponse.avatar_url,
      bio: userResponse.bio,
      location: userResponse.location
    }
    
    let user = await UserModel.findOne({ githubId: userData.githubId })
    
    if (!user) {
      user = new UserModel(userData)
      await user.save()
    } else {
      Object.assign(user, userData)
      await user.save()
    }
    
    const sessionToken = await generateSessionToken()
    const session = new SessionModel({
      userId: user.githubId,
      sessionToken,
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    })
    
    await session.save()
    
    setCookie(event, 'session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60
    })
    
    return sendRedirect(event, '/app')
  } catch (error) {
    console.error('GitHub auth error:', error)
    return sendRedirect(event, '/login?error=auth_failed')
  }
})

async function generateSessionToken(): Promise<string> {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}