import { FollowUpTask, Contact } from '@prisma/client'
import { prisma } from '../../src/lib/db'
import { sendEmail } from '../../src/lib/graph'
import { isContactEligible, hasMinDaysPassed, hasExceededMaxFollowups } from '../rules'
import { completeTask, cancelTask, scheduleTask } from '../utils/task-helpers'
import { generateEmailDraft } from '../utils/email-builder'

/**
 * Handle follow-up email to a contact.
 */
export async function handleFollowUp(
  task: FollowUpTask & { contact: Contact },
  userId: string
): Promise<void> {
  const { contact } = task

  // 1. Check eligibility
  const eligibility = isContactEligible(contact)
  if (!eligibility.eligible) {
    await cancelTask(task.id, eligibility.reason)
    return
  }

  // 2. Check min days
  if (!(await hasMinDaysPassed(contact))) {
    const nextDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await prisma.followUpTask.update({
      where: { id: task.id },
      data: { scheduledAt: nextDate, status: 'pending' },
    })
    return
  }

  // 3. Check max follow-ups
  if (await hasExceededMaxFollowups(contact)) {
    await cancelTask(task.id, 'Max follow-ups exceeded')
    await prisma.contact.update({
      where: { id: contact.id },
      data: { status: 'finished' },
    })
    return
  }

  // 4. Get the existing thread
  const thread = await prisma.outreachThread.findFirst({
    where: { contactId: contact.id, status: 'open' },
    orderBy: { createdAt: 'desc' },
    include: { messages: { orderBy: { sentAt: 'asc' } } },
  })

  if (!thread) {
    // No open thread — treat as initial outreach
    await cancelTask(task.id, 'No open thread found, needs initial outreach')
    await scheduleTask(contact.id, 'initial_outreach', new Date())
    return
  }

  // 5. Get prompt version
  const promptVersion = await prisma.promptVersion.findFirst({
    where: { name: 'follow_up', active: true },
    orderBy: { version: 'desc' },
  })

  if (!promptVersion) {
    throw new Error('No active follow_up prompt version')
  }

  // 6. Generate follow-up email
  const { draft, usage, latencyMs } = await generateEmailDraft(
    promptVersion,
    contact,
    thread.messages
  )

  // 7. Send as reply to existing thread
  const lastMessage = thread.messages[thread.messages.length - 1]
  const replyToId = lastMessage?.graphMessageId ?? undefined

  const result = await sendEmail(userId, {
    to: contact.email,
    subject: `Re: ${thread.subject}`,
    bodyHtml: draft.bodyHtml,
    replyToMessageId: replyToId ?? undefined,
  })

  // 8. Store message
  await prisma.$transaction(async (tx) => {
    await tx.outboundMessage.create({
      data: {
        threadId: thread.id,
        graphMessageId: result.messageId || null,
        subject: `Re: ${thread.subject}`,
        bodyHtml: draft.bodyHtml,
        bodyText: draft.bodyText,
        messageType: 'follow_up',
        promptVersionId: promptVersion.id,
      },
    })

    await tx.contact.update({
      where: { id: contact.id },
      data: {
        lastContactedAt: new Date(),
        totalOutreach: { increment: 1 },
        nextContactAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    await tx.auditLog.create({
      data: {
        action: 'email.sent',
        entityType: 'contact',
        entityId: contact.id,
        details: {
          subject: `Re: ${thread.subject}`,
          threadId: thread.id,
          messageType: 'follow_up',
        },
      },
    })
  })

  // 9. Schedule reply check
  await scheduleTask(
    contact.id,
    'check_reply',
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
  )

  // 10. Log decision
  await prisma.decisionLog.create({
    data: {
      contactId: contact.id,
      taskId: task.id,
      decision: 'send_followup',
      reasoning: `Sent follow-up #${contact.totalOutreach + 1}: "${draft.subject}"`,
      modelUsed: process.env.OPENAI_MODEL ?? 'gpt-4o',
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      latencyMs,
    },
  })

  await completeTask(task.id)
  console.log(`[follow-up] Sent follow-up to ${contact.email}`)
}
