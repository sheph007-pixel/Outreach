import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Default agent settings
  const settings = [
    { key: 'sending.daily_limit', value: 50, label: 'Daily Send Limit', category: 'sending' },
    { key: 'sending.window_start', value: 8, label: 'Send Window Start (hour)', category: 'sending' },
    { key: 'sending.window_end', value: 17, label: 'Send Window End (hour)', category: 'sending' },
    { key: 'sending.timezone', value: 'America/Denver', label: 'Timezone', category: 'sending' },
    { key: 'sending.sender_name', value: 'Hunter Kennion', label: 'Sender Name', category: 'sending' },
    { key: 'sending.sender_email', value: 'hunter@kennion.com', label: 'Sender Email', category: 'sending' },
    { key: 'sending.signature', value: 'Best,\nHunter Kennion', label: 'Email Signature', category: 'sending' },
    { key: 'ai.model', value: 'gpt-4o', label: 'AI Model', category: 'ai' },
    { key: 'ai.temperature', value: 0.7, label: 'AI Temperature', category: 'ai' },
    { key: 'tone.style', value: 'professional-friendly', label: 'Tone Style', category: 'tone' },
    { key: 'tone.instructions', value: '', label: 'Custom Tone Instructions', category: 'tone' },
    { key: 'rules.min_days_between_outreach', value: 7, label: 'Min Days Between Outreach', category: 'rules' },
    { key: 'rules.max_followups', value: 4, label: 'Max Follow-ups', category: 'rules' },
    { key: 'rules.auto_block_hard_bounce', value: true, label: 'Auto-block Hard Bounces', category: 'rules' },
    { key: 'rules.system_enabled', value: true, label: 'System Enabled', category: 'rules' },
    { key: 'rules.blocked_domains', value: '', label: 'Blocked Domains (comma-separated)', category: 'rules' },
    { key: 'rules.business_notes', value: 'We provide group health insurance solutions. Our outreach is focused on asking businesses if they need help with group health this year.', label: 'Business Notes / AI Context', category: 'rules' },
  ]

  for (const setting of settings) {
    await prisma.agentSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, label: setting.label, category: setting.category },
      create: {
        key: setting.key,
        value: setting.value,
        label: setting.label,
        category: setting.category,
      },
    })
  }

  // Default prompt versions
  const prompts = [
    {
      name: 'initial_outreach',
      category: 'outreach',
      version: 1,
      content: `You are writing a short, direct outreach email on behalf of Hunter Kennion, a group health insurance specialist.

Goal: Ask if the recipient needs help with their group health insurance this year.

Rules:
- Keep it short (3-5 sentences max)
- Be human, direct, and professional
- No spammy language or sales pressure
- Light personalization when possible (company name, etc.)
- Always include a clear but soft call to action
- Sign off as Hunter

You will receive contact details. Return JSON:
{
  "subject": "email subject line",
  "bodyHtml": "email body in simple HTML",
  "bodyText": "plain text version"
}`,
    },
    {
      name: 'follow_up',
      category: 'follow_up',
      version: 1,
      content: `You are writing a follow-up email on behalf of Hunter Kennion, a group health insurance specialist.

This person was contacted before but didn't respond. You will receive the thread history.

Rules:
- Keep it even shorter than the initial email (2-3 sentences)
- Reference the previous outreach naturally
- Don't be pushy or apologetic
- Vary the angle slightly from previous messages
- Stay professional and helpful

Return JSON:
{
  "subject": "Re: original subject",
  "bodyHtml": "email body in simple HTML",
  "bodyText": "plain text version"
}`,
    },
    {
      name: 'reply_classification',
      category: 'classification',
      version: 1,
      content: `Classify this email reply into one of these categories:
- "yes" - They want help / are interested in talking
- "interested" - Soft interest, want more info
- "later" - Not now but maybe later this year
- "next_year" - Not this year, try next year
- "no" - Not interested
- "unsubscribe" - Want to be removed / stop contacting

Return JSON:
{
  "replyType": "one of the categories above",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`,
    },
    {
      name: 'next_best_action',
      category: 'reasoning',
      version: 1,
      content: `You are an AI assistant helping decide the next best action for a contact in a group health insurance outreach system.

You will receive the contact's history, previous outreach, replies, and current state.

Decide what should happen next:
- "send_followup" - Send a follow-up email
- "wait" - Wait longer before next contact
- "re_engage" - Re-engage after a long pause
- "finish" - Stop outreach for this contact
- "escalate" - Flag for human review

Return JSON:
{
  "action": "one of the actions above",
  "scheduleDays": number of days to wait (if applicable),
  "reasoning": "explanation of your decision",
  "messageStrategy": "brief note on messaging approach (if sending)"
}`,
    },
  ]

  for (const prompt of prompts) {
    await prisma.promptVersion.upsert({
      where: { name_version: { name: prompt.name, version: prompt.version } },
      update: { content: prompt.content, category: prompt.category },
      create: prompt,
    })
  }

  console.log('Seeding complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
