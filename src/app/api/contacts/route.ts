import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listContacts, createContact } from '@/services/contacts'
import { contactCreateSchema } from '@/types/contacts'
import { ContactStatus, ReplyType } from '@prisma/client'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '25')
  const sort = searchParams.get('sort') ?? undefined
  const direction = (searchParams.get('direction') ?? 'desc') as 'asc' | 'desc'
  const search = searchParams.get('search') ?? undefined
  const status = searchParams.getAll('status') as ContactStatus[]
  const replyType = searchParams.getAll('replyType') as ReplyType[]

  const result = await listContacts({
    page,
    pageSize,
    sort,
    direction,
    search,
    status: status.length ? status : undefined,
    replyType: replyType.length ? replyType : undefined,
  })

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const data = contactCreateSchema.parse(body)
    const contact = await createContact(data, session.user.id)

    return NextResponse.json({ success: true, data: contact }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    const message = error instanceof Error ? error.message : 'Failed to create contact'
    const status = message.includes('Unique constraint') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
