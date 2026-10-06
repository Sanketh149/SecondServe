import {
  ArrowRight,
  CheckCircle2,
  HeartHandshake,
  Leaf,
  ShieldCheck,
  Utensils,
} from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export function RoleEntryPage() {
  return (
    <main className="entry-page">
      <header className="entry-header">
        <Link aria-label="SecondServe home" className="brand" to="/">
          <span className="brand-mark"><Leaf aria-hidden="true" size={19} /></span>
          <span className="brand-name">SecondServe</span>
        </Link>
        <span className="entry-demo-pill"><span className="demo-dot" /> Interactive product demo</span>
      </header>
      <section className="entry-hero">
        <div className="entry-copy">
          <div className="entry-kicker"><Leaf aria-hidden="true" size={15} /> FOOD RESCUE, MADE FEASIBLE</div>
          <h1>Good food deserves a <em>second serve.</em></h1>
          <p>
            A clear path from surplus to need: review the food, plan a feasible rescue,
            and count only what recipients confirm.
          </p>
          <div className="entry-trust-row">
            <span><CheckCircle2 aria-hidden="true" size={16} /> Donor-confirmed details</span>
            <span><CheckCircle2 aria-hidden="true" size={16} /> Feasibility before offers</span>
            <span><CheckCircle2 aria-hidden="true" size={16} /> Verified handoffs</span>
          </div>
        </div>
        <div className="entry-illustration" aria-label="A sample food rescue journey">
          <div className="illustration-label">A SIMPLE RESCUE JOURNEY</div>
          <div className="illustration-flow">
            <div className="illustration-node illustration-node--food">
              <span><Utensils aria-hidden="true" size={22} /></span>
              <strong>Surplus food</strong>
              <small>32 meals · ready today</small>
            </div>
            <div className="illustration-route"><span /><small>12 min</small><span /></div>
            <div className="illustration-node illustration-node--recipient">
              <span><HeartHandshake aria-hidden="true" size={22} /></span>
              <strong>Hope Shelter</strong>
              <small>Capacity confirmed</small>
            </div>
          </div>
          <div className="illustration-receipt">
            <ShieldCheck aria-hidden="true" size={17} />
            <span><strong>24 meals confirmed received</strong><small>Impact updates after handoff</small></span>
            <CheckCircle2 aria-hidden="true" className="illustration-check" size={18} />
          </div>
          <div className="illustration-background illustration-background--one" />
          <div className="illustration-background illustration-background--two" />
        </div>
      </section>

      <section className="role-select-section">
        <div className="role-heading">
          <span className="role-heading-kicker">CHOOSE YOUR WORKSPACE</span>
          <h2>How are you joining today?</h2>
          <p>Each workspace has its own role-specific screens and navigation.</p>
        </div>
        <div className="role-card-grid">
          <article className="role-card">
            <span className="role-card-icon role-card-icon--donor"><Utensils aria-hidden="true" size={20} /></span>
            <div>
              <span className="role-label">FOR FOOD BUSINESSES</span>
              <h3>I have surplus food</h3>
              <p>Create a Food Passport, check feasible recipients, and follow the rescue through receipt.</p>
            </div>
            <Button asChild className="role-card-action">
              <Link to="/donor/dashboard">
                Enter donor demo <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </Button>
          </article>
          <article className="role-card">
            <span className="role-card-icon role-card-icon--recipient"><HeartHandshake aria-hidden="true" size={20} /></span>
            <div>
              <span className="role-label">FOR COMMUNITY ORGANIZATIONS</span>
              <h3>I receive food</h3>
              <p>Review offers against your capacity, respond, and confirm food received.</p>
            </div>
            <div className="recipient-demo-accounts">
              <Button asChild className="role-card-action" variant="outline">
                <Link to="/recipient/hope-shelter/offers">
                  Hope Shelter demo <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </Button>
              <Button asChild className="role-card-action role-card-action--secondary" variant="outline">
                <Link to="/recipient/community-kitchen/offers">
                  Community Kitchen demo <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </Button>
              <Button asChild className="role-card-action role-card-action--secondary" variant="outline">
                <Link to="/recipient/neighborhood-kitchen/offers">
                  Neighborhood Kitchen demo <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </Button>
            </div>
          </article>
        </div>
        <div className="demo-boundary-note">
          <ShieldCheck aria-hidden="true" size={17} />
          <span>
            <strong>Prototype access only.</strong> These paths use synthetic sample data and browser-only state. Authentication and live APIs are not connected.
          </span>
        </div>
      </section>

      <footer className="entry-footer">
        <span>SecondServe · Every meal counts.</span>
        <span>Built for safer, more feasible community food rescue.</span>
      </footer>
    </main>
  )
}
