import { createAppAuth } from '@octokit/auth-app'
import jwt from 'jsonwebtoken'

export async function generateInstallationToken(installationId: string): Promise<string> {
  const appId = process.env.GITHUB_APP_ID
  const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH
  let privateKey = process.env.GITHUB_APP_PRIVATE_KEY
  
  // If GITHUB_APP_PRIVATE_KEY_PATH exists, read the key from file
  if (privateKeyPath && !privateKey) {
    const fs = await import('fs')
    try {
      privateKey = fs.readFileSync(privateKeyPath, 'utf8')
    } catch (error) {
      console.error('Error reading private key from path:', error)
      throw new Error(`Failed to read GitHub App private key from path: ${privateKeyPath}`)
    }
  }
  
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
  
  let allRepositories: any[] = []
  let page = 1
  let hasMore = true
  let totalCount = 0
  
  // Récupérer tous les repositories avec pagination
  while (hasMore) {
    const installationResponse = await $fetch(`https://api.github.com/installation/repositories?per_page=100&page=${page}`, {
      headers: {
        'Authorization': `token ${installationToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'open-rcode-app'
      }
    })
    
    allRepositories = allRepositories.concat(installationResponse.repositories)
    totalCount = installationResponse.total_count
    
    // Vérifier s'il y a d'autres pages
    hasMore = allRepositories.length < totalCount
    page++
  }
  
  console.log(`Fetched ${allRepositories.length} repositories out of ${totalCount} for installation ${installationId}`)
  
  return {
    repositories: allRepositories,
    total_count: totalCount
  }
}

export async function getRepositoryBranches(installationId: string, owner: string, repo: string) {
  const token = await generateInstallationToken(installationId)
  
  let allBranches: any[] = []
  let page = 1
  let hasMore = true
  
  while (hasMore) {
    const response = await $fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=100&page=${page}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'open-rcode-app'
      }
    })
    
    allBranches = allBranches.concat(response)
    hasMore = response.length === 100
    page++
  }
  
  return allBranches
}