import {
  ArrowRight,
  CheckCircle2,
  HeartHandshake,
  Leaf,
  MapPin,
  ShieldCheck,
  TrendingUp,
  Utensils,
} from "lucide-react"
import { Link, Navigate } from "react-router-dom"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { BrandedLoader } from "@/components/BrandedLoader"

export function RoleEntryPage() {
  const { loading, profile, user } = useAuth()
  if (loading) {
    return (
      <BrandedLoader
        title="Checking your account"
        description="We’re securely reconnecting you to your SecondServe workspace."
      />
    )
  }
  if (user && profile?.role && profile.organizationId) {
    const destination = profile.role === "donor"
      ? "/donor/dashboard"
      : `/recipient/${profile.organizationId}/offers`
    return <Navigate replace to={destination} />
  }
  if (user) {
    return <Navigate replace to="/onboarding" />
  }

  return (
    <main className="entry-page">
      <header className="entry-header">
        <Link aria-label="SecondServe home" className="brand" to="/">
          <span className="brand-mark"><Leaf aria-hidden="true" size={19} /></span>
          <span className="brand-name">SecondServe</span>
        </Link>
      </header>
      <section className="entry-hero">
        <div className="entry-copy">
          <h1>Good food deserves a <em>second serve.</em></h1>
          <p>
            Review surplus food, plan a feasible rescue, and verify handoffs with
            a secure one-time code.
          </p>
          <div className="entry-auth-actions">
            <Button asChild>
              <Link to="/create-account">Create account <ArrowRight aria-hidden="true" size={16} /></Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/sign-in">Sign in</Link>
            </Button>
          </div>
          <p className="entry-auth-note">
            Choose donor to list surplus food or recipient to share community needs.
          </p>
        </div>
        <div className="entry-illustration" aria-label="Food rescue process">
          <div className="illustration-label">A CLEAR RESCUE JOURNEY</div>
          <div className="illustration-flow">
            <div className="illustration-node illustration-node--food">
              <span><Utensils aria-hidden="true" size={22} /></span>
              <strong>Surplus food</strong>
              <small>Donor-reviewed details</small>
            </div>
            <div className="illustration-route"><span /><small>Feasible route</small><span /></div>
            <div className="illustration-node illustration-node--recipient">
              <span><HeartHandshake aria-hidden="true" size={22} /></span>
              <strong>Community need</strong>
              <small>Capacity checked</small>
            </div>
          </div>
          <div className="illustration-receipt">
            <CheckCircle2 aria-hidden="true" size={17} />
            <span><strong>Code verified</strong><small>One-time passcode confirms pickup</small></span>
            <CheckCircle2 aria-hidden="true" className="illustration-check" size={18} />
          </div>
          <div className="illustration-background illustration-background--one" />
          <div className="illustration-background illustration-background--two" />
        </div>
      </section>
      <section aria-labelledby="entry-process-title" className="entry-process">
        <div className="entry-process-heading">
          <span className="entry-section-kicker">THE SECOND SERVE ROUTE</span>
          <h2 id="entry-process-title">From surplus patterns to confirmed handoffs.</h2>
        </div>
        <div className="entry-route-map">
          <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 1200 400">
          <path
            className="entry-route-road"
            d="M 100 100 C 220 100 260 305 400 305 S 570 100 720 100 S 920 305 1080 305"
          />
          <path
            className="entry-route-centerline"
            d="M 100 100 C 220 100 260 305 400 305 S 570 100 720 100 S 920 305 1080 305"
          />
          </svg>
          <article className="entry-route-stop entry-route-stop--forecast">
          <span className="entry-route-marker entry-route-marker--forecast"><TrendingUp aria-hidden="true" size={18} /></span>
          <div className="entry-route-label">
            <span className="entry-route-kicker">SURPLUS FORECAST</span>
            <h3>Plan ahead</h3>
            <p>Weekday forecasts help donors anticipate surplus and plan ahead.</p>
          </div>
          </article>
          <article className="entry-route-stop entry-route-stop--review">
          <span className="entry-route-marker"><Utensils aria-hidden="true" size={18} /></span>
          <div className="entry-route-label">
            <span className="entry-route-kicker">DONOR REVIEW</span>
            <h3>Confirm the food</h3>
            <p>AI organizes visible details; donors verify quantity, food, and pickup cutoff.</p>
          </div>
          </article>
          <article className="entry-route-stop entry-route-stop--feasibility">
          <span className="entry-route-marker entry-route-marker--route"><MapPin aria-hidden="true" size={18} /></span>
          <div className="entry-route-label">
            <span className="entry-route-kicker">FEASIBILITY CHECK</span>
            <h3>Find the right route</h3>
            <p>Capacity, food fit, open hours, route, and cutoff are checked before offers.</p>
          </div>
          </article>
          <article className="entry-route-stop entry-route-stop--receipt">
          <span className="entry-route-marker entry-route-marker--receipt"><ShieldCheck aria-hidden="true" size={18} /></span>
          <div className="entry-route-label">
            <span className="entry-route-kicker">ONE-TIME CODE</span>
            <h3>Verify the handoff</h3>
            <p>The recipient confirms pickup using the donor’s single-use six-digit code.</p>
          </div>
          </article>
        </div>
      </section>
    </main>
  )
}
