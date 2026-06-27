# Lightning Fleet Market Intelligence

This repo started as a static `index.html + data.json` fleet dashboard. This branch adds the first real system layer around it: data rules, a pricing engine, validation scripts, a database plan, and a migration path toward scheduled market intelligence.

## Current app

- `index.html` renders the dashboard.
- `data.json` is the source of truth for fleet, earnings, market data, competitors, action items, and history.
- `scripts/pricing-engine.mjs` reads `data.json` and generates `intelligence-report.json`.
- `scripts/validate-data.mjs` checks the dashboard data before publishing.

## Run locally

```bash
npm install
npm run validate
npm run analyze
npm run serve
```

Then open the local server URL and view the dashboard.

## System direction

The goal is to turn this into a market intelligence platform for the Las Vegas Turo/rental market:

```txt
owned fleet data + permitted public market research + Vegas event calendar
→ normalized database
→ pricing/revenue engine
→ dashboard
→ alerts and buy-next-car recommendations
```

## Important boundary

The system should use authorized, permitted, or manually collected data. Do not bypass Turo protections, private APIs, login controls, rate limits, or terms. The safest sources are your own host data, manual competitor research, public listings viewed like a normal user, and external event calendars.

## Next build phases

1. Keep the static dashboard alive and reliable.
2. Add structured data validation and pricing reports.
3. Move `data.json` into Supabase/Postgres.
4. Add admin forms for fleet updates.
5. Add scheduled jobs for allowed market/event data updates.
6. Add Twilio/email alerts.
7. Build a full Next.js dashboard once the data model is stable.
