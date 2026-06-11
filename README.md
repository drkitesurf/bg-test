# Mission Control for THEVETERINARIAN.AI

Production-quality internal dashboard for creating, controlling, editing, and managing THEVETERINARIAN.AI: the 7-day build sprint, roadmap, KPIs, clinic CRM, fundraising CRM, risks, documents, decisions, and weekly updates.

## Stack

- Next.js 15 App Router + TypeScript
- Tailwind CSS + shadcn-style UI primitives
- Supabase-ready data layer with demo-mode localStorage fallback
- Recharts, TanStack Table, zod, date-fns, dnd-kit, PapaParse, react-markdown, sonner

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. No environment variables are required; the app defaults to demo mode with seeded localStorage data.

## Environment variables

```bash
# Default
NEXT_PUBLIC_DATA_MODE=demo

# Supabase mode
NEXT_PUBLIC_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

If `NEXT_PUBLIC_DATA_MODE=supabase` is set without both Supabase keys, the app safely falls back to demo mode.

## Supabase setup

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/migration.sql`.
4. Run `supabase/seed.sql`.
5. Configure auth providers as needed.
6. Set the env vars above in `.env.local` or your hosting platform.

The migration enables Row Level Security and creates authenticated CRUD policies for all Mission Control tables. Tighten policies for your production authorization model before inviting additional users.

## Demo data reset

Go to `/settings` and click **Reset demo data**. Demo mode persists changes in localStorage, so all CRUD remains refresh-safe without Supabase.

## Vercel deployment

1. Push this repository to GitHub.
2. Import the project in Vercel.
3. Use the default Next.js build settings:
   - Install: `npm install`
   - Build: `npm run build`
   - Output: `.next`
4. For demo deployments, set `NEXT_PUBLIC_DATA_MODE=demo` or leave env vars empty.
5. For Supabase deployments, add `NEXT_PUBLIC_DATA_MODE=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Scripts

```bash
npm run dev
npm run build
npm run typecheck
```
