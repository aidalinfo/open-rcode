import { Document, Schema, model } from 'mongoose'

export interface IIndexPath extends Document {
  environmentId: string
  paths: string[]
  indexedAt: Date
  createdAt: Date
  updatedAt: Date
}

const indexPathSchema = new Schema<IIndexPath>({
  environmentId: {
    type: String,
    required: true,
  },
  paths: [{
    type: String,
    required: true,
  }],
  indexedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
}, {
  timestamps: true,
})

indexPathSchema.index({ environmentId: 1 }, { unique: true })

indexPathSchema.pre('save', function (next) {
  this.updatedAt = new Date()
  next()
})

export const IndexPathModel = model<IIndexPath>('IndexPath', indexPathSchema)