import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getContact, updateContact, deleteContact } from '@/services/contacts'
import { contactUpdateSchema } from '@/types/contacts'
import { z } from 'zod'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const contact = await getContact(params.id)
  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: contact })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const data = contactUpdateSchema.parse(body)
    const contact = await updateContact(params.id, data, session.user.id)

    return NextResponse.json({ success: true, data: contact })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    const message = error instanceof Error ? error.message : 'Failed to update contact'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await deleteContact(params.id, session.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete contact'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
