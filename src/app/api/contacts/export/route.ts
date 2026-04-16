import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { exportContactsCsv } from '@/services/contacts'
import { ContactStatus, ReplyType } from '@prisma/client'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const status = searchParams.getAll('status') as ContactStatus[]
  const replyType = searchParams.getAll('replyType') as ReplyType[]

  const csv = await exportContactsCsv({
    status: status.length ? status : undefined,
    replyType: replyType.length ? replyType : undefined,
  })

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="contacts-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
