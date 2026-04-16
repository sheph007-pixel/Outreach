'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import type { CsvImportResult } from '@/types/contacts'

interface CsvImportDialogProps {
  open: boolean
  onClose: () => void
  onComplete: () => void
}

export function CsvImportDialog({ open, onClose, onComplete }: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<CsvImportResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleImport() {
    if (!file) return
    setImporting(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Import failed')
      }

      const json = await res.json()
      setResult(json.data)
      toast.success(`Import complete: ${json.data.created} created, ${json.data.updated} updated`)
      onComplete()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  function handleClose() {
    setFile(null)
    setResult(null)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Import Contacts from CSV">
      {!result ? (
        <div className="space-y-4">
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-300 p-8 hover:border-gray-400 cursor-pointer"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-gray-400" />
            <p className="text-sm text-gray-600">
              {file ? file.name : 'Click to select a CSV file'}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <p className="text-xs text-gray-500">
            CSV should have headers: email (required), first_name, last_name, company, title,
            phone, city, state, group_size, renewal_month, notes
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!file} loading={importing}>
              Import
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg bg-green-50 p-3">
              <p className="text-2xl font-bold text-green-700">{result.created}</p>
              <p className="text-sm text-green-600">Created</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
              <p className="text-sm text-blue-600">Updated</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-2xl font-bold text-gray-700">{result.skipped}</p>
              <p className="text-sm text-gray-600">Skipped</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="max-h-40 overflow-auto rounded border border-red-200 bg-red-50 p-3">
              <p className="mb-1 text-sm font-medium text-red-700">Errors:</p>
              {result.errors.slice(0, 10).map((err, i) => (
                <p key={i} className="text-xs text-red-600">
                  Row {err.row}: {err.error}
                </p>
              ))}
              {result.errors.length > 10 && (
                <p className="text-xs text-red-500 mt-1">
                  ...and {result.errors.length - 10} more
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={handleClose}>Done</Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
