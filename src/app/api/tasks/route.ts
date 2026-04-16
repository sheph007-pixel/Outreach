import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { TaskType, TaskStatus } from '@prisma/client'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') as TaskStatus | null
  const contactId = searchParams.get('contactId')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (contactId) where.contactId = contactId

  const tasks = await prisma.followUpTask.findMany({
    where,
    orderBy: { scheduledAt: 'asc' },
    take: limit,
    include: {
      contact: { select: { email: true, firstName: true, lastName: true } },
    },
  })

  return NextResponse.json({ success: true, data: tasks })
}

const createTaskSchema = z.object({
  contactId: z.string().min(1),
  taskType: z.enum(['initial_outreach', 'follow_up', 'check_reply', 're_engage', 'score_update']),
  scheduledAt: z.string().datetime().optional(),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const data = createTaskSchema.parse(body)

    const task = await prisma.followUpTask.create({
      data: {
        contactId: data.contactId,
        taskType: data.taskType as TaskType,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : new Date(),
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'task.created',
        entityType: 'task',
        entityId: task.id,
        details: {
          contactId: data.contactId,
          taskType: data.taskType,
        },
      },
    })

    return NextResponse.json({ success: true, data: task }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
