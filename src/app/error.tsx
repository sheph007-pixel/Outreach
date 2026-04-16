'use client'

import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Something went wrong</h2>
        <p className="mt-2 text-sm text-gray-600">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <Button onClick={reset} className="mt-4">
          Try again
        </Button>
      </div>
    </div>
  )
}
