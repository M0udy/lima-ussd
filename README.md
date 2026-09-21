# lima-ussd

USSD front end for **Lima by TONA Systems**: a Cloudflare Worker that answers the Africa's Talking callback for `*384*5#` with crop tips and saves farmer profiles.

## Menu

```
Welcome to Lima by TONA Systems!
1. Crop advice   -> crop (5) -> topic (4) -> one static tip
2. My profile    -> province (10) -> main crop -> saved
3. Exit
```

Crops: Maize, Cassava, Groundnuts, Soya beans, Sweet potato. Topics: planting time, pests and diseases, fertilizer, harvesting and storage.

## Status

The tips in `src/tips.js` are a **draft**. A Zambian extension officer must review them before the shortcode goes public. They deliberately contain no fertilizer rates or spray product names, and a test enforces that.

## How it works

- `src/menu.js`: pure router. Turns Africa's Talking's cumulative `text` (`"1*2*3"`) into a screen or an action.
- `src/tips.js`: the 20 tips (crop x topic).
- `src/index.js`: the Worker. Validates the request, runs the action, and stores profiles and interactions in D1 (`schema.sql`). Screens stay under the 182-character USSD limit.

## Setup

```bash
npm install
npx wrangler d1 create lima-db       # put the database_id in wrangler.toml
npm run db:init                      # creates farmer_profiles and interactions
npm run deploy
```

Then set the Worker URL as the USSD callback URL in the Africa's Talking dashboard.

Check it:

```bash
curl -X POST https://<your-worker>.workers.dev \
  -d "sessionId=t1&phoneNumber=%2B260977000001&text="
# CON Welcome to Lima by TONA Systems!
```

## Tests

```bash
npm test
```

## Known limits

- The callback is not authenticated (Africa's Talking does not sign USSD requests). It only reads tips and writes small rows to D1; add rate limiting if it is abused.
- No Africa's Talking secrets are needed today, since USSD replies go back in the HTTP response.
