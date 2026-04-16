import { Prisma, ContactStatus, ReplyType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { AUDIT_ACTIONS } from '@/lib/constants'
import type {
  ContactCreateInput,
  ContactUpdateInput,
  ContactFilters,
  ContactListItem,
  ContactWithRelations,
  CsvImportResult,
} from '@/types/contacts'
import type { PaginatedResponse } from '@/types/api'
import { contactCreateSchema } from '@/types/contacts'
import Papa from 'papaparse'

const DEFAULT_PAGE_SIZE = 25

// ============================================================
// CRUD
// ============================================================

export async function createContact(
  data: ContactCreateInput,
  userId: string
) {
  const contact = await prisma.$transaction(async (tx) => {
    const created = await tx.contact.create({
      data: {
        email: data.email.toLowerCase().trim(),
        firstName: data.firstName?.trim() || null,
        lastName: data.lastName?.trim() || null,
        company: data.company?.trim() || null,
        title: data.title?.trim() || null,
        phone: data.phone?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
        groupSize: data.groupSize ?? null,
        renewalMonth: data.renewalMonth ?? null,
        source: data.source ?? 'manual',
        notes: data.notes ?? null,
      },
    })

    await tx.contactStatusHistory.create({
      data: {
        contactId: created.id,
        toStatus: 'active',
        reason: 'Contact created',
        changedBy: userId,
      },
    })

    await tx.auditLog.create({
      data: {
        userId,
        action: AUDIT_ACTIONS.CONTACT_CREATED,
        entityType: 'contact',
        entityId: created.id,
        details: { email: created.email } as Prisma.InputJsonObject,
      },
    })

    return created
  })

  return contact
}

export async function updateContact(
  id: string,
  data: ContactUpdateInput,
  userId: string
) {
  const existing = await prisma.contact.findUnique({ where: { id } })
  if (!existing) throw new Error('Contact not found')

  const updateData: Prisma.ContactUpdateInput = {}
  if (data.email !== undefined) updateData.email = data.email.toLowerCase().trim()
  if (data.firstName !== undefined) updateData.firstName = data.firstName?.trim() || null
  if (data.lastName !== undefined) updateData.lastName = data.lastName?.trim() || null
  if (data.company !== undefined) updateData.company = data.company?.trim() || null
  if (data.title !== undefined) updateData.title = data.title?.trim() || null
  if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null
  if (data.city !== undefined) updateData.city = data.city?.trim() || null
  if (data.state !== undefined) updateData.state = data.state?.trim() || null
  if (data.groupSize !== undefined) updateData.groupSize = data.groupSize
  if (data.renewalMonth !== undefined) updateData.renewalMonth = data.renewalMonth
  if (data.notes !== undefined) updateData.notes = data.notes
  if (data.replyType !== undefined) updateData.replyType = data.replyType
  if (data.nextContactAt !== undefined) updateData.nextContactAt = data.nextContactAt ? new Date(data.nextContactAt) : null
  if (data.blockedReason !== undefined) updateData.blockedReason = data.blockedReason

  // Handle status change with history
  if (data.status !== undefined && data.status !== existing.status) {
    return changeContactStatus(id, data.status, 'Manual update', userId, updateData)
  }

  const contact = await prisma.$transaction(async (tx) => {
    const updated = await tx.contact.update({
      where: { id },
      data: updateData,
    })

    await tx.auditLog.create({
      data: {
        userId,
        action: AUDIT_ACTIONS.CONTACT_UPDATED,
        entityType: 'contact',
        entityId: id,
        details: { changes: Object.keys(updateData) } as Prisma.InputJsonObject,
      },
    })

    return updated
  })

  return contact
}

export async function deleteContact(id: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.contact.delete({ where: { id } })
    await tx.auditLog.create({
      data: {
        userId,
        action: AUDIT_ACTIONS.CONTACT_DELETED,
        entityType: 'contact',
        entityId: id,
      },
    })
  })
}

