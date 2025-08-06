import mongoose, { Schema, Document } from 'mongoose'

export interface EnvironmentVariable {
  key: string;
  value: string;
  description?: string;
}

export interface Environment {
  userId: string;
  organization: string; // owner du repository (compte GitHub ou organisation)
  repository: string; // nom du repository
  repositoryFullName: string; // owner/repository
  name: string;
  description?: string;
  runtime: 'node' | 'python' | 'bun' | 'java' | 'swift' | 'ruby' | 'rust' | 'go' | 'php';
  aiProvider: 'anthropic-api' | 'claude-oauth' | 'gemini-cli';
  model: 'opus' | 'sonnet' | 'opus-4-1';
  defaultBranch: string; // branche par défaut pour le clonage et les PRs
  environmentVariables: EnvironmentVariable[];
  configurationScript?: string;
  subAgents: string[]
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvironmentDocument extends Environment, Document {}

const environmentVariableSchema = new Schema({
  key: { type: String, required: true },
  value: { type: String, required: true },
  description: { type: String }
})

const environmentSchema = new Schema<EnvironmentDocument>({
  userId: { type: String, required: true },
  organization: { type: String, required: true },
  repository: { type: String, required: true },
  repositoryFullName: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  runtime: { 
    type: String, 
    enum: ['node', 'python', 'bun', 'java', 'swift', 'ruby', 'rust', 'go', 'php'], 
    required: true 
  },
  aiProvider: {
    type: String,
    enum: ['anthropic-api', 'claude-oauth', 'gemini-cli'],
    default: 'anthropic-api',
    required: true
  },
  model: {
    type: String,
    enum: ['opus', 'sonnet', 'opus-4-1'],
    default: 'sonnet',
    required: true
  },
  defaultBranch: { 
    type: String, 
    required: true,
    default: 'main'
  },
  environmentVariables: [environmentVariableSchema],
  configurationScript: { type: String },
  subAgents: [{ 
    type: String,
    ref: 'SubAgent'
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

environmentSchema.pre('save', function() {
  this.updatedAt = new Date()
})

// Index pour optimiser les requêtes
environmentSchema.index({ userId: 1 })
environmentSchema.index({ userId: 1, repositoryFullName: 1 })

export const EnvironmentModel = mongoose.models.Environment || mongoose.model<EnvironmentDocument>('Environment', environmentSchema)