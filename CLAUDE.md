# lima-ussd (`M0udy/lima-ussd`)

Ku-Lima USSD Worker: answers the Africa's Talking callback for `*384*5#` with crop tips, farmer profiles, and crop-news prices. Public repo. Product name in the README is Ku-Lima; the GitHub repo name is still `lima-ussd` (no rename on GitHub as of this draft).

## Stack

JavaScript (ESM) Cloudflare Worker, D1 (`lima-db`), KV (`SESSIONS`), a service binding to Worker `lima-api` (`M0udy/TonaSystems-`), and a Workers rate-limit binding. Tests use Node's built-in test runner. Dev dependency: wrangler `^4`. Schema is applied from `schema.sql` (not a numbered migrations folder).

## Directory map

- `src/index.js` — Worker entry (auth token, D1 writes, 182-char USSD screens)
- `src/menu.js` — pure router for Africa's Talking cumulative `text`
- `src/tips.js` — 20 source-checked tips (no fertilizer rates or spray names; a test enforces that)
- `src/market.js` — crop prices via lima-api
- `src/sms.js`, `src/monitor.js` — SMS helper and weekly FEWS NET cron
- `test/*.test.js`
- `schema.sql` — `farmer_profiles` and `interactions`
- `wrangler.toml`, `package.json`
- No `.env.example`

## Commands

```bash
npm install
npm test                 # node --test
npm run dev              # wrangler dev
npm run deploy           # wrangler deploy — do not run without approval
```

Also in `package.json` (remote D1 — **do not run without Mahmoud's explicit approval**):

```bash
npm run db:init          # wrangler d1 execute lima-db --remote --file=schema.sql
```

README also documents `npx wrangler d1 create lima-db` and `npx wrangler secret put CALLBACK_TOKEN`. Those change infra/secrets — approval required. There is **no lint or build script**.

## Env var names (no values)

Secret: `CALLBACK_TOKEN` (query token on the USSD callback URL; Worker fails closed if missing).

Bindings in `wrangler.toml`: `DB` (D1 `lima-db`), `SESSIONS` (KV), `LIMA_API` (service binding to `lima-api`), `PHONE_LIMITER` (20 requests per phone per minute). Weekly cron: Monday 07:00 UTC.

No Africa's Talking API secrets are required for USSD replies (they go in the HTTP response).

## Conventions

- Default branch: `main`. Branch/commit style: TODO: confirm with Mahmoud.
- Keep PRs small and focused.
- **Schema:** single `schema.sql` applied remotely via `db:init`. Do not create or run schema changes, or use `--remote`, without approval.
- Screens must stay under the 182-character USSD limit.
- Tips must stay free of fertilizer rates and spray product names (enforced by tests).
- Cassava has no real Ministry price; the UI must not show a fake number (README).

## Do

- Run `npm test` before proposing a PR (no lint script exists).
- Ask before any change outside the task.

## Don't

- Never commit secrets or `.env` / `.dev.vars` files.
- Never touch the production DB, or run or create migrations or schema changes, without Mahmoud's explicit approval.
- Never touch payment credentials, KYC/Smile ID configuration, or secret rotation.
- No deletions of data or files without approval.
- Do not log or share the full callback URL (it carries `CALLBACK_TOKEN`). Rotate that secret only with approval.
