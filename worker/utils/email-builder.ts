import { Contact, AgentSetting, AgentMemory, OutboundMessage, PromptVersion } from '@prisma/client'
import { prisma } from '../../src/lib/db'
import { generateCompletion } from '../../src/lib/openai'

interface EmailDraft {
  subject: string
  bodyHtml: string
  bodyText: string
}

/**
 * Build the context string for email generation prompts.
 */
export function buildContactContext(
  contact: Contact,
  previousMessages?: OutboundMessage[]
): string {
  const parts: string[] = [
    `Contact: ${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim(),
    `Email: ${contact.email}`,
  ]

  if (contact.company) parts.push(`Company: ${contact.company}`)
  if (contact.title) parts.push(`Title: ${contact.title}`)
  if (contact.city || contact.state) {
    parts.push(`Location: ${[contact.city, contact.state].filter(Boolean).join(', ')}`)
  }
  if (contact.groupSize) parts.push(`Group Size: ${contact.groupSize}`)
  if (contact.renewalMonth) {
    const monthName = new Date(2000, contact.renewalMonth - 1).toLocaleString('en-US', {
      month: 'long',
    })
    parts.push(`Renewal Month: ${monthName}`)
  }
  if (contact.totalOutreach > 0) {
    parts.push(`Previous outreach attempts: ${contact.totalOutreach}`)
  }
  if (contact.notes) parts.push(`Notes: ${contact.notes}`)

  if (previousMessages?.length) {
    parts.push('\n--- Previous Messages ---')
    for (const msg of previousMessages) {
      parts.push(`[${msg.sentAt.toISOString().slice(0, 10)}] ${msg.subject}`)
      parts.push(msg.bodyText ?? '(HTML only)')
    }
  }

  return parts.join('\n')
}

/**
 * Build the system prompt from a prompt version + settings + memories.
 */
export async function buildSystemPrompt(
  promptVersion: PromptVersion
): Promise<string> {
  const settings = await prisma.agentSetting.findMany({
    where: { category: { in: ['tone', 'rules', 'sending'] } },
  })

  const memories = await prisma.agentMemory.findMany({
    where: { active: true },
  })

  const settingsContext = settings
    .filter((s) => s.value && s.value !== '')
    .map((s) => `${s.label ?? s.key}: ${JSON.stringify(s.value)}`)
    .join('\n')

  const memoriesContext = memories
    .map((m) => `- ${m.content}`)
    .join('\n')

  let prompt = promptVersion.content

  if (settingsContext) {
    prompt += `\n\n--- Current Settings ---\n${settingsContext}`
  }

  if (memoriesContext) {
    prompt += `\n\n--- User Instructions/Preferences ---\n${memoriesContext}`
  }

  return prompt
}

/**
 * Generate an email draft using AI.
 */
export async function generateEmailDraft(
  promptVersion: PromptVersion,
  contact: Contact,
  previousMessages?: OutboundMessage[]
): Promise<{ draft: EmailDraft; usage: { inputTokens: number; outputTokens: number }; latencyMs: number }> {
  const systemPrompt = await buildSystemPrompt(promptVersion)
  const userPrompt = buildContactContext(contact, previousMessages)

  const result = await generateCompletion(systemPrompt, userPrompt, {
    responseFormat: 'json',
    temperature: 0.7,
  })

  let draft: EmailDraft
  try {
    const parsed = JSON.parse(result.content)
    draft = {
      subject: parsed.subject || 'Group Health Insurance',
      bodyHtml: parsed.bodyHtml || parsed.body || '',
      bodyText: parsed.bodyText || stripHtml(parsed.bodyHtml || parsed.body || ''),
    }
  } catch {
    // Fallback if AI doesn't return valid JSON
    draft = {
      subject: 'Group Health Insurance',
      bodyHtml: `<p>${result.content}</p>`,
      bodyText: result.content,
    }
  }

  return { draft, usage: result.usage, latencyMs: result.latencyMs }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}
