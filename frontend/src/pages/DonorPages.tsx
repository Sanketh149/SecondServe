import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  Utensils,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useState, type ChangeEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { AvatarStack, DemoTag, MetricCard, PageHeading, PrimaryLink, ReadinessNotice, RescueTimeline, RouteMeta, StatusBadge } from "@/components/AppShell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  demoActivity,
  getConfirmedQuantity,
  getCurrentAllocation,
  getImpactTotals,
  recipientCandidates,
  type DemoDonation,
  type NewDonationInput,
  type RecipientCandidate,
} from "@/lib/demo-data"
import { useDemoStore } from "@/lib/demo-context"

function formatStatusDescription(donation: DemoDonation): string {
  if (donation.status === "RECEIVED") return "All allocated meals were confirmed received"
  if (donation.status === "PARTIALLY_RECEIVED") return "Some meals are still unconfirmed"
  const active = getCurrentAllocation(donation)
  return active
    ? `${active.recipientName} · ${active.quantity} meals`
    : "No active recipient offer"
}

function getDonorNextAction(donation: DemoDonation) {
  const current = getCurrentAllocation(donation)
  const confirmed = getConfirmedQuantity(donation)
  if (donation.status === "ACCEPTED") {
    return {
      variant: "success" as const,
      title: "Recipient accepted — prepare for handoff.",
      description: `Share the one-time code with ${current?.recipientName ?? "the recipient"} at pickup.`,
    }
  }
  if (donation.status === "OFFERING" || donation.status === "RELAYED") {
    return {
      variant: "info" as const,
      title: `Waiting for ${current?.recipientName ?? "a recipient"} to respond.`,
      description: "Track the offer to see the relay status and next planned recipient.",
    }
  }
  if (donation.status === "PARTIALLY_RECEIVED") {
    return {
      variant: "warning" as const,
      title: `${confirmed} of ${donation.quantity} meals were confirmed.`,
      description: "Only the quantity in a recipient-confirmed receipt counts as rescued.",
    }
  }
  if (donation.status === "RECEIVED") {
    return {
      variant: "success" as const,
      title: "Rescue confirmed.",
      description: `${confirmed} meals were confirmed by the recipient and count toward impact.`,
    }
  }
  return {
    variant: "warning" as const,
    title: "No recipient is currently assigned.",
    description: "Review the plan before treating any quantity as rescued.",
  }
}

function ActiveRescueCard({ donation }: { donation: DemoDonation }) {
  const current = getCurrentAllocation(donation)
  const names = donation.allocations.map((allocation) => allocation.recipientName)
  const nextAction = getDonorNextAction(donation)

  return (
    <Card className="panel active-rescue">
      <div className="panel-heading">
        <h2>Active rescue</h2>
        <Link className="panel-link" to="/donor/donations">
          View all donations <ArrowRight aria-hidden="true" size={14} />
        </Link>
      </div>
      <div className="active-rescue-content">
        <div className="donation-title-row">
          <div>
            <h3>{donation.itemName}</h3>
            <p>
              {donation.quantity} {donation.unit} <span aria-hidden="true">·</span>{" "}
              Created {donation.createdAt}
            </p>
          </div>
          <StatusBadge status={donation.status} />
        </div>
        {current ? (
          <RouteMeta
            distance={current.distance}
            eta={current.eta}
            name={current.recipientName}
            quantity={current.quantity}
          />
        ) : (
          <div className="route-summary">
            <span className="route-icon">
              <Utensils aria-hidden="true" size={17} />
            </span>
            <span className="route-copy">
              <strong>{formatStatusDescription(donation)}</strong>
              <span>Recipient-confirmed quantity is shown separately.</span>
            </span>
          </div>
        )}
        <RescueTimeline status={donation.status} />
        <div className="donor-next-action">
          <ReadinessNotice variant={nextAction.variant}>
            <span>
              <strong>{nextAction.title}</strong>
              <span>{nextAction.description}</span>
            </span>
          </ReadinessNotice>
        </div>
      </div>
      <div className="panel-footer">
        <div className="recipient-inline">
          <AvatarStack names={names} />
          <span>{names.length} recipient{names.length === 1 ? "" : "s"} in rescue plan</span>
        </div>
        <Link className="text-link" to={`/donor/donations/${donation.id}`}>
          Track donation <ArrowRight aria-hidden="true" size={14} />
        </Link>
      </div>
    </Card>
  )
}

function OpportunityCard() {
  const barHeights = [38, 49, 46, 60, 54, 75, 57]
  const days = ["W", "T", "F", "S", "S", "M", "T"]

  return (
    <Card className="panel opportunity-card">
      <div className="panel-heading">
        <h2>Rescue opportunity</h2>
        <Link className="panel-link" to="/donor/impact">
          Details
        </Link>
      </div>
      <div className="opportunity-content">
        <div className="opportunity-label">
          <span className="opportunity-pulse" />
          SAMPLE OPPORTUNITY
        </div>
        <h3>Friday could be a good day to plan ahead.</h3>
        <p>Example pattern: surplus may overlap with nearby community demand.</p>
        <div
          aria-label="Illustrative surplus by day; Monday is the highest"
          className="forecast-chart"
          role="img"
        >
          <span className="chart-caption">Example surplus pattern · recent Fridays</span>
          <div className="chart-bars">
            {barHeights.map((height, index) => (
              <span className="chart-day" key={`${days[index]}-${index}`}>
                <span
                  className={`chart-bar${index === 5 ? " chart-bar--highlight" : ""}`}
                  style={{ height: `${height}%` }}
                />
                <span>{days[index]}</span>
              </span>
            ))}
          </div>
        </div>
        <ReadinessNotice variant="warning">
          <span className="notice-icon">✦</span>
          <span>
            <strong>Potential rescue window</strong>
            <span>Hope Shelter has capacity this Friday evening.</span>
          </span>
        </ReadinessNotice>
      </div>
    </Card>
  )
}

