'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { formatDateTime, formatRelativeTime } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface AuditLogEntry {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  details: Record<string, unknown> | null
  createdAt: string
  user: { name: string | null; email: string } | null
}

const ACTION_LABELS: Record<string, string> = {
  'contact.created': 'Contact Created',
  'contact.updated': 'Contact Updated',
  'contact.deleted': 'Contact Deleted',
  'contact.status_changed': 'Status Changed',
  'contact.imported': 'Contacts Imported',
  'email.sent': 'Email Sent',
  'email.failed': 'Email Failed',
  'reply.received': 'Reply Received',
  'reply.classified': 'Reply Classified',
  'setting.updated': 'Setting Updated',
  'task.created': 'Task Created',
  'task.completed': 'Task Completed',
  'task.failed': 'Task Failed',
  'agent.action': 'Agent Action',
  'memory.created': 'Memory Saved',
  'memory.deleted': 'Memory Deleted',
  'system.enabled': 'System Enabled',
  'system.disabled': 'System Disabled',
}

const ACTION_COLORS: Record<string, string> = {
  'contact.created': 'bg-green-100 text-green-800',
  'email.sent': 'bg-blue-100 text-blue-800',
  'reply.classified': 'bg-purple-100 text-purple-800',
  'contact.status_changed': 'bg-yellow-100 text-yellow-800',
  'contact.deleted': 'bg-red-100 text-red-800',
  'email.failed': 'bg-red-100 text-red-800',
  'task.failed': 'bg-red-100 text-red-800',
}

export function ActivityLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')
  const pageSize = 25

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true)
      try {
        const qs = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        })
        if (actionFilter) qs.set('action', actionFilter)

        const res = await fetch(`/api/audit-logs?${qs.toString()}`)
        if (!res.ok) throw new Error()
        const json = await res.json()
        setLogs(json.data)
        setTotal(json.total)
      } catch {
        // Error handled silently
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [page, actionFilter])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value)
            setPage(1)
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Actions</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{total} entries</span>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-8">
            <Spinner />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No activity logged yet.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-4 px-6 py-3">
                <span className="w-32 shrink-0 text-xs text-gray-400 pt-0.5">
                  <span title={formatDateTime(log.createdAt)}>
                    {formatRelativeTime(log.createdAt)}
                  </span>
                </span>
                <Badge variant={ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700'}>
                  {ACTION_LABELS[log.action] ?? log.action}
                </Badge>
                <div className="flex-1 min-w-0">
                  {log.entityType && (
                    <span className="text-xs text-gray-400">
                      {log.entityType}
                      {log.entityId ? ` #${log.entityId.slice(0, 8)}` : ''}
                    </span>
                  )}
                  {log.details && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {JSON.stringify(log.details).slice(0, 120)}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {log.user ? log.user.name ?? log.user.email : 'system'}
                </span>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
