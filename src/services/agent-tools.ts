import { prisma } from '@/lib/db'
import { listContacts, changeContactStatus } from '@/services/contacts'
import { AUDIT_ACTIONS } from '@/lib/constants'
import type { ContactStatus } from '@prisma/client'

/**
 * Execute an agent tool call against real system data.
 */
export async function executeAgentTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  switch (toolName) {
    case 'search_contacts':
      return searchContacts(args)
    case 'get_contact_details':
      return getContactDetails(args)
    case 'get_system_stats':
      return getSystemStats()
    case 'get_recent_decisions':
      return getRecentDecisions(args)
    case 'get_pending_tasks':
      return getPendingTasks(args)
    case 'update_contact_status':
      return updateContactStatus(args, userId)
    case 'pause_contact':
      return pauseContact(args, userId)
    case 'schedule_outreach':
      return scheduleOutreach(args, userId)
    case 'save_memory':
      return saveMemory(args, userId)
    case 'get_outreach_history':
      return getOutreachHistory(args)
    case 'get_memories':
      return getMemories(userId)
    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}

async function searchContacts(args: Record<string, unknown>) {
  const result = await listContacts({
    search: args.query as string,
    status: args.status ? [args.status as ContactStatus] : undefined,
    pageSize: (args.limit as number) ?? 10,
  })
  return result.data.map((c) => ({
    id: c.id,
    email: c.email,
    name: [c.firstName, c.lastName].filter(Boolean).join(' '),
    company: c.company,
    status: c.status,
    replyType: c.replyType,
    priorityScore: c.priorityScore,
    lastContactedAt: c.lastContactedAt,
    nextContactAt: c.nextContactAt,
  }))
}

async function getContactDetails(args: Record<string, unknown>) {
  const contact = await prisma.contact.findUnique({
    where: { id: args.contactId as string },
    include: {
      statusHistory: { orderBy: { createdAt: 'desc' }, take: 5 },
      threads: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { messages: { orderBy: { sentAt: 'desc' }, take: 3 } },
      },
    },
  })
  if (!contact) return { error: 'Contact not found' }
  return contact
}

async function getSystemStats() {
  const now = new Date()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    totalContacts,
    activeContacts,
    pausedContacts,
    blockedContacts,
    repliedContacts,
    sendsToday,
    pendingTasks,
    dueContacts,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.contact.count({ where: { status: 'active' } }),
    prisma.contact.count({ where: { status: 'paused' } }),
    prisma.contact.count({ where: { status: 'blocked' } }),
    prisma.contact.count({ where: { status: 'replied' } }),
    prisma.outboundMessage.count({ where: { sentAt: { gte: today } } }),
    prisma.followUpTask.count({ where: { status: 'pending' } }),
    prisma.contact.count({
      where: { status: 'active', nextContactAt: { lte: now } },
    }),
  ])

  return {
    totalContacts,
    activeContacts,
    pausedContacts,
    blockedContacts,
    repliedContacts,
    sendsToday,
    pendingTasks,
    dueContacts,
  }
}

async function getRecentDecisions(args: Record<string, unknown>) {
  const where: Record<string, unknown> = {}
  if (args.contactId) where.contactId = args.contactId

  return prisma.decisionLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: (args.limit as number) ?? 10,
    include: { contact: { select: { email: true, firstName: true, lastName: true } } },
  })
}

async function getPendingTasks(args: Record<string, unknown>) {
  return prisma.followUpTask.findMany({
    where: { status: 'pending' },
    orderBy: { scheduledAt: 'asc' },
    take: (args.limit as number) ?? 10,
    include: {
      contact: { select: { email: true, firstName: true, lastName: true, company: true } },
    },
  })
}

async function updateContactStatus(args: Record<string, unknown>, userId: string) {
  const contactId = args.contactId as string
  const status = args.status as ContactStatus
  const reason = (args.reason as string) ?? 'Agent action'

  const contact = await changeContactStatus(contactId, status, reason, userId)

  await prisma.aiAction.create({
    data: {
      actionType: 'update_status',
      contactId,
      payload: { status, reason },
      status: 'executed',
      executedAt: new Date(),
    },
  })

  return { success: true, contact: { id: contact.id, email: contact.email, status: contact.status } }
}

async function pauseContact(args: Record<string, unknown>, userId: string) {
  return updateContactStatus(
    { contactId: args.contactId, status: 'paused', reason: args.reason ?? 'Paused by agent' },
    userId
  )
}

async function scheduleOutreach(args: Record<string, unknown>, userId: string) {
  const contactId = args.contactId as string
  const scheduledAt = args.scheduledAt
    ? new Date(args.scheduledAt as string)
    : new Date()

  const task = await prisma.followUpTask.create({
    data: {
      contactId,
      taskType: 'initial_outreach',
      scheduledAt,
    },
  })

  await prisma.aiAction.create({
    data: {
      actionType: 'schedule_followup',
      contactId,
      payload: { taskId: task.id, scheduledAt: scheduledAt.toISOString() },
      status: 'executed',
      executedAt: new Date(),
    },
  })

  await prisma.auditLog.create({
    data: {
      userId,
      action: AUDIT_ACTIONS.TASK_CREATED,
      entityType: 'task',
      entityId: task.id,
      details: { contactId, taskType: 'initial_outreach', source: 'agent' },
    },
  })

  return { success: true, taskId: task.id, scheduledAt }
}

async function saveMemory(args: Record<string, unknown>, userId: string) {
  const memory = await prisma.agentMemory.create({
    data: {
      userId,
      content: args.content as string,
      category: (args.category as string) ?? 'instruction',
    },
  })

  await prisma.auditLog.create({
    data: {
      userId,
      action: AUDIT_ACTIONS.MEMORY_CREATED,
      entityType: 'memory',
      entityId: memory.id,
      details: { content: String(args.content ?? ''), category: String(args.category ?? '') },
    },
  })

  return { success: true, memoryId: memory.id }
}

async function getOutreachHistory(args: Record<string, unknown>) {
  const threads = await prisma.outreachThread.findMany({
    where: { contactId: args.contactId as string },
    orderBy: { createdAt: 'desc' },
    include: { messages: { orderBy: { sentAt: 'asc' } } },
  })
  return threads
}

async function getMemories(userId: string) {
  return prisma.agentMemory.findMany({
    where: { userId, active: true },
    orderBy: { createdAt: 'desc' },
  })
}
