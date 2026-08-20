# Deploying to Supabase + Vercel

The code is ready. What remains needs your accounts, so it is written as steps
for you rather than something I could run.

Roughly 30–40 minutes end to end.

---

## 1. Create the Supabase project

1. <https://supabase.com> → **New project**.
2. Pick a region close to Ghana or Saudi Arabia — `eu-west-1` (Ireland) or
   `eu-central-1` (Frankfurt) are both reasonable. Region cannot be changed later.
3. Save the database password it generates. You cannot see it again.

### Connection strings

**Project Settings → Database → Connection string.** You need two, and they are
not interchangeable:

| Variable | Which string | Port | Why |
|---|---|---|---|
| `DATABASE_URL` | **Transaction pooler** | 6543 | Serverless functions open many short-lived connections; the pooler is what survives that |
| `DIRECT_URL` | **Direct connection** | 5432 | Migrations run DDL and advisory locks, which pgbouncer's transaction mode cannot do |

Append `?pgbouncer=true&connection_limit=1` to `DATABASE_URL`.

> Using the pooler for migrations fails with a confusing "prepared statement
> already exists" error. Using the direct connection for the app exhausts the
> connection limit under load. This split matters.

---

## 2. Create the storage bucket

**Storage → New bucket**

- Name: `product-photos`
- **Public bucket: on** — product photos are not sensitive, and public URLs
  avoid signing every thumbnail on the catalogue.

Then **Project Settings → API** and copy:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

> The service-role key bypasses row-level security. It is only ever read
> server-side in `src/lib/photo-storage.ts`. Never put it in a
> `NEXT_PUBLIC_*` variable.

---

## 3. Fill in `.env` locally and create the schema

Copy the values into `.env` (see `.env.example`), then:

```bash
npx prisma migrate deploy
npm run db:seed
```

`migrate deploy` creates all 13 tables. `db:seed` loads the 9 brands / 34
fragrances / 38 sizes and creates your admin account from `ADMIN_EMAIL`. If
`ADMIN_PASSWORD` is unset it generates one and prints it **once** — save it.

Check it worked:

```bash
npm run dev
```

---

## 4. Push to GitHub

The repo has no remote yet.

```bash
git init
git add .
git commit -m "Perfume price tool"
git branch -M main
git remote add origin https://github.com/<you>/perfume-price-tool.git
git push -u origin main
```

`.gitignore` already excludes `.env`, `dev.db`, `node_modules` and
`public/uploads`. Verify before pushing — those files contain your API keys:

```bash
git status --porcelain | grep -E "\.env$|dev\.db"
```

That should print nothing.

---

## 5. Deploy on Vercel

1. <https://vercel.com> → **Add New → Project** → import the repo.
2. Framework preset: **Next.js** (detected automatically). Leave build settings alone.
3. Add **Environment Variables** — all of these, for Production *and* Preview:

```
DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
EXCHANGERATE_API_KEY
WISE_API_TOKEN
CRON_SECRET
```

`CRON_SECRET` can be any long random string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`ADMIN_EMAIL` / `ADMIN_PASSWORD` are **not** needed on Vercel — seeding already
happened in step 3.

4. Deploy.

---

## 6. Keep Supabase awake

Free-tier projects pause after ~7 days without database activity, and a paused
project must be restored by hand.

`vercel.json` already registers a daily cron at 06:00 UTC hitting
`/api/keepalive`, which runs a real query — a route that returned 200 without
touching Postgres would not reset the timer.

**Vercel Hobby allows one cron run per day**, which is comfortably inside the
7-day window. Confirm it under **Project → Settings → Cron Jobs** after the
first deploy.

Test it by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>.vercel.app/api/keepalive
```

Expect `{"ok":true,"brands":9,...}`.

For belt and braces, point a free monitor (UptimeRobot, cron-job.org) at the
same URL every few days with the same header. If Vercel's cron ever silently
stops, the project still stays awake.

---

## 7. Custom domain (optional)

**Vercel → Project → Settings → Domains.** Add the domain and follow the DNS
instructions. HTTPS is issued automatically.

---

## Database exposure (Supabase "RLS disabled in public" advisory)

Supabase serves every table in the `public` schema over PostgREST at
`https://<ref>.supabase.co/rest/v1/`. Reaching it needs the anon (publishable)
key, and **Supabase treats that key as public** — it is designed to be shipped
in browsers. So "the key is not published anywhere" is not a security control.

This app never uses PostgREST. It reaches Postgres directly through Prisma as
the `postgres` role, and `supabase-js` is used server-side only, with the
service-role key, purely for Storage. Both `postgres` and `service_role` have
`rolbypassrls = true`.

Two migrations close this off:

- RLS is enabled on every table in `public`, with no policies attached, so
  `anon` and `authenticated` are denied all row access.
- Every object privilege is revoked from `anon` and `authenticated`, and the
  schema's default privileges no longer re-grant them. **The revoke is the
  important half:** RLS does not apply to `TRUNCATE`, so with the grants left
  in place anyone holding the anon key could still empty every table.

`anon` keeps `USAGE` on the schema itself, inherited from the `PUBLIC`
pseudo-role. That was left alone on purpose: `supabase_admin`,
`supabase_storage_admin` and `authenticator` inherit theirs the same way, so
revoking it from `PUBLIC` risks breaking Storage, and it buys nothing — schema
`USAGE` only permits looking an object up, and every privilege on the objects
themselves is gone.

**When you add a table**, enable RLS on it:

```sql
ALTER TABLE public."YourTable" ENABLE ROW LEVEL SECURITY;
```

Prisma will not do this for you, and Supabase will email you an advisory if you
forget. The data is still unreachable without it — new tables no longer receive
grants — but keeping RLS on everything keeps the advisory clean and means the
protection does not rest on a single control.

If you ever want client-side `supabase-js` against these tables, you will need
to grant privileges back **and** write RLS policies first. Do not do one without
the other.

## Things worth knowing

**Photos.** With Supabase Storage configured, uploads go to the bucket. With
those variables blank, they fall back to `public/uploads` — fine locally, but on
Vercel the filesystem is wiped between requests, so photos would vanish. Set the
variables before uploading anything you care about.

**Migrations on deploy.** New migrations are not applied automatically. After
changing the schema, run `npx prisma migrate deploy` locally against production
before or just after the deploy. Adding it to the Vercel build command is
possible but risky: a failed migration mid-build leaves the schema half-applied.

**Cost.** Both free tiers are sufficient here. Supabase free gives 500 MB
database and 1 GB storage — this catalogue is a few hundred kilobytes plus
photos. ExchangeRate-API allows 1500 requests/month and rates are only fetched
when an admin taps the button.

**Backups.** Supabase free tier has no automatic backups. The catalogue is
reproducible from the seed, but price history is not. Worth a periodic
`pg_dump`, or the CSV export, once real prices accumulate.
