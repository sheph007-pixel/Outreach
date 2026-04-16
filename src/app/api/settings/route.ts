import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { getSettingsGrouped, updateSetting } from '@/services/settings'
import { z } from 'zod'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await getSettingsGrouped()
  return NextResponse.json({ success: true, data: settings })
}

const updateSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
})

export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = updateSchema.parse(body)

    await updateSetting(parsed.key, parsed.value as Prisma.InputJsonValue, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
  }
}
