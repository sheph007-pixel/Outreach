export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T = unknown> {
  success: boolean
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  field: string
  direction: SortDirection
}
