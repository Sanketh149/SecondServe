import {
  ArrowRight,
  CheckCircle2,
  HeartHandshake,
  Home,
  LocateFixed,
  ShieldCheck,
  TrendingUp,
  Utensils,
} from "lucide-react"
import { useState, type FormEvent } from "react"
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { Brand, ReadinessNotice } from "@/components/AppShell"
import { BrandedLoader } from "@/components/BrandedLoader"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth-context"
import { firebaseConfigured } from "@/lib/firebase"
import { createOrganizationProfile } from "@/lib/api-client"

function getAuthenticationErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error &&
    typeof error.code === "string"
      ? error.code
      : ""

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect. Check your details and try again."
    case "auth/invalid-email":
      return "Enter a valid email address."
    case "auth/user-disabled":
      return "This account is disabled. Contact your organization administrator."
    case "auth/too-many-requests":
      return "There have been too many attempts. Wait a moment and try again."
    case "auth/network-request-failed":
      return "We couldn’t reach the sign-in service. Check your connection and try again."
    case "auth/email-already-in-use":
      return "An account already exists for this email. Try signing in instead."
    case "auth/weak-password":
      return "Choose a stronger password with at least 8 characters."
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled. Contact support."
    default:
      return "We couldn’t complete sign-in. Please check your details and try again."
  }
}

