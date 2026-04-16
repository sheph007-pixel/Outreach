import { prisma } from '../../src/lib/db'

/**
 * Recalculate priority, engagement, and response scores for all active contacts.
 * Uses deterministic formulas, not AI.
 */
export async function runScoreUpdater(): Promise<void> {
  const contacts = await prisma.contact.findMany({
    where: { status: { in: ['active', 'paused', 'replied'] } },
    include: {
      threads: { include: { messages: true } },
      signals: true,
    },
  })

  console.log(`[scores] Updating scores for ${contacts.length} contacts`)

  const now = Date.now()

  for (const contact of contacts) {
    try {
      // Priority Score (0-100)
      // Higher = should be contacted sooner
      let priority = 50 // Base score

      // Group size boost (larger groups = higher priority)
      if (contact.groupSize) {
        if (contact.groupSize >= 100) priority += 20
        else if (contact.groupSize >= 50) priority += 15
        else if (contact.groupSize >= 20) priority += 10
        else if (contact.groupSize >= 5) priority += 5
      }

      // Renewal month proximity (closer = higher priority)
      if (contact.renewalMonth) {
        const currentMonth = new Date().getMonth() + 1
        const monthsUntilRenewal =
          ((contact.renewalMonth - currentMonth + 12) % 12) || 12
        if (monthsUntilRenewal <= 2) priority += 20
        else if (monthsUntilRenewal <= 4) priority += 10
        else if (monthsUntilRenewal <= 6) priority += 5
      }

      // Never contacted = higher priority
      if (contact.totalOutreach === 0) {
        priority += 10
      }

      // Decay: long time since last contact = slightly higher priority
      if (contact.lastContactedAt) {
        const daysSince = Math.floor(
          (now - contact.lastContactedAt.getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysSince > 30) priority += 5
        if (daysSince > 90) priority += 5
      }

      // Engagement Score (0-100)
      // Based on reply history and interactions
      let engagement = 0

      if (contact.replyType === 'yes' || contact.replyType === 'interested') {
        engagement = 90
      } else if (contact.replyType === 'later') {
        engagement = 60
      } else if (contact.replyType === 'next_year') {
        engagement = 40
      } else if (contact.replyType === 'no') {
        engagement = 10
      } else if (contact.totalOutreach > 0) {
        // No reply yet: engagement based on outreach attempts
        engagement = Math.max(5, 30 - contact.totalOutreach * 5)
      }

      // Signal boost
      const signalCount = contact.signals.length
      engagement = Math.min(100, engagement + signalCount * 2)

      // Response Score (0-100)
      // Based on speed and quality of responses
      let response = 0

      if (contact.lastRepliedAt && contact.lastContactedAt) {
        const responseTimeMs =
          contact.lastRepliedAt.getTime() - contact.lastContactedAt.getTime()
        const responseDays = responseTimeMs / (1000 * 60 * 60 * 24)

        if (responseDays <= 1) response = 100
        else if (responseDays <= 3) response = 80
        else if (responseDays <= 7) response = 60
        else response = 40
      }

      // Positive reply type boosts response score
      if (['yes', 'interested'].includes(contact.replyType)) {
        response = Math.max(response, 80)
      }

      // Clamp all scores to 0-100
      priority = Math.max(0, Math.min(100, priority))
      engagement = Math.max(0, Math.min(100, engagement))
      response = Math.max(0, Math.min(100, response))

      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          priorityScore: Math.round(priority * 10) / 10,
          engagementScore: Math.round(engagement * 10) / 10,
          responseScore: Math.round(response * 10) / 10,
        },
      })
    } catch (error) {
      console.error(`[scores] Error updating scores for ${contact.email}:`, error)
    }
  }

  console.log('[scores] Score update complete')
}
