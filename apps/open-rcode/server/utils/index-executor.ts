import { EnvironmentModel } from '../models/Environment'
import { IndexPathModel } from '../models/IndexPath'
import { UserModel } from '../models/User'
import { ContainerManagerFactory } from './container/container-manager-factory'
import { RepositoryCloner } from './repository-cloner'
import { decrypt } from './crypto'
import { generateInstallationToken } from './github-app'

export class IndexExecutor {
  private repositoryCloner: RepositoryCloner

  constructor() {
    this.repositoryCloner = new RepositoryCloner()
  }

  async executeIndexing(environmentId: string, userId: string): Promise<void> {
    console.log(`🔍 Starting file indexing for environment: ${environmentId}`)

    const environment = await EnvironmentModel.findById(environmentId)
    if (!environment) {
      throw new Error('Environment not found')
    }

    const user = await UserModel.findOne({ githubId: userId })
    if (!user) {
      throw new Error('User not found')
    }

    const containerManager = await ContainerManagerFactory.create()
    const containerId = `openrcode-index-${environmentId}-${Date.now()}`

    try {
      console.log(`📦 Creating container: ${containerId}`)
      await containerManager.createContainer(containerId, {
        labels: {
          'openrcode.type': 'index',
          'openrcode.environment': environmentId,
          'openrcode.user': userId,
        },
      })

      const workDir = `/tmp/workspace-${Date.now()}-${environmentId}`
      console.log(`📁 Setting up workspace: ${workDir}`)

      const installationId = user.githubAppInstallationIds?.[0]
      if (!installationId) {
        throw new Error('No GitHub App installation found')
      }

      const accessToken = await generateInstallationToken(installationId)

      console.log(`🔄 Cloning repository: ${environment.repositoryFullName}`)
      const repoPath = await this.repositoryCloner.cloneRepository(
        containerId,
        environment.repositoryFullName,
        workDir,
        environment.defaultBranch || 'main',
        accessToken
      )

      console.log(`🌳 Indexing files in: ${repoPath}`)
      const findCommand = `cd "${repoPath}" && find . -type f -not -path '*/\\.*' -not -path '*/node_modules/*' -not -path '*/vendor/*' -not -path '*/dist/*' -not -path '*/build/*' | sort`
      
      const result = await containerManager.executeCommand(containerId, ['sh', '-c', findCommand])
      
      const paths = result.output
        .split('\n')
        .filter(path => path.trim() !== '')
        .map(path => path.startsWith('./') ? path.substring(2) : path)

      console.log(`📝 Found ${paths.length} files to index`)

      await IndexPathModel.findOneAndUpdate(
        { environmentId },
        {
          environmentId,
          paths,
          indexedAt: new Date(),
        },
        {
          upsert: true,
          new: true,
        }
      )

      console.log(`✅ Indexing completed successfully`)
    } catch (error) {
      console.error(`❌ Indexing failed:`, error)
      throw error
    } finally {
      try {
        console.log(`🧹 Cleaning up container: ${containerId}`)
        await containerManager.removeContainer(containerId)
      } catch (cleanupError) {
        console.error(`⚠️ Failed to cleanup container:`, cleanupError)
      }
    }
  }

  async getIndex(environmentId: string): Promise<string[] | null> {
    const indexPath = await IndexPathModel.findOne({ environmentId })
    return indexPath ? indexPath.paths : null
  }

  async getIndexInfo(environmentId: string): Promise<{ paths: string[], indexedAt: Date } | null> {
    const indexPath = await IndexPathModel.findOne({ environmentId })
    return indexPath ? { paths: indexPath.paths, indexedAt: indexPath.indexedAt } : null
  }
}