export interface SelectOption {
  label: string
  value: string
  description?: string
}

export interface IndexInfo {
  indexed: boolean
  paths: string[]
  indexedAt: string | null
  totalFiles?: number
}

export interface EnvironmentVariable {
  key: string
  value: string
  description?: string
}

export interface Environment {
  _id: string
  name: string
  description?: string
  repositoryFullName: string
  runtime: string
  aiProvider: string
  model?: string
  defaultBranch: string
  environmentVariables: EnvironmentVariable[]
  configurationScript?: string
  userId: string
  createdAt: string
  updatedAt: string
}
