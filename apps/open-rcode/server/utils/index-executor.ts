import { EnvironmentModel } from '../models/Environment'
import { IndexPathModel } from '../models/IndexPath'
import { UserModel } from '../models/User'
import { ContainerManagerFactory } from './container/container-manager-factory'
import { RepositoryCloner } from './repository-cloner'
import { decrypt } from './crypto'
import { generateInstallationToken } from './github-app'

export class IndexExecutor {
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
    const repositoryCloner = new RepositoryCloner(containerManager)

    let containerId: string | undefined
    try {
      console.log(`📦 Creating container for indexing`)
      containerId = await containerManager.createContainer({
        image: 'ghcr.io/aidalinfo/open-rcoder-worker:latest',
        name: `openrcode-index-${environmentId}-${Date.now()}`,
        environment: {
          OPENRCODE_TYPE: 'index',
          OPENRCODE_ENVIRONMENT: environmentId,
          OPENRCODE_USER: userId
        }
      })
      console.log(`📦 Created container: ${containerId}`)

      const workDir = `/tmp/workspace-${Date.now()}-${environmentId}`
      console.log(`📁 Setting up workspace: ${workDir}`)

      console.log(`🔄 Cloning repository: ${environment.repositoryFullName}`)
      await repositoryCloner.cloneInContainer(
        { userId },
        environment,
        containerId,
        workDir
      )

      const repoPath = `${workDir}/repo`

      console.log(`🌳 Indexing files in: ${repoPath}`)
      const findCommand = `cd "${repoPath}" && find . -type f -not -path '*/\\.*' -not -path '*/node_modules/*' -not -path '*/vendor/*' -not -path '*/dist/*' -not -path '*/build/*' | sort`

      const result = await containerManager.executeInContainer({
        containerId,
        command: ['sh', '-c', findCommand],
        user: 'root'
      })

      const paths = result.stdout
        .split('\n')
        .filter(path => path.trim() !== '')
        .map(path => path.startsWith('./') ? path.substring(2) : path)

      console.log(`📝 Found ${paths.length} files to index`)

      await IndexPathModel.findOneAndUpdate(
        { environmentId },
        {
          environmentId,
          paths,
          indexedAt: new Date()
        },
        {
          upsert: true,
          new: true
        }
      )

      console.log(`✅ Indexing completed successfully`)
    } catch (error) {
      console.error(`❌ Indexing failed:`, error)
      throw error
    } finally {
      if (containerId) {
        try {
          console.log(`🧹 Cleaning up container: ${containerId}`)
          await containerManager.removeContainer(containerId)
        } catch (cleanupError) {
          console.error(`⚠️ Failed to cleanup container:`, cleanupError)
        }
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
