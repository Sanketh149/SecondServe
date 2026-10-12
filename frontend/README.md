# SecondServe frontend

Responsive React + TypeScript application for the SecondServe food-rescue flow.
Sign-in uses Firebase Authentication; application data is loaded through the
FastAPI API.

## Run locally

Create `frontend/.env.local` from `.env.example` and set the Firebase Web App
configuration values. Keep `VITE_API_BASE_URL` blank to use the Vite proxy to
`http://127.0.0.1:8000`.

```bash
npm ci
npm run dev
```

The API and Firebase project must be configured and running for authenticated
workspaces. Create a donor account and a recipient account through the UI;
their organization profiles and rescue activity are stored in Firestore.
There are no browser-only demo fallbacks or seeded sample records.
In local mode, the UI warns that automatic timeout callbacks are disabled;
an overdue response attempt still advances the offer relay. Production-like
environments block offer start until Cloud Tasks is configured.

Useful checks:

```bash
npm run build
npm run lint
```

The donor forecast uses saved donation history. It returns an insufficient
history state until enough real observations exist; it does not fill gaps with
fabricated examples. For Firebase, Firestore, Vertex AI, and local API setup,
see the root [README](../README.md).
