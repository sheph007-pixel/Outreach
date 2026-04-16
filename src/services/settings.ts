import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { AUDIT_ACTIONS } from '@/lib/constants'

type JsonValue = Prisma.InputJsonValue

/**
 * Get a single setting by key. Returns the parsed value.
 */
export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const setting = await prisma.agentSetting.findUnique({ where: { key } })
  if (!setting) return null
  return setting.value as T
}

/**
 * Get all settings, optionally filtered by category.
 */
export async function getSettings(category?: string) {
  const where = category ? { category } : {}
  return prisma.agentSetting.findMany({
    where,
    orderBy: { key: 'asc' },
  })
}

/**
 * Get all settings grouped by category.
 */
export async function getSettingsGrouped(): Promise<
  Record<string, Array<{ id: string; key: string; value: unknown; label: string | null }>>
> {
  const settings = await prisma.agentSetting.findMany({
    orderBy: { key: 'asc' },
  })

  const grouped: Record<string, typeof settings> = {}
  for (const s of settings) {
    const cat = s.category ?? 'general'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(s)
  }
  return grouped
}

/**
 * Update a setting by key. Creates an audit log entry.
 */
export async function updateSetting(
  key: string,
  value: JsonValue,
  userId?: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.agentSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })

    await tx.auditLog.create({
      data: {
        userId,
        action: AUDIT_ACTIONS.SETTING_UPDATED,
        entityType: 'setting',
        entityId: key,
        details: { key, value } as Prisma.InputJsonObject,
      },
    })
  })
}

/**
 * Bulk update settings.
 */
export async function updateSettings(
  updates: Array<{ key: string; value: JsonValue }>,
  userId?: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const { key, value } of updates) {
      await tx.agentSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: AUDIT_ACTIONS.SETTING_UPDATED,
        entityType: 'setting',
        details: { updates: updates.map((u) => u.key) },
      },
    })
  })
}
