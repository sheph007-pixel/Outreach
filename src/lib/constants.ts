import type { ContactStatus, ReplyType } from '@prisma/client'

export const CONTACT_STATUSES: { value: ContactStatus; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'paused', label: 'Paused', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'blocked', label: 'Blocked', color: 'bg-red-100 text-red-800' },
  { value: 'replied', label: 'Replied', color: 'bg-blue-100 text-blue-800' },
  { value: 'finished', label: 'Finished', color: 'bg-gray-100 text-gray-800' },
]

export const REPLY_TYPES: { value: ReplyType; label: string; color: string }[] = [
  { value: 'yes', label: 'Yes', color: 'bg-green-100 text-green-800' },
  { value: 'interested', label: 'Interested', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'later', label: 'Later', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'next_year', label: 'Next Year', color: 'bg-orange-100 text-orange-800' },
  { value: 'no', label: 'No', color: 'bg-red-100 text-red-800' },
  { value: 'unsubscribe', label: 'Unsubscribe', color: 'bg-red-200 text-red-900' },
  { value: 'none', label: 'None', color: 'bg-gray-100 text-gray-600' },
]

export const DEFAULT_PAGE_SIZE = 25
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export const AUDIT_ACTIONS = {
  CONTACT_CREATED: 'contact.created',
  CONTACT_UPDATED: 'contact.updated',
  CONTACT_DELETED: 'contact.deleted',
  CONTACT_STATUS_CHANGED: 'contact.status_changed',
  CONTACT_IMPORTED: 'contact.imported',
  EMAIL_SENT: 'email.sent',
  EMAIL_FAILED: 'email.failed',
  REPLY_RECEIVED: 'reply.received',
  REPLY_CLASSIFIED: 'reply.classified',
  SETTING_UPDATED: 'setting.updated',
  TASK_CREATED: 'task.created',
  TASK_COMPLETED: 'task.completed',
  TASK_FAILED: 'task.failed',
  AGENT_ACTION: 'agent.action',
  MEMORY_CREATED: 'memory.created',
  MEMORY_DELETED: 'memory.deleted',
  SYSTEM_ENABLED: 'system.enabled',
  SYSTEM_DISABLED: 'system.disabled',
} as const
