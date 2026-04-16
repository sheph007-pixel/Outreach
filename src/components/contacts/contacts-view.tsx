'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useContacts } from '@/lib/hooks/use-contacts'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { ContactForm } from './contact-form'
import { CsvImportDialog } from './csv-import-dialog'
import { ContactStatusBadge, ReplyTypeBadge } from './contact-status-badge'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import {
  Plus,
  Upload,
  Download,
  ChevronUp,
  ChevronDown,
  Pause,
  Play,
  Ban,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { ContactListItem } from '@/types/contacts'
import type { SortDirection } from '@/types/api'

export function ContactsView() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sort, setSort] = useState('updatedAt')
  const [direction, setDirection] = useState<SortDirection>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string[]>([])

  const debouncedSearch = useDebounce(search, 300)

  const { data, total, totalPages, loading, refetch } = useContacts({
    page,
    pageSize,
    sort,
    direction,
    search: debouncedSearch || undefined,
    status: statusFilter.length ? statusFilter : undefined,
  })

  function handleSort(field: string) {
    if (sort === field) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(field)
      setDirection('asc')
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data.map((c) => c.id)))
    }
  }

  async function handleBulkAction(action: string) {
    if (selectedIds.size === 0) return

    try {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: Array.from(selectedIds) }),
      })

      if (!res.ok) throw new Error('Bulk action failed')

      const json = await res.json()
      toast.success(`${json.data.count} contacts updated`)
      setSelectedIds(new Set())
      refetch()
    } catch {
      toast.error('Bulk action failed')
    }
  }

  async function handleAddContact(data: Record<string, unknown>) {
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Failed to create contact')
    }
    setShowAddDialog(false)
    refetch()
  }

  async function handleExport() {
    const qs = new URLSearchParams()
    statusFilter.forEach((s) => qs.append('status', s))

    const res = await fetch(`/api/contacts/export?${qs.toString()}`)
    if (!res.ok) {
      toast.error('Export failed')
      return
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sort !== field) return null
    return direction === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    )
  }

  const columns: Array<{
    key: string
    label: string
    sortable?: boolean
    render: (c: ContactListItem) => React.ReactNode
  }> = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (c) => (
        <a href={`/contacts/${c.id}`} className="font-medium text-gray-900 hover:underline">
          {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email}
        </a>
      ),
    },
    { key: 'email', label: 'Email', sortable: true, render: (c) => c.email },
    { key: 'company', label: 'Company', sortable: true, render: (c) => c.company ?? '-' },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (c) => <ContactStatusBadge status={c.status} />,
    },
    {
      key: 'replyType',
      label: 'Reply',
      sortable: true,
      render: (c) => <ReplyTypeBadge replyType={c.replyType} />,
    },
    {
      key: 'priorityScore',
      label: 'Priority',
      sortable: true,
      render: (c) => <span className="tabular-nums">{c.priorityScore.toFixed(1)}</span>,
    },
    {
      key: 'lastContactedAt',
      label: 'Last Contacted',
      sortable: true,
      render: (c) =>
        c.lastContactedAt ? (
          <span title={formatDate(c.lastContactedAt)}>{formatRelativeTime(c.lastContactedAt)}</span>
        ) : (
          <span className="text-gray-400">Never</span>
        ),
    },
    {
      key: 'nextContactAt',
      label: 'Next Contact',
      sortable: true,
      render: (c) => (c.nextContactAt ? formatDate(c.nextContactAt) : '-'),
    },
  ]

  const statusOptions = ['active', 'paused', 'blocked', 'replied', 'finished']

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search name, email, company..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="w-72"
        />
        <select
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={statusFilter[0] ?? ''}
          onChange={(e) => {
            setStatusFilter(e.target.value ? [e.target.value] : [])
            setPage(1)
          }}
        >
          <option value="">All Statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
          <Upload className="mr-1.5 h-4 w-4" /> Import
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1.5 h-4 w-4" /> Export
        </Button>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Contact
        </Button>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-md bg-gray-100 px-4 py-2">
          <span className="text-sm font-medium text-gray-700">
            {selectedIds.size} selected
          </span>
          <Button variant="ghost" size="sm" onClick={() => handleBulkAction('pause')}>
            <Pause className="mr-1 h-3.5 w-3.5" /> Pause
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleBulkAction('resume')}>
            <Play className="mr-1 h-3.5 w-3.5" /> Resume
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleBulkAction('block')}>
            <Ban className="mr-1 h-3.5 w-3.5" /> Block
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => {
              if (confirm(`Delete ${selectedIds.size} contacts?`)) {
                handleBulkAction('delete')
              }
            }}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={data.length > 0 && selectedIds.size === data.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 ${
                      col.sortable ? 'cursor-pointer hover:text-gray-700' : ''
                    }`}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && <SortIcon field={col.key} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={columns.length + 1} className="px-4 py-3">
                      <div className="h-5 animate-pulse rounded bg-gray-200" />
                    </td>
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No contacts found.{' '}
                    {!search && !statusFilter.length && (
                      <button
                        className="text-gray-900 underline"
                        onClick={() => setShowImportDialog(true)}
                      >
                        Import a CSV
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                data.map((contact) => (
                  <tr
                    key={contact.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(contact.id)}
                        onChange={() => toggleSelect(contact.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                        {col.render(contact)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>
              {total > 0
                ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}`
                : '0 contacts'}
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value))
                setPage(1)
              }}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages || 1}
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
        </div>
      </Card>

      {/* Add Contact Dialog */}
      <Dialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        title="Add Contact"
      >
        <ContactForm
          mode="create"
          onSave={handleAddContact}
          onCancel={() => setShowAddDialog(false)}
        />
      </Dialog>

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onComplete={refetch}
      />
    </div>
  )
}
