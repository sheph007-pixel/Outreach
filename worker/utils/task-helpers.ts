import { TaskType, TaskStatus } from '@prisma/client'
import { prisma } from '../../src/lib/db'

/**
 * Atomically claim a task. Returns true if this worker claimed it.
 * Uses updateMany with a status filter to prevent double-processing.
 */
export async function claimTask(taskId: string): Promise<boolean> {
  const result = await prisma.followUpTask.updateMany({
    where: { id: taskId, status: 'pending' },
    data: {
      status: 'processing',
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  })
  return result.count > 0
}

/**
 * Mark a task as completed.
 */
export async function completeTask(taskId: string): Promise<void> {
  await prisma.followUpTask.update({
    where: { id: taskId },
    data: {
      status: 'completed',
      completedAt: new Date(),
    },
  })
}

/**
 * Handle task failure with retry logic.
 * If attempts >= maxAttempts, mark as failed permanently.
 * Otherwise, set back to pending with exponential backoff.
 */
export async function failTask(taskId: string, error: unknown): Promise<void> {
  const task = await prisma.followUpTask.findUnique({ where: { id: taskId } })
  if (!task) return

  const errorMessage = error instanceof Error ? error.message : String(error)

  if (task.attempts >= task.maxAttempts) {
    await prisma.followUpTask.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        lastError: errorMessage,
        completedAt: new Date(),
      },
    })
  } else {
    // Exponential backoff: 2^attempts minutes
    const backoffMs = Math.pow(2, task.attempts) * 60 * 1000
    const nextAttempt = new Date(Date.now() + backoffMs)

    await prisma.followUpTask.update({
      where: { id: taskId },
      data: {
        status: 'pending',
        scheduledAt: nextAttempt,
        lastError: errorMessage,
      },
    })
  }
}

/**
 * Cancel a task.
 */
export async function cancelTask(taskId: string, reason: string): Promise<void> {
  await prisma.followUpTask.update({
    where: { id: taskId },
    data: {
      status: 'cancelled',
      lastError: reason,
      completedAt: new Date(),
    },
  })
}

/**
 * Schedule a new task for a contact.
 */
export async function scheduleTask(
  contactId: string,
  taskType: TaskType,
  scheduledAt: Date,
  metadata?: Record<string, unknown>
): Promise<string> {
  const task = await prisma.followUpTask.create({
    data: {
      contactId,
      taskType,
      scheduledAt,
      metadata: metadata ?? undefined,
    },
  })
  return task.id
}

/**
 * Cancel all pending tasks for a contact.
 */
export async function cancelContactTasks(contactId: string, reason: string): Promise<number> {
  const result = await prisma.followUpTask.updateMany({
    where: { contactId, status: 'pending' },
    data: {
      status: 'cancelled',
      lastError: reason,
      completedAt: new Date(),
    },
  })
  return result.count
}
