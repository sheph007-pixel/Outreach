import { z } from 'zod'
import type { Contact, ContactStatus, ReplyType, ContactStatusHistory, OutreachThread } from '@prisma/client'

export type ContactWithRelations = Contact & {
  statusHistory: ContactStatusHistory[]
  threads: OutreachThread[]
}

export type ContactListItem = Pick<
  Contact,
  | 'id'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'company'
  | 'status'
  | 'replyType'
  | 'priorityScore'
  | 'lastContactedAt'
  | 'nextContactAt'
  | 'updatedAt'
  | 'renewalMonth'
  | 'totalOutreach'
>

export const contactCreateSchema = z.object({
  email: z.string().email('Invalid email'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  groupSize: z.coerce.number().int().positive().optional().nullable(),
  renewalMonth: z.coerce.number().int().min(1).max(12).optional().nullable(),
  source: z.string().optional(),
  notes: z.string().optional(),
})

export type ContactCreateInput = z.infer<typeof contactCreateSchema>

export const contactUpdateSchema = contactCreateSchema.partial().extend({
  status: z.enum(['active', 'paused', 'blocked', 'replied', 'finished']).optional(),
  replyType: z.enum(['yes', 'no', 'later', 'next_year', 'interested', 'unsubscribe', 'none']).optional(),
  nextContactAt: z.string().datetime().optional().nullable(),
  blockedReason: z.string().optional().nullable(),
})

export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>

export interface ContactFilters {
  search?: string
  status?: ContactStatus[]
  replyType?: ReplyType[]
  renewalMonth?: number[]
  source?: string[]
  minPriorityScore?: number
}

export interface CsvImportResult {
  created: number
  updated: number
  skipped: number
  errors: Array<{ row: number; error: string }>
}

export type BulkAction = 'pause' | 'resume' | 'block' | 'delete' | 'set_next_contact'
