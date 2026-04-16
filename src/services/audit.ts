import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export async function createAuditLog(params: {
  userId?: string
  action: string
  entityType?: string
  entityId?: string
  details?: Prisma.InputJsonObject
}) {
  return prisma.auditLog.create({ data: params })
}

export async function listAuditLogs(params: {
  page?: number
  pageSize?: number
  action?: string
  entityType?: string
  entityId?: string
}) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 25
  const skip = (page - 1) * pageSize

  const where: Prisma.AuditLogWhereInput = {}
  if (params.action) where.action = params.action
  if (params.entityType) where.entityType = params.entityType
  if (params.entityId) where.entityId = params.entityId

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    success: true,
    data: logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