export function DonorDashboardPage() {
  const { donations } = useDemoStore()
  const active = donations.find((donation) =>
    ["OFFERING", "RELAYED", "ACCEPTED", "PARTIALLY_RECEIVED"].includes(
      donation.status,
    ),
  )
  const activeCount = donations.filter((donation) =>
    ["OFFERING", "RELAYED", "ACCEPTED", "PARTIALLY_RECEIVED"].includes(
      donation.status,
    ),
  ).length
  const impact = getImpactTotals(donations)

  return (
    <>
      <PageHeading
        action={
          <PrimaryLink to="/donor/new">
            <Plus aria-hidden="true" size={18} /> New donation
          </PrimaryLink>
        }
        description="Here’s what’s happening with your food rescue efforts."
        title={
          <>
            Good morning, Jordan <DemoTag />
          </>
        }
      />
      <div className="metrics-grid">
        <MetricCard
          icon={<ArrowUpRight aria-hidden="true" size={17} />}
          note={
            <>
              <strong>+18%</strong> from last month
            </>
          }
          title="Meals rescued"
          value={impact.confirmedMeals.toLocaleString()}
        />
        <MetricCard
          icon={<span className="metric-target">◎</span>}
          note={`${activeCount} awaiting recipient response`}
          title="Active donations"
          value={String(activeCount)}
        />
        <MetricCard
          icon={<Check aria-hidden="true" size={17} />}
          note="Based on recipient-confirmed deliveries"
          title="Rescue success"
          value={`${impact.rescueRate}%`}
        />
      </div>

      <div className="dashboard-main-grid">
        <div className="dashboard-primary-column">
          {active ? (
            <ActiveRescueCard donation={active} />
          ) : (
            <Card className="panel empty-panel">
              <div className="empty-state">
                <span className="empty-icon"><Utensils aria-hidden="true" size={20} /></span>
                <h2>No active rescues</h2>
                <p>Create a donation when you have safe surplus food to share.</p>
                <PrimaryLink to="/donor/new">
                  Start a donation <ArrowRight aria-hidden="true" size={16} />
                </PrimaryLink>
              </div>
            </Card>
          )}
          <RecentActivity />
        </div>
        <div className="dashboard-secondary-column">
          <OpportunityCard />
          <ImpactPreview
            confirmed={impact.confirmedMeals}
            offered={impact.offeredMeals}
            rescueRate={impact.rescueRate}
          />
        </div>
      </div>
      <p className="demo-disclaimer">
        Demo workspace · figures and organizations are synthetic sample data, not live community activity.
      </p>
    </>
  )
}

