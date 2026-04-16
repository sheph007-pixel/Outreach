import { Client } from '@microsoft/microsoft-graph-client'
import { prisma } from '@/lib/db'

interface SendEmailParams {
  to: string
  subject: string
  bodyHtml: string
  replyToMessageId?: string
}

interface GraphSendResult {
  messageId: string
  conversationId: string
}

interface GraphReply {
  id: string
  conversationId: string
  subject: string
  bodyPreview: string
  body: { content: string; contentType: string }
  from: { emailAddress: { address: string; name: string } }
  receivedDateTime: string
  isRead: boolean
}

/**
 * Get a configured Microsoft Graph client for a user.
 * Refreshes the access token if expired.
 */
export async function getGraphClient(userId: string): Promise<Client> {
  const oauth = await prisma.oAuthAccount.findUnique({
    where: { userId_provider: { userId, provider: 'microsoft' } },
  })

  if (!oauth) {
    throw new Error('Microsoft account not connected. Please sign in again.')
  }

  // Check if token is expired (with 5-minute buffer)
  const now = new Date()
  const bufferMs = 5 * 60 * 1000
  if (oauth.expiresAt && oauth.expiresAt.getTime() - bufferMs < now.getTime()) {
    const refreshed = await refreshMicrosoftToken(oauth.refreshToken!, userId)
    return createClient(refreshed.accessToken)
  }

  return createClient(oauth.accessToken)
}

function createClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken)
    },
  })
}

async function refreshMicrosoftToken(
  refreshToken: string,
  userId: string
): Promise<{ accessToken: string }> {
  const tenantId = process.env.AZURE_AD_TENANT_ID!
  const clientId = process.env.AZURE_AD_CLIENT_ID!
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET!

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'openid profile email offline_access Mail.Send Mail.ReadWrite',
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const errorData = await response.text()
    console.error('Token refresh failed:', errorData)
    throw new Error('Failed to refresh Microsoft token. User may need to re-authenticate.')
  }

  const data = await response.json()

  await prisma.oAuthAccount.update({
    where: { userId_provider: { userId, provider: 'microsoft' } },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
    },
  })

  return { accessToken: data.access_token }
}

/**
 * Send an email via Microsoft Graph.
 */
export async function sendEmail(
  userId: string,
  params: SendEmailParams
): Promise<GraphSendResult> {
  const client = await getGraphClient(userId)

  if (params.replyToMessageId) {
    // Reply to existing thread
    const reply = await client
      .api(`/me/messages/${params.replyToMessageId}/reply`)
      .post({
        message: {
          body: {
            contentType: 'HTML',
            content: params.bodyHtml,
          },
        },
      })

    // Get the sent message details
    const sentMessages = await client
      .api('/me/mailFolders/sentitems/messages')
      .top(1)
      .orderby('sentDateTime desc')
      .select('id,conversationId')
      .get()

    const latest = sentMessages.value?.[0]
    return {
      messageId: latest?.id ?? '',
      conversationId: latest?.conversationId ?? '',
    }
  }

  // Send new email
  const sendResult = await client.api('/me/sendMail').post({
    message: {
      subject: params.subject,
      body: {
        contentType: 'HTML',
        content: params.bodyHtml,
      },
      toRecipients: [
        {
          emailAddress: { address: params.to },
        },
      ],
    },
    saveToSentItems: true,
  })

  // Get the sent message to capture IDs
  const sentMessages = await client
    .api('/me/mailFolders/sentitems/messages')
    .top(1)
    .orderby('sentDateTime desc')
    .select('id,conversationId,internetMessageId')
    .get()

  const latest = sentMessages.value?.[0]
  return {
    messageId: latest?.id ?? '',
    conversationId: latest?.conversationId ?? '',
  }
}

/**
 * Get replies in a thread by conversation ID.
 * Only returns messages NOT from the sender.
 */
export async function getThreadReplies(
  userId: string,
  conversationId: string,
  senderEmail: string
): Promise<GraphReply[]> {
  const client = await getGraphClient(userId)

  const messages = await client
    .api('/me/messages')
    .filter(`conversationId eq '${conversationId}'`)
    .select('id,conversationId,subject,bodyPreview,body,from,receivedDateTime,isRead')
    .orderby('receivedDateTime desc')
    .top(50)
    .get()

  // Filter out messages from the sender (only keep actual replies)
  return (messages.value ?? []).filter(
    (msg: GraphReply) =>
      msg.from?.emailAddress?.address?.toLowerCase() !== senderEmail.toLowerCase()
  )
}

/**
 * Check if the Microsoft connection is valid for a user.
 */
export async function checkMicrosoftConnection(userId: string): Promise<{
  connected: boolean
  email?: string
  error?: string
}> {
  try {
    const oauth = await prisma.oAuthAccount.findUnique({
      where: { userId_provider: { userId, provider: 'microsoft' } },
    })

    if (!oauth) {
      return { connected: false, error: 'No Microsoft account connected' }
    }

    const client = await getGraphClient(userId)
    const me = await client.api('/me').select('mail,userPrincipalName').get()

    return {
      connected: true,
      email: me.mail ?? me.userPrincipalName,
    }
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
