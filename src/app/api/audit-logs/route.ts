import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listAuditLogs } from '@/services/audit'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '25')
  const action = searchParams.get('action') ?? undefined
  const entityType = searchParams.get('entityType') ?? undefined

  const result = await listAuditLogs({ page, pageSize, action, entityType })
  return NextResponse.json(result)
}
