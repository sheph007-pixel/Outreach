import { Card, CardContent } from '@/components/ui/card'
import { getDashboardMetrics, getRecentActivity, getRecentDecisions } from '@/services/dashboard'
import { formatRelativeTime } from '@/lib/utils'
import {
  Send,
  MessageSquare,
  Users,
  Clock,
  Pause,
  Ban,
  ListTodo,
  CheckCircle,
} from 'lucide-react'

export default async function DashboardPage() {
  const [metrics, recentActivity, recentDecisions] = await Promise.all([
    getDashboardMetrics(),
    getRecentActivity(8),
    getRecentDecisions(8),
  ])

  const cards = [
    { label: 'Sends Today', value: metrics.sendsToday, icon: Send, color: 'text-blue-600' },
    { label: 'Replies Today', value: metrics.repliesToday, icon: MessageSquare, color: 'text-green-600' },
    { label: 'Interested Leads', value: metrics.interestedLeads, icon: CheckCircle, color: 'text-emerald-600' },
    { label: 'Due Contacts', value: metrics.dueContacts, icon: Clock, color: 'text-orange-600' },
    { label: 'Active Contacts', value: metrics.activeContacts, icon: Users, color: 'text-gray-600' },
    { label: 'Paused', value: metrics.pausedContacts, icon: Pause, color: 'text-yellow-600' },
    { label: 'Blocked', value: metrics.blockedContacts, icon: Ban, color: 'text-red-600' },
    { label: 'Tasks Queued', value: metrics.tasksQueued, icon: ListTodo, color: 'text-purple-600' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">{metrics.totalContacts} total contacts</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <card.icon className={`h-8 w-8 ${card.color}`} />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-sm text-gray-500">{card.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-gray-500">No activity yet. Import contacts and enable the system to get started.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <span className="text-gray-400 text-xs w-24 shrink-0 pt-0.5">
                      {formatRelativeTime(log.createdAt)}
                    </span>
                    <div>
                      <p className="text-gray-700">{formatAuditAction(log.action)}</p>
                      {log.user && (
                        <p className="text-xs text-gray-400">by {log.user.name ?? log.user.email}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Recent AI Decisions</h2>
          </div>
          <CardContent>
            {recentDecisions.length === 0 ? (
              <p className="text-sm text-gray-500">No decisions yet. The system will log AI decisions here once active.</p>
            ) : (
              <div className="space-y-3">
                {recentDecisions.map((dec) => (
                  <div key={dec.id} className="flex items-start gap-3 text-sm">
                    <span className="text-gray-400 text-xs w-24 shrink-0 pt-0.5">
                      {formatRelativeTime(dec.createdAt)}
                    </span>
                    <div>
                      <p className="text-gray-700">
                        <span className="font-medium">{dec.decision}</span>
                        {dec.contact && (
                          <span className="text-gray-500">
                            {' - '}
                            {dec.contact.firstName} {dec.contact.lastName} ({dec.contact.email})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 line-clamp-2">{dec.reasoning}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function formatAuditAction(action: string): string {
  const map: Record<string, string> = {
    'contact.created': 'Contact created',
    'contact.updated': 'Contact updated',
    'contact.deleted': 'Contact deleted',
    'contact.status_changed': 'Contact status changed',
    'contact.imported': 'Contacts imported from CSV',
    'email.sent': 'Email sent',
    'email.failed': 'Email delivery failed',
    'reply.received': 'Reply received',
    'reply.classified': 'Reply classified',
    'setting.updated': 'Setting updated',
    'task.created': 'Task scheduled',
    'task.completed': 'Task completed',
    'task.failed': 'Task failed',
    'agent.action': 'Agent action',
    'memory.created': 'Memory saved',
    'memory.deleted': 'Memory deleted',
    'system.enabled': 'System enabled',
    'system.disabled': 'System disabled',
  }
  return map[action] ?? action
}
