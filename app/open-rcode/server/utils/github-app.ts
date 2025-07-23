import { createAppAuth } from '@octokit/auth-app'
import jwt from 'jsonwebtoken'

export async function generateInstallationToken(installationId: string): Promise<string> {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY
  
  console.log('App ID:', appId)
  console.log('Private key exists:', !!privateKey)
  console.log('Installation ID:', installationId)
  
  if (!appId || !privateKey) {
    throw new Error('GitHub App credentials not configured')
  }
  
  try {
    const auth = createAppAuth({
      appId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      installationId: parseInt(installationId)
    })
    
    const installationAuthentication = await auth({ type: 'installation' })
    console.log('Token generated successfully')
    return installationAuthentication.token
  } catch (error) {
    console.error('Error generating installation token:', error)
    throw error
  }
}

export async function getInstallationRepositories(installationId: string) {
  const installationToken = await generateInstallationToken(installationId)
  
  // Récupérer les repositories de l'installation (organisations + utilisateur)
  const installationResponse = await $fetch(`https://api.github.com/installation/repositories`, {
    headers: {
      'Authorization': `token ${installationToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ccweb-app'
    }
  })
  
  return {
    repositories: installationResponse.repositories,
    total_count: installationResponse.total_count
  }
}

export async function getRepositoryBranches(installationId: string, owner: string, repo: string) {
  const token = await generateInstallationToken(installationId)
  
  const response = await $fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ccweb-app'
    }
  })
  
  return response
}