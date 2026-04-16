'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ContactListItem, ContactFilters } from '@/types/contacts'
import type { PaginatedResponse, SortDirection } from '@/types/api'

interface UseContactsParams {
  page?: number
  pageSize?: number
  sort?: string
  direction?: SortDirection
  search?: string
  status?: string[]
  replyType?: string[]
}

interface UseContactsReturn {
  data: ContactListItem[]
  total: number
  totalPages: number
  page: number
  pageSize: number
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useContacts(params: UseContactsParams): UseContactsReturn {
  const [data, setData] = useState<ContactListItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchKey, setFetchKey] = useState(0)

  const refetch = useCallback(() => setFetchKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false

    async function fetchContacts() {
      setLoading(true)
      setError(null)

      try {
        const qs = new URLSearchParams()
        if (params.page) qs.set('page', String(params.page))
        if (params.pageSize) qs.set('pageSize', String(params.pageSize))
        if (params.sort) qs.set('sort', params.sort)
        if (params.direction) qs.set('direction', params.direction)
        if (params.search) qs.set('search', params.search)
        params.status?.forEach((s) => qs.append('status', s))
        params.replyType?.forEach((r) => qs.append('replyType', r))

        const res = await fetch(`/api/contacts?${qs.toString()}`)
        if (!res.ok) throw new Error('Failed to fetch contacts')

        const json: PaginatedResponse<ContactListItem> = await res.json()

        if (!cancelled) {
          setData(json.data)
          setTotal(json.total)
          setTotalPages(json.totalPages)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchContacts()

    return () => {
      cancelled = true
    }
  }, [
    params.page,
    params.pageSize,
    params.sort,
    params.direction,
    params.search,
    params.status?.join(','),
    params.replyType?.join(','),
    fetchKey,
  ])

  return {
    data,
    total,
    totalPages,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 25,
    loading,
    error,
    refetch,
  }
}
