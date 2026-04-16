'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface ContactFormProps {
  initialData?: Record<string, unknown>
  onSave: (data: Record<string, unknown>) => Promise<void>
  onCancel: () => void
  mode: 'create' | 'edit'
}

const monthOptions = [
  { value: '', label: 'No renewal month' },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i).toLocaleString('en-US', { month: 'long' }),
  })),
]

export function ContactForm({ initialData, onSave, onCancel, mode }: ContactFormProps) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    email: String(initialData?.email ?? ''),
    firstName: String(initialData?.firstName ?? ''),
    lastName: String(initialData?.lastName ?? ''),
    company: String(initialData?.company ?? ''),
    title: String(initialData?.title ?? ''),
    phone: String(initialData?.phone ?? ''),
    city: String(initialData?.city ?? ''),
    state: String(initialData?.state ?? ''),
    groupSize: String(initialData?.groupSize ?? ''),
    renewalMonth: String(initialData?.renewalMonth ?? ''),
    notes: String(initialData?.notes ?? ''),
  })

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const data: Record<string, unknown> = {
        email: form.email,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        company: form.company || undefined,
        title: form.title || undefined,
        phone: form.phone || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        groupSize: form.groupSize ? parseInt(form.groupSize) : undefined,
        renewalMonth: form.renewalMonth ? parseInt(form.renewalMonth) : undefined,
        notes: form.notes || undefined,
      }

      await onSave(data)
      toast.success(mode === 'create' ? 'Contact created' : 'Contact updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Email"
        type="email"
        required
        value={form.email}
        onChange={(e) => updateField('email', e.target.value)}
        disabled={mode === 'edit'}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="First Name"
          value={form.firstName}
          onChange={(e) => updateField('firstName', e.target.value)}
        />
        <Input
          label="Last Name"
          value={form.lastName}
          onChange={(e) => updateField('lastName', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Company"
          value={form.company}
          onChange={(e) => updateField('company', e.target.value)}
        />
        <Input
          label="Title"
          value={form.title}
          onChange={(e) => updateField('title', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Input
          label="Phone"
          value={form.phone}
          onChange={(e) => updateField('phone', e.target.value)}
        />
        <Input
          label="City"
          value={form.city}
          onChange={(e) => updateField('city', e.target.value)}
        />
        <Input
          label="State"
          value={form.state}
          onChange={(e) => updateField('state', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Group Size"
          type="number"
          value={form.groupSize}
          onChange={(e) => updateField('groupSize', e.target.value)}
        />
        <Select
          label="Renewal Month"
          value={form.renewalMonth}
          onChange={(e) => updateField('renewalMonth', e.target.value)}
          options={monthOptions}
        />
      </div>
      <Textarea
        label="Notes"
        value={form.notes}
        onChange={(e) => updateField('notes', e.target.value)}
        rows={3}
      />
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {mode === 'create' ? 'Add Contact' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
