import { UserModel } from '../models/User'
import { generateInstallationToken, getInstallationRepositories } from './github-app'
import type { BaseContainerManager } from './container/base-container-manager'
import { logger } from './logger'

export class RepositoryCloner {
  private containerManager: BaseContainerManager

  constructor(containerManager: BaseContainerManager) {
    this.containerManager = containerManager
  }

  async cloneInContainer(task: any, environment: any, containerId: string, customWorkspaceDir?: string): Promise<void> {
    const user = await UserModel.findOne({ githubId: task.userId })
    if (!user) {
      throw new Error(`User ${task.userId} not found`)
    }

    const installationToken = await this.getInstallationToken(user, environment.repositoryFullName)
    
    if (!installationToken) {
      throw new Error(`No GitHub App token available for repository ${environment.repositoryFullName}. Please install the GitHub App on this repository.`)
    }

    const repositoryUrl = `https://x-access-token:${installationToken}@github.com/${environment.repositoryFullName}.git`

    const workspaceDir = customWorkspaceDir || `/tmp/workspace-${Date.now()}/${environment.repository || 'ccweb'}`
    const defaultBranch = environment.defaultBranch || 'main'

    logger.info({
      repository: environment.repositoryFullName,
      branch: defaultBranch,
      containerId,
      workspaceDir
    }, 'Cloning repository with GitHub App token in container')
    
    const cloneScript = `
      mkdir -p "${workspaceDir}"
      cd "${workspaceDir}"
      export GIT_TERMINAL_PROMPT=0
      git clone -b "${defaultBranch}" "${repositoryUrl}" repo
    `

    const result = await this.containerManager.executeInContainer({
      containerId,
      command: ['bash', '-c', cloneScript],
      user: 'root',
    })

    if (result.exitCode !== 0) {
      throw new Error(`Git clone failed with exit code ${result.exitCode}: ${result.stderr}`)
    }

    logger.info({
      repository: environment.repositoryFullName,
      containerId,
      path: `${workspaceDir}/repo`
    }, 'Repository cloned successfully in container')

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
        logger.warn({ error, installationId }, 'Error checking installation')
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

    await this.containerManager.executeInContainer({
      containerId,
      command: ['bash', '-c', configScript],
      user: 'root',
    })
  }
}