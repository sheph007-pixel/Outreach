'use client'

import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Mail } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Outreach</h1>
            <p className="mt-2 text-sm text-gray-600">
              AI-driven group health outreach system
            </p>
          </div>
          <Button
            onClick={() => signIn('microsoft-entra-id', { callbackUrl: '/dashboard' })}
            className="w-full"
            size="lg"
          >
            <Mail className="mr-2 h-5 w-5" />
            Sign in with Microsoft
          </Button>
          <p className="mt-4 text-center text-xs text-gray-500">
            Sign in with your Microsoft account to get started.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
