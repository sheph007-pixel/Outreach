import { prisma } from '../../src/lib/db'
import { getThreadReplies } from '../../src/lib/graph'
import { classifyReply } from '../utils/classifier'
import { cancelContactTasks, scheduleTask } from '../utils/task-helpers'

/**
 * Check for replies on all open outreach threads.
 * Runs on an interval (not task-based).
 */
export async function runReplyChecker(userId: string): Promise<void> {
  // Get sender email from settings
  const senderSetting = await prisma.agentSetting.findUnique({
    where: { key: 'sending.sender_email' },
  })
  const senderEmail = (senderSetting?.value as string) ?? 'hunter@kennion.com'

  // Get all open threads with Graph conversation IDs
  const openThreads = await prisma.outreachThread.findMany({
    where: {
      status: 'open',
      graphThreadId: { not: null },
    },
    include: {
      contact: true,
      messages: { orderBy: { sentAt: 'desc' }, take: 5 },
    },
  })

  if (openThreads.length === 0) {
    console.log('[reply-check] No open threads to check')
    return
  }

  console.log(`[reply-check] Checking ${openThreads.length} open threads`)

  for (const thread of openThreads) {
    try {
      if (!thread.graphThreadId) continue

      const replies = await getThreadReplies(userId, thread.graphThreadId, senderEmail)

      if (replies.length === 0) continue

      // Check for new replies we haven't processed
      const existingMessageIds = new Set(
        thread.messages
          .filter((m) => m.graphMessageId)
          .map((m) => m.graphMessageId)
      )

      for (const reply of replies) {
        if (existingMessageIds.has(reply.id)) continue // Already processed

        console.log(`[reply-check] New reply from ${reply.from.emailAddress.address} on thread ${thread.id}`)

        // Classify the reply
        const previousTexts = thread.messages.map((m) => m.bodyText ?? m.bodyHtml)
        const classification = await classifyReply(
          reply.bodyPreview || reply.body.content,
          thread.subject,
          previousTexts
        )

        // Update contact and thread in a transaction
        await prisma.$transaction(async (tx) => {
          // Update contact
          const contactUpdate: Record<string, unknown> = {
            replyType: classification.replyType,
            lastRepliedAt: new Date(),
            lastOutcome: classification.replyType,
          }

          // Determine status change based on reply type
          if (classification.replyType === 'unsubscribe') {
            contactUpdate.status = 'blocked'
            contactUpdate.blockedReason = 'Unsubscribed via reply'
          } else if (['no', 'next_year'].includes(classification.replyType)) {
            contactUpdate.status = 'finished'
          } else {
            contactUpdate.status = 'replied'
          }

          await tx.contact.update({
            where: { id: thread.contact.id },
            data: contactUpdate as any,
          })

          // Status history
          await tx.contactStatusHistory.create({
            data: {
              contactId: thread.contact.id,
              fromStatus: thread.contact.status,
              toStatus: contactUpdate.status as any,
              reason: `Reply classified as: ${classification.replyType}`,
              changedBy: 'system',
            },
          })

          // Update thread status
          await tx.outreachThread.update({
            where: { id: thread.id },
            data: { status: 'replied' },
          })

          // Create signal
          await tx.contactSignal.create({
            data: {
              contactId: thread.contact.id,
              type: 'reply_received',
              source: 'worker',
              data: {
                replyType: classification.replyType,
                confidence: classification.confidence,
                from: reply.from.emailAddress.address,
              },
            },
          })

          // Audit log
          await tx.auditLog.create({
            data: {
              action: 'reply.classified',
              entityType: 'contact',
              entityId: thread.contact.id,
              details: {
                threadId: thread.id,
                replyType: classification.replyType,
                confidence: classification.confidence,
                reasoning: classification.reasoning,
              },
            },
          })
        })

        // Cancel pending tasks for unsubscribed/blocked contacts
        if (['unsubscribe', 'no'].includes(classification.replyType)) {
          await cancelContactTasks(thread.contact.id, `Reply: ${classification.replyType}`)
        }

        // For "later" replies, schedule re-engagement
        if (classification.replyType === 'later') {
          await scheduleTask(
            thread.contact.id,
            're_engage',
            new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days
          )
        }

        // For "next_year" replies, schedule re-engagement for next year
        if (classification.replyType === 'next_year') {
          const nextYear = new Date()
          nextYear.setFullYear(nextYear.getFullYear() + 1)
          nextYear.setMonth(0) // January
          await scheduleTask(thread.contact.id, 're_engage', nextYear)
        }

        // Log the decision
        await prisma.decisionLog.create({
          data: {
            contactId: thread.contact.id,
            decision: 'classify_reply',
            reasoning: `Classified reply as "${classification.replyType}" (confidence: ${classification.confidence}). ${classification.reasoning}`,
            modelUsed: process.env.OPENAI_MODEL ?? 'gpt-4o',
            inputTokens: classification.usage.inputTokens,
            outputTokens: classification.usage.outputTokens,
            latencyMs: classification.latencyMs,
          },
        })
      }
    } catch (error) {
      console.error(`[reply-check] Error checking thread ${thread.id}:`, error)
    }
  }
}
