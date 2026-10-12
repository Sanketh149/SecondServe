import { ArrowLeft } from "lucide-react"
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom"
import { AuthProvider } from "@/components/AuthProvider"
import { BrandedLoader } from "@/components/BrandedLoader"
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
import { OrganizationOnboardingPage, SignInPage } from "@/pages/AuthPages"
import { RoleEntryPage } from "@/pages/RoleEntryPage"
import { DemoStoreProvider } from "@/lib/demo-store"
import { useAuth } from "@/lib/auth-context"

function NotFoundPage() {
  return (
    <main className="not-found-page">
      <div className="not-found-card">
        <span className="entry-kicker">SECOND SERVE</span>
        <h1>We couldn’t find that page.</h1>
        <p>This screen may not exist or the route may have changed.</p>
        <Button asChild>
          <Link to="/">
            <ArrowLeft aria-hidden="true" size={16} /> Return home
          </Link>
        </Button>
      </div>
    </main>
  )
}

function AuthenticatedApplication() {
  const { loading, profile, user } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <BrandedLoader
        title="Preparing your workspace"
        description="We’re securely connecting your account and loading your organization data."
      />
    )
  }
  if (!user) return <Navigate replace to="/sign-in" />
  if (!profile?.role || !profile.organizationId) {
    return <Navigate replace to={`/onboarding${location.search}`} />
  }

  return (
    <DemoStoreProvider>
      <Routes>
        {profile.role === "donor" && (
          <Route element={<DonorShell />} path="/donor">
            <Route element={<Navigate replace to="/donor/dashboard" />} index />
            <Route element={<DonorDashboardPage />} path="dashboard" />
            <Route element={<DonationsPage />} path="donations" />
            <Route element={<DonorImpactPage />} path="impact" />
            <Route element={<NewDonationPage />} path="new" />
            <Route element={<TrackDonationPage />} path="donations/:donationId" />
          </Route>
        )}
        {profile.role === "recipient" && (
          <Route element={<RecipientShell />} path="/recipient/:recipientId">
            <Route element={<Navigate replace to="offers" />} index />
            <Route element={<RecipientOffersPage />} path="offers" />
            <Route element={<RecipientCapacityPage />} path="capacity" />
            <Route element={<RecipientReceivedPage />} path="received" />
            <Route element={<RecipientImpactPage />} path="impact" />
          </Route>
        )}
        <Route element={<NotFoundPage />} path="*" />
      </Routes>
    </DemoStoreProvider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<RoleEntryPage />} path="/" />
          <Route element={<SignInPage />} path="/sign-in" />
          <Route element={<SignInPage createAccount />} path="/create-account" />
          <Route element={<OrganizationOnboardingPage />} path="/onboarding" />
          <Route element={<AuthenticatedApplication />} path="/*" />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
