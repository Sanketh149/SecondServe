# SecondServe — Locked Product & Build Specification

**Version:** 1.0  
**Status:** Locked for implementation  
**Locked:** October 5, 2026  
**Competition:** AI Builder Cup 2026  
**Team:** 2 people — Frontend owner and Backend/AI owner  
**Submission deadline:** October 18, 2026  
**Target challenge:** Sustainability & Social Impact  
**Primary cloud:** Google Cloud  

This is the shared source of truth for both developers and their coding agents. The five approved signature features in Section 5 are committed scope, not optional additions. If implementation details are unclear, follow the API and acceptance criteria here rather than inventing a second contract.

---

## 1. Competition Requirements and Judging Fit

The official AI Builder Cup site lists **Sustainability & Social Impact** as a challenge theme. Its published judging rubric is:

| Judging area | Weight | What SecondServe must demonstrate |
|---|---:|---|
| Technical Merit & GenAI Implementation | 40% | A working end-to-end product on Google Cloud; Gemini used meaningfully for visual food understanding; secure, tested backend workflows. |
| Problem Alignment & Impact | 25% | A real surplus-to-need workflow; feasibility before recommendations; impact based on recipient-confirmed delivery rather than matches. |
| Innovation & Creativity | 25% | Time-bound rescue relay, split allocation, field-level AI provenance, and impact receipts. |
| User Experience & Solution Design | 10% | A clear, fast donor flow; understandable reasons; accessible status and error handling. |

Published submission requirements include a deployed working prototype, a public GitHub repository, a comprehensive presentation deck, and a demonstration video **under three minutes**. The rules require the solution to be built primarily on Google Cloud and use fresh code/assets produced within the event timeline.

The published timeline gives **October 18, 2026** as the prototype submission deadline. Registration and permitted roster changes close **October 11, 2026**. Teams may have 2–4 members, but members must meet the published eligibility requirements: age 21+, JAPAC residence, and not be students. The two-person team size is within the allowed range; each member must independently confirm eligibility and registration.

Official references:

