import { prisma } from '@/lib/db'

export interface DashboardMetrics {
  sendsToday: number
  repliesToday: number
  interestedLeads: number
  dueContacts: number
  activeContacts: number
  pausedContacts: number
  blockedContacts: number
  tasksQueued: number
  totalContacts: number
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const now = new Date()

  const [
    sendsToday,
    repliesToday,
    interestedLeads,
    dueContacts,
    statusCounts,
    tasksQueued,
    totalContacts,
  ] = await Promise.all([
    prisma.outboundMessage.count({
      where: { sentAt: { gte: today } },
    }),
    prisma.contact.count({
      where: { lastRepliedAt: { gte: today } },
    }),
    prisma.contact.count({
      where: { replyType: { in: ['yes', 'interested'] } },
    }),
    prisma.contact.count({
      where: {
        status: 'active',
        nextContactAt: { lte: now },
      },
    }),
    prisma.contact.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.followUpTask.count({
      where: { status: 'pending' },
    }),
    prisma.contact.count(),
  ])

  const countMap: Record<string, number> = {}
  for (const row of statusCounts) {
    countMap[row.status] = row._count.id
  }

  return {
    sendsToday,
    repliesToday,
    interestedLeads,
    dueContacts,
    activeContacts: countMap['active'] ?? 0,
    pausedContacts: countMap['paused'] ?? 0,
    blockedContacts: countMap['blocked'] ?? 0,
    tasksQueued,
    totalContacts,
  }
}

export async function getRecentActivity(limit: number = 10) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { name: true, email: true } } },
  })
}

export async function getRecentDecisions(limit: number = 10) {
  return prisma.decisionLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { contact: { select: { email: true, firstName: true, lastName: true } } },
  })
}
