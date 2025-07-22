import { UserModel } from '../models/User'
import { generateInstallationToken, getInstallationRepositories } from './github-app'
import type { DockerManager } from './docker'

export class RepositoryCloner {
  private docker: DockerManager

  constructor(docker: DockerManager) {
    this.docker = docker
  }

  async cloneInContainer(task: any, environment: any, containerId: string): Promise<void> {
    const user = await UserModel.findOne({ githubId: task.userId })
    if (!user) {
      throw new Error(`User ${task.userId} not found`)
    }

    const installationToken = await this.getInstallationToken(user, environment.repositoryFullName)
    
    if (!installationToken) {
      throw new Error(`No GitHub App token available for repository ${environment.repositoryFullName}. Please install the GitHub App on this repository.`)
    }

    const repositoryUrl = `https://x-access-token:${installationToken}@github.com/${environment.repositoryFullName}.git`

    const workspaceDir = `/workspace/${environment.repository || 'ccweb'}`

    console.log(`Cloning repository ${environment.repositoryFullName} with GitHub App token in container`)

    const cloneScript = `
      mkdir -p "${workspaceDir}"
      cd "${workspaceDir}"
      export GIT_TERMINAL_PROMPT=0
      git clone "${repositoryUrl}" repo
    `

    const result = await this.docker.executeInContainer({
      containerId,
      command: ['bash', '-c', cloneScript],
      user: 'root',
    })

    if (result.exitCode !== 0) {
      throw new Error(`Git clone failed with exit code ${result.exitCode}: ${result.stderr}`)
    }

    console.log(`Repository cloned successfully in container at ${workspaceDir}/repo`)

    await this.configureGitInContainer(user, containerId, `${workspaceDir}/repo`)
  }

  private async getInstallationToken(user: any, repositoryFullName: string): Promise<string | null> {
    if (!user.githubAppInstallationIds?.length) return null

    for (const installationId of user.githubAppInstallationIds) {
      try {
        const installationRepos = await getInstallationRepositories(installationId)
        const hasRepository = installationRepos.repositories.some(
          (repo: any) => repo.full_name === repositoryFullName,
        )

        if (hasRepository) {
          return await generateInstallationToken(installationId)
        }
      }
      catch (error) {
        console.warn(`Error checking installation ${installationId}:`, error)
        continue
      }
    }

    return null
  }

  private async configureGitInContainer(user: any, containerId: string, repoDir: string): Promise<void> {
    const configScript = `
      cd "${repoDir}"
      git config user.name "${user.name || user.username}"
      git config user.email "${user.email || `${user.username}@users.noreply.github.com`}"
      git config --global --add safe.directory "${repoDir}"
    `

    await this.docker.executeInContainer({
      containerId,
      command: ['bash', '-c', configScript],
      user: 'root',
    })
  }
}