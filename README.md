# Outreach

AI-driven annual outreach system for group health insurance. A digital salesperson that continuously works a master contact list, sends outreach, follows up, classifies replies, and improves over time.

## Architecture

```
┌─────────────────┐     ┌───────────────┐     ┌──────────────┐
│  Next.js Web    │────▶│  Worker       │────▶│  PostgreSQL  │
│  (UI + API)     │     │  (Background) │     │  (Railway)   │
└────────┬────────┘     └───────┬───────┘     └──────────────┘
         │                      │
    ┌────▼────┐           ┌─────┴─────┐
    │ OpenAI  │           │ MS Graph  │
    │ (Agent) │           │ (Email)   │
    └─────────┘           └───────────┘
```

- **Web**: Next.js 14, App Router, TypeScript, Tailwind CSS
- **Worker**: Separate process for background automation
- **Database**: PostgreSQL via Prisma ORM (15 tables)
- **Auth**: NextAuth v5 with Microsoft Entra ID
- **Email**: Microsoft Graph API (send + check replies)
- **AI**: OpenAI API (drafting, classification, agent chat)

## Local Development

### Prerequisites

- Node.js 18+
- pnpm 9+
- PostgreSQL database
- Microsoft Entra ID app registration
- OpenAI API key

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Fill in all values in .env

# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Seed default settings and prompts
pnpm db:seed

# Start web app
pnpm dev

# Start worker (separate terminal)
pnpm worker:dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | NextAuth secret (`openssl rand -base64 32`) |
| `AUTH_URL` | App URL (http://localhost:3000 for dev) |
| `AZURE_AD_CLIENT_ID` | Microsoft Entra ID app client ID |
| `AZURE_AD_CLIENT_SECRET` | Microsoft Entra ID app client secret |
| `AZURE_AD_TENANT_ID` | Microsoft Entra ID tenant ID |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | OpenAI model (default: gpt-4o) |
| `WORKER_POLL_INTERVAL_MS` | Worker poll interval in ms (default: 30000) |

### Microsoft Entra ID Setup

1. Create an app registration in Azure Portal
2. Set redirect URI to `{AUTH_URL}/api/auth/callback/microsoft-entra-id`
3. Grant API permissions: `Mail.Send`, `Mail.ReadWrite`, `openid`, `profile`, `email`, `offline_access`
4. Create a client secret
5. Note the client ID, tenant ID, and secret

## Railway Deployment

### Services

Create a Railway project with 3 services:

1. **PostgreSQL** - Railway managed PostgreSQL
2. **Web** - Next.js application
   - Build: `pnpm install && pnpm build`
   - Start: `pnpm start`
3. **Worker** - Background automation
   - Build: `pnpm install && pnpm db:generate`
   - Start: `pnpm worker:dev`

### Steps

1. Create a new Railway project
2. Add a PostgreSQL service
3. Add a new service from your GitHub repo for the web app
4. Set all environment variables (use `DATABASE_URL` from the PostgreSQL service)
5. Add another service from the same repo for the worker
6. Set the same environment variables on the worker service
7. Deploy

Both web and worker share the same `DATABASE_URL` and environment variables.

## Project Structure

```
├── prisma/              Schema and seed
├── src/
│   ├── app/             Next.js App Router pages and API routes
│   ├── components/      React components (UI, layout, features)
│   ├── lib/             Shared utilities (db, auth, graph, openai)
│   ├── services/        Business logic layer
│   └── types/           TypeScript types
├── worker/
│   ├── index.ts         Worker entry point
│   ├── queue.ts         Task queue processor
│   ├── rules.ts         Hard guardrails (code-enforced)
│   ├── jobs/            Job handlers
│   └── utils/           Worker utilities
```

## Key Design Decisions

- **Hard rules in code, not prompts**: Blocked/unsubscribed suppression, daily limits, send windows enforced before AI is consulted
- **No inbox sync**: Only tracks system-created email threads
- **Service layer pattern**: API routes are thin, all business logic in `src/services/`
- **Worker shares code**: Imports from `src/lib/` and `src/services/` directly
- **Settings as DB rows**: Runtime-configurable without redeployment
- **Idempotent tasks**: Atomic claiming prevents double-processing
- **Audit everything**: All mutations create audit log entries
