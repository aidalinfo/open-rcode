import mongoose, { Schema, Document } from 'mongoose'

export interface Task {
  userId: string;
  environmentId: string;
  name: string;
  dockerId?: string;
  pr?: string;
  merged: boolean;
  executed: boolean;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskDocument extends Task, Document {}

const taskSchema = new Schema<TaskDocument>({
  userId: { type: String, required: true },
  environmentId: { type: String, required: true },
  name: { type: String, required: true },
  dockerId: { type: String },
  pr: { type: String },
  merged: { type: Boolean, default: false },
  executed: { type: Boolean, default: false },
  error: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

taskSchema.pre('save', function() {
  this.updatedAt = new Date()
})

// Index pour optimiser les requêtes
taskSchema.index({ userId: 1 })
taskSchema.index({ userId: 1, environmentId: 1 })
taskSchema.index({ createdAt: -1 })

export const TaskModel = mongoose.models.Task || mongoose.model<TaskDocument>('Task', taskSchema)