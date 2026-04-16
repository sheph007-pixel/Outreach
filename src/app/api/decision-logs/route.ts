import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '25')
  const contactId = searchParams.get('contactId')
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  if (contactId) where.contactId = contactId

  const [logs, total] = await Promise.all([
    prisma.decisionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        contact: { select: { email: true, firstName: true, lastName: true } },
      },
    }),
    prisma.decisionLog.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
}
