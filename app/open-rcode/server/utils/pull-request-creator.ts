import { DockerManager } from './docker'
import { EnvironmentModel } from '../models/Environment'
import { UserModel } from '../models/User'
import { generateInstallationToken, getInstallationRepositories } from './github-app'

export class PullRequestCreator {
  private docker: DockerManager

  constructor(docker: DockerManager) {
    this.docker = docker
  }

  async createFromChanges(containerId: string, task: any, summary: string): Promise<void> {
    try {
      console.log(`Creating pull request for task ${task._id}`)
      
      const environment = await EnvironmentModel.findById(task.environmentId)
      if (!environment) {
        throw new Error(`Environment ${task.environmentId} not found`)
      }
      
      const workspaceDir = `/workspace/${environment.repository || 'ccweb'}/repo`
      
      const user = await UserModel.findOne({ githubId: task.userId })
      if (!user) {
        throw new Error(`User ${task.userId} not found`)
      }

      const hasChanges = await this.checkForChanges(containerId, workspaceDir)
      if (!hasChanges) {
        task.messages.push({
          role: 'assistant',
          content: '📝 **Aucune modification détectée** - Pas de Pull Request créée',
          timestamp: new Date()
        })
        await task.save()
        return
      }

      const branchName = `ccweb-task-${task._id}-${Date.now()}`
      
      await this.createBranchAndCommit(containerId, workspaceDir, branchName, task, summary)
      
      const githubToken = await this.getGitHubToken(user, environment.repositoryFullName)
      
      if (!githubToken) {
        await this.handleNoToken(task)
        return
      }
      
      await this.pushBranch(containerId, workspaceDir, branchName, environment.repositoryFullName, githubToken)
      
      await this.createGitHubPullRequest(
        environment.repositoryFullName,
        branchName,
        task.title || 'Automated Task Completion',
        summary,
        githubToken,
        environment.defaultBranch || 'main'
      )
      
      task.messages.push({
        role: 'assistant',
        content: `✅ **Pull Request créée avec succès!**
        
**Branche:** \`${branchName}\`
**Repository:** ${environment.repositoryFullName}

Les modifications ont été poussées et une Pull Request a été créée automatiquement.`,
        timestamp: new Date()
      })
      await task.save()
      
      console.log(`Pull request created successfully for task ${task._id}`)
      
    } catch (error) {
      console.error(`Error creating pull request for task ${task._id}:`, error)
      
      task.messages.push({
        role: 'assistant',
        content: `❌ **Erreur lors de la création de la PR:** ${(error as any).message}`,
        timestamp: new Date()
      })
      await task.save()
    }
  }

  private async checkForChanges(containerId: string, workspaceDir: string): Promise<boolean> {
    const script = `
      cd "${workspaceDir}"
      git config --global --add safe.directory "${workspaceDir}" || true
      git status --porcelain
    `
    
    const result = await this.docker.executeInContainer({
      containerId,
      command: ['bash', '-c', script],
      user: 'root'
    })
    
    const porcelainOutput = result.stdout.trim()
    return !!porcelainOutput
  }

  private async createBranchAndCommit(
    containerId: string, 
    workspaceDir: string, 
    branchName: string, 
    task: any, 
    summary: string
  ): Promise<void> {
    const script = `
      cd "${workspaceDir}"
      
      git checkout -b "${branchName}"
      git add .
      
      git commit -m "$(cat <<'EOF'
feat: ${task.title || 'Automated task completion'}

${summary.replace(/'/g, "'")}

🤖 Generated with CCWeb automation
EOF
)"
    `
    
    const result = await this.docker.executeInContainer({
      containerId,
      command: ['bash', '-c', script],
      user: 'root'
    })
    
    if (result.exitCode !== 0) {
      throw new Error(`Git commit failed with exit code ${result.exitCode}: ${result.stderr}`)
    }
  }

  private async getGitHubToken(user: any, repositoryFullName: string): Promise<string | null> {
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

  private async handleNoToken(task: any): Promise<void> {
    task.messages.push({
      role: 'assistant',
      content: `⚠️ **Modifications prêtes mais PR non créée automatiquement**
      
Les modifications ont été faites dans le conteneur mais ne peuvent pas être poussées automatiquement car aucun token GitHub valide n'est disponible.

Pour créer une PR manuellement, installez la GitHub App sur ce repository.`,
      timestamp: new Date()
    })
    await task.save()
  }

  private async pushBranch(
    containerId: string,
    workspaceDir: string,
    branchName: string,
    repositoryFullName: string,
    githubToken: string
  ): Promise<void> {
    const script = `
      cd "${workspaceDir}"
      git remote set-url origin "https://x-access-token:${githubToken}@github.com/${repositoryFullName}.git"
      git push origin "${branchName}"
    `
    
    const result = await this.docker.executeInContainer({
      containerId,
      command: ['bash', '-c', script],
      user: 'root'
    })
    
    if (result.exitCode !== 0) {
      throw new Error(`Git push failed with exit code ${result.exitCode}: ${result.stderr}`)
    }
  }

  private async createGitHubPullRequest(
    repoFullName: string,
    branchName: string, 
    title: string,
    body: string,
    token: string,
    baseBranch: string = 'main'
  ): Promise<void> {
    const [owner, repo] = repoFullName.split('/')
    
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        head: branchName,
        base: baseBranch,
        body: `${body}

🤖 This PR was created automatically by CCWeb after executing a Claude-powered task.`,
        maintainer_can_modify: true
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`GitHub API error: ${response.status} - ${errorData.message || 'Unknown error'}`)
    }
    
    const prData = await response.json()
    console.log(`Pull request created: ${prData.html_url}`)
  }
}