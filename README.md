# SecondServe

SecondServe helps food businesses turn time-sensitive surplus into a feasible
rescue. Donors review and confirm food details, recipients are matched against
need and capacity, unanswered offers can be relayed, and only recipient-confirmed
handoffs count as rescued.

> **Prototype status:** The repository now includes a FastAPI backend and an
> optional frontend API mode. The local repository is still an in-memory demo
> backend: Firestore, Cloud Storage, deployed Firebase web auth, and a production
> service are not connected. Cloud Tasks scheduling is implemented but only
> activates when configured. Gemini and Google Routes call real Google Cloud
> services only when their backend credentials/configuration exist.

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

## Run the API-backed local demo

Requirements: Python 3.11+ and `uv` (or an equivalent virtual-environment tool).

```bash
cd backend
uv venv
uv pip install --python .venv/bin/python -r requirements.txt
cp .env.example .env
uv run --python .venv/bin/python uvicorn app.main:app --reload --port 8000
```

In another terminal, enable the API mode and launch the frontend:

```bash
cd frontend
cp .env.example .env.local
npm run dev
```

The backend defaults to seeded demo identities for this local flow. This mode
is not authentication and must not be enabled on a public deployment. Without
Vertex AI credentials/project configuration, food image analysis returns an
explicit error and allows manual entry. Without a Maps API key, route estimates
are synthetic and labeled as demo estimates.

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
recipient journeys; an optional typed FastAPI integration for food-image
analysis, plan preview/creation, offers, receipts, impact, and donation
tracking; in-memory backend demo records; Gemini via Vertex AI when configured;
Google Routes when configured; and reduced-motion-aware UI transitions.

**Still not production-integrated:** Firestore persistence, Cloud Storage image
retention/deletion, deployed Firebase user profile provisioning/authorization,
Google Cloud deployment, and a fully transactional offer/receipt state
machine. Cloud Tasks expiry scheduling and its OIDC-protected handler are
implemented but require deployment configuration and IAM setup. The current
backend repository is in-memory; data is lost on restart. Never present local
demo data as real community impact.

| Spec area | Implemented in this checkout | Remaining before production |
| --- | --- | --- |
| Food Passport / Gemini | Frontend uploads to FastAPI; Vertex AI Gemini produces structured suggestions and field confidence when configured. Manual entry remains available on errors. | Configure project and ADC; persist analyses/images with Cloud Storage retention; add deployed image-analysis smoke test. |
| Readiness / Split the Batch | Backend checks category, capacity, allergen restrictions, local opening hours, route estimate, cutoff, and at-most-two quantity allocation. Preview sends no offers. | Google Routes key for live estimates; persist plans and reservations in Firestore; add dietary compatibility policy where recipient profile semantics are finalized. |
| Rescue Relay | Offers are sequential; declines and configured Cloud Tasks expiry advance to a ready fallback or queued allocation. | Deploy queue/service account and IAM; use Firestore transactions for concurrency and durable/idempotent state across instances. |
| Receipt / impact | Backend validates a hashed one-time handoff code and positive received quantity; totals count only saved receipts. | Firestore persistence/transactions and deployed concurrency testing. |
| Authentication | Backend verifies Firebase ID tokens when demo mode is off; local API mode uses explicit seeded demo identities. | Firebase web sign-in, real user/org profile provisioning and persistent role/ownership data. |
| Hosting / storage | Local Vite and FastAPI setup documented. | Cloud Run deployment, Firestore, Cloud Storage lifecycle, secrets, monitoring, and production CORS configuration. |

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
