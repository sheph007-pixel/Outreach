import NextAuth from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID!}/v2.0`,
      authorization: {
        params: {
          scope: 'openid profile email offline_access Mail.Send Mail.ReadWrite',
        },
      },
    }),
  ],
  session: { strategy: 'database' },
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id
      return session
    },
    async signIn({ user, account }) {
      // Store Microsoft Graph tokens in our separate OAuthAccount table
      if (account && account.provider === 'microsoft-entra-id' && user.id) {
        try {
          await prisma.oAuthAccount.upsert({
            where: { userId_provider: { userId: user.id, provider: 'microsoft' } },
            create: {
              userId: user.id,
              provider: 'microsoft',
              accessToken: account.access_token!,
              refreshToken: account.refresh_token ?? null,
              expiresAt: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
              scope: account.scope ?? null,
            },
            update: {
              accessToken: account.access_token!,
              refreshToken: account.refresh_token ?? account.refresh_token ?? null,
              expiresAt: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
              scope: account.scope ?? null,
            },
          })
        } catch (error) {
          console.error('Failed to store OAuth tokens:', error)
          // Don't block sign-in on token storage failure
        }
      }
      return true
    },
  },
  pages: {
    signIn: '/login',
  },
  trustHost: true,
})
