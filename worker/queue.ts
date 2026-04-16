import { prisma } from '../src/lib/db'
import { isWithinSendWindow, canSendMore, isSystemEnabled } from './rules'
import { claimTask, failTask } from './utils/task-helpers'
import { handleInitialOutreach } from './jobs/initial-outreach'
import { handleFollowUp } from './jobs/follow-up'
import { handleReEngage } from './jobs/re-engage'

const BATCH_SIZE = 10

/**
 * Process the task queue. Called on each poll interval.
 */
export async function processTaskQueue(userId: string): Promise<void> {
  // 1. Check if system is enabled
  if (!(await isSystemEnabled())) {
    console.log('[queue] System is disabled, skipping')
    return
  }

  // 2. Check send window
  if (!(await isWithinSendWindow())) {
    console.log('[queue] Outside send window, skipping')
    return
  }

  // 3. Check daily limit
  const { allowed, sent, limit } = await canSendMore()
  if (!allowed) {
    console.log(`[queue] Daily limit reached (${sent}/${limit})`)
    return
  }

  // 4. Fetch pending tasks that are due
  const tasks = await prisma.followUpTask.findMany({
    where: {
      status: 'pending',
      scheduledAt: { lte: new Date() },
    },
    orderBy: [{ scheduledAt: 'asc' }],
    take: BATCH_SIZE,
    include: { contact: true },
  })

  if (tasks.length === 0) {
    console.log('[queue] No tasks due')
    return
  }

  console.log(`[queue] Processing ${tasks.length} tasks`)

  let processedSends = 0

  for (const task of tasks) {
    // Re-check daily limit within batch
    if (['initial_outreach', 'follow_up', 're_engage'].includes(task.taskType)) {
      if (sent + processedSends >= limit) {
        console.log('[queue] Daily limit reached mid-batch')
        break
      }
    }

    // Claim the task atomically
    const claimed = await claimTask(task.id)
    if (!claimed) {
      console.log(`[queue] Task ${task.id} already claimed, skipping`)
      continue
    }

    try {
      switch (task.taskType) {
        case 'initial_outreach':
          await handleInitialOutreach(task, userId)
          processedSends++
          break

        case 'follow_up':
          await handleFollowUp(task, userId)
          processedSends++
          break

        case 're_engage':
          await handleReEngage(task)
          break

        case 'check_reply':
          // Reply checking is handled separately on its own interval
          // If a check_reply task exists, just complete it
          await prisma.followUpTask.update({
            where: { id: task.id },
            data: { status: 'completed', completedAt: new Date() },
          })
          break

        case 'score_update':
          // Score updates are handled separately on their own interval
          await prisma.followUpTask.update({
            where: { id: task.id },
            data: { status: 'completed', completedAt: new Date() },
          })
          break

        default:
          console.warn(`[queue] Unknown task type: ${task.taskType}`)
          await prisma.followUpTask.update({
            where: { id: task.id },
            data: { status: 'failed', lastError: `Unknown task type: ${task.taskType}` },
          })
      }
    } catch (error) {
      console.error(`[queue] Task ${task.id} failed:`, error)
      await failTask(task.id, error)
    }
  }

  console.log(`[queue] Batch complete. ${processedSends} emails sent.`)
}
