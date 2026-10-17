# SecondServe

SecondServe helps food businesses turn time-sensitive surplus into a feasible
rescue. Donors review and confirm food details, recipients are matched against
need and capacity, unanswered offers can be relayed, and only recipient-confirmed
handoffs count as rescued.

> **Integration status:** The React app uses Firebase Authentication and the
> FastAPI API; the deployed API uses Firestore, Cloud Storage, Vertex AI Gemini,
> Google Routes, and Cloud Tasks when configured. Cloud Run is deployed for the
> frontend and backend; Firebase Hosting is not used for the current deployment.
> The project is `secondserve-511317`; cloud API usage may incur charges.

## Deployment

The current prototype is deployed as two Cloud Run services in the
`secondserve-511317` GCP project, region `us-central1`:

- Frontend: `https://secondserve-frontend-6x3xgvzyca-uc.a.run.app`
- Backend API: `https://secondserve-backend-6x3xgvzyca-uc.a.run.app`

The frontend is a Vite production build served by Nginx. Its Firebase web
configuration and backend URL are baked into the static bundle at build time;
Firebase web configuration is public client configuration, not a server secret.
The backend receives runtime configuration through Cloud Run environment
variables. Sensitive values (`HANDOFF_ENCRYPTION_KEY` and
`GOOGLE_MAPS_API_KEY`) are mounted from Secret Manager, not copied into the
repository or container image. Firestore, Cloud Storage, Vertex AI, Google
Routes, and the Cloud Tasks offer-expiry queue use the configured runtime
service account.

Cloud Tasks expiry is configured as a deployment-dependent callback; local
development still reports that automatic expiry is unavailable.

## Product scope

The current prototype combines five safety-critical rescue capabilities with
history-based planning and network intelligence:

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
6. **Predictive planning** — forecast donor surplus and recipient-confirmed
   incoming meal patterns from real history; display insufficient-history states.
7. **AI Rescue Assistant** — answer operational questions from authenticated,
   role-scoped workspace records, without certifying food safety or promising
   routes and matches.
8. **Dynamic matching and pickup coordination** — re-evaluate pending rescues
   when recipient readiness changes; coordinate pickup-window acceptance,
   on-the-way/arrived status, and the one-time handoff in the app.
9. **Network insights** — recommend repeat partners from confirmed receipts,
   show coarse aggregated surplus/need heatmap cells, and use completed
   recipient outcomes as an explainable matching tie-breaker.
10. **Measured impact** — optionally record donor-reported total weight and
    attribute only the confirmed-meal proportion to received weight. No
    default meal-to-weight or carbon conversion is presented as measured fact.

See [FINAL_SPEC.md](FINAL_SPEC.md) for the locked requirements, safety rules,
API/data contracts, technical architecture, team ownership, and acceptance
criteria.

## Run locally

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

The app prints a local URL after the development server starts. Create or sign
in to a Firebase account, then register the donor or recipient organization.

Requirements: Python 3.11+, Node.js/npm, and Google Cloud CLI. The backend uses
Application Default Credentials for Google Cloud access; sign in with an
account that has the required project permissions.

```bash
gcloud auth application-default login

cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Set the project IDs, Google Maps key, and handoff-encryption key in
`backend/.env`. Keep `DEMO_MODE=false` and `DATA_BACKEND=firestore`. Use a local
Fernet key for handoff-code encryption:

```bash
cd backend
.venv/bin/python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Copy the generated key into `HANDOFF_ENCRYPTION_KEY`. Do not commit `.env`.

In another terminal, configure the Firebase Web App values in
`frontend/.env.local` (copy `frontend/.env.example`; leave
`VITE_API_BASE_URL` blank for the local Vite proxy) and start the frontend:

```bash
cd frontend
npm run dev
```

Create a donor account and at least one recipient account through the UI.
Profiles and food-rescue records are persisted in Firestore; no sample
organizations or impact records are seeded. Analysis and route feasibility
require the configured Vertex AI and Routes APIs. Offer response and
recipient-confirmed receipt can be exercised locally. Automatic timeout
callbacks are not scheduled without a deployed service URL; local offers
report that state, and the first response attempt after expiry advances the
relay. Non-local environments still require Cloud Tasks before an offer starts.
New donor workspaces receive a clearly identified built-in weekday planning
profile while real donation history is sparse. Forecasts recalculate from the
organization's own history once a weekday has at least four weekly observations;
the starting profile never creates fake donations or impact records.

## Application routes

| Route | Screen |
| --- | --- |
| `/` | Sign-in and account entry |
| `/create-account` | Create a Firebase account |
| `/onboarding` | Register an organization |
| `/donor/dashboard` | Donor overview and history-based forecast |
| `/donor/donations` | Donation history |
| `/donor/impact` | Donor impact |
| `/donor/new` | Three-step donation and rescue-plan flow |
| `/donor/donations/:donationId` | Rescue timeline and handoff status |
| `/recipient/:recipientId/offers` | Recipient offer inbox and receipt form |
| `/recipient/:recipientId/capacity` | Recipient capacity and needs |
| `/recipient/:recipientId/received` | Confirmed receipt history |
| `/recipient/:recipientId/impact` | Recipient impact |

## Screenshots

The numbered full-page PNGs are in [`screenshots/`](screenshots/). The
[screenshot index](screenshots/README.md) lists each screen and state; the
images are ready to insert into a presentation or Google Doc.

## Implementation status

The repository includes Firebase sign-in and organization onboarding, a
Firestore-backed API, Gemini food-image suggestions and grounded rescue
guidance, backend rescue-plan preview and dynamic offers, encrypted handoff
codes, pickup-status coordination, recipient-confirmed receipts, donor-surplus
and recipient-intake history forecasts, repeat-partner recommendations,
coarse network heatmaps, history-aware matching, donor-reported weight impact,
and GCS staging for analyzed images. Local
backend and frontend build/test checks are available below. Cloud Run and
Firebase Hosting deployment and Cloud Tasks expiry callbacks remain
separate verification/deployment steps. The prototype does not dispatch
third-party drivers or send SMS/push notifications.

## Team ownership

- **Frontend owner:** React application, role-based screens, responsive and
  accessible interactions, API client, and frontend integration.
- **Backend owner:** API contract, authentication and authorization,
  Firestore, AI analysis, readiness and route evaluation, offer relay,
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
- Do not seed synthetic organizations, forecasts, or outcomes into real
  workspaces or present fabricated activity as real community impact.

For frontend-specific setup and demo limitations, see
[frontend/README.md](frontend/README.md).
