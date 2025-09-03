import type { Document } from 'mongoose'
import mongoose, { Schema } from 'mongoose'

export interface TaskMessage {
  id: string
  userId: string
  taskId: string
  role: 'user' | 'assistant'
  content: string
  type?: string
  createdAt: Date
  updatedAt: Date
}

export interface TaskMessageDocument extends TaskMessage, Document {}

const taskMessageSchema = new Schema<TaskMessageDocument>({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, ref: 'User' },
  taskId: { type: String, required: true, ref: 'Task' },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  type: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

taskMessageSchema.pre('save', function () {
  this.updatedAt = new Date()
})

// Index pour optimiser les requêtes
taskMessageSchema.index({ userId: 1 })
taskMessageSchema.index({ taskId: 1 })
taskMessageSchema.index({ userId: 1, taskId: 1 })
taskMessageSchema.index({ createdAt: -1 })

export const TaskMessageModel = mongoose.models.TaskMessage || mongoose.model<TaskMessageDocument>('TaskMessage', taskMessageSchema)
