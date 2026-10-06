# SecondServe frontend

Responsive React + TypeScript prototype for the SecondServe food-rescue flow.

## Run locally

```bash
npm install
npm run dev
```

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

The current UI uses synthetic sample data and in-memory browser state. It does not call Firebase, Gemini, Google Routes, or a live backend; image analysis is represented only by an explicitly labelled sample suggestion. Refreshing the page resets the demo state. Do not use the demo as a food-safety certification or a report of real impact.
