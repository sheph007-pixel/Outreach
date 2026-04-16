import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { processAgentChat } from '@/services/agent'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { messages } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }

    const result = await processAgentChat(messages, session.user.id)

    return NextResponse.json({
      success: true,
      data: {
        response: result.response,
        toolCalls: result.toolCalls,
      },
    })
  } catch (error) {
    console.error('Agent chat error:', error)
    return NextResponse.json(
      { error: 'Agent processing failed' },
      { status: 500 }
    )
  }
}
