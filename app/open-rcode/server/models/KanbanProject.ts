import mongoose, { Schema, Document } from 'mongoose';

export interface KanbanProject {
  userId: string;
  environmentId: string;
  name: string;
  description?: string;
  kanbanTaskIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface KanbanProjectDocument extends KanbanProject, Document {}

const kanbanProjectSchema = new Schema<KanbanProjectDocument>({
  userId: { type: String, required: true },
  environmentId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  kanbanTaskIds: [{ type: String, ref: 'KanbanTask' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

kanbanProjectSchema.pre('save', function() {
  this.updatedAt = new Date()
})

// Index pour optimiser les requêtes
kanbanProjectSchema.index({ userId: 1 })
kanbanProjectSchema.index({ userId: 1, environmentId: 1 })
kanbanProjectSchema.index({ createdAt: -1 })

export const KanbanProjectModel = mongoose.models.KanbanProject || mongoose.model<KanbanProjectDocument>('KanbanProject', kanbanProjectSchema)