# Deploying DirectLet to Vercel

One Vercel project serves both the website and the API. The website lives at
`/` and the API at `/api`, on the same address. That keeps the login cookie
working and lets the API see each visitor's real IP address.

`pnpm run build:vercel` (see `scripts/build-vercel.mjs`) builds everything into
`.vercel/output`: the website as static files, the API as one bundled function,
the routes, and a daily job that issues the next rent charges.

## 1. Set up the project

1. Push this repo to GitHub (keep it private).
2. On vercel.com choose **Add New > Project** and import the repo.
3. Set **Root Directory** to **`deploy`**, not the repo root. Vercel finds two
   apps in this repo (`apps/api` and `apps/web`) and, from the root, forces you to
   import them as separate projects or configure "services". The `deploy` folder
   holds no app, only `vercel.json`, whose commands run the real build from the
   repo root. Do not click "Import single project" for `api` or `web`. Pick
   **Other** as the Framework Preset and leave the commands alone.
4. Before the first deploy, add the environment variables below (**Settings >
   Environment Variables**, tick Production, Preview and Development).
5. Under **Settings > Functions**, set **Function Region** to **Dublin (dub1)**,
   next to the Supabase database, so each query is fast.

## 2. Environment variables

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Supabase **Transaction pooler** string (port **6543**), with the real password |
| `JWT_ACCESS_SECRET` | A new random string, 48+ characters. Not the one used locally |
| `JWT_REFRESH_SECRET` | A different new random string, 48+ characters |
| `WEB_ORIGIN` | The site address, e.g. `https://directlet.vercel.app` (https, no trailing slash) |
| `NODE_ENV` | `production` |
| `REFRESH_COOKIE_PATH` | `/api/auth` |
| `TRUST_PROXY_HOPS` | `1` |
| `DB_POOL_MAX` | `1` |
| `CRON_SECRET` | A random string, 32+ characters. Vercel sends it to the daily job |

Make a random string with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`WEB_ORIGIN` is used for tenant invite links and to reject requests from other
sites, so it must match the address people actually use. Change it when you add
a custom domain.

## 3. After it deploys

- Open `/api/health`. It should answer `{"status":"ok","service":"directlet-api"}`.
- Log in, then reload the page. You should stay logged in (the cookie works).
- Open a payment receipt to confirm the PDF downloads.

## Database changes

Migrations are not run by the deploy. Run them from a laptop that has the
database URL, using the Session pooler (port 5432):

```bash
pnpm --filter @directlet/api exec prisma migrate deploy
```

## Making someone an admin

Admin is never offered at sign-up. Sign up as a house hunter, then from a laptop:

```bash
pnpm --filter @directlet/api admin:grant someone@example.com
```

## Running the test scripts

The scripts in `scripts/` call a running API. No password is stored in the repo:

```powershell
$env:DEMO_PASSWORD = "the demo landlord's password"   # the demo account
$env:API_BASE = "http://localhost:4000"               # optional, this is the default
.\scripts\test-v1-gaps.ps1
```

Test accounts get a random password on every run. `seed.ts` reads `DEMO_PASSWORD`
the same way, or makes a random one and prints it.

## Known limits

- Rate limits are counted in memory, per running function. They slow down
  guessing, but a determined attacker spread across instances is not fully
  stopped. A shared store (for example Upstash Redis) would fix that.
- The rent job runs once a day (the free plan allows no more).
- Payment proofs are stored in the database (2 MB each). Move them to file
  storage if uploads grow.
