/**
 * Hard guardrails enforced in code. These are NEVER overridable by AI.
 * The worker checks these BEFORE consulting AI for any decision.
 */

import { Contact, ContactStatus } from '@prisma/client'
import { prisma } from '../src/lib/db'

// ============================================================
// Contact Eligibility
// ============================================================

interface EligibilityResult {
  eligible: boolean
  reason: string
}

export function isContactEligible(contact: Contact): EligibilityResult {
  if (contact.status === 'blocked') {
    return { eligible: false, reason: 'Contact is blocked' }
  }
  if (contact.status === 'finished') {
    return { eligible: false, reason: 'Contact is finished' }
  }
  if (contact.status === 'paused') {
    return { eligible: false, reason: 'Contact is paused' }
  }
  if (contact.replyType === 'unsubscribe') {
    return { eligible: false, reason: 'Contact unsubscribed' }
  }
  // Replied contacts should not receive new outreach unless re-engaged
  if (contact.status === 'replied') {
    return { eligible: false, reason: 'Contact has replied — requires manual re-engagement' }
  }
  return { eligible: true, reason: '' }
}

// ============================================================
// Send Window
// ============================================================

export async function isWithinSendWindow(): Promise<boolean> {
  const windowStart = await getSettingValue<number>('sending.window_start', 8)
  const windowEnd = await getSettingValue<number>('sending.window_end', 17)
  const timezone = await getSettingValue<string>('sending.timezone', 'America/Denver')

  const now = new Date()
  // Get current hour in the configured timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: timezone,
  })
  const currentHour = parseInt(formatter.format(now))

  return currentHour >= windowStart && currentHour < windowEnd
}

// ============================================================
// Daily Send Limit
// ============================================================

export async function getSentTodayCount(): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return prisma.outboundMessage.count({
    where: { sentAt: { gte: today } },
  })
}

export async function getDailyLimit(): Promise<number> {
  return getSettingValue<number>('sending.daily_limit', 50)
}

export async function canSendMore(): Promise<{ allowed: boolean; sent: number; limit: number }> {
  const [sent, limit] = await Promise.all([getSentTodayCount(), getDailyLimit()])
  return { allowed: sent < limit, sent, limit }
}

// ============================================================
// Minimum Days Between Outreach
// ============================================================

export async function hasMinDaysPassed(contact: Contact): Promise<boolean> {
  if (!contact.lastContactedAt) return true

  const minDays = await getSettingValue<number>('rules.min_days_between_outreach', 7)
  const daysSince = Math.floor(
    (Date.now() - contact.lastContactedAt.getTime()) / (1000 * 60 * 60 * 24)
  )

  return daysSince >= minDays
}

// ============================================================
// Max Follow-ups
// ============================================================

export async function hasExceededMaxFollowups(contact: Contact): Promise<boolean> {
  const maxFollowups = await getSettingValue<number>('rules.max_followups', 4)
  return contact.totalOutreach > maxFollowups
}

// ============================================================
// Blocked Domains
// ============================================================

export async function isDomainBlocked(email: string): Promise<boolean> {
  const blockedDomains = await getSettingValue<string>('rules.blocked_domains', '')
  if (!blockedDomains) return false

  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false

  const blocked = blockedDomains
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)

  return blocked.includes(domain)
}

// ============================================================
// System Enabled
// ============================================================

export async function isSystemEnabled(): Promise<boolean> {
  return getSettingValue<boolean>('rules.system_enabled', true)
}

// ============================================================
// Helper
// ============================================================

async function getSettingValue<T>(key: string, defaultValue: T): Promise<T> {
  const setting = await prisma.agentSetting.findUnique({ where: { key } })
  if (!setting) return defaultValue
  return setting.value as T
}
