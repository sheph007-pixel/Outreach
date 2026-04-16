'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Send, Bot, User, Wrench } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result: unknown }>
}

export function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!res.ok) throw new Error('Chat request failed')

      const json = await res.json()
      const assistantMessage: Message = {
        role: 'assistant',
        content: json.data.response,
        toolCalls: json.data.toolCalls,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto space-y-4 pb-4"
      >
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Bot className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-lg font-medium text-gray-600">
                What would you like to know?
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {[
                  'What are you doing today?',
                  'How many people are queued?',
                  'Show me system stats',
                  'Who replied this week?',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion)
                      inputRef.current?.focus()
                    }}
                    className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
                <Bot className="h-4 w-4 text-gray-600" />
              </div>
            )}
            <div className={`max-w-[80%] space-y-2`}>
              <div
                className={`rounded-lg px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>

              {/* Tool calls */}
              {msg.toolCalls?.length ? (
                <div className="space-y-1.5">
                  {msg.toolCalls.map((tc, j) => (
                    <ToolCallCard key={j} toolCall={tc} />
                  ))}
                </div>
              ) : null}
            </div>
            {msg.role === 'user' && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900">
                <User className="h-4 w-4 text-white" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
              <Bot className="h-4 w-4 text-gray-600" />
            </div>
            <div className="rounded-lg bg-white border border-gray-200 px-4 py-3">
              <Spinner size="sm" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white pt-4">
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the agent anything..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          />
          <Button onClick={handleSend} disabled={!input.trim() || loading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function ToolCallCard({
  toolCall,
}: {
  toolCall: { name: string; args: Record<string, unknown>; result: unknown }
}) {
  const [expanded, setExpanded] = useState(false)

  const toolLabels: Record<string, string> = {
    search_contacts: 'Searched contacts',
    get_contact_details: 'Fetched contact details',
    get_system_stats: 'Checked system stats',
    get_recent_decisions: 'Reviewed recent decisions',
    get_pending_tasks: 'Checked pending tasks',
    update_contact_status: 'Updated contact status',
    pause_contact: 'Paused contact',
    schedule_outreach: 'Scheduled outreach',
    save_memory: 'Saved memory',
    get_outreach_history: 'Fetched outreach history',
    get_memories: 'Retrieved memories',
  }

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="block w-full text-left rounded border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500 hover:bg-gray-100"
    >
      <div className="flex items-center gap-2">
        <Wrench className="h-3 w-3" />
        <span>{toolLabels[toolCall.name] ?? toolCall.name}</span>
      </div>
      {expanded && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[10px] text-gray-400">
          {JSON.stringify({ args: toolCall.args, result: toolCall.result }, null, 2)}
        </pre>
      )}
    </button>
  )
}
