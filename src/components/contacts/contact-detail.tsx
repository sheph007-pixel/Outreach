'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ContactForm } from './contact-form'
import { ContactStatusBadge, ReplyTypeBadge } from './contact-status-badge'
import { formatDate, formatDateTime, formatRelativeTime } from '@/lib/utils'
import { CONTACT_STATUSES } from '@/lib/constants'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import type { ContactWithRelations } from '@/types/contacts'

export function ContactDetail({ contact: initial }: { contact: ContactWithRelations }) {
  const router = useRouter()
  const [contact, setContact] = useState(initial)
  const [editing, setEditing] = useState(false)

  async function handleSave(data: Record<string, unknown>) {
    const res = await fetch(`/api/contacts/${contact.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Failed to update')
    }
    const json = await res.json()
    setContact((prev) => ({ ...prev, ...json.data }))
    setEditing(false)
  }

  async function handleStatusChange(newStatus: string) {
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      const json = await res.json()
      setContact((prev) => ({ ...prev, ...json.data }))
      toast.success(`Status changed to ${newStatus}`)
    } catch {
      toast.error('Failed to change status')
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this contact? This cannot be undone.')) return
    try {
      await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' })
      toast.success('Contact deleted')
      router.push('/contacts')
    } catch {
      toast.error('Failed to delete contact')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/contacts')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email}
        </h1>
        <ContactStatusBadge status={contact.status} />
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
          <Pencil className="mr-1 h-4 w-4" /> Edit
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="mr-1 h-4 w-4" /> Delete
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">Contact Information</h2>
            </CardHeader>
            <CardContent>
              {editing ? (
                <ContactForm
                  mode="edit"
                  initialData={contact as unknown as Record<string, unknown>}
                  onSave={handleSave}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <dt className="text-gray-500">Email</dt>
                    <dd className="font-medium">{contact.email}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Company</dt>
                    <dd className="font-medium">{contact.company ?? '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Title</dt>
                    <dd>{contact.title ?? '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Phone</dt>
                    <dd>{contact.phone ?? '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Location</dt>
                    <dd>
                      {[contact.city, contact.state].filter(Boolean).join(', ') || '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Group Size</dt>
                    <dd>{contact.groupSize ?? '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Renewal Month</dt>
                    <dd>
                      {contact.renewalMonth
                        ? new Date(2000, contact.renewalMonth - 1).toLocaleString('en-US', {
                            month: 'long',
                          })
                        : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Source</dt>
                    <dd>{contact.source ?? '-'}</dd>
                  </div>
                  {contact.notes && (
                    <div className="col-span-2">
                      <dt className="text-gray-500">Notes</dt>
                      <dd className="whitespace-pre-wrap">{contact.notes}</dd>
                    </div>
                  )}
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Status History */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">Status History</h2>
            </CardHeader>
            <CardContent>
              {contact.statusHistory.length === 0 ? (
                <p className="text-sm text-gray-500">No status changes recorded.</p>
              ) : (
                <div className="space-y-3">
                  {contact.statusHistory.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="text-gray-400 w-32 shrink-0 text-xs">
                        {formatDateTime(h.createdAt)}
                      </span>
                      {h.fromStatus && (
                        <>
                          <ContactStatusBadge status={h.fromStatus} />
                          <span className="text-gray-400">&rarr;</span>
                        </>
                      )}
                      <ContactStatusBadge status={h.toStatus} />
                      {h.reason && (
                        <span className="text-gray-500">- {h.reason}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Outreach Threads */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">Outreach Threads</h2>
            </CardHeader>
            <CardContent>
              {contact.threads.length === 0 ? (
                <p className="text-sm text-gray-500">No outreach threads yet.</p>
              ) : (
                <div className="space-y-4">
                  {contact.threads.map((thread) => (
                    <div key={thread.id} className="rounded-md border border-gray-200 p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{thread.subject}</p>
                        <Badge variant={
                          thread.status === 'replied' ? 'bg-blue-100 text-blue-800' :
                          thread.status === 'closed' ? 'bg-gray-100 text-gray-600' :
                          'bg-green-100 text-green-800'
                        }>
                          {thread.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDateTime(thread.createdAt)} &middot;{' '}
                        {thread.messages?.length ?? 0} messages
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">Status & Scores</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-gray-500">Status</label>
                <div className="mt-1">
                  <select
                    value={contact.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-full"
                  >
                    {CONTACT_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Reply Type</label>
                <div className="mt-1">
                  <ReplyTypeBadge replyType={contact.replyType} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold">{contact.priorityScore.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">Priority</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{contact.engagementScore.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">Engagement</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{contact.responseScore.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">Response</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">Activity</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Outreach</span>
                <span className="font-medium">{contact.totalOutreach}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last Contacted</span>
                <span>{contact.lastContactedAt ? formatRelativeTime(contact.lastContactedAt) : 'Never'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last Replied</span>
                <span>{contact.lastRepliedAt ? formatRelativeTime(contact.lastRepliedAt) : 'Never'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Next Contact</span>
                <span>{contact.nextContactAt ? formatDate(contact.nextContactAt) : 'Not scheduled'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span>{formatDate(contact.createdAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
