import { FollowUpTask, Contact } from '@prisma/client'
import { prisma } from '../../src/lib/db'
import { isContactEligible } from '../rules'
import { completeTask, cancelTask, scheduleTask } from '../utils/task-helpers'

/**
 * Handle re-engagement of a contact who previously said "later" or "next_year".
 * Creates a new initial outreach task (new thread, not reply to old one).
 */
export async function handleReEngage(
  task: FollowUpTask & { contact: Contact }
): Promise<void> {
  const { contact } = task

  // Check if contact is still eligible
  const eligibility = isContactEligible(contact)
  if (!eligibility.eligible) {
    await cancelTask(task.id, eligibility.reason)
    return
  }

  // Reset contact for fresh outreach
  await prisma.$transaction(async (tx) => {
    await tx.contact.update({
      where: { id: contact.id },
      data: {
        status: 'active',
        replyType: 'none',
        lastOutcome: null,
      },
    })

    await tx.contactStatusHistory.create({
      data: {
        contactId: contact.id,
        fromStatus: contact.status,
        toStatus: 'active',
        reason: 'Re-engagement: scheduling new outreach cycle',
        changedBy: 'system',
      },
    })

    await tx.auditLog.create({
      data: {
        action: 'contact.status_changed',
        entityType: 'contact',
        entityId: contact.id,
        details: {
          from: contact.status,
          to: 'active',
          reason: 'Re-engagement',
        },
      },
    })
  })

  // Schedule a new initial outreach
  await scheduleTask(contact.id, 'initial_outreach', new Date())

  await prisma.decisionLog.create({
    data: {
      contactId: contact.id,
      taskId: task.id,
      decision: 're_engage',
      reasoning: `Re-engaging contact. Previous outcome: ${contact.lastOutcome ?? 'unknown'}. Scheduling new initial outreach.`,
    },
  })

  await completeTask(task.id)
  console.log(`[re-engage] Re-engaged ${contact.email}, scheduling new outreach`)
}