function RecentActivity() {
  const { donations } = useDemoStore()
  const generated = donations
    .filter((donation) => donation.createdAt === "Just now")
    .slice(0, 1)
    .map((donation) => ({
      id: donation.id,
      title: "Rescue plan started",
      detail: `${donation.itemName} · ${donation.quantity} meals`,
      time: "Just now",
      kind: "plan",
    }))
  const activities = [...generated, ...demoActivity].slice(0, 3)

  return (
    <Card className="panel activity-panel">
      <div className="panel-heading">
        <h2>Recent activity</h2>
        <Link className="panel-link" to="/donor/donations">
          See history <ArrowRight aria-hidden="true" size={14} />
        </Link>
      </div>
      <div className="activity-list">
        {activities.map((activity) => (
          <div className="activity-row" key={activity.id}>
            <span className={`activity-icon activity-icon--${activity.kind}`}>
              {activity.kind === "received" ? (
                <Check aria-hidden="true" size={16} />
              ) : (
                <ArrowUpRight aria-hidden="true" size={16} />
              )}
            </span>
            <span className="activity-copy">
              <strong>{activity.title}</strong>
              <span>{activity.detail}</span>
            </span>
            <span className="activity-time">{activity.time}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function ImpactPreview({
  confirmed,
  offered,
  rescueRate,
}: {
  confirmed: number
  offered: number
  rescueRate: number
}) {
  return (
    <Card className="panel impact-preview">
      <div className="panel-heading">
        <h2>Your impact</h2>
        <Link className="panel-link" to="/donor/impact">
          Explore <ArrowRight aria-hidden="true" size={14} />
        </Link>
      </div>
      <div className="impact-preview-content">
        <div className="impact-ring">
          <div>
            <strong>{rescueRate}%</strong>
          </div>
        </div>
        <div>
          <strong>Rescue completion</strong>
          <p>
            <b>{confirmed} meals</b> confirmed received this month from {offered} offered.
          </p>
        </div>
      </div>
    </Card>
  )
}

function DonationRow({ donation }: { donation: DemoDonation }) {
  const received = getConfirmedQuantity(donation)
  return (
    <Link className="donation-list-row" to={`/donor/donations/${donation.id}`}>
      <span className="donation-food-icon">
        <Utensils aria-hidden="true" size={18} />
      </span>
      <span className="donation-row-main">
        <strong>{donation.itemName}</strong>
        <span>
          {donation.quantity} meals · {donation.createdAt}
        </span>
      </span>
      <span className="donation-row-recipient">
        {getCurrentAllocation(donation)?.recipientName ??
          donation.allocations[0]?.recipientName ??
          "Unassigned"}
      </span>
      <StatusBadge status={donation.status} />
      {received > 0 && (
        <span className="donation-row-received">{received} received</span>
      )}
      <ArrowRight aria-hidden="true" className="donation-row-arrow" size={16} />
    </Link>
  )
}

export function DonationsPage() {
  const { donations } = useDemoStore()
  const [query, setQuery] = useState("")
  const filtered = donations.filter((donation) =>
    donation.itemName.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <>
      <PageHeading
        action={
          <PrimaryLink to="/donor/new">
            <Plus aria-hidden="true" size={18} /> New donation
          </PrimaryLink>
        }
        description="Review offers, recipient responses, and confirmed handoffs."
        title="Donations"
      />
      <div className="list-toolbar">
        <label className="search-field">
          <span className="visually-hidden">Search donations</span>
          <Input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search donations"
            value={query}
          />
        </label>
        <span className="toolbar-meta">
          {filtered.length} donation{filtered.length === 1 ? "" : "s"} · demo records
        </span>
      </div>
      <Card className="panel donation-list">
        {filtered.length > 0 ? (
          filtered.map((donation) => (
            <DonationRow donation={donation} key={donation.id} />
          ))
        ) : (
          <div className="empty-state compact-empty">
            <h2>No matching donations</h2>
            <p>Try a different search or create a new donation.</p>
          </div>
        )}
      </Card>
      <p className="demo-disclaimer">
        Offer and receipt events in this prototype are simulated in browser memory.
      </p>
    </>
  )
}

export function DonorImpactPage() {
  const { donations } = useDemoStore()
  const impact = getImpactTotals(donations)
  const { confirmedMeals: confirmed } = impact
  const [range, setRange] = useState("This month")

  return (
    <>
      <PageHeading
        action={
          <label className="range-select">
            <CalendarDays aria-hidden="true" size={16} />
            <select
              aria-label="Impact date range"
              onChange={(event) => setRange(event.target.value)}
              value={range}
            >
              <option>This month</option>
              <option>Last 90 days</option>
              <option>All time</option>
            </select>
          </label>
        }
        description={`Recipient-confirmed outcomes for ${range.toLowerCase()}.`}
        title="Your impact"
      />
      <ReadinessNotice variant="success">
        <ShieldCheck aria-hidden="true" size={19} />
        <span>
          <strong>Verified by recipients</strong>
          <span>Only completed handoff receipts count toward rescued meals.</span>
        </span>
      </ReadinessNotice>
      <div className="metrics-grid impact-metrics">
        <MetricCard
          icon={<CheckCircle2 aria-hidden="true" size={17} />}
          note="Confirmed at recipient handoff"
          title="Meals confirmed received"
          value={confirmed.toLocaleString()}
        />
        <MetricCard
          icon={<Utensils aria-hidden="true" size={17} />}
          note="Across active and completed plans"
          title="Meals offered"
          value={String(impact.offeredMeals)}
        />
        <MetricCard
          icon={<ArrowUpRight aria-hidden="true" size={17} />}
          note="Confirmed received ÷ offered"
          title="Rescue completion"
          value={`${impact.rescueRate}%`}
        />
      </div>
      <div className="impact-page-grid">
        <Card className="panel impact-chart-card">
          <div className="panel-heading">
            <h2>Confirmed meals over time</h2>
            <Badge variant="neutral">SAMPLE DATA</Badge>
          </div>
          <div className="impact-chart">
            {[48, 63, 57, 75, 66, 92, 78, 86, 72, 100, 82, 94].map(
              (height, index) => (
                <div className="impact-chart-column" key={index}>
                  <span style={{ height: `${height}%` }} />
                  <small>{["W1", "W2", "W3", "W4"][index % 4]}</small>
                </div>
              ),
            )}
          </div>
          <p className="chart-footnote">
            Illustrative weekly totals. Historical sample data is not a live report.
          </p>
        </Card>
        <Card className="panel impact-breakdown">
          <div className="panel-heading">
            <h2>Outcome breakdown</h2>
          </div>
          <div className="breakdown-content">
            <div className="breakdown-row">
              <span className="breakdown-icon"><Check aria-hidden="true" size={16} /></span>
              <span><strong>Recipient-confirmed</strong><small>Actual handoff receipts</small></span>
              <b>{confirmed}</b>
            </div>
            <div className="breakdown-row">
              <span className="breakdown-icon breakdown-icon--amber"><Clock3 aria-hidden="true" size={16} /></span>
              <span><strong>Still in rescue</strong><small>Offers or handoffs in progress</small></span>
              <b>{donations.filter((item) => item.status !== "RECEIVED").length} plans</b>
            </div>
            <div className="breakdown-row">
              <span className="breakdown-icon breakdown-icon--muted"><Utensils aria-hidden="true" size={16} /></span>
              <span><strong>Environmental impact</strong><small>No unsupported estimates shown</small></span>
              <Badge variant="neutral">Not calculated</Badge>
            </div>
          </div>
        </Card>
      </div>
      <p className="demo-disclaimer">
        Sample historical totals are synthetic and do not represent real-world community outcomes.
      </p>
    </>
  )
}

type DonationDraft = {
  itemName: string
  category: string
  quantity: number
  dietaryTags: string[]
  potentialAllergens: string
  allergenStatus: "DONOR_CONFIRMED" | "UNKNOWN" | "NOT_APPLICABLE"
  preparedAt: string
  storageCondition: string
  pickupAvailableAt: string
  usableUntil: string
  donorConfirmed: boolean
  imageName: string
}

function localDateTime(hoursFromNow: number): string {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatLocalDate(value: string): string {
  if (!value) return "Not set"
  return new Date(value).toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}

function splitQuantity(quantity: number, recipientCount: number): number[] {
  if (recipientCount === 0) return []
  if (recipientCount === 1) return [quantity]
  const first = Math.ceil(quantity * 0.75)
  return [first, quantity - first]
}

const steps = [
  { title: "Food Passport", helper: "Food details" },
  { title: "Rescue plan", helper: "Feasibility & split" },
  { title: "Review", helper: "Confirm & start" },
]

export function NewDonationPage() {
  const navigate = useNavigate()
  const { createDonation } = useDemoStore()
  const reducedMotion = useReducedMotion() ?? false
  const transition = { duration: reducedMotion ? 0.12 : 0.2, ease: "easeOut" as const }
  const [step, setStep] = useState(0)
  const [analysisApplied, setAnalysisApplied] = useState(false)
  const [fileMessage, setFileMessage] = useState("")
  const [draft, setDraft] = useState<DonationDraft>({
    itemName: "",
    category: "Prepared meals",
    quantity: 32,
    dietaryTags: [],
    potentialAllergens: "",
    allergenStatus: "UNKNOWN",
    preparedAt: localDateTime(-1),
    storageCondition: "Refrigerated",
    pickupAvailableAt: localDateTime(0.05),
    usableUntil: localDateTime(4),
    donorConfirmed: false,
    imageName: "",
  })
  const [selectedRecipients, setSelectedRecipients] = useState([
    "hope-shelter",
    "community-kitchen",
  ])
  const [allocationQuantities, setAllocationQuantities] = useState([24, 8])
  const [error, setError] = useState("")
  const allocations = selectedRecipients.map((id, index) => ({
    recipient: recipientCandidates.find((candidate) => candidate.id === id)!,
    quantity: allocationQuantities[index] ?? 0,
  }))
  const allocatedQuantity = allocations.reduce(
    (total, item) => total + item.quantity,
    0,
  )
  const remainingQuantity = draft.quantity - allocatedQuantity
  const allocationIsBalanced = remainingQuantity === 0
  const estimatedRouteMinutes = allocations.reduce(
    (total, item) => total + Number.parseInt(item.recipient.eta, 10),
    0,
  )
  const pickupAt = Date.parse(draft.pickupAvailableAt)
  const usableUntilAt = Date.parse(draft.usableUntil)
  const routeForecast: {
    variant: "danger" | "success" | "warning"
    label: string
  } =
    allocations.length === 0
      ? { variant: "warning", label: "Choose a recipient" }
      : !Number.isFinite(pickupAt) || !Number.isFinite(usableUntilAt)
        ? { variant: "warning", label: "Set pickup and cutoff" }
        : !allocationIsBalanced
          ? { variant: "warning", label: "Complete allocation" }
          : pickupAt + estimatedRouteMinutes * 60_000 > usableUntilAt
            ? { variant: "danger", label: "After cutoff" }
            : { variant: "success", label: "Within entered cutoff" }

  function updateDraft<Key extends keyof DonationDraft>(
    key: Key,
    value: DonationDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function toggleDietaryTag(tag: string) {
    setDraft((current) => ({
      ...current,
      dietaryTags: current.dietaryTags.includes(tag)
        ? current.dietaryTags.filter((item) => item !== tag)
        : [...current.dietaryTags, tag],
    }))
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setFileMessage("Choose a JPG, PNG, or WEBP image.")
      return
    }
    updateDraft("imageName", file.name)
    setFileMessage(
      "Photo selected. Image analysis is not connected in this demo; enter or sample the details below.",
    )
    setAnalysisApplied(false)
  }

  function useSampleSuggestion() {
    setDraft((current) => ({
      ...current,
      itemName: "Vegetarian pasta meals",
      category: "Prepared meals",
      dietaryTags: ["Vegetarian"],
      donorConfirmed: false,
    }))
    setAnalysisApplied(true)
    setFileMessage(
      "Demo sample suggestions applied. They are not generated from your photo and must be reviewed.",
    )
  }

  function toggleRecipient(candidate: RecipientCandidate) {
    if (candidate.readiness !== "READY") return
    setError("")
    if (selectedRecipients.includes(candidate.id)) {
      if (selectedRecipients.length === 1) {
        setError("Choose at least one feasible recipient.")
        return
      }
      const next = selectedRecipients.filter((id) => id !== candidate.id)
      setSelectedRecipients(next)
      setAllocationQuantities(splitQuantity(draft.quantity, next.length))
      return
    }
    if (selectedRecipients.length >= 2) {
      setError("A rescue plan can include at most two recipient stops.")
      return
    }
    const next = [...selectedRecipients, candidate.id]
    setSelectedRecipients(next)
    setAllocationQuantities(splitQuantity(draft.quantity, next.length))
  }

  function validateStep(): boolean {
    if (step === 0) {
      if (!draft.itemName.trim() || !draft.category || draft.quantity < 1) {
        setError("Enter the food name, category, and a positive quantity.")
        return false
      }
      setError("")
      return true
    }
    if (step === 1) {
      if (
        !draft.preparedAt ||
        !draft.storageCondition ||
        !draft.pickupAvailableAt ||
        !draft.usableUntil ||
        new Date(draft.pickupAvailableAt) > new Date(draft.usableUntil)
      ) {
        setError("Set valid preparation, storage, pickup, and usable-until details.")
        return false
      }
      if (
        new Date(draft.pickupAvailableAt).getTime() +
          estimatedRouteMinutes * 60_000 >
        new Date(draft.usableUntil).getTime()
      ) {
        setError("The selected route would arrive after your usable-until cutoff.")
        return false
      }
      if (selectedRecipients.length === 0 || allocatedQuantity !== draft.quantity) {
        setError("Allocate the full donation quantity across one or two recipients.")
        return false
      }
      if (selectedRecipients.some((id) =>
        recipientCandidates.find((candidate) => candidate.id === id)?.readiness !== "READY",
      )) {
        setError("Only READY recipients can receive automatic offers.")
        return false
      }
      setError("")
      return true
    }
    if (!draft.donorConfirmed) {
      setError("Confirm that you reviewed the food details and donor-entered safety fields.")
      return false
    }
    setError("")
    return true
  }

  function goNext() {
    if (validateStep()) setStep((current) => Math.min(2, current + 1))
  }

  function startRescue() {
    if (!validateStep()) return
    const input: NewDonationInput = {
      itemName: draft.itemName.trim(),
      category: draft.category,
      quantity: draft.quantity,
      usableUntil: formatLocalDate(draft.usableUntil),
      allocations: selectedRecipients.map((recipientId, index) => ({
        recipientId,
        quantity: allocationQuantities[index] ?? 0,
      })),
    }
    const id = createDonation(input)
    navigate(`/donor/donations/${id}`)
  }

  return (
    <>
      <PageHeading
        description="Review every suggested detail before a rescue offer can start."
        title="Create a donation"
      />
      <div className="wizard-layout">
        <div className="wizard-main">
          <div aria-label="Donation setup progress" className="wizard-steps">
            {steps.map((item, index) => (
              <div
                aria-current={index === step ? "step" : undefined}
                className={`wizard-step${index === step ? " wizard-step--active" : ""}${index < step ? " wizard-step--done" : ""}`}
                key={item.title}
              >
                <span className="wizard-step-number">
                  {index < step ? <Check aria-hidden="true" size={14} /> : index + 1}
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.helper}</small>
                </span>
              </div>
            ))}
          </div>

          <AnimatePresence initial={false} mode="wait">
          {step === 0 && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : -5 }}
              initial={{ opacity: 0, y: reducedMotion ? 0 : 7 }}
              key="food-passport"
              transition={transition}
            >
            <Card className="panel wizard-card">
              <div className="wizard-card-heading">
                <div>
                  <span className="step-kicker">STEP 1 OF 3</span>
                  <h2>Build the Food Passport</h2>
                  <p>Start with a photo or enter the food details manually.</p>
                </div>
                <span className="wizard-heading-icon"><Sparkles aria-hidden="true" size={19} /></span>
              </div>

              <label className="upload-zone">
                <input
                  accept="image/png,image/jpeg,image/webp"
                  onChange={choosePhoto}
                  type="file"
                />
                <span className="upload-icon"><Camera aria-hidden="true" size={20} /></span>
                <strong>{draft.imageName || "Add a food photo"}</strong>
                <span>JPG, PNG, or WEBP · photo optional</span>
                <span className="upload-action">Choose image</span>
              </label>
              {fileMessage && (
                <ReadinessNotice variant={analysisApplied ? "warning" : "info"}>
                  {fileMessage}
                </ReadinessNotice>
              )}
              <div className="sample-analysis-row">
                <span>
                  <Sparkles aria-hidden="true" size={16} />
                  Want to preview the AI Passport?
                </span>
                <Button
                  onClick={useSampleSuggestion}
                  type="button"
                  variant="outline"
                >
                  Use sample suggestion
                </Button>
              </div>
              {analysisApplied && (
                <div className="suggestion-banner">
                  <Badge variant="neutral">DEMO AI SUGGESTION</Badge>
                  <span>
                    Example suggestion only · no AI service analyzed your image.
                  </span>
                </div>
              )}

              <div className="form-grid">
                <label className="field-label field-span-2">
                  Food name
                  {analysisApplied && <span className="field-provenance">Sample suggestion · review</span>}
                  <Input
                    onChange={(event) => updateDraft("itemName", event.target.value)}
                    placeholder="e.g. Vegetarian pasta meals"
                    value={draft.itemName}
                  />
                </label>
                <label className="field-label">
                  Food category
                  <select
                    className="field-input"
                    onChange={(event) => updateDraft("category", event.target.value)}
                    value={draft.category}
                  >
                    <option>Prepared meals</option>
                    <option>Bakery</option>
                    <option>Produce</option>
                    <option>Packaged food</option>
                  </select>
                </label>
                <label className="field-label">
                  Quantity
                  <span className="quantity-input-wrap">
                    <Input
                      min={1}
                      onChange={(event) => {
                        const quantity = Math.max(
                          1,
                          Math.floor(Number(event.target.value) || 1),
                        )
                        updateDraft("quantity", quantity)
                        const nextRecipients =
                          quantity < selectedRecipients.length
                            ? selectedRecipients.slice(0, quantity)
                            : selectedRecipients
                        if (nextRecipients.length !== selectedRecipients.length) {
                          setSelectedRecipients(nextRecipients)
                        }
                        setAllocationQuantities(splitQuantity(quantity, nextRecipients.length))
                      }}
                      type="number"
                      value={draft.quantity}
                    />
                    <span>meals</span>
                  </span>
                </label>
                <div className="field-label field-span-2">
                  Dietary tags <span className="field-optional">Optional</span>
                  <div className="tag-options">
                    {["Vegetarian", "Vegan", "Halal", "Gluten-free"].map((tag) => (
                      <button
                        aria-pressed={draft.dietaryTags.includes(tag)}
                        className={`choice-chip${draft.dietaryTags.includes(tag) ? " choice-chip--selected" : ""}`}
                        key={tag}
                        onClick={() => toggleDietaryTag(tag)}
                        type="button"
                      >
                        {draft.dietaryTags.includes(tag) && <Check aria-hidden="true" size={13} />}
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="field-label field-span-2">
                  Potential allergens
                  <span className="field-hint">AI may suggest visible ingredients, but only your confirmation is used for matching.</span>
                  <Input
                    onChange={(event) => updateDraft("potentialAllergens", event.target.value)}
                    placeholder="Enter known allergens, or leave blank until confirmed"
                    value={draft.potentialAllergens}
                  />
                </label>
                <label className="field-label field-span-2">
                  Allergen information status
                  <select
                    className="field-input"
                    onChange={(event) =>
                      updateDraft(
                        "allergenStatus",
                        event.target.value as DonationDraft["allergenStatus"],
                      )
                    }
                    value={draft.allergenStatus}
                  >
                    <option value="UNKNOWN">Unknown — not yet confirmed</option>
                    <option value="DONOR_CONFIRMED">Donor confirmed</option>
                    <option value="NOT_APPLICABLE">Not applicable</option>
                  </select>
                </label>
              </div>
              <ReadinessNotice variant="warning">
                <AlertTriangle aria-hidden="true" size={18} />
                <span>
                  <strong>Image analysis does not determine food safety.</strong>
                  <span>Confirm ingredients, allergens, preparation time, and storage yourself.</span>
                </span>
              </ReadinessNotice>
            </Card>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : -5 }}
              initial={{ opacity: 0, y: reducedMotion ? 0 : 7 }}
              key="rescue-plan"
              transition={transition}
            >
            <Card className="panel wizard-card">
              <div className="wizard-card-heading">
                <div>
                  <span className="step-kicker">STEP 2 OF 3</span>
                  <h2>Check rescue readiness</h2>
                  <p>Only recipients that can use the food before your cutoff can be selected.</p>
                </div>
                <span className="wizard-heading-icon"><MapPin aria-hidden="true" size={19} /></span>
              </div>
              <div className="form-grid safety-details">
                <label className="field-label">
                  Prepared at
                  <Input
                    onChange={(event) => updateDraft("preparedAt", event.target.value)}
                    type="datetime-local"
                    value={draft.preparedAt}
                  />
                </label>
                <label className="field-label">
                  Storage condition
                  <select
                    className="field-input"
                    onChange={(event) => updateDraft("storageCondition", event.target.value)}
                    value={draft.storageCondition}
                  >
                    <option>Refrigerated</option>
                    <option>Hot-held</option>
                    <option>Frozen</option>
                    <option>Room temperature</option>
                  </select>
                </label>
                <label className="field-label">
                  Pickup available at
                  <Input
                    onChange={(event) => updateDraft("pickupAvailableAt", event.target.value)}
                    type="datetime-local"
                    value={draft.pickupAvailableAt}
                  />
                </label>
                <label className="field-label">
                  Usable until <span className="field-required">Required</span>
                  <Input
                    onChange={(event) => updateDraft("usableUntil", event.target.value)}
                    type="datetime-local"
                    value={draft.usableUntil}
                  />
                </label>
              </div>
              <ReadinessNotice variant="info">
                <Clock3 aria-hidden="true" size={18} />
                <span>
                  <strong>Your cutoff controls route feasibility.</strong>
                  <span>AI does not set or extend the donor-entered usable-until time.</span>
                </span>
              </ReadinessNotice>

              <div className="recipient-picker-heading">
                <div>
                  <h3>Choose recipients</h3>
                  <p>Select up to two ready recipients; the allocation must total {draft.quantity} meals.</p>
                </div>
                <Badge
                  aria-live="polite"
                  variant={
                    allocationIsBalanced
                      ? "success"
                      : remainingQuantity > 0
                        ? "warning"
                        : "danger"
                  }
                >
                  <motion.span
                    animate={{ opacity: 1, y: 0 }}
                    initial={{ opacity: 0, y: reducedMotion ? 0 : 3 }}
                    key={`${allocatedQuantity}-${draft.quantity}`}
                    transition={transition}
                  >
                    {allocatedQuantity}
                  </motion.span>
                  {" "}/ {draft.quantity} allocated
                </Badge>
              </div>
              <div className="recipient-candidate-list">
                {recipientCandidates.map((candidate) => {
                  const selectedIndex = selectedRecipients.indexOf(candidate.id)
                  const selected = selectedIndex !== -1
                  const maxAllocation = selected
                    ? Math.max(
                        1,
                        draft.quantity -
                          allocationQuantities.reduce(
                            (total, quantity, index) =>
                              index === selectedIndex ? total : total + quantity,
                            0,
                          ),
                      )
                    : draft.quantity
                  return (
                    <motion.div
                      className={`recipient-candidate${selected ? " recipient-candidate--selected" : ""}${candidate.readiness === "BLOCKED" ? " recipient-candidate--blocked" : ""}`}
                      key={candidate.id}
                      layout
                      transition={{
                        layout: { duration: reducedMotion ? 0.12 : 0.2 },
                      }}
                    >
                      <button
                        aria-pressed={selected}
                        className="candidate-select"
                        disabled={candidate.readiness === "BLOCKED"}
                        onClick={() => toggleRecipient(candidate)}
                        type="button"
                      >
                        <span className={`candidate-avatar${candidate.readiness === "BLOCKED" ? " candidate-avatar--muted" : ""}`}>
                          {candidate.initials}
                        </span>
                        <span className="candidate-main">
                          <strong>{candidate.name}</strong>
                          <span>
                            {candidate.readiness === "READY"
                              ? `${candidate.distance} · ${candidate.eta} estimated arrival · ${candidate.unmetNeed} meals needed`
                              : candidate.reasons[0]}
                          </span>
                          {selected && (
                            <span className="candidate-reasons">
                              {candidate.reasons.slice(0, 3).join(" · ")}
                            </span>
                          )}
                        </span>
                        <span className={`readiness-indicator${candidate.readiness === "BLOCKED" ? " readiness-indicator--blocked" : ""}`}>
                          {candidate.readiness === "READY" ? "READY" : "BLOCKED"}
                        </span>
                      </button>
                      <AnimatePresence initial={false}>
                        {selected && (
                          <motion.label
                            animate={{ opacity: 1, height: "auto", y: 0 }}
                            className="allocation-control"
                            exit={{ opacity: 0, height: 0, y: reducedMotion ? 0 : -3 }}
                            initial={{ opacity: 0, height: 0, y: reducedMotion ? 0 : 3 }}
                            key={`allocation-${candidate.id}`}
                            transition={transition}
                          >
                            Allocate
                            <Input
                              aria-label={`Meals allocated to ${candidate.name}`}
                              max={maxAllocation}
                              min={1}
                              onChange={(event) => {
                                const entered = Math.max(
                                  1,
                                  Math.floor(Number(event.target.value) || 1),
                                )
                                setAllocationQuantities((current) => {
                                  const otherQuantity = current.reduce(
                                    (total, quantity, index) =>
                                      index === selectedIndex ? total : total + quantity,
                                    0,
                                  )
                                  const next = [...current]
                                  next[selectedIndex] = Math.min(
                                    entered,
                                    Math.max(1, draft.quantity - otherQuantity),
                                  )
                                  return next
                                })
                              }}
                              type="number"
                              value={allocationQuantities[selectedIndex] ?? 0}
                            />
                            meals
                          </motion.label>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </div>
              {!allocationIsBalanced && (
                <p
                  aria-live="polite"
                  className="allocation-balance-message"
                  role="status"
                >
                  {remainingQuantity > 0
                    ? `${remainingQuantity} meals still need to be allocated.`
                    : `${Math.abs(remainingQuantity)} meals exceed the donation quantity.`}
                </p>
              )}
              {error && <p className="form-error" role="alert">{error}</p>}
              <motion.div className="route-forecast" layout transition={{ layout: { duration: reducedMotion ? 0.12 : 0.2 } }}>
                <span className="route-forecast-icon"><MapPin aria-hidden="true" size={17} /></span>
                <span>
                  <strong>Sample route estimate · {estimatedRouteMinutes} min total</strong>
                  <small>
                    {allocations.map((item) => `${item.recipient.name} ${item.recipient.eta}`).join(" → ")}
                  </small>
                </span>
                <Badge variant={routeForecast.variant}>{routeForecast.label}</Badge>
              </motion.div>
            </Card>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : -5 }}
              initial={{ opacity: 0, y: reducedMotion ? 0 : 7 }}
              key="review"
              transition={transition}
            >
            <Card className="panel wizard-card">
              <div className="wizard-card-heading">
                <div>
                  <span className="step-kicker">STEP 3 OF 3</span>
                  <h2>Review before you start</h2>
                  <p>Offers are sent only after your explicit confirmation.</p>
                </div>
                <span className="wizard-heading-icon"><ShieldCheck aria-hidden="true" size={19} /></span>
              </div>
              <div className="review-summary">
                <div className="review-food-icon"><Utensils aria-hidden="true" size={21} /></div>
                <div>
                  <h3>{draft.itemName}</h3>
                  <p>{draft.category} · {draft.quantity} meals</p>
                </div>
                <Badge variant={analysisApplied ? "neutral" : "outline"}>
                  {analysisApplied ? "Sample suggestions reviewed" : "Manual entry"}
                </Badge>
              </div>
              <div className="review-grid">
                <div><small>Prepared</small><strong>{formatLocalDate(draft.preparedAt)}</strong></div>
                <div><small>Storage</small><strong>{draft.storageCondition}</strong></div>
                <div><small>Pickup from</small><strong>{formatLocalDate(draft.pickupAvailableAt)}</strong></div>
                <div><small>Usable until</small><strong>{formatLocalDate(draft.usableUntil)}</strong></div>
                <div><small>Dietary tags</small><strong>{draft.dietaryTags.join(", ") || "None confirmed"}</strong></div>
                <div><small>Allergen status</small><strong>{draft.allergenStatus.replaceAll("_", " ")}</strong></div>
              </div>
              <div className="review-section-heading">
                <h3>Rescue plan</h3>
                <Badge variant="success">READY</Badge>
              </div>
              <div className="review-allocation-list">
                {allocations.map((item) => (
                  <motion.div
                    animate={{ opacity: 1, x: 0 }}
                    className="review-allocation"
                    initial={{ opacity: 0, x: reducedMotion ? 0 : -5 }}
                    key={item.recipient.id}
                    layout
                    transition={transition}
                  >
                    <span className="candidate-avatar">{item.recipient.initials}</span>
                    <span><strong>{item.recipient.name}</strong><small>{item.recipient.eta} · {item.recipient.distance} away</small></span>
                    <b>{item.quantity} meals</b>
                  </motion.div>
                ))}
              </div>
              <ReadinessNotice variant="warning">
                <AlertTriangle aria-hidden="true" size={18} />
                <span>
                  <strong>Final safety check</strong>
                  <span>SecondServe does not certify food safety. You are responsible for the details you confirm.</span>
                </span>
              </ReadinessNotice>
              <label className="confirmation-control">
                <input
                  checked={draft.donorConfirmed}
                  onChange={(event) => updateDraft("donorConfirmed", event.target.checked)}
                  type="checkbox"
                />
                <span>
                  I reviewed the food details, allergens, storage, pickup time, and usable-until cutoff. These are donor-confirmed details—not AI-certified safety claims.
                </span>
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
            </Card>
            </motion.div>
          )}
          </AnimatePresence>

          <div className="wizard-actions">
            <Button
              disabled={step === 0}
              onClick={() => {
                setError("")
                setStep((current) => Math.max(0, current - 1))
              }}
              type="button"
              variant="outline"
            >
              <ChevronLeft aria-hidden="true" size={17} /> Back
            </Button>
            {step < 2 ? (
              <Button onClick={goNext} type="button">
                Continue <ChevronRight aria-hidden="true" size={17} />
              </Button>
            ) : (
              <Button onClick={startRescue} type="button">
                Start rescue offers <ArrowRight aria-hidden="true" size={17} />
              </Button>
            )}
          </div>
        </div>
        <aside className="wizard-aside">
          <Card className="panel aside-card">
            <div className="aside-icon"><ShieldCheck aria-hidden="true" size={18} /></div>
            <h3>Food safety stays with the donor</h3>
            <p>AI can suggest visible details. It cannot confirm ingredients, allergens, temperature history, or whether food is safe to eat.</p>
          </Card>
          <Card className="panel aside-card">
            <div className="aside-icon aside-icon--amber"><Clock3 aria-hidden="true" size={18} /></div>
            <h3>A feasible rescue, first</h3>
            <p>Only recipients with compatible need, capacity, hours, and arrival time can be offered food automatically.</p>
          </Card>
          <div className="demo-side-note">
            <Sparkles aria-hidden="true" size={16} />
            <span><strong>Prototype mode</strong>Details, offers, and impact are stored only in this browser session.</span>
          </div>
        </aside>
      </div>
    </>
  )
}

function AllocationProgress({ donation }: { donation: DemoDonation }) {
  const reducedMotion = useReducedMotion() ?? false
  return (
    <div className="allocation-progress-list">
      <AnimatePresence initial={false}>
      {donation.allocations.map((allocation, index) => (
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          className="allocation-progress-row"
          exit={{ opacity: 0, x: reducedMotion ? 0 : -6 }}
          initial={{ opacity: 0, x: reducedMotion ? 0 : 6 }}
          key={`${allocation.id}-${allocation.recipientId}-${allocation.status}`}
          layout
          transition={{ duration: reducedMotion ? 0.12 : 0.2, ease: "easeOut" }}
        >
          <span className={`allocation-step-icon allocation-step-icon--${allocation.status.toLowerCase()}`}>
            {allocation.status === "RECEIVED" || allocation.status === "ACCEPTED" ? (
              <Check aria-hidden="true" size={15} />
            ) : (
              index + 1
            )}
          </span>
          <span className="allocation-progress-copy">
            <strong>{allocation.recipientName}</strong>
            <span>{allocation.quantity} meals · {allocation.distance} · {allocation.eta}</span>
            {allocation.fallbackRecipientName && allocation.status === "OFFERING" && (
              <small>Fallback if unanswered: {allocation.fallbackRecipientName}</small>
            )}
          </span>
          <Badge
            variant={
              allocation.status === "RECEIVED" || allocation.status === "ACCEPTED"
                ? "success"
                : allocation.status === "OFFERING"
                  ? "warning"
                  : "neutral"
            }
          >
            {allocation.status === "OFFERING"
              ? "Offer active"
              : allocation.status === "QUEUED"
                ? "Next in plan"
                : allocation.status === "ACCEPTED"
                  ? "Accepted"
                  : allocation.status === "RECEIVED"
                    ? `${allocation.receivedQuantity ?? 0} received`
                    : "Declined"}
          </Badge>
        </motion.div>
      ))}
      </AnimatePresence>
    </div>
  )
}

export function TrackDonationPage() {
  const { donationId } = useParams()
  const { donations } = useDemoStore()
  const reducedMotion = useReducedMotion() ?? false
  const transition = { duration: reducedMotion ? 0.12 : 0.2, ease: "easeOut" as const }
  const donation = donations.find((item) => item.id === donationId)
  const active = donation ? getCurrentAllocation(donation) : undefined
  const confirmed = donation ? getConfirmedQuantity(donation) : 0
  const nextAction = donation ? getDonorNextAction(donation) : undefined
  const fallbackAvailable = Boolean(active?.fallbackRecipientName)

  if (!donation) {
    return (
      <div className="not-found-page">
        <PageHeading description="This donation may have been reset with the demo data." title="Donation not found" />
        <PrimaryLink to="/donor/donations">Back to donations</PrimaryLink>
      </div>
    )
  }

  return (
    <>
      <PageHeading
        action={<StatusBadge status={donation.status} />}
        description={`${donation.quantity} meals · created ${donation.createdAt}`}
        eyebrow={<Link className="back-link" to="/donor/donations">← Donations</Link>}
        title={donation.itemName}
      />
      <div className="tracking-layout">
        <div className="tracking-main">
          <Card className="panel tracking-panel">
            <div className="panel-heading">
              <h2>Rescue timeline</h2>
              <Badge variant="neutral">SAMPLE DATA</Badge>
            </div>
            <div className="tracking-panel-content">
              <RescueTimeline status={donation.status} />
              <div className="tracking-event-list">
                <div className="tracking-event tracking-event--done">
                  <span className="event-marker"><Check aria-hidden="true" size={13} /></span>
                  <div><strong>Donation details confirmed</strong><small>{donation.quantity} {donation.unit} · donor-entered cutoff: {donation.usableUntil}</small></div>
                  <small>{donation.createdAt}</small>
                </div>
                <div className="tracking-event tracking-event--done">
                  <span className="event-marker"><Check aria-hidden="true" size={13} /></span>
                  <div><strong>Readiness checked</strong><small>Feasible route · allocated quantity: {donation.quantity} meals</small></div>
                  <small>Demo route</small>
                </div>
                <AnimatePresence initial={false}>
                {donation.status === "RELAYED" && (
                  <motion.div
                    animate={{ opacity: 1, x: 0 }}
                    className="tracking-event tracking-event--current"
                    exit={{ opacity: 0, x: reducedMotion ? 0 : -6 }}
                    initial={{ opacity: 0, x: reducedMotion ? 0 : 6 }}
                    key="relay-event"
                    transition={transition}
                  >
                    <span className="event-marker"><ArrowRight aria-hidden="true" size={13} /></span>
                    <div><strong>Offer relayed to next recipient</strong><small>The first recipient declined; the demo moved the offer to the fallback.</small></div>
                    <small>Now</small>
                  </motion.div>
                )}
                {active && (
                  <motion.div
                    animate={{ opacity: 1, x: 0 }}
                    className="tracking-event tracking-event--current"
                    exit={{ opacity: 0, x: reducedMotion ? 0 : -6 }}
                    initial={{ opacity: 0, x: reducedMotion ? 0 : 6 }}
                    key={`active-${active.recipientId}-${donation.status}`}
                    transition={transition}
                  >
                    <span className="event-marker"><Clock3 aria-hidden="true" size={13} /></span>
                    <div><strong>{donation.status === "ACCEPTED" ? "Recipient accepted" : "Waiting for recipient response"}</strong><small>{active.recipientName} · {active.quantity} meals · estimated arrival {active.eta}</small></div>
                    <small>
                      {donation.status === "ACCEPTED"
                        ? "Handoff pending"
                        : "Sample response window · not live"}
                    </small>
                  </motion.div>
                )}
                {(donation.status === "RECEIVED" || donation.status === "PARTIALLY_RECEIVED") && (
                  <motion.div
                    animate={{ opacity: 1, x: 0 }}
                    className="tracking-event tracking-event--received"
                    exit={{ opacity: 0, x: reducedMotion ? 0 : -6 }}
                    initial={{ opacity: 0, x: reducedMotion ? 0 : 6 }}
                    key="receipt-event"
                    transition={transition}
                  >
                    <span className="event-marker"><Check aria-hidden="true" size={13} /></span>
                    <div><strong>Recipient-confirmed receipt</strong><small>{confirmed} meals confirmed received. Only this amount counts toward impact.</small></div>
                    <small>Complete</small>
                  </motion.div>
                )}
                {donation.status === "UNCLAIMED" && (
                  <motion.div
                    animate={{ opacity: 1, x: 0 }}
                    className="tracking-event tracking-event--blocked"
                    exit={{ opacity: 0, x: reducedMotion ? 0 : -6 }}
                    initial={{ opacity: 0, x: reducedMotion ? 0 : 6 }}
                    key="unclaimed-event"
                    transition={transition}
                  >
                    <span className="event-marker"><AlertTriangle aria-hidden="true" size={13} /></span>
                    <div><strong>No active recipient</strong><small>All available demo recipients declined or the relay ended.</small></div>
                    <small>Action needed</small>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
              {nextAction && (
                <div className="tracking-next-action">
                  <ReadinessNotice variant={nextAction.variant}>
                    <span>
                      <strong>{nextAction.title}</strong>
                      <span>{nextAction.description}</span>
                    </span>
                  </ReadinessNotice>
                </div>
              )}
            </div>
          </Card>
          <Card className="panel tracking-panel">
            <div className="panel-heading">
              <h2>Split rescue plan</h2>
              <span className="panel-subtitle">{donation.allocations.length} stops · quantity conserved</span>
            </div>
            <AllocationProgress donation={donation} />
            <div className="tracking-quantity-footer">
              <span>Confirmed received <strong>{confirmed}</strong></span>
              <span>Still in plan <strong>{Math.max(0, donation.quantity - confirmed)}</strong></span>
              <span>Total listed <strong>{donation.quantity}</strong></span>
            </div>
          </Card>
        </div>
        <aside className="tracking-side">
          <Card className="panel tracking-side-card">
            <div className="aside-icon"><MapPin aria-hidden="true" size={18} /></div>
            <span className="side-card-kicker">CURRENT OFFER</span>
            <AnimatePresence initial={false} mode="wait">
              {active ? (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reducedMotion ? 0 : -4 }}
                  initial={{ opacity: 0, y: reducedMotion ? 0 : 5 }}
                  key={`${active.recipientId}-${donation.status}`}
                  transition={transition}
                >
                  <h3>{active.recipientName}</h3>
                  <p>{active.quantity} meals · {active.distance} away</p>
                  {donation.status === "ACCEPTED" ? (
                    <motion.div
                      animate={{ opacity: 1, scale: 1 }}
                      className="handoff-code-box"
                      initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.97 }}
                      transition={transition}
                    >
                      <span>One-time handoff code</span>
                      <strong>{donation.handoffCode}</strong>
                      <small>Share this code with {active.recipientName} at handoff.</small>
                    </motion.div>
                  ) : (
                    <div className="countdown-box">
                      <Clock3 aria-hidden="true" size={17} />
                      <span>
                        <strong>Sample response window</strong>
                        <small>Illustrative only · not a live timer</small>
                      </span>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reducedMotion ? 0 : 4 }}
                  initial={{ opacity: 0, y: reducedMotion ? 0 : -4 }}
                  key="no-active-offer"
                  transition={transition}
                >
                  <h3>No active offer</h3>
                  <p>Offers are complete or awaiting manual review.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
          <Card className="panel tracking-side-card">
            <div className="aside-icon aside-icon--amber"><CalendarDays aria-hidden="true" size={18} /></div>
            <span className="side-card-kicker">DONOR CUTOFF</span>
            <h3>{donation.usableUntil}</h3>
            <p>Set by the donor. Route estimates do not extend or certify this time.</p>
          </Card>
          <ReadinessNotice variant={fallbackAvailable ? "warning" : "info"}>
            <Clock3 aria-hidden="true" size={18} />
            <span>
              <strong>Sequential rescue relay</strong>
              <span>Only one active offer runs at a time. If declined, the system follows the planned fallback.</span>
            </span>
          </ReadinessNotice>
          <div className="cross-role-link">
            <strong>Testing the recipient journey?</strong>
            <p>Open the separate demo role from the entry screen; there is no in-app role switch.</p>
            <Link className="text-link" to="/">
              Return to role entry <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>
        </aside>
      </div>
    </>
  )
}
