# SecondServe

SecondServe helps food businesses turn time-sensitive surplus into a feasible
rescue. Donors review and confirm food details, recipients are matched against
need and capacity, unanswered offers can be relayed, and only recipient-confirmed
handoffs count as rescued.

> **Local integration status:** The React app uses Firebase Authentication and
> the FastAPI API; the API uses Firestore, Cloud Storage, Vertex AI Gemini, and
> Google Routes when configured. Cloud Run and Firebase Hosting have **not**
> been deployed. The current local backend configuration targets the
> `secondserve-511317` GCP project; cloud API usage may incur charges.

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
Firestore-backed API, Gemini food-image suggestions, backend rescue-plan
preview and offers, encrypted handoff codes, recipient-confirmed receipts,
history-based forecast responses, and GCS staging for analyzed images. Local
backend and frontend build/test checks are available below. Cloud Run and
Firebase Hosting deployment, Cloud Tasks expiry callbacks, and a fresh-user
end-to-end browser run remain separate verification/deployment steps.

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
