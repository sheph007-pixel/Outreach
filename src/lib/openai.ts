import OpenAI from 'openai'

const globalForOpenAI = globalThis as unknown as { openai: OpenAI }

export const openai =
  globalForOpenAI.openai ??
  new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

if (process.env.NODE_ENV !== 'production') globalForOpenAI.openai = openai

export function getModel(): string {
  return process.env.OPENAI_MODEL ?? 'gpt-4o'
}

interface CompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  responseFormat?: 'text' | 'json'
}

interface CompletionResult {
  content: string
  usage: {
    inputTokens: number
    outputTokens: number
  }
  latencyMs: number
}

/**
 * Generate a completion from OpenAI with usage tracking.
 */
export async function generateCompletion(
  systemPrompt: string,
  userPrompt: string,
  options: CompletionOptions = {}
): Promise<CompletionResult> {
  const model = options.model ?? getModel()
  const start = Date.now()

  const response = await openai.chat.completions.create({
    model,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2000,
    response_format: options.responseFormat === 'json' ? { type: 'json_object' } : undefined,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const latencyMs = Date.now() - start
  const content = response.choices[0]?.message?.content ?? ''
  const usage = response.usage

  return {
    content,
    usage: {
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
    },
    latencyMs,
  }
}
