import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Page not found</h2>
        <p className="mt-2 text-sm text-gray-600">
          The page you are looking for does not exist.
        </p>
        <Link href="/dashboard">
          <Button className="mt-4">Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
