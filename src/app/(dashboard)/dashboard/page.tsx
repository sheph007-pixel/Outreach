import { Card, CardContent } from '@/components/ui/card'
import {
  Send,
  MessageSquare,
  Users,
  Clock,
  Pause,
  Ban,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'

export default function DashboardPage() {
  // Placeholder dashboard - will be populated with real metrics in Phase 2
  const metrics = [
    { label: 'Sends Today', value: '0', icon: Send, color: 'text-blue-600' },
    { label: 'Replies Today', value: '0', icon: MessageSquare, color: 'text-green-600' },
    { label: 'Interested Leads', value: '0', icon: CheckCircle, color: 'text-emerald-600' },
    { label: 'Due Contacts', value: '0', icon: Clock, color: 'text-orange-600' },
    { label: 'Active Contacts', value: '0', icon: Users, color: 'text-gray-600' },
    { label: 'Paused', value: '0', icon: Pause, color: 'text-yellow-600' },
    { label: 'Blocked', value: '0', icon: Ban, color: 'text-red-600' },
    { label: 'Tasks Queued', value: '0', icon: AlertCircle, color: 'text-purple-600' },
  ]

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <metric.icon className={`h-8 w-8 ${metric.color}`} />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                  <p className="text-sm text-gray-500">{metric.label}</p>
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
            <p className="text-sm text-gray-500">No activity yet. Import contacts and enable the system to get started.</p>
          </CardContent>
        </Card>
        <Card>
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Recent AI Decisions</h2>
          </div>
          <CardContent>
            <p className="text-sm text-gray-500">No decisions yet. The system will log AI decisions here once active.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
