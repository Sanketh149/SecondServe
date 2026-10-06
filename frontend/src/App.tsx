import { ArrowLeft } from "lucide-react"
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
} from "react-router-dom"
import { DonorShell, RecipientShell } from "@/components/AppShell"
import { Button } from "@/components/ui/button"
import {
  DonorDashboardPage,
  DonorImpactPage,
  DonationsPage,
  NewDonationPage,
  TrackDonationPage,
} from "@/pages/DonorPages"
import {
  RecipientCapacityPage,
  RecipientImpactPage,
  RecipientOffersPage,
  RecipientReceivedPage,
} from "@/pages/RecipientPages"
import { RoleEntryPage } from "@/pages/RoleEntryPage"
import { DemoStoreProvider } from "@/lib/demo-store"

function NotFoundPage() {
  return (
    <main className="not-found-page">
      <div className="not-found-card">
        <span className="entry-kicker">SECOND SERVE</span>
        <h1>We couldn’t find that page.</h1>
        <p>This screen may not exist in the demo or the route may have changed.</p>
        <Button asChild>
          <Link to="/">
            <ArrowLeft aria-hidden="true" size={16} /> Return to role entry
          </Link>
        </Button>
      </div>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <DemoStoreProvider>
        <Routes>
          <Route element={<RoleEntryPage />} path="/" />
          <Route element={<DonorShell />} path="/donor">
            <Route element={<Navigate replace to="/donor/dashboard" />} index />
            <Route element={<DonorDashboardPage />} path="dashboard" />
            <Route element={<DonationsPage />} path="donations" />
            <Route element={<DonorImpactPage />} path="impact" />
            <Route element={<NewDonationPage />} path="new" />
            <Route element={<TrackDonationPage />} path="donations/:donationId" />
          </Route>
          <Route element={<RecipientShell />} path="/recipient/:recipientId">
            <Route element={<Navigate replace to="offers" />} index />
            <Route element={<RecipientOffersPage />} path="offers" />
            <Route element={<RecipientCapacityPage />} path="capacity" />
            <Route element={<RecipientReceivedPage />} path="received" />
            <Route element={<RecipientImpactPage />} path="impact" />
          </Route>
          <Route element={<NotFoundPage />} path="*" />
        </Routes>
      </DemoStoreProvider>
    </BrowserRouter>
  )
}

export default App
