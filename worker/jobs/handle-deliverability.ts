import { prisma } from '../../src/lib/db'

/**
 * Record a deliverability event and take appropriate action.
 */
export async function handleDeliverabilityEvent(
  contactId: string,
  messageId: string | null,
  eventType: 'bounce_hard' | 'bounce_soft' | 'failed' | 'blocked',
  details?: Record<string, unknown>
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Record the event
    await tx.deliverabilityEvent.create({
      data: {
        contactId,
        messageId,
        eventType,
        details: details ?? {},
      },
    })

    // Check auto-block setting for hard bounces
    if (eventType === 'bounce_hard') {
      const autoBlock = await tx.agentSetting.findUnique({
        where: { key: 'rules.auto_block_hard_bounce' },
      })

      if (autoBlock?.value === true) {
        const contact = await tx.contact.findUnique({ where: { id: contactId } })
        if (contact && contact.status !== 'blocked') {
          await tx.contact.update({
            where: { id: contactId },
            data: {
              status: 'blocked',
              blockedReason: 'Hard bounce - email undeliverable',
            },
          })

          await tx.contactStatusHistory.create({
            data: {
              contactId,
              fromStatus: contact.status,
              toStatus: 'blocked',
              reason: 'Auto-blocked: hard bounce',
              changedBy: 'system',
            },
          })

          await tx.auditLog.create({
            data: {
              action: 'contact.status_changed',
              entityType: 'contact',
              entityId: contactId,
              details: {
                from: contact.status,
                to: 'blocked',
                reason: 'Hard bounce auto-block',
                eventType,
              },
            },
          })
        }
      }
    }

    // For soft bounces, check if we've had multiple
    if (eventType === 'bounce_soft') {
      const softBounceCount = await tx.deliverabilityEvent.count({
        where: { contactId, eventType: 'bounce_soft' },
      })

      // After 3 soft bounces, auto-block
      if (softBounceCount >= 3) {
        const contact = await tx.contact.findUnique({ where: { id: contactId } })
        if (contact && contact.status !== 'blocked') {
          await tx.contact.update({
            where: { id: contactId },
            data: {
              status: 'blocked',
              blockedReason: `${softBounceCount} soft bounces`,
            },
          })

          await tx.contactStatusHistory.create({
            data: {
              contactId,
              fromStatus: contact.status,
              toStatus: 'blocked',
              reason: `Auto-blocked: ${softBounceCount} soft bounces`,
              changedBy: 'system',
            },
          })
        }
      }
    }
  })

  console.log(`[deliverability] Recorded ${eventType} for contact ${contactId}`)
}
