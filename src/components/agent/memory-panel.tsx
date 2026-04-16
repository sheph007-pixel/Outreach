'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Trash2, Plus, Brain } from 'lucide-react'

interface Memory {
  id: string
  content: string
  category: string | null
  createdAt: string
}

export function MemoryPanel() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState('instruction')
  const [loading, setLoading] = useState(true)

  async function fetchMemories() {
    try {
      const res = await fetch('/api/agent/memories')
      if (!res.ok) throw new Error()
      const json = await res.json()
      setMemories(json.data)
    } catch {
      toast.error('Failed to load memories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMemories()
  }, [])

  async function handleAdd() {
    if (!newContent.trim()) return

    try {
      const res = await fetch('/api/agent/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent.trim(), category: newCategory }),
      })
      if (!res.ok) throw new Error()
      toast.success('Memory saved')
      setNewContent('')
      fetchMemories()
    } catch {
      toast.error('Failed to save memory')
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/agent/memories?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Memory removed')
      setMemories((prev) => prev.filter((m) => m.id !== id))
    } catch {
      toast.error('Failed to delete memory')
    }
  }

  const categoryOptions = [
    { value: 'instruction', label: 'Instruction' },
    { value: 'preference', label: 'Preference' },
    { value: 'context', label: 'Context' },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-gray-600" />
          <h2 className="font-semibold text-gray-900">Agent Memory</h2>
        </div>
        <p className="text-sm text-gray-500">
          Instructions and preferences the agent will remember.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new memory */}
        <div className="flex gap-2">
          <Input
            placeholder="Add an instruction or preference..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="flex-1"
          />
          <Select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            options={categoryOptions}
            className="w-32"
          />
          <Button size="sm" onClick={handleAdd} disabled={!newContent.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Memory list */}
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : memories.length === 0 ? (
          <p className="text-sm text-gray-500">
            No memories yet. Add instructions the agent should follow.
          </p>
        ) : (
          <div className="space-y-2">
            {memories.map((memory) => (
              <div
                key={memory.id}
                className="flex items-start justify-between gap-3 rounded border border-gray-200 px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{memory.content}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {memory.category} &middot;{' '}
                    {new Date(memory.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(memory.id)}
                  className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
