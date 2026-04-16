import { prisma } from '../src/lib/db'
import { processTaskQueue } from './queue'
import { runReplyChecker } from './jobs/check-replies'
import { runScoreUpdater } from './jobs/update-scores'

const POLL_INTERVAL = parseInt(process.env.WORKER_POLL_INTERVAL_MS ?? '30000')
const REPLY_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes
const SCORE_UPDATE_INTERVAL = 60 * 60 * 1000 // 1 hour

let running = true

async function getWorkerUserId(): Promise<string> {
  // Get the first user with a Microsoft connection as the sending identity
  const oauth = await prisma.oAuthAccount.findFirst({
    where: { provider: 'microsoft' },
    select: { userId: true },
  })

  if (!oauth) {
    throw new Error(
      'No Microsoft account connected. Sign in to the web app first to connect your Microsoft account.'
    )
  }

  return oauth.userId
}

async function main() {
  console.log('===========================================')
  console.log('  Outreach Worker Starting')
  console.log(`  Poll interval: ${POLL_INTERVAL}ms`)
  console.log(`  Reply check interval: ${REPLY_CHECK_INTERVAL}ms`)
  console.log(`  Score update interval: ${SCORE_UPDATE_INTERVAL}ms`)
  console.log('===========================================')

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[worker] SIGTERM received, shutting down...')
    running = false
  })
  process.on('SIGINT', () => {
    console.log('[worker] SIGINT received, shutting down...')
    running = false
  })

  // Verify we have a connected Microsoft account
  let userId: string
  try {
    userId = await getWorkerUserId()
    console.log(`[worker] Using user ID: ${userId}`)
  } catch (error) {
    console.error('[worker] No Microsoft account connected. Worker cannot send emails.')
    console.error('[worker] Please sign in to the web app first, then restart the worker.')
    // Don't exit — keep checking in case user signs in
    userId = ''
  }

  // Task queue polling loop
  async function pollLoop() {
    while (running) {
      try {
        if (!userId) {
          // Try to find a connected account
          try {
            userId = await getWorkerUserId()
            console.log(`[worker] Microsoft account found: ${userId}`)
          } catch {
            // Still no account, skip this cycle
          }
        }

        if (userId) {
          await processTaskQueue(userId)
        }
      } catch (error) {
        console.error('[worker] Queue processing error:', error)
      }

      await sleep(POLL_INTERVAL)
    }
  }

  // Reply checker interval
  async function replyLoop() {
    while (running) {
      await sleep(REPLY_CHECK_INTERVAL)
      try {
        if (userId) {
          await runReplyChecker(userId)
        }
      } catch (error) {
        console.error('[worker] Reply check error:', error)
      }
    }
  }

  // Score updater interval
  async function scoreLoop() {
    while (running) {
      await sleep(SCORE_UPDATE_INTERVAL)
      try {
        await runScoreUpdater()
      } catch (error) {
        console.error('[worker] Score update error:', error)
      }
    }
  }

  // Run all loops concurrently
  await Promise.all([pollLoop(), replyLoop(), scoreLoop()])

  console.log('[worker] Shutdown complete')
  await prisma.$disconnect()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch((error) => {
  console.error('[worker] Fatal error:', error)
  process.exit(1)
})
