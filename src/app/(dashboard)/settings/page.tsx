import { getSettingsGrouped } from '@/services/settings'
import { SettingsForm } from '@/components/settings/settings-form'

export default async function SettingsPage() {
  const settings = await getSettingsGrouped()

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Settings & Rules</h1>
      <SettingsForm initialSettings={settings} />
    </div>
  )
}