export async function deleteContacts(ids: string[], userId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.contact.deleteMany({
      where: { id: { in: ids } },
    })

    await tx.auditLog.create({
      data: {
        userId,
        action: AUDIT_ACTIONS.CONTACT_DELETED,
        entityType: 'contact',
        details: { ids, count: deleted.count } as Prisma.InputJsonObject,
      },
    })

    return deleted.count
  })

  return result
}

export async function getContact(id: string): Promise<ContactWithRelations | null> {
  return prisma.contact.findUnique({
    where: { id },
    include: {
      statusHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
      threads: {
        orderBy: { createdAt: 'desc' },
        include: { messages: { orderBy: { sentAt: 'desc' } } },
      },
    },
  }) as Promise<ContactWithRelations | null>
}

// ============================================================
// List with filtering, sorting, pagination
// ============================================================

export async function listContacts(params: {
  page?: number
  pageSize?: number
  sort?: string
  direction?: 'asc' | 'desc'
  search?: string
  status?: ContactStatus[]
  replyType?: ReplyType[]
  renewalMonth?: number[]
  source?: string[]
}): Promise<PaginatedResponse<ContactListItem>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Prisma.ContactWhereInput = {}

  if (params.search) {
    const search = params.search.trim()
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (params.status?.length) {
    where.status = { in: params.status }
  }

  if (params.replyType?.length) {
    where.replyType = { in: params.replyType }
  }

  if (params.renewalMonth?.length) {
    where.renewalMonth = { in: params.renewalMonth }
  }

  if (params.source?.length) {
    where.source = { in: params.source }
  }

  const sortField = params.sort ?? 'updatedAt'
  const sortDir = params.direction ?? 'desc'
  const orderBy: Prisma.ContactOrderByWithRelationInput = { [sortField]: sortDir }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        status: true,
        replyType: true,
        priorityScore: true,
        lastContactedAt: true,
        nextContactAt: true,
        updatedAt: true,
        renewalMonth: true,
        totalOutreach: true,
      },
    }),
    prisma.contact.count({ where }),
  ])

  return {
    success: true,
    data: contacts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ============================================================
// Status changes
// ============================================================

export async function changeContactStatus(
  contactId: string,
  newStatus: ContactStatus,
  reason: string,
  changedBy: string,
  additionalUpdate?: Prisma.ContactUpdateInput
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.contact.findUnique({ where: { id: contactId } })
    if (!existing) throw new Error('Contact not found')

    const updated = await tx.contact.update({
      where: { id: contactId },
      data: {
        ...additionalUpdate,
        status: newStatus,
      },
    })

    await tx.contactStatusHistory.create({
      data: {
        contactId,
        fromStatus: existing.status,
        toStatus: newStatus,
        reason,
        changedBy,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: changedBy === 'system' ? null : changedBy,
        action: AUDIT_ACTIONS.CONTACT_STATUS_CHANGED,
        entityType: 'contact',
        entityId: contactId,
        details: {
          from: existing.status,
          to: newStatus,
          reason,
        } as Prisma.InputJsonObject,
      },
    })

    return updated
  })
}

// ============================================================
// Bulk actions
// ============================================================

export async function bulkUpdateStatus(
  ids: string[],
  status: ContactStatus,
  userId: string
) {
  let updated = 0
  for (const id of ids) {
    try {
      await changeContactStatus(id, status, `Bulk ${status}`, userId)
      updated++
    } catch {
      // Skip contacts that can't be updated
    }
  }
  return updated
}

// ============================================================
// CSV Import / Export
// ============================================================

const CSV_FIELD_MAP: Record<string, string> = {
  email: 'email',
  e_mail: 'email',
  'e-mail': 'email',
  first_name: 'firstName',
  firstname: 'firstName',
  'first name': 'firstName',
  last_name: 'lastName',
  lastname: 'lastName',
  'last name': 'lastName',
  company: 'company',
  company_name: 'company',
  'company name': 'company',
  title: 'title',
  job_title: 'title',
  phone: 'phone',
  telephone: 'phone',
  city: 'city',
  state: 'state',
  group_size: 'groupSize',
  groupsize: 'groupSize',
  'group size': 'groupSize',
  renewal_month: 'renewalMonth',
  renewalmonth: 'renewalMonth',
  'renewal month': 'renewalMonth',
  notes: 'notes',
  source: 'source',
}

