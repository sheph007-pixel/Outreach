export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: unknown
}

export interface AgentTool {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface MemoryItem {
  id: string
  content: string
  category: string | null
  active: boolean
  createdAt: Date
}
