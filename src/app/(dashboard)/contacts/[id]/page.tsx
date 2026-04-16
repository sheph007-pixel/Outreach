import { notFound } from 'next/navigation'
import { getContact } from '@/services/contacts'
import { ContactDetail } from '@/components/contacts/contact-detail'

export default async function ContactDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const contact = await getContact(params.id)
  if (!contact) notFound()

  return <ContactDetail contact={contact} />
}