export async function importContactsCsv(
  csvText: string,
  userId: string
): Promise<CsvImportResult> {
  const result: CsvImportResult = { created: 0, updated: 0, skipped: 0, errors: [] }

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })

  if (parsed.errors.length > 0) {
    for (const err of parsed.errors.slice(0, 10)) {
      result.errors.push({ row: err.row ?? 0, error: err.message })
    }
  }

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i] as Record<string, string>
    const rowNum = i + 2 // +2 for header row and 1-based indexing

    try {
      // Map CSV columns to our fields
      const mapped: Record<string, string> = {}
      for (const [csvKey, value] of Object.entries(row)) {
        const fieldName = CSV_FIELD_MAP[csvKey.toLowerCase()]
        if (fieldName && value?.trim()) {
          mapped[fieldName] = value.trim()
        }
      }

      if (!mapped.email) {
        result.errors.push({ row: rowNum, error: 'Missing email' })
        result.skipped++
        continue
      }

      // Validate with schema
      const validated = contactCreateSchema.safeParse({
        ...mapped,
        groupSize: mapped.groupSize ? parseInt(mapped.groupSize) : undefined,
        renewalMonth: mapped.renewalMonth ? parseInt(mapped.renewalMonth) : undefined,
        source: 'csv_import',
      })

      if (!validated.success) {
        result.errors.push({
          row: rowNum,
          error: validated.error.errors.map((e) => e.message).join(', '),
        })
        result.skipped++
        continue
      }

      const data = validated.data
      const email = data.email.toLowerCase().trim()

      // Upsert: create or update existing
      const existing = await prisma.contact.findUnique({ where: { email } })

      if (existing) {
        await prisma.contact.update({
          where: { email },
          data: {
            firstName: data.firstName || existing.firstName,
            lastName: data.lastName || existing.lastName,
            company: data.company || existing.company,
            title: data.title || existing.title,
            phone: data.phone || existing.phone,
            city: data.city || existing.city,
            state: data.state || existing.state,
            groupSize: data.groupSize ?? existing.groupSize,
            renewalMonth: data.renewalMonth ?? existing.renewalMonth,
            notes: data.notes || existing.notes,
          },
        })
        result.updated++
      } else {
        await createContact(data, userId)
        result.created++
      }
    } catch (error) {
      result.errors.push({
        row: rowNum,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      result.skipped++
    }
  }

  // Audit log for the import
  await prisma.auditLog.create({
    data: {
      userId,
      action: AUDIT_ACTIONS.CONTACT_IMPORTED,
      entityType: 'contact',
      details: {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errorCount: result.errors.length,
      } as Prisma.InputJsonObject,
    },
  })

  return result
}

export async function exportContactsCsv(filters?: ContactFilters): Promise<string> {
  const where: Prisma.ContactWhereInput = {}

  if (filters?.status?.length) where.status = { in: filters.status }
  if (filters?.replyType?.length) where.replyType = { in: filters.replyType }

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { email: 'asc' },
  })

  const rows = contacts.map((c) => ({
    email: c.email,
    first_name: c.firstName ?? '',
    last_name: c.lastName ?? '',
    company: c.company ?? '',
    title: c.title ?? '',
    phone: c.phone ?? '',
    city: c.city ?? '',
    state: c.state ?? '',
    group_size: c.groupSize ?? '',
    renewal_month: c.renewalMonth ?? '',
    status: c.status,
    reply_type: c.replyType,
    priority_score: c.priorityScore,
    last_contacted_at: c.lastContactedAt?.toISOString() ?? '',
    next_contact_at: c.nextContactAt?.toISOString() ?? '',
    total_outreach: c.totalOutreach,
    source: c.source ?? '',
    notes: c.notes ?? '',
  }))

  return Papa.unparse(rows)
}
