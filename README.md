# Ku-Lima USSD

USSD front end for **Ku-Lima by TONA Systems**: a Cloudflare Worker that answers the Africa's Talking callback for `*384*5#` with crop tips and saves farmer profiles.

## Menu

```
Welcome to Ku-Lima by TONA Systems!
1. Crop advice   -> crop (5) -> topic (4) -> one static tip
2. My profile    -> province (10) -> main crop -> saved
3. Crop news     -> saved crop's price, or crop (5) -> price
4. Exit
```

Crops: Maize, Cassava, Groundnuts, Soya beans, Sweet potato. Topics: planting time, pests and diseases, fertilizer, harvesting and storage.

**Crop news** shows the national average market price for one crop, fetched live from **lima-api** (a separate Worker/repo — the Ku-Lima web + SMS backend). If the phone has a saved profile (option 2), it skips straight to that crop's price; otherwise it asks which crop first. It does not save a profile. Cassava has no real Ministry price in lima-api's data (a fabricated placeholder, not a real figure) — the screen says so rather than showing a fake number. The other 4 crops' prices are dated (as of whatever the Ministry last published; check the date on screen) and can be up to a couple of years stale if the Ministry hasn't published since.

## Status

The tips in `src/tips.js` are **source-checked, not expert-reviewed**. Each was checked against published guides (Zambia Ministry of Agriculture soya manual, ZARI sweet potato and groundnut guides, FAO, IITA, ICRISAT, CIP) and the links are in the file. Several sources are regional or company guides where no Ministry page could be opened, and planting windows vary by region. Review by a Zambian extension officer is still recommended before the shortcode is widely promoted. The tips deliberately contain no fertilizer rates or spray product names, and a test enforces that.

## How it works

- `src/menu.js`: pure router. Turns Africa's Talking's cumulative `text` (`"1*2*3"`) into a screen or an action.
- `src/tips.js`: the 20 tips (crop x topic).
- `src/market.js`: fetches and formats a crop's price from lima-api's public `/api/lima/market` endpoint (no auth needed), with a 3s timeout.
- `src/index.js`: the Worker. Validates the request, runs the action, and stores profiles and interactions in D1 (`schema.sql`). Screens stay under the 182-character USSD limit.

## Setup

```bash
npm install
npx wrangler d1 create lima-db       # put the database_id in wrangler.toml
npm run db:init                      # creates farmer_profiles and interactions
openssl rand -hex 24                 # generate a token, then store it as the secret:
npx wrangler secret put CALLBACK_TOKEN
npm run deploy
```

Then set the USSD callback URL in the Africa's Talking dashboard to `https://<your-worker>.workers.dev/?token=<the token>`. Set the secret before deploying: with no `CALLBACK_TOKEN` the Worker rejects every request.

Check it:

```bash
curl -X POST "https://<your-worker>.workers.dev/?token=<the token>" \
  -d "sessionId=t1&phoneNumber=%2B260977000001&text="
# CON Welcome to Ku-Lima by TONA Systems!
# without the token: 403 Forbidden
```

## Tests

```bash
npm test
```

## Known limits

- Africa's Talking does not sign USSD requests, so the callback URL carries a secret token (`?token=`). Requests without the exact token get 403 before any other work is done, and the check fails closed if the secret is missing. Keep the full URL private. To rotate it, run `wrangler secret put CALLBACK_TOKEN` with a new value and update the URL in the dashboard. The token shows in `wrangler tail` request lines.
- Rate limit: 20 requests per phone number per minute (a full menu walk is at most 4), then the farmer sees "Too many requests" and can dial again after a minute. It is keyed by phone, not IP, because every real callback comes from Africa's Talking's servers. Counts are per Cloudflare location and approximate, and the limiter fails open if it errors.
- No Africa's Talking secrets are needed today, since USSD replies go back in the HTTP response.
- Crop news depends on lima-api being up (`https://lima-api.fragrant-glade-9265.workers.dev`, hardcoded in `src/market.js`). If it's slow, down, or its URL changes, that one menu option falls back to the generic "Ku-Lima is unavailable" message — the rest of the menu is unaffected.
