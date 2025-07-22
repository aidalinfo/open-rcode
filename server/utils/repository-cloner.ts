import { UserModel } from '../models/User'
import { generateInstallationToken, getInstallationRepositories } from './github-app'

export class RepositoryCloner {
  async cloneToHost(task: any, environment: any, hostDir: string): Promise<void> {
    try {
      const user = await UserModel.findOne({ githubId: task.userId })
      if (!user) {
        throw new Error(`User ${task.userId} not found`)
      }

      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      const installationToken = await this.getInstallationToken(user, environment.repositoryFullName)
      
      const repositoryUrl = installationToken 
        ? `https://x-access-token:${installationToken}@github.com/${environment.repositoryFullName}.git`
        : `https://github.com/${environment.repositoryFullName}.git`
      
      const gitCommand = `git clone ${repositoryUrl} ${hostDir}/repo`
      
      console.log(`Cloning repository ${environment.repositoryFullName}${installationToken ? ' with GitHub App token' : ' (public)'}`)

      await execAsync(gitCommand, {
        cwd: '/tmp',
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0'
        }
      })

      console.log(`Repository cloned successfully to ${hostDir}/repo`)

      await this.configureGit(user, `${hostDir}/repo`, execAsync)

    } catch (error) {
      console.error(`Error cloning repository ${environment.repositoryFullName}:`, error)
      await this.createFallbackReadme(environment, hostDir, error)
    }
  }

  private async getInstallationToken(user: any, repositoryFullName: string): Promise<string | null> {
    if (!user.githubAppInstallationIds?.length) return null

    for (const installationId of user.githubAppInstallationIds) {
      try {
        const installationRepos = await getInstallationRepositories(installationId)
        const hasRepository = installationRepos.repositories.some(
          (repo: any) => repo.full_name === repositoryFullName
        )
        
        if (hasRepository) {
          return await generateInstallationToken(installationId)
        }
      } catch (error) {
        console.warn(`Error checking installation ${installationId}:`, error)
        continue
      }
    }
    
    return null
  }

  private async configureGit(user: any, repoDir: string, execAsync: any): Promise<void> {
    const gitConfigCommands = [
      `git config user.name "${user.name || user.username}"`,
      `git config user.email "${user.email || `${user.username}@users.noreply.github.com`}"`
    ]

    for (const cmd of gitConfigCommands) {
      await execAsync(cmd, { cwd: repoDir })
    }
  }

  private async createFallbackReadme(environment: any, hostDir: string, error: any): Promise<void> {
    const fs = await import('fs')
    const repoDir = `${hostDir}/repo`
    
    if (!fs.existsSync(repoDir)) {
      fs.mkdirSync(repoDir, { recursive: true })
    }
    
    let errorMessage = 'Erreur inconnue lors du clonage'
    
    if (error.message.includes('Repository not found') || error.message.includes('not found')) {
      errorMessage = `Le repository ${environment.repositoryFullName} n'existe pas ou n'est pas accessible.`
    } else if (error.message.includes('Authentication failed') || error.message.includes('Permission denied')) {
      errorMessage = 'Le repository est privé et nécessite l\'installation de la GitHub App avec les bonnes permissions.'
    } else {
      errorMessage = `Erreur lors du clonage: ${error.message}`
    }
    
    const readmeContent = `# ${environment.repository}

Repository: ${environment.repositoryFullName}
Environment: ${environment.name}

⚠️ Le clonage automatique du repository a échoué.
${errorMessage}

**Actions possibles :**
1. Vérifiez que le repository existe sur GitHub
2. Assurez-vous que la GitHub App est installée sur ce repository
3. Vérifiez les permissions de la GitHub App

Vous pouvez cloner manuellement le repository ou créer vos fichiers ici.

\`\`\`bash
git clone https://github.com/${environment.repositoryFullName}.git .
\`\`\`
`
    
    fs.writeFileSync(`${repoDir}/README.md`, readmeContent)
    console.log(`Created fallback README in ${repoDir} due to: ${errorMessage}`)
  }
}