export function SignInPage({ createAccount = false }: { createAccount?: boolean }) {
  const { error: authError, loading, profile, signIn, signUp, user } = useAuth()
  const navigate = useNavigate()
  const [organizationRole, setOrganizationRole] =
    useState<"donor" | "recipient" | "">("")
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  if (loading) {
    return (
      <BrandedLoader
        title="Checking your account"
        description="We’re confirming your secure sign-in before opening the right workspace."
      />
    )
  }
  if (user && profile?.role && profile.organizationId) {
    return (
      <Navigate
        replace
        to={profile.role === "donor" ? "/donor/dashboard" : `/recipient/${profile.organizationId}/offers`}
      />
    )
  }
  if (user) return <Navigate replace to="/onboarding" />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (createAccount && !organizationRole) {
      setError("Choose whether your organization donates surplus food or receives it.")
      return
    }
    setError("")
    setSubmitting(true)
    try {
      if (createAccount) {
        await signUp(email, password, displayName)
        navigate(`/onboarding?role=${organizationRole}`)
      } else {
        await signIn(email, password)
      }
    } catch (submitError) {
      setError(getAuthenticationErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-page-header">
        <Brand />
        <Link className="back-link" to="/">
          <Home aria-hidden="true" size={15} /> Home
        </Link>
      </header>
      <div className={`auth-layout${createAccount ? " auth-signup-layout" : " auth-signin-layout"}`}>
        <aside aria-labelledby="signup-intro-title" className="auth-signup-intro">
          <span className="auth-signup-kicker">
            <HeartHandshake aria-hidden="true" size={16} />
            {createAccount ? "FOOD DONORS + COMMUNITY RECIPIENTS" : "YOUR SECOND SERVE WORKSPACE"}
          </span>
          <h2 aria-live="polite" id="signup-intro-title">
            {createAccount
              ? organizationRole === "donor"
                ? "Plan surplus before it goes to waste."
                : organizationRole === "recipient"
                  ? "Find food that fits your community."
                  : "A better route for surplus food."
              : "Welcome back. Let’s keep good food moving."}
          </h2>
          <p>
            {createAccount
              ? "SecondServe connects food businesses with community organizations through a clear, feasible handoff."
              : "Sign in to pick up where your organization left off: review donations, respond to offers, and track confirmed handoffs."}
          </p>
          <div className={`auth-signup-benefit${createAccount && organizationRole === "donor" ? " auth-signup-benefit--selected" : ""}`}>
            <span className="auth-signup-benefit-icon auth-signup-benefit-icon--forecast">
              <TrendingUp aria-hidden="true" size={18} />
            </span>
            <span>
              <strong>For restaurants and donors</strong>
              <small>Use real surplus patterns to plan donations ahead.</small>
              {createAccount && organizationRole === "donor" && (
                <small className="auth-signup-selection">Selected for your account</small>
              )}
            </span>
          </div>
          <div className={`auth-signup-benefit${createAccount && organizationRole === "recipient" ? " auth-signup-benefit--selected" : ""}`}>
            <span className="auth-signup-benefit-icon auth-signup-benefit-icon--recipient">
              <Utensils aria-hidden="true" size={18} />
            </span>
            <span>
              <strong>For community recipients</strong>
              <small>Share your needs and accept offers that fit your capacity.</small>
              {createAccount && organizationRole === "recipient" && (
                <small className="auth-signup-selection">Selected for your account</small>
              )}
            </span>
          </div>
        </aside>
      <Card className={`panel auth-card${createAccount ? " auth-card--signup" : " auth-card--signin"}`}>
        <span className="step-kicker">{createAccount ? "GET STARTED" : "WELCOME BACK"}</span>
        <h1>{createAccount ? "Create your account" : "Sign in to SecondServe"}</h1>
        <p>
          {createAccount
            ? "Choose whether your organization donates surplus food or receives it for your community."
            : "Use your organization account to manage food rescues and confirmed deliveries."}
        </p>
        {!firebaseConfigured && (
          <ReadinessNotice variant="warning">
            <ShieldCheck aria-hidden="true" size={17} />
            <span>
              <strong>Firebase web configuration is not set.</strong>
              <span>
                Configure the Firebase Web App values in the frontend environment
                before enabling account sign-in.
              </span>
            </span>
          </ReadinessNotice>
        )}
        {(error || authError) && (
          <p className="form-error" role="alert">{error || authError}</p>
        )}
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          {createAccount && (
            <label className="field-label">
              I am joining as
              <div className="select-wrap">
                <select
                  className="field-input role-type-select"
                  required
                  onChange={(event) =>
                    setOrganizationRole(event.target.value as "donor" | "recipient" | "")
                  }
                  value={organizationRole}
                >
                  <option disabled value="">Select donor or recipient</option>
                  <option value="donor">Donor / restaurant or business</option>
                  <option value="recipient">Recipient / community organization</option>
                </select>
              </div>
              <span className="field-hint">
                Donors list surplus food. Recipients share needs and receive offers.
              </span>
            </label>
          )}
          {createAccount && (
            <label className="field-label">
              Your name
              <Input
                autoComplete="name"
                onChange={(event) => setDisplayName(event.target.value)}
                required
                value={displayName}
              />
            </label>
          )}
          <label className="field-label">
            Email
            <Input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="field-label">
            Password
            <Input
              autoComplete={createAccount ? "new-password" : "current-password"}
              minLength={createAccount ? 8 : undefined}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {createAccount && <span className="field-hint">Use at least 8 characters.</span>}
          </label>
          <Button disabled={submitting || !firebaseConfigured} type="submit">
            {submitting ? (
              <><span aria-hidden="true" className="button-spinner" />{createAccount ? "Creating secure account…" : "Signing in securely…"}</>
            ) : (
              <>{createAccount ? "Create account" : "Sign in"}<ArrowRight aria-hidden="true" size={16} /></>
            )}
          </Button>
        </form>
        <p className="auth-switch">
          {createAccount ? "Already registered?" : "New to SecondServe?"}{" "}
          <Link to={createAccount ? "/sign-in" : "/create-account"}>
            {createAccount ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </Card>
      </div>
    </main>
  )
}

export function OrganizationOnboardingPage() {
  const { loading, profile, reloadProfile, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedRole = searchParams.get("role")
  const hasRequestedRole = requestedRole === "donor" || requestedRole === "recipient"
  const [role, setRole] = useState<"donor" | "recipient" | "">(
    hasRequestedRole ? requestedRole : "",
  )
  const [showRoleSelector, setShowRoleSelector] = useState(!hasRequestedRole)
  const [organizationName, setOrganizationName] = useState("")
  const [address, setAddress] = useState("")
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  )
  const [capacity, setCapacity] = useState("")
  const [unmetDemand, setUnmetDemand] = useState("")
  const [categories, setCategories] = useState<string[]>(["prepared_meal"])
  const [allergens, setAllergens] = useState("")
  const [openTime, setOpenTime] = useState("09:00")
  const [closeTime, setCloseTime] = useState("17:00")
  const [openSaturday, setOpenSaturday] = useState(false)
  const [openSunday, setOpenSunday] = useState(false)
  const [locationMessage, setLocationMessage] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (loading && (!user || !hasRequestedRole)) {
    return (
      <BrandedLoader
        title={user ? "Preparing your organization setup" : "Connecting to your account"}
        description={
          user
            ? "We’re getting your secure organization setup ready. This should only take a moment."
            : "We’re securely reconnecting your account before continuing."
        }
      />
    )
  }
  if (!user) return <Navigate replace to="/sign-in" />
  if (profile?.role && profile.organizationId) {
    return (
      <Navigate
        replace
        to={profile.role === "donor" ? "/donor/dashboard" : `/recipient/${profile.organizationId}/offers`}
      />
    )
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("This browser does not provide location. Enter coordinates manually.")
      return
    }
    setLocationMessage("Requesting this device’s location…")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6))
        setLongitude(position.coords.longitude.toFixed(6))
        setLocationMessage("Location added. Check that it is the organization pickup/delivery location.")
      },
      () => setLocationMessage("Could not access location. Enter the organization coordinates manually."),
      { enableHighAccuracy: false, timeout: 10000 },
    )
  }

  function toggleCategory(value: string) {
    setCategories((current) =>
      current.includes(value)
        ? current.filter((category) => category !== value)
        : [...current, value],
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (role !== "donor" && role !== "recipient") {
      setError("Choose whether your organization donates surplus food or receives it.")
      return
    }
    setError("")
    setSubmitting(true)
    try {
      const profile = await createOrganizationProfile({
        role,
        displayName: user?.displayName || organizationName,
        organizationName,
        address,
        latitude: Number(latitude),
        longitude: Number(longitude),
        timezone,
        ...(role === "recipient"
          ? {
              capacity: Number(capacity),
              unmetDemand: Number(unmetDemand),
              acceptedCategories: categories,
              allergenRestrictions: allergens
                .split(/[,;]/)
                .map((item) => item.trim().toLowerCase())
                .filter(Boolean),
              openTime,
              closeTime,
              openSaturday,
              openSunday,
            }
          : {}),
      })
      await reloadProfile()
      navigate(
        profile.role === "donor"
          ? "/donor/dashboard"
          : `/recipient/${profile.organizationId}/offers`,
        { replace: true },
      )
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save your organization profile.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page onboarding-page">
      <header className="auth-page-header">
        <Brand />
        <span>{user.email}</span>
      </header>
      <Card className="panel auth-card onboarding-card">
        <span className="step-kicker">ORGANIZATION SETUP</span>
        <h1>Set up your workspace</h1>
        <p>Your organization profile powers identity, recipient readiness, and route planning.</p>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          {showRoleSelector ? (
            <label className="field-label">
              Organization role
              <div className="select-wrap">
                <select
                  className="field-input role-type-select"
                  required
                  onChange={(event) =>
                    setRole(event.target.value as "donor" | "recipient" | "")
                  }
                  value={role}
                >
                  <option disabled value="">Select donor or recipient</option>
                  <option value="donor">Donor / restaurant or business</option>
                  <option value="recipient">Recipient / community organization</option>
                </select>
              </div>
            </label>
          ) : (
            <div className="field-label">
              Organization role
              <div className="onboarding-role-summary">
                <strong>
                  {role === "donor"
                    ? "Donor / restaurant or business"
                    : "Recipient / community organization"}
                </strong>
                <button
                  className="text-link onboarding-role-change"
                  onClick={() => setShowRoleSelector(true)}
                  type="button"
                >
                  Change
                </button>
              </div>
              <span className="field-hint">
                {role === "donor"
                  ? "You’ll list surplus food and plan rescues."
                  : "You’ll share your organization’s needs and receive offers."}
              </span>
            </div>
          )}
          <label className="field-label">
            Organization name
            <Input onChange={(event) => setOrganizationName(event.target.value)} required value={organizationName} />
          </label>
          <label className="field-label">
            Organization address
            <Input onChange={(event) => setAddress(event.target.value)} required value={address} />
          </label>
          <div className="auth-coordinate-grid">
            <label className="field-label">
              Latitude
              <Input max={90} min={-90} onChange={(event) => setLatitude(event.target.value)} required step="any" type="number" value={latitude} />
            </label>
            <label className="field-label">
              Longitude
              <Input max={180} min={-180} onChange={(event) => setLongitude(event.target.value)} required step="any" type="number" value={longitude} />
            </label>
          </div>
          <Button onClick={useCurrentLocation} type="button" variant="outline">
            <LocateFixed aria-hidden="true" size={16} /> Use this device’s location
          </Button>
          {locationMessage && <p className="field-hint" role="status">{locationMessage}</p>}
          <label className="field-label">
            Organization time zone
            <Input onChange={(event) => setTimezone(event.target.value)} required value={timezone} />
          </label>
          {role === "recipient" && (
            <>
              <div className="auth-coordinate-grid">
                <label className="field-label">
                  Meal capacity
                  <Input min={1} onChange={(event) => setCapacity(event.target.value)} required type="number" value={capacity} />
                </label>
                <label className="field-label">
                  Current unmet need
                  <Input min={0} onChange={(event) => setUnmetDemand(event.target.value)} required type="number" value={unmetDemand} />
                </label>
              </div>
              <label className="field-label">
                Accepted food categories
                <span className="tag-options">
                  {[
                    ["prepared_meal", "Prepared meals"],
                    ["bakery", "Bakery"],
                    ["produce", "Produce"],
                    ["packaged_food", "Packaged food"],
                  ].map(([value, label]) => (
                    <button
                      aria-pressed={categories.includes(value)}
                      className={`choice-chip${categories.includes(value) ? " choice-chip--selected" : ""}`}
                      key={value}
                      onClick={() => toggleCategory(value)}
                      type="button"
                    >
                      {categories.includes(value) && <CheckCircle2 aria-hidden="true" size={13} />}
                      {label}
                    </button>
                  ))}
                </span>
              </label>
              <label className="field-label">
                Allergen exclusions
                <Input onChange={(event) => setAllergens(event.target.value)} placeholder="e.g. peanut, shellfish" value={allergens} />
              </label>
              <div className="auth-coordinate-grid">
                <label className="field-label">
                  Opens
                  <Input onChange={(event) => setOpenTime(event.target.value)} required type="time" value={openTime} />
                </label>
                <label className="field-label">
                  Closes
                  <Input onChange={(event) => setCloseTime(event.target.value)} required type="time" value={closeTime} />
                </label>
              </div>
              <div className="tag-options">
                <label className="choice-chip">
                  <input checked={openSaturday} onChange={(event) => setOpenSaturday(event.target.checked)} type="checkbox" />
                  Open Saturday
                </label>
                <label className="choice-chip">
                  <input checked={openSunday} onChange={(event) => setOpenSunday(event.target.checked)} type="checkbox" />
                  Open Sunday
                </label>
              </div>
            </>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button disabled={submitting} type="submit">
            {submitting ? (
              <><span aria-hidden="true" className="button-spinner" />Saving organization profile…</>
            ) : (
              <>Create organization workspace<ArrowRight aria-hidden="true" size={16} /></>
            )}
          </Button>
        </form>
      </Card>
    </main>
  )
}
