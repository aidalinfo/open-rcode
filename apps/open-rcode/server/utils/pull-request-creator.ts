import type { BaseContainerManager } from './container/base-container-manager'
import { EnvironmentModel } from '../models/Environment'
import { UserModel } from '../models/User'
import { TaskModel } from '../models/Task'
import { TaskMessageModel } from '../models/TaskMessage'
import { generateInstallationToken, getInstallationRepositories } from './github-app'
import { v4 as uuidv4 } from 'uuid'
import { AIExecutor } from './ai-executor'
import { logger } from './logger'

export class PullRequestCreator {
  private containerManager: BaseContainerManager

  constructor(containerManager: BaseContainerManager) {
    this.containerManager = containerManager
  }

  async createFromChanges(containerId: string, task: any, summary: string): Promise<void> {
    try {
      logger.info({ taskId: task._id }, 'Creating pull request for task')

      const environment = await EnvironmentModel.findById(task.environmentId)
      if (!environment) {
        throw new Error(`Environment ${task.environmentId} not found`)
      }

      const workspaceDir = task.workspaceDir || `/tmp/workspace/${environment.repository || 'openrcode'}/repo`

      const user = await UserModel.findOne({ githubId: task.userId })
      if (!user) {
        throw new Error(`User ${task.userId} not found`)
      }

      const hasChanges = await this.checkForChanges(containerId, workspaceDir)
      if (!hasChanges) {
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: '📝 **Aucune modification détectée** - Pas de Pull Request créée'
        })
        return
      }

      const branchName = `open-rcode-task-${task._id}-${Date.now()}`

      await this.createBranchAndCommit(containerId, workspaceDir, branchName, task, summary)

      // Obtenir le git diff des changements
      const gitDiff = await this.getGitDiff(containerId, workspaceDir, environment.defaultBranch || 'main')

      // Demander à Gemini de suggérer un titre pour la PR
      let prTitle = task.title || 'Automated Task Completion'

      // Toujours utiliser Gemini pour suggérer un titre basé sur le diff
      const claudeExecutor = new AIExecutor(this.containerManager)
      const geminiPrompt = `Basé sur les modifications suivantes (git diff), suggère un titre concis et descriptif pour une pull request (maximum 72 caractères). Réponds uniquement avec le titre, sans explication ni formatage supplémentaire.

Git diff:
${gitDiff}

Contexte de la tâche: ${task.title || 'Automated task completion'}`

      try {
        const titleSuggestion = await claudeExecutor.executeCommand(
          containerId,
          geminiPrompt,
          workspaceDir,
          'admin-gemini',
          'gemini-2.5-flash'
        )

        // Nettoyer la réponse de Gemini
        prTitle = this.extractTitleFromGeminiResponse(titleSuggestion)

        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `🤖 **Titre suggéré par Gemini:** ${prTitle}`
        })
      } catch (error) {
        logger.error({ error, taskId: task._id }, 'Error getting title suggestion from Gemini')
        // Continuer avec le titre par défaut en cas d'erreur
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `⚠️ **Impossible d'obtenir un titre suggéré par Gemini, utilisation du titre par défaut**`
        })
      }

      const githubToken = await this.getGitHubToken(user, environment.repositoryFullName)

      if (!githubToken) {
        await this.handleNoToken(task)
        return
      }

      await this.pushBranch(containerId, workspaceDir, branchName, environment.repositoryFullName, githubToken)

      const prUrl = await this.createGitHubPullRequest(
        environment.repositoryFullName,
        branchName,
        prTitle,
        summary,
        githubToken,
        environment.defaultBranch || 'main'
      )

      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant',
        content: `✅ **Pull Request créée avec succès!**
        
**Branche:** \`${branchName}\`
**Repository:** ${environment.repositoryFullName}

Les modifications ont été poussées et une Pull Request a été créée automatiquement.`
      })

      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant',
        content: prUrl,
        type: 'pr_link'
      })

      // Stocker l'URL de la PR dans le modèle Task
      await TaskModel.findByIdAndUpdate(task._id, {
        pr: prUrl,
        updatedAt: new Date()
      })

      logger.info({ taskId: task._id, prUrl }, 'Pull request created successfully')

      // Auto-merge si activé
      if (task.autoMerge) {
        await this.autoMergePullRequest(prUrl, environment.repositoryFullName, githubToken, task)
      }
    } catch (error) {
      logger.error({ error, taskId: task._id }, 'Error creating pull request')

      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant',
        content: `❌ **Erreur lors de la création de la PR:** ${(error as any).message}`
      })
    }
  }

  private async checkForChanges(containerId: string, workspaceDir: string): Promise<boolean> {
    const script = `
      cd "${workspaceDir}"
      git config --global --add safe.directory "${workspaceDir}" || true
      git status --porcelain
    `

    const result = await this.containerManager.executeInContainer({
      containerId,
      command: ['bash', '-c', script],
      user: 'root'
    })

    const porcelainOutput = result.stdout.trim()
    return !!porcelainOutput
  }

  private async getGitDiff(containerId: string, workspaceDir: string, baseBranch: string): Promise<string> {
    const script = `
      cd "${workspaceDir}"
      git config --global --add safe.directory "${workspaceDir}" || true
      # Obtenir le diff complet des changements par rapport à la branche de base
      git diff ${baseBranch}...HEAD --no-color || true
    `

    const result = await this.containerManager.executeInContainer({
      containerId,
      command: ['bash', '-c', script],
      user: 'root'
    })

    if (result.exitCode !== 0) {
      logger.error({ exitCode: result.exitCode, stderr: result.stderr }, 'Git diff failed')
      return ''
    }

    // Limiter la taille du diff pour éviter des prompts trop longs
    const maxDiffLength = 5000
    if (result.stdout.length > maxDiffLength) {
      return result.stdout.substring(0, maxDiffLength) + '\n... (diff tronqué)'
    }

    return result.stdout
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

${summary.replace(/'/g, '\'')}

🤖 Generated with open-rcode automation
EOF
)"
    `

    const result = await this.containerManager.executeInContainer({
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
        logger.warn({ error, installationId }, 'Error checking installation')
        continue
      }
    }

    return null
  }

  private async handleNoToken(task: any): Promise<void> {
    await TaskMessageModel.create({
      id: uuidv4(),
      userId: task.userId,
      taskId: task._id,
      role: 'assistant',
      content: `⚠️ **Modifications prêtes mais PR non créée automatiquement**
      
