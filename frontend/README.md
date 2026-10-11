# SecondServe frontend

Responsive React + TypeScript prototype for the SecondServe food-rescue flow.

## Run locally

```bash
npm install
npm run dev
```

To use the FastAPI backend, copy `.env.example` to `.env.local` and run the
backend at `http://127.0.0.1:8000`. The frontend then uses the seeded demo
identities and backend API data instead of the browser-only reducer.

Useful checks:

```bash
npm run build
npm run lint
```

## Demo journeys

- `/` — choose the donor or a seeded recipient demo account.
- `/donor/dashboard` — donor overview and active rescues.
- `/donor/new` — Food Passport, readiness/split plan, donor confirmation, and offer start.
- `/donor/donations/:donationId` — relay status, allocations, and handoff code.
- `/recipient/:recipientId/offers` — accept or decline offers and submit recipient-confirmed receipts.
- `/recipient/:recipientId/capacity`, `/received`, and `/impact` — recipient profile and outcomes.

Without `VITE_API_BASE_URL`, the UI uses synthetic sample data and in-memory
browser state; refreshing resets demo changes. With the backend URL configured,
donation, offer, receipt, impact, image analysis, and readiness flows use the
FastAPI endpoints. Gemini and Google Routes require backend configuration and
Google Cloud credentials; their failures are surfaced rather than replaced
with success-shaped sample results. Do not use the demo as food-safety
certification or a report of real impact.

For backend setup and its current persistence/infrastructure limits, see the
root [README](../README.md).
