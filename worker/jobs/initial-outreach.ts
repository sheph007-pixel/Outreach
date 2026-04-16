import { FollowUpTask, Contact } from '@prisma/client'
import { prisma } from '../../src/lib/db'
import { sendEmail } from '../../src/lib/graph'
import { isContactEligible, hasMinDaysPassed, isDomainBlocked, hasExceededMaxFollowups } from '../rules'
import { completeTask, cancelTask, scheduleTask } from '../utils/task-helpers'
import { generateEmailDraft } from '../utils/email-builder'

/**
 * Handle initial outreach to a contact.
 */
export async function handleInitialOutreach(
  task: FollowUpTask & { contact: Contact },
  userId: string
): Promise<void> {
  const { contact } = task

  // 1. Check eligibility
  const eligibility = isContactEligible(contact)
  if (!eligibility.eligible) {
    await cancelTask(task.id, eligibility.reason)
    await logDecision(contact.id, task.id, 'skip_blocked', eligibility.reason)
    return
  }

  // 2. Check domain block
  if (await isDomainBlocked(contact.email)) {
    await cancelTask(task.id, 'Domain is blocked')
    await logDecision(contact.id, task.id, 'skip_blocked', 'Domain is blocked')
    return
  }

  // 3. Check min days
  if (!(await hasMinDaysPassed(contact))) {
    // Reschedule for later
    const nextDate = new Date(Date.now() + 24 * 60 * 60 * 1000) // +1 day
    await prisma.followUpTask.update({
      where: { id: task.id },
      data: { scheduledAt: nextDate, status: 'pending' },
    })
    await logDecision(contact.id, task.id, 'wait', 'Minimum days between outreach not met, rescheduled')
    return
  }

  // 4. Check max follow-ups
  if (await hasExceededMaxFollowups(contact)) {
    await cancelTask(task.id, 'Max follow-ups exceeded')
    await prisma.contact.update({
      where: { id: contact.id },
      data: { status: 'finished' },
    })
    await logDecision(contact.id, task.id, 'finish', 'Max follow-ups exceeded')
    return
  }

  // 5. Get prompt version
  const promptVersion = await prisma.promptVersion.findFirst({
    where: { name: 'initial_outreach', active: true },
    orderBy: { version: 'desc' },
  })

  if (!promptVersion) {
    throw new Error('No active initial_outreach prompt version')
  }

  // 6. Generate email
  const { draft, usage, latencyMs } = await generateEmailDraft(promptVersion, contact)

  // 7. Send via Microsoft Graph
  const result = await sendEmail(userId, {
    to: contact.email,
    subject: draft.subject,
    bodyHtml: draft.bodyHtml,
  })

  // 8. Store thread and message in transaction
  await prisma.$transaction(async (tx) => {
    const thread = await tx.outreachThread.create({
      data: {
        contactId: contact.id,
        graphThreadId: result.conversationId || null,
        graphMessageId: result.messageId || null,
        subject: draft.subject,
        status: 'open',
      },
    })

    await tx.outboundMessage.create({
      data: {
        threadId: thread.id,
        graphMessageId: result.messageId || null,
        subject: draft.subject,
        bodyHtml: draft.bodyHtml,
        bodyText: draft.bodyText,
        messageType: 'initial',
        promptVersionId: promptVersion.id,
      },
    })

    // 9. Update contact
    await tx.contact.update({
      where: { id: contact.id },
      data: {
        lastContactedAt: new Date(),
        totalOutreach: { increment: 1 },
        nextContactAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
      },
    })

    // 10. Audit log
    await tx.auditLog.create({
      data: {
        action: 'email.sent',
        entityType: 'contact',
        entityId: contact.id,
        details: {
          subject: draft.subject,
          threadId: thread.id,
          messageType: 'initial',
        },
      },
    })
  })

  // 11. Schedule follow-up check
  await scheduleTask(
    contact.id,
    'check_reply',
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // Check for reply in 2 days
  )

  // 12. Log decision
  await logDecision(
    contact.id,
    task.id,
    'send_initial',
    `Sent initial outreach: "${draft.subject}"`,
    usage,
    latencyMs
  )

  // 13. Mark task complete
  await completeTask(task.id)

  console.log(`[outreach] Sent initial email to ${contact.email}: ${draft.subject}`)
}

async function logDecision(
  contactId: string,
  taskId: string,
  decision: string,
  reasoning: string,
  usage?: { inputTokens: number; outputTokens: number },
  latencyMs?: number
) {
  await prisma.decisionLog.create({
    data: {
      contactId,
      taskId,
      decision,
      reasoning,
      modelUsed: usage ? (process.env.OPENAI_MODEL ?? 'gpt-4o') : undefined,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      latencyMs,
    },
  })
}
