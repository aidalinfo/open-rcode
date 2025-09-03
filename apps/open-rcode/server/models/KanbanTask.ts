import type { Document } from 'mongoose'
import mongoose, { Schema } from 'mongoose'

export type KanbanTaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'

export interface KanbanTask {
  kanbanProjectId: string
  userId: string
  taskId?: string
  title: string
  message?: string
  error?: string
  status: KanbanTaskStatus
  plannifiedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface KanbanTaskDocument extends KanbanTask, Document {}

const kanbanTaskSchema = new Schema<KanbanTaskDocument>({
  kanbanProjectId: { type: String, required: true, ref: 'KanbanProject' },
  userId: { type: String, required: true },
  taskId: { type: String, ref: 'Task' },
  title: { type: String, required: true },
  message: { type: String },
  error: { type: String },
  status: {
    type: String,
    enum: ['todo', 'in_progress', 'review', 'done', 'cancelled'],
    default: 'todo'
  },
  plannifiedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

kanbanTaskSchema.pre('save', function () {
  this.updatedAt = new Date()
})

// Index pour optimiser les requêtes
kanbanTaskSchema.index({ kanbanProjectId: 1 })
kanbanTaskSchema.index({ userId: 1 })
kanbanTaskSchema.index({ taskId: 1 })
kanbanTaskSchema.index({ status: 1 })
kanbanTaskSchema.index({ createdAt: -1 })

export const KanbanTaskModel = mongoose.models.KanbanTask || mongoose.model<KanbanTaskDocument>('KanbanTask', kanbanTaskSchema)
