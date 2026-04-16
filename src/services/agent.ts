import { prisma } from '@/lib/db'
import { openai, getModel } from '@/lib/openai'
import { executeAgentTool } from './agent-tools'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_contacts',
      description: 'Search contacts by name, email, company, or status',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term' },
          status: { type: 'string', enum: ['active', 'paused', 'blocked', 'replied', 'finished'] },
          limit: { type: 'number', description: 'Max results (default 10)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_contact_details',
      description: 'Get full details for a contact including history and threads',
      parameters: {
        type: 'object',
        properties: { contactId: { type: 'string' } },
        required: ['contactId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_system_stats',
      description: 'Get current system statistics: total contacts, active, paused, blocked, sends today, pending tasks',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_recent_decisions',
      description: 'Get recent AI decisions with reasoning',
      parameters: {
        type: 'object',
        properties: {
          contactId: { type: 'string', description: 'Optional: filter by contact' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_pending_tasks',
      description: 'Get upcoming scheduled tasks',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'number' } },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_contact_status',
      description: 'Change a contact status (active, paused, blocked, replied, finished)',
      parameters: {
        type: 'object',
        properties: {
          contactId: { type: 'string' },
          status: { type: 'string', enum: ['active', 'paused', 'blocked', 'replied', 'finished'] },
          reason: { type: 'string' },
        },
        required: ['contactId', 'status', 'reason'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'pause_contact',
      description: 'Pause outreach to a contact',
      parameters: {
        type: 'object',
        properties: {
          contactId: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['contactId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'schedule_outreach',
      description: 'Schedule outreach to a contact',
      parameters: {
        type: 'object',
        properties: {
          contactId: { type: 'string' },
          scheduledAt: { type: 'string', description: 'ISO datetime (default: now)' },
        },
        required: ['contactId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'save_memory',
      description: 'Save a preference, instruction, or note to remember for future reference',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'What to remember' },
          category: { type: 'string', enum: ['preference', 'instruction', 'context'] },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_outreach_history',
      description: 'Get sent emails and threads for a contact',
      parameters: {
        type: 'object',
        properties: { contactId: { type: 'string' } },
        required: ['contactId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_memories',
      description: 'Get all saved memories and preferences',
      parameters: { type: 'object', properties: {} },
    },
  },
]

/**
 * Build the system prompt for the agent.
 */
async function buildAgentSystemPrompt(userId: string): Promise<string> {
  const [settings, memories] = await Promise.all([
    prisma.agentSetting.findMany(),
    prisma.agentMemory.findMany({
      where: { userId, active: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const settingsStr = settings
    .map((s) => `${s.label ?? s.key}: ${JSON.stringify(s.value)}`)
    .join('\n')

  const memoriesStr = memories.map((m) => `- [${m.category ?? 'general'}] ${m.content}`).join('\n')

  return `You are an AI assistant managing an outreach automation system for group health insurance. You work as Hunter Kennion's digital salesperson.

Your role: Help Hunter inspect, control, and understand the outreach system. You have real-time access to the database through tools. Always use tools to get current data before answering questions.

Current System Settings:
${settingsStr}

${memoriesStr ? `User Instructions & Memories:\n${memoriesStr}` : ''}

Guidelines:
- Always use tools to fetch real data. Never make up numbers or contact details.
- When asked about contacts, search the database.
- When asked about system status, use get_system_stats.
- You can take actions like pausing contacts, scheduling outreach, and saving memories.
- Be concise and helpful. Speak like a competent coworker, not a chatbot.
- If Hunter gives you an instruction to remember, use save_memory.
- Explain your reasoning when making changes.`
}

/**
 * Process a chat conversation with the agent.
 * Returns the final assistant response and any tool calls made.
 */
export async function processAgentChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  userId: string
): Promise<{
  response: string
  toolCalls: Array<{ name: string; args: Record<string, unknown>; result: unknown }>
}> {
  const systemPrompt = await buildAgentSystemPrompt(userId)
  const toolCallsMade: Array<{ name: string; args: Record<string, unknown>; result: unknown }> = []

  const chatMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  // Conversation loop with tool calls (max 5 iterations)
  for (let i = 0; i < 5; i++) {
    const completion = await openai.chat.completions.create({
      model: getModel(),
      messages: chatMessages,
      tools: AGENT_TOOLS,
      temperature: 0.7,
    })

    const choice = completion.choices[0]
    if (!choice) break

    const message = choice.message

    // If no tool calls, return the text response
    if (!message.tool_calls?.length) {
      return {
        response: message.content ?? 'I apologize, I was unable to generate a response.',
        toolCalls: toolCallsMade,
      }
    }

    // Process tool calls
    chatMessages.push(message as ChatCompletionMessageParam)

    for (const toolCall of message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments)
      const result = await executeAgentTool(toolCall.function.name, args, userId)

      toolCallsMade.push({
        name: toolCall.function.name,
        args,
        result,
      })

      chatMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      })
    }
  }

  return {
    response: 'I ran into a problem processing your request. Please try again.',
    toolCalls: toolCallsMade,
  }
}