- [AI Builder Cup overview and timeline](https://aibuildercup.com/)
- [Challenge themes and requirements](https://aibuildercup.com/themes.html)
- [Official terms, submission rules, and judging criteria](https://docs.google.com/document/d/e/2PACX-1vRm7ChZ6Ij9fG7uFDkxzUMpwgVeBmnQ6cMDnAIEEX84AiLBOOQ9cYbl3S5OzFBbcVb8TF55s-eVpiXb/pub)
- [Official FAQ](https://aibuildercup.com/Faqs.html)
- [Awards](https://aibuildercup.com/rewards.html)

The official awards page lists relevant categories including **Best use of Google Cloud AI tools**, **Most Impactful Solution**, and **Social Choice Award**. Product claims, demo content, and the deck must accurately distinguish real, seeded, and estimated data.

---

## 2. Product Definition

### Product statement

> **SecondServe turns surplus into a feasible, time-bound rescue: it understands the food, allocates it to recipients who can use it, relays unanswered offers, and counts only recipient-confirmed deliveries as rescued.**

SecondServe is a web application for food businesses and community organizations. It is not a food-safety authority, food bank CRM, or fleet-tracking platform.

### The problem

Businesses can have usable surplus while nearby organizations have unmet need. A simple directory or nearest-recipient result does not answer:

1. What is available, and which details still need human confirmation?
2. Which recipients can accept the food and receive it before the donor-entered cutoff?
3. What happens if the first recipient cannot accept the offer?
4. Can a quantity that is too large for one recipient be divided safely?
5. How much food was actually received, rather than merely matched?

### User roles

- **Donor:** A restaurant, bakery, cafeteria, hotel, or other food business that creates and tracks a donation.
- **Recipient:** A shelter, pantry, community kitchen, or nonprofit that maintains its capacity, demand, hours, food preferences, and active offers.
- **Demo administrator:** Seeds/resets the demo dataset and monitors the prototype. Admin-only actions must not be exposed to ordinary users.

---

## 3. Product and Safety Rules

These rules apply to the UI, API, AI prompts, matching logic, demo, and pitch:

1. **AI suggestions are not confirmed facts.** The donor reviews and confirms every value used to create a donation. Visual confidence is shown per field where available.
2. **An image cannot establish food safety.** Gemini must not certify edibility, temperature history, legal eligibility, or a safe expiry time. The donor supplies and confirms preparation time, storage condition, pickup availability, and `usableUntil`.
3. **Never invent ingredients or allergens.** AI-identified potential allergens are unverified suggestions. The donor must confirm known allergens or mark them unknown. A recipient with allergen restrictions cannot be marked compatible while relevant allergen information remains unknown.
4. **Feasibility precedes ranking.** Do not recommend a recipient that fails category/dietary restrictions, available capacity, opening hours, or estimated arrival before the donor-confirmed cutoff.
5. **Unknown route is not a successful feasibility check.** If a reliable route estimate cannot be obtained, show readiness as unknown and do not start automatic offers for that plan.
6. **Matches are not rescues.** Meals/units count as rescued only after a recipient submits a valid receipt. Show offered, accepted, and received amounts separately.
7. **Synthetic demo data is labelled.** Do not present seeded organizations, forecast examples, or demo deliveries as real community impact.
8. **No speculative environmental claims.** Do not show carbon, water, or landfill savings without a clearly sourced calculation and assumptions. They are not required for this submission.

---

## 4. Locked Product Scope

The prototype must provide one complete, reliable path:

```text
Sign in
  → upload food photo
  → review AI Food Passport
  → donor confirms details and usable-until time
  → compute feasible rescue plan
  → split one homogeneous lot across at most two recipients when useful
  → send time-limited offers with automatic fallback
  → hand off food and submit recipient-confirmed receipt
  → show verified rescued quantity and event timeline
```

The scope is deliberately bounded so two developers can finish and demonstrate it:

- Web app only; responsive desktop/tablet/mobile layout.
- One donation is one homogeneous lot with an integer quantity and unit (for example, 32 meals). The AI may suggest multiple visible foods, but the donor selects one homogeneous lot for this workflow. Multiple lots are separate donations.
- A rescue plan contains at most **two recipient stops**.
- A split must conserve quantity exactly; no unit can be assigned twice or disappear from the plan.
- A recipient gets one active offer at a time for a donation. Relay is sequential and idempotent.
- Seeded recipient and historical data supports a believable demonstration. Production-scale onboarding or a real-world operational network is not claimed.
- A simple recurring-opportunity card is included only where the seeded dataset supports it; it uses a documented baseline, not a trained predictive model.

The following are not part of this submission: native apps, real-time driver tracking, payments, SMS/WhatsApp, a general-purpose AI chat assistant, voice donation entry, custom model training, complex multi-vehicle optimization, public recipient discovery, or unsubstantiated environmental-impact estimates.

---

## 5. Locked Signature Features

### 5.1 AI Food Passport

**Purpose:** Make multimodal AI useful and reviewable rather than presenting an opaque AI answer.

1. Donor uploads a food image.
2. Backend validates the file and sends it to Gemini through Vertex AI with a structured-output prompt.
3. API returns suggestions with field-level provenance and confidence:
   - `AI_SUGGESTED`: inferred from the image.
   - `DONOR_CONFIRMED`: explicitly accepted or edited by the donor.
   - `UNKNOWN`: not supplied or not confidently inferred.
4. The UI makes the donor confirm the primary item, category, quantity, unit, dietary tags, known allergens, preparation time, storage condition, pickup availability, and `usableUntil`.
5. AI may suggest visible packaging and potential allergens, but neither is treated as verified until the donor confirms it.
6. If image analysis fails, the donor can continue with manual entry. The UI must clearly say that analysis did not succeed; it must not show a success-shaped fallback.

**Frontend owner:** Upload, progress/error states, field provenance, confidence indicators, correction/confirmation form, manual-entry path.  
**Backend owner:** Image validation, Vertex AI call, response validation, prompt, field provenance, analysis persistence/expiry, rate and size limits.

### 5.2 Rescue Readiness Check

**Purpose:** Prevent an attractive score from hiding an impossible rescue.

For each candidate recipient, backend first applies hard checks:

- Recipient is active and has a valid location.
- Donation category is accepted.
- Confirmed dietary/allergen constraints are compatible.
- Recipient has capacity and unmet demand for the proposed allocation.
- Recipient is open at the estimated arrival time.
- Estimated route/arrival is before donor-confirmed `usableUntil`.

Each candidate is returned as `READY`, `BLOCKED`, or `UNKNOWN`, with specific reason codes. Only `READY` candidates can receive automatic offers. A blocked candidate can be visible in a “not feasible” explanation list but must not be presented as a recommended match.

For a plan, rank in this order:

1. Maximize the number of donor-confirmed units that can be delivered.
2. Maximize the amount-weighted unmet-need fit.
3. Prefer more deadline headroom and better recipient-confirmed completion history.
4. Use estimated total route time as the final tie-breaker.

This order deliberately prioritizes need and successful rescue over proximity. It replaces the draft's opaque weighted sum of overlapping factors. Return component values and reason codes so the frontend can explain the result without asking an LLM to invent a rationale.

**Frontend owner:** Readiness badge, ranked plan cards, map, route/ETA, clear “why this plan” and “why not this recipient” explanations.  
**Backend owner:** Eligibility rules, readiness reasons, route feasibility, plan ranking, deterministic explanation data, tests for every hard check.

### 5.3 Split the Batch

**Purpose:** Rescue a homogeneous donation lot when one recipient cannot use the whole quantity.

- Find a full single-recipient allocation if possible.
- Otherwise, evaluate plans assigning the quantity to two distinct `READY` recipients, respecting each recipient's unmet demand and remaining capacity.
- A plan may be `FULL`, `PARTIAL`, or `NONE`; it always reports `allocatedQuantity` and `unallocatedQuantity`.
- The plan must satisfy:

```text
sum(allocation.quantity) + unallocatedQuantity = donation.quantity
```

- Each proposed allocation must be a positive integer. The sum assigned to a recipient cannot exceed the recipient's eligible capacity or unmet demand.
- Evaluate both possible stop orders for two-recipient routes. If either ordering works, choose the best feasible total route.
- Display each recipient, allocated quantity, need, route stop order, and remaining unallocated quantity before the donor starts offers.
- Donor explicitly starts the plan. No recipient is contacted merely because a preview was calculated.

**Frontend owner:** Allocation preview, stop order/map, totals, partial-plan warning, donor confirmation.  
**Backend owner:** Bounded one/two-recipient allocation planner, route checks, quantity invariants, plan persistence.

### 5.4 Rescue Relay

**Purpose:** Prevent a donation from stalling at the first recipient.

- Each allocation has a ranked list of eligible candidates.
- Only one offer is active at a time for a donation. The initial offer is sent to the highest-ranked available candidate.
- Each offer expires after **5 minutes** by default; TTL is configuration, not a frontend constant.
- A recipient can accept or decline. A decline immediately advances that allocation to the next still-feasible candidate.
- A timeout advances it using a Cloud Tasks scheduled callback. If no fallback remains, the allocation becomes `UNASSIGNED` and the donor sees why. The product must not imply that an unassigned amount has been rescued.
- Recheck the donation cutoff, recipient capacity, hours, demand, and route feasibility before every fallback offer.
- Offers are sequential across allocation legs as well: after the active leg is accepted or exhausted, start the next planned leg. This avoids duplicate capacity reservations and keeps relay behavior understandable.
- State transitions and task callbacks must be idempotent. Accept/decline/timeout races are resolved by a Firestore transaction; only one transition wins.
- The demo can show the relay with a recipient declining; it does not need to wait five minutes for a timeout.

**Frontend owner:** Recipient offer inbox, countdown, accept/decline, donor relay timeline, pending/failed/fallback states.  
**Backend owner:** Offer state machine, TTL configuration, Cloud Tasks integration, capacity reservations, fallback selection, transactional/idempotent transitions.

### 5.5 Recipient-Confirmed Rescue Receipt

**Purpose:** Make impact numbers traceable to delivered food rather than intent.

- When an offer is accepted, backend issues a one-time handoff code and exposes it only to the donor for sharing at handoff.
- Recipient submits the code and the quantity actually received.
- Backend validates the code, recipient authorization, allocation state, one-time use, and `0 <= quantityReceived <= allocation.quantity`.
- The receipt records donor/recipient, allocation, amount, timestamp, and optional exception reason.
- A receipt is called **recipient-confirmed**, not independently audited proof.
- Only the confirmed received quantity increments the rescued-meals/units metric. A match, acceptance, planned amount, or unconfirmed handoff never increments it.
- If received quantity is below the allocation, record the shortfall as not rescued. Do not silently count it or automatically extend a donor-confirmed cutoff.
- Receipt submission is idempotent; retries must not double-count impact.

**Frontend owner:** Donor handoff-code view; recipient receipt form; receipt result; verified-impact dashboard and history.  
**Backend owner:** Secure one-time code lifecycle, receipt validation, append-only event, idempotent aggregate update, impact queries.

---

## 6. Main User Flows and Screens

### Donor flow

1. **Sign-in / role entry:** Firebase Authentication; role is read from the backend profile.
2. **Donor dashboard:** Active donations, next actions, confirmed meals rescued, and a seeded recurring-opportunity card where data supports it.
3. **Create donation:** Upload photo or continue manually.
4. **Food Passport:** Review AI suggestions and explicitly confirm/edit fields.
5. **Donation details:** Confirm pickup availability, donor-entered usable-until time, storage condition, and location.
6. **Rescue plan:** View readiness, one- or two-recipient allocation, explanation, route and ETA, and any quantity that cannot currently be placed.
7. **Start rescue:** Explicit action starts the first offer.
8. **Tracking:** Read-only event timeline with active recipient, response countdown, relay attempts, accepted allocation(s), and route.
9. **Handoff:** Show the one-time code to share with recipient.
10. **Impact:** Show recipient-confirmed quantities, outstanding/unassigned quantity, and history.

### Recipient flow

1. Sign in and load the recipient organization.
2. See active offer, quantity, food details, cutoff, and route/arrival estimate.
3. Accept or decline with an optional reason.
4. For accepted food, enter the donor's one-time handoff code and actual quantity received.
5. See receipt confirmation and updated demand/capacity.

### Demo administrator

- Seed/reset only synthetic demo data through a restricted admin command or demo-only endpoint.
- Do not allow ordinary users to reset data or edit other organizations.
- Do not seed real people's contact details or claim seeded recipient activity is real.

---

## 7. Shared Data and API Contract

### Contract rules

- All API paths start with `/api/v1`.
- JSON field names are **camelCase**. Backend Python may use snake_case internally, with Pydantic aliases at the boundary.
- All timestamps are RFC 3339 UTC strings, e.g. `2026-10-05T12:30:00Z`.
- IDs are opaque strings. The client must not construct Firestore paths or use client-supplied organization IDs as authorization.
- Quantities are positive integers; units are explicit strings. MVP demo unit: `meals`.
- Any displayed score uses `0–100`; confidence and normalized fit ratios use `0–1`.
- API errors use the same shape:

```json
{
  "error": {
    "code": "ROUTE_UNAVAILABLE",
    "message": "A reliable route could not be calculated. No offer was started.",
    "details": {},
    "requestId": "req_123"
  }
}
```

- Backend owns and publishes `contracts/openapi.yaml` before parallel feature coding. Frontend uses that contract and must not invent endpoint names or response fields.

### Core endpoints

| Method and path | Purpose | Access |
|---|---|---|
| `GET /api/v1/health` | Liveness/readiness for deployment checks; no secrets in response. | Public |
| `GET /api/v1/me` | Resolve authenticated user, role, and organization. | Authenticated |
| `POST /api/v1/donations/analyze` | Multipart image upload and AI Food Passport suggestions. | Donor |
| `POST /api/v1/donations` | Create a donation from donor-confirmed fields and an optional analysis ID. | Donor |
| `GET /api/v1/donations` | List current donor's donations. | Donor |
| `GET /api/v1/donations/{donationId}` | Donation, current plan/allocations, and ordered event timeline. | Owner/assigned recipient |
| `POST /api/v1/donations/{donationId}/rescue-plan` | Calculate and persist a plan preview; sends no offers. | Donor |
| `POST /api/v1/rescue-plans/{planId}/start` | Start the first eligible offer. | Donor |
| `GET /api/v1/recipients/me/offers` | Recipient's active and recent offers. | Recipient |
| `POST /api/v1/offers/{offerId}/response` | Accept or decline an active offer. | Target recipient |
| `POST /api/v1/allocations/{allocationId}/receipt` | Submit a recipient-confirmed handoff receipt. | Target recipient |
| `GET /api/v1/impact/summary` | Confirmed impact totals for the caller's organization. | Authenticated |
| `GET /api/v1/forecast/opportunities` | Simple seeded-data opportunity preview, if sufficient history exists. | Donor/recipient |

Cloud Tasks invokes an internal, authenticated offer-expiration handler. It is not a public frontend endpoint.

### AI analysis response

```json
{
  "analysisId": "an_123",
  "expiresAt": "2026-10-05T12:45:00Z",
  "candidate": {
    "name": {
      "value": "Vegetarian pasta meal",
      "source": "AI_SUGGESTED",
      "confidence": 0.91
    },
    "category": {
      "value": "prepared_meal",
      "source": "AI_SUGGESTED",
      "confidence": 0.88
    },
    "visiblePackaging": {
      "value": "sealed_container",
      "source": "AI_SUGGESTED",
      "confidence": 0.76
    },
    "dietaryTags": {
      "value": ["vegetarian"],
      "source": "AI_SUGGESTED",
      "confidence": 0.72
    },
    "potentialAllergens": {
      "value": ["wheat", "dairy"],
      "source": "AI_SUGGESTED",
      "confidence": 0.64
    },
    "quantitySuggestion": {
      "value": null,
      "source": "UNKNOWN",
      "confidence": 0.0
    }
  },
  "requiredDonorConfirmations": [
    "name",
    "category",
    "quantity",
    "unit",
    "allergenStatus",
    "preparedAt",
    "storageCondition",
    "pickupAvailableAt",
    "usableUntil"
  ],
  "safetyNotice": "Visual analysis does not determine food safety or confirm ingredients."
}
```

An absent or uncertain quantity is `null`, not an invented estimate.

### Donation creation request

```json
{
  "analysisId": "an_123",
  "itemName": "Vegetarian pasta meal",
  "category": "prepared_meal",
  "quantity": 32,
  "unit": "meals",
  "dietaryTags": ["vegetarian"],
  "declaredAllergens": ["wheat", "dairy"],
  "allergenStatus": "DONOR_CONFIRMED",
  "preparedAt": "2026-10-05T11:00:00Z",
  "storageCondition": "refrigerated",
  "pickupAvailableAt": "2026-10-05T12:00:00Z",
  "usableUntil": "2026-10-05T16:00:00Z"
}
```

Allowed `allergenStatus`: `DONOR_CONFIRMED`, `UNKNOWN`, `NOT_APPLICABLE`. `usableUntil` is supplied by the donor and is not generated by AI.

### Rescue plan response

```json
{
  "planId": "rp_123",
  "status": "FULL",
  "donationId": "dn_123",
  "donationQuantity": 32,
  "allocatedQuantity": 32,
  "unallocatedQuantity": 0,
  "allocations": [
    {
      "allocationId": "al_1",
      "recipientId": "rcp_1",
      "recipientName": "Hope Shelter",
      "quantity": 24,
      "readiness": "READY",
      "estimatedArrivalAt": "2026-10-05T12:15:00Z",
      "needFit": 1.0,
      "reasonCodes": ["HIGH_UNMET_NEED", "CAPACITY_FITS", "OPEN_AT_ARRIVAL", "ARRIVES_BEFORE_CUTOFF"],
      "fallbackCandidates": [
        {
          "recipientId": "rcp_4",
          "recipientName": "Community Pantry",
          "readiness": "READY"
        }
      ]
    },
    {
      "allocationId": "al_2",
      "recipientId": "rcp_2",
      "recipientName": "Community Kitchen",
      "quantity": 8,
      "readiness": "READY",
      "estimatedArrivalAt": "2026-10-05T12:25:00Z",
      "needFit": 1.0,
      "reasonCodes": ["HIGH_UNMET_NEED", "CAPACITY_FITS", "OPEN_AT_ARRIVAL", "ARRIVES_BEFORE_CUTOFF"]
    }
  ],
  "route": {
    "orderedRecipientIds": ["rcp_1", "rcp_2"],
    "distanceMeters": 8400,
    "durationSeconds": 1500,
    "provider": "GOOGLE_ROUTES"
  },
  "notReadyCandidates": [
    {
      "recipientId": "rcp_3",
      "recipientName": "Nearby Food Bank",
      "readiness": "BLOCKED",
      "reasonCodes": ["INSUFFICIENT_UNMET_NEED"]
    }
  ],
  "createdAt": "2026-10-05T12:00:00Z"
}
```

`status` is `FULL`, `PARTIAL`, `NONE`, or `UNKNOWN`. A `NONE`/`UNKNOWN` plan cannot be started.

### Offer response and receipt

Accept/decline request:

```json
{
  "decision": "DECLINE",
  "reason": "No pickup capacity before cutoff"
}
```

Receipt request:

```json
{
  "handoffCode": "482916",
  "quantityReceived": 24,
  "exceptionReason": null
}
```

The receipt response includes `receiptId`, `confirmedQuantity`, `confirmedAt`, updated allocation/donation statuses, and the impact totals. It must never include the stored handoff-code hash.

---

## 8. Data Model and Lifecycle

### Firestore collections

- `users/{uid}` — role, organization ID, display name. Role changes are admin-only.
- `organizations/{organizationId}` — donor profile and location.
- `recipients/{recipientId}` — location, hours/time zone, capacity, unmet demand, accepted categories/dietary tags, allergen restrictions, active status, and recipient-confirmed delivery history.
- `analyses/{analysisId}` — owner, image object path, validated AI suggestions, expiry, and confirmation state.
- `donations/{donationId}` — donor-confirmed homogeneous lot details, status, cutoff, and current plan ID.
- `rescuePlans/{planId}` — preview status, allocations, route, ranked candidates, and creation time.
- `offers/{offerId}` — allocation, recipient, status, expiry, and transition metadata.
- `allocations/{allocationId}` — planned quantity, confirmed quantity, active candidate index, and status.
- `donations/{donationId}/events/{eventId}` — append-only timeline events with actor, event type, timestamp, and safe display payload.
- `receipts/{receiptId}` — allocation, authorized recipient, confirmed quantity, timestamp, and one-time handoff-code hash reference.

### Statuses

Donation: `OPEN`, `PLANNED`, `OFFERING`, `PARTIALLY_ACCEPTED`, `ACCEPTED`, `IN_PROGRESS`, `RESCUED`, `PARTIALLY_RESCUED`, `EXPIRED`, `CANCELLED`.

Offer: `PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `CANCELLED`.

Allocation: `PLANNED`, `OFFERING`, `ACCEPTED`, `DELIVERED`, `UNASSIGNED`, `EXPIRED`, `CANCELLED`.

All state changes are performed by the backend and appended to the event timeline. The client may request a transition but cannot write a status directly.

Normal progression is `OPEN → PLANNED → OFFERING → ACCEPTED/PARTIALLY_ACCEPTED → IN_PROGRESS → RESCUED/PARTIALLY_RESCUED`. `RESCUED` means the full donor-confirmed quantity has recipient-confirmed receipts. `PARTIALLY_RESCUED` means at least one unit was received but no further feasible offer can be made for the remaining amount. `EXPIRED` means the cutoff passed with zero confirmed units and no active offer.

Recipient capacity is reserved transactionally when an offer starts. Decline/expiry releases the reservation; acceptance keeps it reserved until receipt or cancellation. On receipt, decrease unmet demand and capacity by the confirmed quantity, release any unreceived remainder, and write the receipt/event exactly once. Before each offer, recompute available capacity and demand to account for other concurrent donations.

---

## 9. Locked Technical Architecture

### Frontend

- React, TypeScript, Vite, and the existing agreed styling/component system.
- Firebase Authentication for sign-in.
- Google Maps JavaScript API for the map and route display.
- Typed API client; every request includes the Firebase ID token.
- No direct Firestore writes for donations, offers, plans, receipts, or impact counters.

Suggested structure:

```text
frontend/src/
  app/
  components/
  features/
    auth/
    dashboard/
    donations/
    food-passport/
    rescue-plan/
    recipient-offers/
    receipts/
    impact/
  services/apiClient.ts
  types/
```

### Backend

- Python FastAPI on Google Cloud Run.
- Pydantic request/response validation.
- Firebase Admin SDK verifies ID tokens and resolves roles.
- Cloud Firestore for application data and transactions.
- Cloud Storage for images, with temporary-image expiry/lifecycle policy.
- Gemini through Vertex AI for image understanding and structured extraction.
- Cloud Tasks for time-limited offer expiry and relay.
- Google Maps Routes API for bounded route evaluation.

Suggested structure:

```text
backend/app/
  api/
  services/
    auth_service.py
    gemini_service.py
    matching_service.py
    route_service.py
    offer_service.py
    receipt_service.py
    impact_service.py
  models/
  prompts/
  config.py
backend/tests/
backend/scripts/seed_demo.py
contracts/openapi.yaml
```

### Route planning limits

- First filter recipients and use a cheap geographic prefilter.
- Compare one-stop plans and bounded two-stop plans from the eligible candidate set.
- Use Google Routes API for the best few candidate plans and both stop orders, not for every possible permutation.
- Cache route responses briefly by origin, destination sequence, and travel mode.
- If Google Routes fails, return `UNKNOWN` readiness for affected plans and do not start offers.

### Simple opportunity preview

The donor dashboard may show the next recurring surplus/demand opportunity using the seeded history only. Use a transparent same-weekday baseline (up to the last four matching observations) and return sample size and source. Do not train an ML model or present synthetic-data forecasts as real. If fewer than four observations exist, return `insufficientHistory` and omit the forecast card.

---

## 10. Frontend and Backend Ownership

### Frontend developer / frontend agent owns

- React/TypeScript app shell, routing, role-based screens, and responsive styling.
- Firebase sign-in and secure token attachment to API calls.
- Donor dashboard and all donor screens.
- AI Food Passport review/edit/confirmation interactions.
- Rescue readiness, split allocation preview, map and route display.
- Recipient offer inbox and accept/decline UI.
- Handoff-code sharing and recipient receipt entry.
- Verified impact display and donation event timeline.
- Loading, empty, validation, permission, and failure states.
- Frontend tests and deployed frontend.

### Backend developer / backend agent owns

- OpenAPI contract and backend scaffold.
- Firebase token verification, role/organization authorization, and Firestore security posture.
- Firestore and Cloud Storage models/operations.
- Vertex AI Gemini prompt, structured extraction, validation, error handling, and analysis persistence.
- Readiness rules, plan generation, quantity invariants, deterministic reason codes, and route evaluation.
- Offer state machine, Cloud Tasks expiry, sequential relay, transaction/idempotency behavior.
- Handoff code generation/validation, recipient-confirmed receipts, and impact aggregation.
- Seed data and repeatable seed/reset workflow.
- Backend tests, Cloud Run deployment, secrets/configuration, logs, and health checks.

### Shared ownership and integration gates

- **Before parallel feature coding:** Backend publishes `contracts/openapi.yaml`; both developers agree on field names, status enums, error codes, and demo accounts.
- **At every integration:** Frontend uses the deployed or local API contract; backend does not change response shape without updating OpenAPI and telling frontend owner.
- **Frontend must not** recreate matching, safety, expiry, authorization, or impact calculations.
- **Backend must not** return Gemini free text as the only source of truth for readiness or explanations.
- Both developers own an end-to-end smoke test, the public README/deck/video content, and the final submission check.

---

## 11. Repository and Configuration

Recommended layout:

```text
secondserve/
  FINAL_SPEC.md
  frontend/
  backend/
  contracts/
    openapi.yaml
  data/
    demo/
  README.md
```

Frontend configuration:

```text
VITE_API_BASE_URL=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_GOOGLE_MAPS_API_KEY=
```

Backend configuration:

```text
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_REGION=
FIRESTORE_DATABASE=
GCS_BUCKET=
VERTEX_AI_LOCATION=
GEMINI_MODEL=
GOOGLE_MAPS_API_KEY=
CLOUD_TASKS_QUEUE=
CLOUD_TASKS_SERVICE_ACCOUNT=
FRONTEND_ORIGIN=
OFFER_TTL_MINUTES=5
MAX_UPLOAD_BYTES=5242880
```

Use Cloud Run service identity / Application Default Credentials and Secret Manager for backend secrets. Frontend Firebase and browser Maps keys are public by design but must be restricted to the deployed domain and required APIs. Never commit service account keys, API secrets, user data, or credentials.

---

## 12. Security, Privacy, and Error Behavior

- Verify Firebase ID token on every protected endpoint; authorize against server-side user/organization data.
- Donors can read and mutate only their organization's donations. Recipients can read only their offers and submit their receipts. Admin actions are restricted.
- Validate image MIME/content and size server-side; reject unsupported or oversized files with a visible error.
- Do not log image bytes, auth tokens, handoff codes, or personal data. Store only the minimum profile data needed for the demo.
- Rate-limit costly image analysis per authenticated user. Deduplicate repeat image analysis by a server-computed image hash when safe.
- Configure CORS for the actual frontend origin. Use least-privilege service accounts and restricted API keys.
- Delete staged/unconfirmed images after 24 hours and apply a retention lifecycle to confirmed demo images (maximum 30 days unless the organizer's submission requirements require otherwise).
- Validate Gemini output against a strict schema. Retry one time on schema failure; if the retry fails, return an explicit analysis error and allow manual entry.
- If there is no feasible recipient, show `NONE` with reasons. Do not start offers or label the donation rescued.
- If a Cloud Task cannot be scheduled, report a relay setup error and do not present an active timed offer.
- If a route is unavailable, show the route failure and `UNKNOWN` readiness; do not silently substitute straight-line distance as driving time.
- All write endpoints use idempotency/version checks where retries or concurrent responses could double-apply a transition.

---

## 13. Demo Dataset and Three-Minute Demo

Use clearly labelled synthetic records in one compact demo district.

### Scenario

- Donor: **Green Leaf Kitchen**
- Donation: **32 donor-confirmed vegetarian meals**, with confirmed preparation/storage/cutoff fields.
- Candidate A: nearby food bank with capacity or unmet demand for only a small portion.
- Candidate B: Hope Shelter with meaningful unmet demand and capacity for a larger portion.
- Candidate C: Community Kitchen with capacity for the remaining portion.
- Expected plan: a full two-recipient allocation (for example, 24 + 8 meals) with a feasible two-stop route; exact seeded values must be consistent with hours and ETAs.
- One test/demo recipient declines, causing the active allocation to relay to the next feasible recipient.
- Recipient enters the handoff code and confirms the actual quantity received. The impact total changes only after receipt.

Do not hardcode a claimed score such as “91” unless the live algorithm actually computes that value from the displayed data. Prefer showing full quantity covered, unmet-need fit, route time, and clear reason codes.

### Video run of show (target: 2:40, hard maximum: under 3:00)

1. **0:00–0:20 — Problem:** Surplus is time-sensitive; nearest does not always mean useful.
2. **0:20–0:50 — AI Food Passport:** Upload image; show inferred vs donor-confirmed fields and uncertainty.
3. **0:50–1:20 — Rescue Readiness + Split the Batch:** Show why the nearest candidate is not the best feasible plan and how the lot is divided.
4. **1:20–1:50 — Rescue Relay:** First offer declined; the next candidate receives the offer with a visible timeline.
5. **1:50–2:15 — Receipt + impact:** Recipient confirms amount; dashboard counts only that confirmed amount.
6. **2:15–2:40 — Google Cloud and business case:** Briefly show Gemini/Vertex AI, Cloud Run, Firestore, Cloud Tasks, and the impact opportunity.

Record a backup video from the deployed URL. Avoid relying on live AI or Maps responses for every demo step; prepare deterministic demo data and a tested upload while retaining a visible fallback path.

---

## 14. Ten-Day Build and Submission Plan

The dates below reserve the final days for judging artifacts and submission. The October 18 deadline is authoritative.

| Build day | Frontend owner | Backend owner | Exit condition |
|---|---|---|---|
| 1 | App shell, Firebase auth shell, routes, API client setup. | GCP/Firebase setup, FastAPI skeleton, OpenAPI contract, auth verification. | Both run locally; FE can call authenticated `/me`. |
| 2 | Donation wizard shell and upload states. | Image validation, Vertex AI analysis, schema and error behavior. | Image returns a typed Food Passport. |
| 3 | Food Passport review/correction and confirmation. | Analysis persistence/expiry, donation creation and ownership. | Donor can create a confirmed donation. |
| 4 | Donor dashboard and recipient seed screens. | Recipient/donation models, seed script, readiness checks and reason codes. | Feasible and blocked candidates are correct in tests. |
| 5 | Rescue plan UI, split allocation, map layout. | Plan generation, quantity invariants, Routes API for bounded candidate plans. | One- and two-recipient plans conserve quantity and obey cutoff. |
| 6 | Recipient offer inbox, countdown and relay timeline. | Offer state machine, Cloud Tasks expiry, fallback and race/idempotency tests. | Decline immediately relays; timeout path is scheduled. |
| 7 | Handoff code and receipt forms; impact UI. | Code issuance/validation, receipt persistence and idempotent impact totals. | Only receipt-confirmed units count. |
| 8 | Responsive/accessibility polish; seeded forecast card. | Forecast baseline, error hardening, seed/demo reset, operational logs. | Complete happy path works against seeded data. |
| 9 | Frontend integration/e2e run, fix critical UI defects. | Backend integration/security tests, Cloud Run deployment. | Deployed end-to-end path works with fresh sign-in. |
| 10 | Final visual pass; record demo and prepare screenshots. | Production configuration, API health, seed consistency, backend fixes. | Freeze feature scope; only fix defects after this point. |

Reserve October 16–18 for final recording, deck/README checks, submission upload, and contingency. No new product features after the freeze.

---

## 15. Definition of Done

### Product

- [ ] Donor can sign in and is authorized to use only their own organization.
- [ ] Photo analysis returns schema-valid suggestions or an explicit error/manual-entry option.
- [ ] Donor can correct and confirm every donation fact used for matching.
- [ ] The system never claims image analysis certified safety or generated `usableUntil`.
- [ ] Readiness rejects incompatible, closed, over-capacity, and late-arriving candidates with reason codes.
- [ ] A full or partial plan supports one or two recipients and satisfies the quantity conservation invariant.
- [ ] No offers start from preview alone; donor explicitly starts the plan.
- [ ] Recipient can accept/decline; decline triggers the next still-feasible candidate.
- [ ] Timeout is scheduled, authorized, idempotent, and race-safe.
- [ ] Recipient can confirm receipt with a valid one-time handoff code.
- [ ] Impact totals count only receipt-confirmed quantities and cannot be double-counted.
- [ ] Seeded data and forecasts are clearly marked as demonstration data.

### Quality and deployment

- [ ] Frontend and backend run locally from documented commands.
- [ ] Backend unit tests cover AI validation, all readiness hard checks, plan conservation/capacity, relay transitions/races, and receipt idempotency.
- [ ] Frontend tests cover Food Passport review, plan preview, recipient response, and receipt submission.
- [ ] At least one end-to-end smoke test completes from donor sign-in to confirmed receipt.
- [ ] Cloud Run deployment, frontend URL, Firebase Auth, Firestore, Storage, Vertex AI, Maps, and Cloud Tasks are tested in the deployed environment.
- [ ] Errors, empty states, loading states, and narrow-screen layouts are present.
- [ ] Public GitHub repository contains source and setup documentation, but no credentials or private user data.
- [ ] Demo video is under 3 minutes; deck explains the problem, measurable impact, technical architecture, and business case.
- [ ] Each team member has checked official eligibility and registration; repository history and assets comply with the event's freshness and originality rules.

---

## 16. Final Positioning

Do not pitch SecondServe as “an AI app that finds a nearby food bank.” Pitch the complete operation:

> **SecondServe uses Google Cloud AI to turn a donor-confirmed surplus listing into a feasible rescue plan: it shows what AI inferred, splits the lot where needed, relays unanswered offers before the donor's cutoff, and measures only recipient-confirmed food received.**

The product's proof points are the working flows—not speculative model claims:

```text
Understand responsibly
  → prove readiness
  → allocate for unmet need
  → relay before time runs out
  → confirm what arrived
  → report verifiable impact
```

---

## 17. Locked UI/UX Design Direction

These choices were reviewed and approved before frontend implementation. The Figma prototype is the visual source of truth; the running app must follow its tokens, component states, and user flows.

### Brand and visual tone

- **Direction:** Modern civic tech—warm, human, trustworthy, operationally clear.
- **Theme:** Light-first.
- **Avoid:** Generic neon/AI gradients, glassmorphism, decorative motion that competes with the food-rescue task, and dashboard cards that do not support a real user decision.
- **Primary design goal:** Make the next safe, feasible rescue action obvious to a donor or recipient at a glance.

### Color tokens

| Token | Value | Use |
|---|---|---|
| `brand.primary` | `#245B45` | Primary buttons, active navigation, selected states, key actions. |
| `surface.canvas` | `#F7F6F0` | Main page background. |
| `surface.card` | `#FFFFFF` | Cards, dialogs, forms, and map overlays. |
| `text.primary` | `#1E2924` | Headings and body text. |
| `text.secondary` | `#57645C` | Supporting copy, labels, metadata. |
| `surface.sage` | `#DCEBE1` | Soft brand panels, selected allocation, secondary highlights. |
| `status.urgent.accent` | `#D99A32` | Urgency marker, countdown accent, warning icon; not small text on a light background. |
| `status.urgent.background` | `#FFF4D6` | Urgency badges and callouts. |
| `status.urgent.text` | `#6A4700` | Text/icons on urgency backgrounds. |
| `status.success.background` | `#E7F4EB` | Accepted, delivered, and confirmed surfaces. |
| `status.success.text` | `#245B45` | Text/icons on success backgrounds. |
| `status.error.background` | `#FEE4E2` | Error surfaces only. |
| `status.error.text` | `#B42318` | Error text/icons. |
| `border.default` | `#E3E7DF` | Card, input, and divider borders. |

Use accessible foreground/background pairs; do not encode readiness or donation status using color alone. Pair color with a label and, where useful, an icon. Red is reserved for genuine errors or destructive actions, not ordinary urgency.

### Typography and layout tokens

- **Headings:** Manrope, with a system sans-serif fallback.
- **Body and UI:** DM Sans, with a system sans-serif fallback.
- Use a restrained type scale: 12–14px metadata/labels, 14–16px body and controls, 20–24px section headings, 28–36px page titles.
- Use an 8px spacing rhythm. Keep forms and decision cards generous enough for quick scanning.
- Cards use a 1px neutral border, subtle shadow only when elevated, and approximately 14–16px corner radius. Buttons and fields use approximately 10–12px radius.
- The desktop app uses a stable left navigation and a focused content area. On mobile, navigation collapses without hiding the primary action, active status, or recipient response controls.

### Component and animation foundation

- **CSS/component foundation:** Tailwind CSS + shadcn/ui, themed with the tokens above. Components are copied/owned in the project and must be reviewed for accessible labels, focus behavior, and keyboard use.
- **Motion:** Motion for React (`motion/react`) for a small number of state-linked transitions. Use CSS transitions for simple hover/focus changes.
- Magic UI and Aceternity UI are inspiration/reference sources only; do not add either as a second component system or import decorative effects into core workflows.
- Motion should be purposeful: analysis progress reflects actual backend activity; allocation changes reveal the recalculated plan; relay transitions clearly identify the new active recipient; receipt confirmation gets one brief success moment.
- Keep normal interaction transitions around 160–240ms. No looping animations, autoplaying ambient backgrounds, or animation-only status cues.
- Respect the operating system's reduced-motion preference. Replace large movement/scale transitions with opacity or no motion while keeping the same status information visible.

### Role entry and navigation

The unauthenticated entry screen presents two explicit role paths:

- **I have surplus food — Donor**
- **I receive food — Recipient**

Each path leads into role-contextual sign-in/registration. The selected path is not authorization: after sign-in, the backend-resolved profile role controls access and navigation.

Donor navigation:

```text
Overview
Donations
Impact
Primary action: New donation
```

Recipient navigation:

```text
Offers
Capacity & needs
Received
Impact
```

The recipient interface must not show a donation-creation action. Show the two user journeys by signing into their distinct donor and recipient accounts; do not provide a client-side role switcher.

### Locked Figma prototype

Create a clickable Figma prototype before frontend screen implementation. It should be a time-boxed product-design artifact, not a long visual exploration:

1. Role entry / role-contextual sign-in.
2. Donor overview with a visible next action and active rescue status.
3. AI Food Passport with suggested vs donor-confirmed values, confidence/unknown states, and manual correction.
4. Rescue plan with readiness reasons, split quantities, route/ETA, and explicit start action.
5. Recipient offers screen showing accept/decline and active-offer countdown.
6. Donor relay/tracking and recipient-confirmed receipt states, including the impact change after receipt.

Prototype the main path across both roles:

```text
Role entry
  → Donor sign-in
  → Food Passport
  → Rescue plan
  → Start offers
  → Recipient sign-in
  → Accept/decline
  → Donor sees relay/tracking
  → Recipient submits receipt
  → Confirmed impact
```

The Figma handoff must include the token palette, typography, reusable button/input/status/card variants, loading/empty/error states, desktop and mobile behavior, and clickable links between the two role journeys. Once this is reviewed, implement the screens in React; do not build an unrelated marketing site or add more visual systems.
