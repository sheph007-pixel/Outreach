import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { bulkUpdateStatus, deleteContacts } from '@/services/contacts'
import { ContactStatus } from '@prisma/client'
import { z } from 'zod'

const bulkSchema = z.object({
  action: z.enum(['pause', 'resume', 'block', 'delete']),
  ids: z.array(z.string()).min(1),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action, ids } = bulkSchema.parse(body)

    let count = 0
    const statusMap: Record<string, ContactStatus> = {
      pause: 'paused',
      resume: 'active',
      block: 'blocked',
    }

    if (action === 'delete') {
      count = await deleteContacts(ids, session.user.id)
    } else {
      const status = statusMap[action]
      count = await bulkUpdateStatus(ids, status, session.user.id)
    }

    return NextResponse.json({ success: true, data: { count } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Bulk action failed' }, { status: 500 })
  }
}
