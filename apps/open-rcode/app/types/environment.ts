export interface SelectOption {
  label: string
  value: string
  description?: string
}

export interface SubAgentOption {
  _id: string
  name: string
  description?: string
  isPublic: boolean
}