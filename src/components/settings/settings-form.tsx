'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Toggle } from '@/components/ui/toggle'
import { Button } from '@/components/ui/button'

interface SettingItem {
  id: string
  key: string
  value: unknown
  label: string | null
}

interface SettingsFormProps {
  initialSettings: Record<string, SettingItem[]>
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [saving, setSaving] = useState<string | null>(null)

  function getValue(key: string): unknown {
    for (const group of Object.values(settings)) {
      const setting = group.find((s) => s.key === key)
      if (setting) return setting.value
    }
    return null
  }

  function setValue(key: string, value: unknown) {
    setSettings((prev) => {
      const next = { ...prev }
      for (const cat of Object.keys(next)) {
        next[cat] = next[cat].map((s) =>
          s.key === key ? { ...s, value } : s
        )
      }
      return next
    })
  }

  async function saveSetting(key: string) {
    setSaving(key)
    try {
      const value = getValue(key)
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success('Setting saved')
    } catch {
      toast.error('Failed to save setting')
    } finally {
      setSaving(null)
    }
  }

  const toneOptions = [
    { value: 'professional', label: 'Professional' },
    { value: 'friendly', label: 'Friendly' },
    { value: 'professional-friendly', label: 'Professional & Friendly' },
    { value: 'casual', label: 'Casual' },
  ]

  const timezoneOptions = [
    { value: 'America/New_York', label: 'Eastern' },
    { value: 'America/Chicago', label: 'Central' },
    { value: 'America/Denver', label: 'Mountain' },
    { value: 'America/Los_Angeles', label: 'Pacific' },
  ]

  const hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: String(i),
    label: `${i === 0 ? '12' : i > 12 ? i - 12 : i}:00 ${i < 12 ? 'AM' : 'PM'}`,
  }))

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Sending Settings */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Sending</h2>
          <p className="text-sm text-gray-500">Configure email sending behavior</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Sender Name"
              value={String(getValue('sending.sender_name') ?? '')}
              onChange={(e) => setValue('sending.sender_name', e.target.value)}
              onBlur={() => saveSetting('sending.sender_name')}
            />
            <Input
              label="Sender Email"
              value={String(getValue('sending.sender_email') ?? '')}
              disabled
              helperText="Set via Microsoft account"
            />
          </div>
          <Input
            label="Daily Send Limit"
            type="number"
            value={String(getValue('sending.daily_limit') ?? 50)}
            onChange={(e) => setValue('sending.daily_limit', parseInt(e.target.value) || 0)}
            onBlur={() => saveSetting('sending.daily_limit')}
          />
          <div className="grid grid-cols-3 gap-4">
            <Select
              label="Send Window Start"
              value={String(getValue('sending.window_start') ?? '8')}
              onChange={(e) => {
                setValue('sending.window_start', parseInt(e.target.value))
                saveSetting('sending.window_start')
              }}
              options={hourOptions}
            />
            <Select
              label="Send Window End"
              value={String(getValue('sending.window_end') ?? '17')}
              onChange={(e) => {
                setValue('sending.window_end', parseInt(e.target.value))
                saveSetting('sending.window_end')
              }}
              options={hourOptions}
            />
            <Select
              label="Timezone"
              value={String(getValue('sending.timezone') ?? 'America/Denver')}
              onChange={(e) => {
                setValue('sending.timezone', e.target.value)
                saveSetting('sending.timezone')
              }}
              options={timezoneOptions}
            />
          </div>
          <Textarea
            label="Email Signature"
            value={String(getValue('sending.signature') ?? '')}
            onChange={(e) => setValue('sending.signature', e.target.value)}
            onBlur={() => saveSetting('sending.signature')}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">AI</h2>
          <p className="text-sm text-gray-500">Configure the AI reasoning layer</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="AI Model"
            value={String(getValue('ai.model') ?? 'gpt-4o')}
            onChange={(e) => setValue('ai.model', e.target.value)}
            onBlur={() => saveSetting('ai.model')}
            helperText="e.g. gpt-4o, gpt-4o-mini"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temperature: {String(getValue('ai.temperature') ?? 0.7)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={Number(getValue('ai.temperature') ?? 0.7)}
              onChange={(e) => {
                setValue('ai.temperature', parseFloat(e.target.value))
              }}
              onMouseUp={() => saveSetting('ai.temperature')}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tone Settings */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Tone</h2>
          <p className="text-sm text-gray-500">Control how the system communicates</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            label="Tone Style"
            value={String(getValue('tone.style') ?? 'professional-friendly')}
            onChange={(e) => {
              setValue('tone.style', e.target.value)
              saveSetting('tone.style')
            }}
            options={toneOptions}
          />
          <Textarea
            label="Custom Instructions"
            value={String(getValue('tone.instructions') ?? '')}
            onChange={(e) => setValue('tone.instructions', e.target.value)}
            onBlur={() => saveSetting('tone.instructions')}
            rows={3}
            placeholder="Any special tone or messaging instructions..."
          />
        </CardContent>
      </Card>

      {/* Rules */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Rules</h2>
          <p className="text-sm text-gray-500">Hard rules and system behavior</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">System Enabled</p>
              <p className="text-sm text-gray-500">Turn the outreach system on or off</p>
            </div>
            <Toggle
              checked={Boolean(getValue('rules.system_enabled'))}
              onChange={(val) => {
                setValue('rules.system_enabled', val)
                saveSetting('rules.system_enabled')
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Min Days Between Outreach"
              type="number"
              value={String(getValue('rules.min_days_between_outreach') ?? 7)}
              onChange={(e) =>
                setValue('rules.min_days_between_outreach', parseInt(e.target.value) || 0)
              }
              onBlur={() => saveSetting('rules.min_days_between_outreach')}
            />
            <Input
              label="Max Follow-ups"
              type="number"
              value={String(getValue('rules.max_followups') ?? 4)}
              onChange={(e) =>
                setValue('rules.max_followups', parseInt(e.target.value) || 0)
              }
              onBlur={() => saveSetting('rules.max_followups')}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Auto-block Hard Bounces</p>
              <p className="text-sm text-gray-500">
                Automatically block contacts that hard bounce
              </p>
            </div>
            <Toggle
              checked={Boolean(getValue('rules.auto_block_hard_bounce'))}
              onChange={(val) => {
                setValue('rules.auto_block_hard_bounce', val)
                saveSetting('rules.auto_block_hard_bounce')
              }}
            />
          </div>
          <Textarea
            label="Blocked Domains"
            value={String(getValue('rules.blocked_domains') ?? '')}
            onChange={(e) => setValue('rules.blocked_domains', e.target.value)}
            onBlur={() => saveSetting('rules.blocked_domains')}
            rows={2}
            placeholder="comma-separated domains to never contact"
          />
          <Textarea
            label="Business Notes / AI Context"
            value={String(getValue('rules.business_notes') ?? '')}
            onChange={(e) => setValue('rules.business_notes', e.target.value)}
            onBlur={() => saveSetting('rules.business_notes')}
            rows={4}
            placeholder="Describe your business context for the AI..."
          />
        </CardContent>
      </Card>
    </div>
  )
}