Les modifications ont été faites dans le conteneur mais ne peuvent pas être poussées automatiquement car aucun token GitHub valide n'est disponible.

Pour créer une PR manuellement, installez la GitHub App sur ce repository.`
    })
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

    const result = await this.containerManager.executeInContainer({
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
  ): Promise<string> {
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

🤖 This PR was created automatically by open-rcode after executing a Claude-powered task.`,
        maintainer_can_modify: true
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`GitHub API error: ${response.status} - ${errorData.message || 'Unknown error'}`)
    }

    const prData = await response.json()
    logger.info({ prUrl: prData.html_url, repo: `${owner}/${repo}` }, 'GitHub pull request created')
    return prData.html_url
  }

  private extractTitleFromGeminiResponse(response: string): string {
    // Nettoyer la réponse de Gemini
    let cleanedResponse = response.trim()

    // Enlever les éventuels marqueurs de formatage
    cleanedResponse = cleanedResponse.replace(/^#+\s*/g, '') // Enlever les headers markdown
    cleanedResponse = cleanedResponse.replace(/^\*+\s*/g, '') // Enlever les bullets
    cleanedResponse = cleanedResponse.replace(/^-+\s*/g, '') // Enlever les tirets
    cleanedResponse = cleanedResponse.replace(/^["'`]+|["'`]+$/g, '') // Enlever les guillemets

    // Si la réponse contient plusieurs lignes, prendre seulement la première
    const lines = cleanedResponse.split('\n').filter(line => line.trim())
    if (lines.length > 0) {
      cleanedResponse = lines[0].trim()
    }

    // Extraire le texte entre "Réponse:" ou similaire si présent
    const responseMatch = cleanedResponse.match(/(?:réponse|response|titre|title):\s*(.+)/i)
    if (responseMatch) {
      cleanedResponse = responseMatch[1].trim()
    }

    // Limiter à 72 caractères
    if (cleanedResponse.length > 72) {
      cleanedResponse = cleanedResponse.substring(0, 69) + '...'
    }

    // Retourner le titre par défaut si le résultat est vide ou trop court
    if (!cleanedResponse || cleanedResponse.length < 5) {
      return 'Automated Task Completion'
    }

    return cleanedResponse
  }

  private async autoMergePullRequest(
    prUrl: string,
    repoFullName: string,
    token: string,
    task: any
  ): Promise<void> {
    try {
      logger.info({ taskId: task._id, prUrl }, 'Starting auto-merge for pull request')

      // Extraire le numéro de PR de l'URL
      const prNumber = prUrl.match(/pull\/(\d+)/)?.[1]
      if (!prNumber) {
        throw new Error('Could not extract PR number from URL')
      }

      const [owner, repo] = repoFullName.split('/')

      // Attendre quelques secondes pour que les checks se lancent
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Récupérer les informations de la PR
      const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      })

      if (!prResponse.ok) {
        throw new Error(`Failed to get PR info: ${prResponse.status}`)
      }

      const prData = await prResponse.json()

      // Vérifier si la PR peut être mergée
      if (!prData.mergeable) {
        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `⚠️ **Auto-merge impossible:** La PR a des conflits ou ne peut pas être mergée automatiquement.`
        })
        return
      }

      // Merger la PR
      const mergeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          commit_title: `Merge pull request #${prNumber} from ${prData.head.ref}`,
          commit_message: `Auto-merged by open-rcode\n\n${prData.title}`,
          merge_method: 'merge' // ou 'squash' ou 'rebase' selon la préférence
        })
      })

      if (mergeResponse.ok) {
        await TaskModel.findByIdAndUpdate(task._id, {
          merged: true,
          updatedAt: new Date()
        })

        await TaskMessageModel.create({
          id: uuidv4(),
          userId: task.userId,
          taskId: task._id,
          role: 'assistant',
          content: `🎉 **Pull Request mergée automatiquement!**
          
La PR #${prNumber} a été mergée avec succès dans la branche principale.`
        })

        logger.info({ taskId: task._id, prNumber }, 'Pull request auto-merged successfully')
      } else {
        const errorData = await mergeResponse.json()
        throw new Error(`Merge failed: ${errorData.message || 'Unknown error'}`)
      }
    } catch (error) {
      logger.error({ error, taskId: task._id }, 'Error auto-merging pull request')

      await TaskMessageModel.create({
        id: uuidv4(),
        userId: task.userId,
        taskId: task._id,
        role: 'assistant',
        content: `❌ **Erreur lors du merge automatique:** ${(error as any).message}
        
La PR a été créée mais nécessite un merge manuel.`
      })
    }
  }
}
