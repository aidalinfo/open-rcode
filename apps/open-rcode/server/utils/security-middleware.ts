import type { H3Event } from 'h3'
import { TaskModel } from '../models/Task'
import { EnvironmentModel } from '../models/Environment'
import { KanbanProjectModel } from '../models/KanbanProject'
import { KanbanTaskModel } from '../models/KanbanTask'
import { requireUser } from './auth'
import { logger } from './logger'

/**
 * Vérifie que l'utilisateur est propriétaire de la tâche
 */
export async function requireTaskOwnership(event: H3Event, taskId: string) {
  const user = await requireUser(event)
  
  const task = await TaskModel.findOne({ _id: taskId, userId: user.githubId })
  if (!task) {
    logger.warn({ taskId, userId: user.githubId }, 'Unauthorized task access attempt')
    throw createError({
      statusCode: 404,
      statusMessage: 'Task not found'
    })
  }
  
  return { user, task }
}

/**
 * Vérifie que l'utilisateur est propriétaire de l'environnement
 */
export async function requireEnvironmentOwnership(event: H3Event, environmentId: string) {
  const user = await requireUser(event)
  
  const environment = await EnvironmentModel.findOne({ _id: environmentId, userId: user.githubId })
  if (!environment) {
    logger.warn({ environmentId, userId: user.githubId }, 'Unauthorized environment access attempt')
    throw createError({
      statusCode: 404,
      statusMessage: 'Environment not found'
    })
  }
  
  return { user, environment }
}

/**
 * Vérifie que l'utilisateur est propriétaire du projet kanban
 */
export async function requireKanbanProjectOwnership(event: H3Event, projectId: string) {
  const user = await requireUser(event)
  
  const project = await KanbanProjectModel.findOne({ _id: projectId, userId: user.githubId })
  if (!project) {
    logger.warn({ projectId, userId: user.githubId }, 'Unauthorized kanban project access attempt')
    throw createError({
      statusCode: 404,
      statusMessage: 'Project not found'
    })
  }
  
  return { user, project }
}

/**
 * Vérifie que l'utilisateur est propriétaire de la tâche kanban
 */
export async function requireKanbanTaskOwnership(event: H3Event, taskId: string) {
  const user = await requireUser(event)
  
  const task = await KanbanTaskModel.findOne({ _id: taskId, userId: user.githubId })
  if (!task) {
    logger.warn({ taskId, userId: user.githubId }, 'Unauthorized kanban task access attempt')
    throw createError({
      statusCode: 404,
      statusMessage: 'Task not found'
    })
  }
  
  return { user, task }
}

/**
 * Vérifie que l'utilisateur a le rôle admin
 */
export async function requireAdminRole(event: H3Event) {
  const user = await requireUser(event)
  
  if (user.role !== 'admin') {
    logger.warn({ userId: user.githubId, role: user.role }, 'Unauthorized admin access attempt')
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access required'
    })
  }
  
  return user
}

/**
 * Vérifie que l'utilisateur a au moins le rôle premium
 */
export async function requirePremiumRole(event: H3Event) {
  const user = await requireUser(event)
  
  if (user.role !== 'premium' && user.role !== 'admin') {
    logger.warn({ userId: user.githubId, role: user.role }, 'Unauthorized premium access attempt')
    throw createError({
      statusCode: 403,
      statusMessage: 'Premium access required'
    })
  }
  
  return user
}

/**
 * Log un accès sécurisé réussi
 */
export function logSecureAccess(userId: string, resource: string, action: string, resourceId?: string) {
  logger.info({ userId, resource, action, resourceId }, 'Secure access granted')
}

/**
 * Log une tentative d'accès non autorisée
 */
export function logUnauthorizedAccess(userId: string | null, resource: string, action: string, resourceId?: string) {
  logger.warn({ userId, resource, action, resourceId }, 'Unauthorized access attempt')
}