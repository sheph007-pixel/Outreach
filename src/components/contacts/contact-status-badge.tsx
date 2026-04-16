import { Badge } from '@/components/ui/badge'
import { CONTACT_STATUSES, REPLY_TYPES } from '@/lib/constants'
import type { ContactStatus, ReplyType } from '@prisma/client'

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  const config = CONTACT_STATUSES.find((s) => s.value === status)
  return <Badge variant={config?.color}>{config?.label ?? status}</Badge>
}

export function ReplyTypeBadge({ replyType }: { replyType: ReplyType }) {
  if (replyType === 'none') return <span className="text-sm text-gray-400">-</span>
  const config = REPLY_TYPES.find((r) => r.value === replyType)
  return <Badge variant={config?.color}>{config?.label ?? replyType}</Badge>
}
