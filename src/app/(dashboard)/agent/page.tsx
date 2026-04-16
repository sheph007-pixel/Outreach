import { AgentChat } from '@/components/agent/agent-chat'
import { MemoryPanel } from '@/components/agent/memory-panel'

export default function AgentPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Agent Chat</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AgentChat />
        </div>
        <div>
          <MemoryPanel />
        </div>
      </div>
    </div>
  )
}
