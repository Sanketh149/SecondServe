# SecondServe

SecondServe helps food businesses turn time-sensitive surplus into a feasible
rescue. Donors review and confirm food details, recipients are matched against
need and capacity, unanswered offers can be relayed, and only recipient-confirmed
handoffs count as rescued.

> **Prototype status:** The current frontend is an interactive demo with
> synthetic data and in-memory state. Firebase, Gemini, Google Routes, and a
> production backend are not connected. Refreshing the page resets demo changes.

## Product scope

The locked product scope includes five signature features:

1. **AI Food Passport** — present food-image suggestions with clear provenance
   for donor review; AI does not certify food safety.
2. **Rescue Readiness Check** — assess recipient need, category, capacity, hours,
   and arrival before the donor-entered cutoff.
3. **Split the Batch** — divide one homogeneous donation across no more than two
   recipients while conserving the full quantity.
4. **Rescue Relay** — send offers sequentially and move to a planned fallback
   when an offer is declined or expires.
5. **Recipient-Confirmed Rescue Receipt** — record the actual quantity received
   and count only that quantity toward impact.

See [FINAL_SPEC.md](FINAL_SPEC.md) for the locked requirements, safety rules,
API/data contracts, technical architecture, team ownership, and acceptance
criteria.

## Run the frontend demo

Requirements: Node.js and npm.

```bash
cd frontend
npm ci
npm run dev
```

Useful checks:

```bash
npm run build
npm run lint
```

The app prints a local URL after the development server starts. Use the entry
screen to open the donor workspace or a seeded recipient workspace.

## Demo screens

| Route | Screen |
| --- | --- |
| `/` | Role entry |
| `/donor/dashboard` | Donor overview |
| `/donor/donations` | Donation history |
| `/donor/impact` | Donor impact |
| `/donor/new` | Three-step donation and rescue-plan flow |
| `/donor/donations/:donationId` | Rescue timeline and handoff status |
| `/recipient/:recipientId/offers` | Recipient offer inbox and handoff form |
| `/recipient/:recipientId/capacity` | Recipient capacity and needs |
| `/recipient/:recipientId/received` | Confirmed receipt history |
| `/recipient/:recipientId/impact` | Recipient impact |

Seeded recipient IDs include `hope-shelter`, `community-kitchen`, and
`neighborhood-kitchen`.

## Screenshots

The numbered full-page PNGs are in [`screenshots/`](screenshots/). The
[screenshot index](screenshots/README.md) lists each screen and state; the
images are ready to insert into a presentation or Google Doc.

## Current implementation and planned integrations

**Implemented:** Responsive React, TypeScript, and Vite frontend; donor and
recipient journeys; typed synthetic data; in-memory demo interactions; and
reduced-motion-aware UI transitions.

**Planned in the locked architecture, not connected in this demo:** Firebase
Authentication, a Python FastAPI service on Google Cloud Run, Firestore and
Cloud Storage, Gemini through Vertex AI, Cloud Tasks for offer expiry/relay,
and Google Maps Routes API. The frontend demo must not be presented as live
AI analysis, routing, authentication, or real community impact.

## Team ownership

- **Frontend owner:** React application, role-based screens, responsive and
  accessible interactions, API client, and frontend integration.
- **Backend owner:** OpenAPI contract, authentication and authorization,
  persistence, AI analysis, readiness and route evaluation, offer relay,
  receipt validation, and impact aggregation.

The API contract and integration gates are documented in
[FINAL_SPEC.md](FINAL_SPEC.md).

## Product safety and impact rules

- Donors confirm the food details and donor-entered cutoff.
- Image analysis cannot establish edibility, temperature history, or safe
  expiry.
- Readiness must be established before offers are started.
- Matches and offers are not counted as rescues; only recipient-confirmed
  quantities contribute to impact.
- Synthetic organizations, forecasts, and outcomes must remain labeled as
  demonstration data.

For frontend-specific setup and demo limitations, see
[frontend/README.md](frontend/README.md).
