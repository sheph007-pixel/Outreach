import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { AUDIT_ACTIONS } from '@/lib/constants'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const memories = await prisma.agentMemory.findMany({
    where: { userId: session.user.id, active: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: memories })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { content, category } = body as { content: string; category?: string }

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 })
  }

  const memory = await prisma.agentMemory.create({
    data: {
      userId: session.user.id,
      content: content.trim(),
      category: category ?? 'instruction',
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: AUDIT_ACTIONS.MEMORY_CREATED,
      entityType: 'memory',
      entityId: memory.id,
    },
  })

  return NextResponse.json({ success: true, data: memory }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Memory ID is required' }, { status: 400 })
  }

  await prisma.agentMemory.update({
    where: { id },
    data: { active: false },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: AUDIT_ACTIONS.MEMORY_DELETED,
      entityType: 'memory',
      entityId: id,
    },
  })

  return NextResponse.json({ success: true })
}
