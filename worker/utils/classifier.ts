import { ReplyType } from '@prisma/client'
import { prisma } from '../../src/lib/db'
import { generateCompletion } from '../../src/lib/openai'

interface ClassificationResult {
  replyType: ReplyType
  confidence: number
  reasoning: string
  usage: { inputTokens: number; outputTokens: number }
  latencyMs: number
}

/**
 * Classify an email reply using AI.
 * Uses the stored reply_classification prompt version.
 */
export async function classifyReply(
  replyText: string,
  threadSubject: string,
  previousMessages?: string[]
): Promise<ClassificationResult> {
  const promptVersion = await prisma.promptVersion.findFirst({
    where: { name: 'reply_classification', active: true },
    orderBy: { version: 'desc' },
  })

  if (!promptVersion) {
    throw new Error('No active reply_classification prompt version found')
  }

  let userPrompt = `Subject: ${threadSubject}\n\nReply:\n${replyText}`

  if (previousMessages?.length) {
    userPrompt += '\n\n--- Thread History ---\n' + previousMessages.join('\n---\n')
  }

  const result = await generateCompletion(promptVersion.content, userPrompt, {
    responseFormat: 'json',
    temperature: 0.3, // Lower temperature for classification accuracy
  })

  let parsed: { replyType?: string; confidence?: number; reasoning?: string }
  try {
    parsed = JSON.parse(result.content)
  } catch {
    // If parsing fails, default to conservative classification
    return {
      replyType: 'none',
      confidence: 0,
      reasoning: 'Failed to parse AI classification response',
      usage: result.usage,
      latencyMs: result.latencyMs,
    }
  }

  // Validate the reply type
  const validTypes: ReplyType[] = ['yes', 'no', 'later', 'next_year', 'interested', 'unsubscribe', 'none']
  const replyType = validTypes.includes(parsed.replyType as ReplyType)
    ? (parsed.replyType as ReplyType)
    : 'none'

  return {
    replyType,
    confidence: parsed.confidence ?? 0.5,
    reasoning: parsed.reasoning ?? 'No reasoning provided',
    usage: result.usage,
    latencyMs: result.latencyMs,
  }
}
