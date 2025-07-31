import mongoose, { Schema, Document } from 'mongoose';

export interface CountRequest {
  userId: string;
  environmentId: string;
  model: string;
  taskId: string;
  createdAt: Date;
}

export interface CountRequestDocument extends CountRequest, Document {}

const countRequestSchema = new Schema<CountRequestDocument>({
  userId: { type: String, required: true },
  environmentId: { type: String, required: true },
  model: { type: String, required: true },
  taskId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Index pour optimiser les requêtes
countRequestSchema.index({ userId: 1 })
countRequestSchema.index({ taskId: 1 })
countRequestSchema.index({ createdAt: -1 })
countRequestSchema.index({ userId: 1, environmentId: 1, createdAt: -1 })

export const CountRequestModel = mongoose.models.CountRequest || mongoose.model<CountRequestDocument>('CountRequest', countRequestSchema)