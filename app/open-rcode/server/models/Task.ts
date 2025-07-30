import mongoose, { Schema, Document } from 'mongoose';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Task {
  userId: string;
  environmentId: string;
  name: string;
  status: TaskStatus;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    type?: string;
  }>;
  dockerId?: string;
  pr?: string;
  merged: boolean;
  executed: boolean;
  error?: string;
  planMode?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskDocument extends Task, Document {}

const taskSchema = new Schema<TaskDocument>({
  userId: { type: String, required: true },
  environmentId: { type: String, required: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    type: { type: String, required: false }
  }],
  dockerId: { type: String },
  pr: { type: String },
  merged: { type: Boolean, default: false },
  executed: { type: Boolean, default: false },
  error: { type: String },
  planMode: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

taskSchema.pre('save', function() {
  this.updatedAt = new Date()
})

// Index pour optimiser les requêtes
taskSchema.index({ userId: 1 })
taskSchema.index({ userId: 1, environmentId: 1 })
taskSchema.index({ createdAt: -1 })

export const TaskModel = mongoose.models.Task || mongoose.model<TaskDocument>('Task', taskSchema)