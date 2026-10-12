import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  HeartHandshake,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  MapPin,
  Info,
  Plus,
  ShieldCheck,
  Sparkles,
  Utensils,
  FaceSlightlySmilingPlus
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { AvatarStack, MetricCard, PageHeading, PrimaryLink, ReadinessNotice, RescueTimeline, RouteMeta, StatusBadge } from "@/components/AppShell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  getConfirmedQuantity,
  getCurrentAllocation,
  type DemoDonation,
  type NewDonationInput,
} from "@/lib/demo-data"
import { useDemoStore } from "@/lib/demo-context"
import type { ApiFoodAnalysis, ApiForecast, ApiRescuePlan } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"

function getRecentWeekStarts(): Date[] {
  return Array.from({ length: 8 }, (_, index) => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (7 - index) * 7)
    return start
  })
}

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

function getConnectedImpact(
  donations: DemoDonation[],
  summary: { confirmedQuantity: number } | null,
) {
  const offeredMeals = donations.reduce((total, donation) => total + donation.quantity, 0)
  const confirmedMeals =
    summary?.confirmedQuantity ??
    donations.reduce((total, donation) => total + getConfirmedQuantity(donation), 0)
  return {
    confirmedMeals,
    offeredMeals,
    rescueRate:
      offeredMeals === 0 ? 0 : Math.round((confirmedMeals / offeredMeals) * 100),
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

function OpportunityCard({ forecast }: { forecast: ApiForecast | null }) {
  const [forecastInfoOpen, setForecastInfoOpen] = useState(false)

  return (
    <Card className="panel opportunity-card">
      <div className="panel-heading">
        <h2>Rescue opportunity</h2>
        <div className="forecast-heading-actions">
          <button
            aria-controls="forecast-info-popover"
            aria-expanded={forecastInfoOpen}
            aria-label="About the surplus forecast"
            className="forecast-info"
            onClick={() => setForecastInfoOpen((open) => !open)}
            type="button"
          >
            <Info aria-hidden="true" size={16} />
          </button>
          {forecastInfoOpen && (
            <div className="forecast-info-popover" id="forecast-info-popover" role="status">
              <p>
                New workspaces start with a built-in planning profile, not recorded
                activity. As donations are logged, estimates recalculate from your
                weekday history.
              </p>
              <button
                aria-label="Close forecast information"
                className="forecast-info-close"
                onClick={() => setForecastInfoOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="opportunity-content">
        {forecast?.opportunities.length ? (
          <>
            <div className="opportunity-label">WEEKLY SURPLUS FORECAST</div>
            <h3>{forecast.usesBaseline ? "Starting forecast for your kitchen" : "Plan around your recurring surplus"}</h3>
            <p>
              {forecast.usesBaseline
                ? "Planning profile adapts as your donation history grows. Estimates only."
                : `Based on ${forecast.sampleSize} weeks of your donation history · planning estimates, not guarantees.`}
            </p>
            <div aria-label="Forecast by weekday, in meals" className="forecast-week-calendar">
              {forecast.opportunities.map((opportunity) => (
                <div
                  aria-label={`${opportunity.weekday}: ${opportunity.predictedQuantity} meals${opportunity.isBaseline ? ", starting estimate" : ", based on donation history"}`}
                  className={`forecast-calendar-day${opportunity.isBaseline ? " forecast-calendar-day--baseline" : ""}`}
                  key={opportunity.weekday}
                  title={`${opportunity.weekday}: ${opportunity.predictedQuantity} meals${opportunity.isBaseline ? " · starting estimate" : ` · ${opportunity.sampleSize} weeks of history`}`}
                >
                  <span>{opportunity.weekday.slice(0, 3)}</span>
                  <strong>{opportunity.predictedQuantity}</strong>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="forecast-empty">
            <span className="opportunity-label">WEEKLY SURPLUS FORECAST</span>
            <h3>Forecast is temporarily unavailable</h3>
            <p>We couldn’t load a planning estimate right now. Try refreshing your workspace.</p>
          </div>
        )}
      </div>
    </Card>
  )
}

export function DonorDashboardPage() {
  const { donations, forecast, impactSummary } = useDemoStore()
  const { profile } = useAuth()
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
  const impact = getConnectedImpact(donations, impactSummary)

  return (
    <>
      <PageHeading
        action={
          <PrimaryLink to="/donor/new">
            <Plus aria-hidden="true" size={18} /> New donation
          </PrimaryLink>
        }
        description="Here’s what’s happening with your food rescue efforts."
        title={`Welcome, ${profile?.displayName ?? profile?.organizationName ?? "there"}`}
      />
      <div className="metrics-grid">
        <MetricCard
          icon={<ArrowUpRight aria-hidden="true" size={17} />}
          note="Across confirmed recipient receipts"
          title="Meals rescued"
          value={impact.confirmedMeals.toLocaleString()}
        />
        <MetricCard
          icon={<span className="metric-target">◎</span>}
          note={`${activeCount} active rescue${activeCount === 1 ? "" : "s"}`}
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
        {active ? (
          <ActiveRescueCard donation={active} />
        ) : (
          <Card className="panel empty-panel dashboard-active-card">
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
        <OpportunityCard forecast={forecast} />
        <RecentActivity />
        <ImpactPreview
          confirmed={impact.confirmedMeals}
          offered={impact.offeredMeals}
          rescueRate={impact.rescueRate}
        />
      </div>
    </>
  )
}

function RecentActivity() {
  const { donations } = useDemoStore()
  const activities = donations
    .flatMap((donation) =>
      (donation.events ?? []).map((event) => ({
        id: `${donation.id}-${event.type}-${event.occurredAt}`,
        title: activityTitle(event.type),
        detail: `${donation.itemName} · ${event.detail}`,
        occurredAt: event.occurredAt,
        time: new Date(event.occurredAt).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        kind: event.type === "RECEIPT_CONFIRMED" ? "received" : "plan",
      })),
    )
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
    .slice(0, 3)

  return (
    <Card className="panel activity-panel">
      <div className="panel-heading">
        <h2>Recent activity</h2>
        <Link className="panel-link" to="/donor/donations">
          See history <ArrowRight aria-hidden="true" size={14} />
        </Link>
      </div>
      <div className="activity-list">
        {activities.length ? activities.map((activity) => (
          <div className="activity-row" key={activity.id}>
            <span className={`activity-icon activity-icon--${activity.kind}`}>
              {activity.kind === "received" ? <Check aria-hidden="true" size={16} /> : <ArrowUpRight aria-hidden="true" size={16} />}
            </span>
            <span className="activity-copy">
              <strong>{activity.title}</strong>
              <span>{activity.detail}</span>
            </span>
            <span className="activity-time">{activity.time}</span>
          </div>
        )) : (
          <div className="empty-state compact-empty">
            <p>Your donation and handoff activity will appear here.</p>
          </div>
        )}
      </div>
    </Card>
  )
}

function activityTitle(eventType: string): string {
  const titles: Record<string, string> = {
    DONATION_CREATED: "Donation created",
    RESCUE_PLAN_CREATED: "Readiness checked",
    OFFER_STARTED: "Rescue offer sent",
    OFFER_RELAYED: "Offer relayed",
    OFFER_ACCEPTED: "Offer accepted",
    OFFER_DECLINED: "Offer declined",
    OFFER_EXPIRED: "Offer expired",
    RECEIPT_CONFIRMED: "Receipt confirmed",
  }
  return titles[eventType] ?? eventType.toLowerCase().replaceAll("_", " ")
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
        <div
          className="impact-ring"
          style={{
            background: `conic-gradient(var(--brand-primary) 0 ${Math.max(0, Math.min(100, rescueRate))}%, #e6eee8 ${Math.max(0, Math.min(100, rescueRate))}% 100%)`,
          }}
        >
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
          {filtered.length} donation{filtered.length === 1 ? "" : "s"}
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
    </>
  )
}

export function DonorImpactPage() {
  const { donations, impactSummary } = useDemoStore()
  const impact = getConnectedImpact(donations, impactSummary)
  const { confirmedMeals: confirmed } = impact
  const communityPartnersReached = new Set(
    donations.flatMap((donation) =>
      donation.allocations
        .filter((allocation) => allocation.status === "RECEIVED")
        .map((allocation) => allocation.recipientId),
    ),
  ).size
  const receiptEvents = donations.flatMap((donation) =>
    (donation.events ?? [])
      .filter((event) => event.type === "RECEIPT_CONFIRMED")
      .map((event) => ({
        occurredAt: new Date(event.occurredAt),
        quantity: Number(event.payload.quantityReceived ?? 0),
      })),
  )
  const [weekStarts] = useState(getRecentWeekStarts)
  const weeklyReceipts = weekStarts.map((start, index) => {
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    const quantity = receiptEvents
      .filter((receipt) => receipt.occurredAt >= start && receipt.occurredAt < end)
      .reduce((total, receipt) => total + receipt.quantity, 0)
    return { label: `W${index + 1}`, quantity }
  })
  const maxWeeklyQuantity = Math.max(...weeklyReceipts.map((week) => week.quantity), 1)

  return (
    <div className="donor-impact-page">
      <PageHeading
        description="Recipient-confirmed outcomes for your organization."
        title="Your impact"
      />
      <div className="metrics-grid impact-metrics">
        <MetricCard
          icon={<FaceSlightlySmilingPlus aria-hidden="true" size={17} />}
          note="One recipient-confirmed meal = one smile"
          title="Smiles sparked"
          value={confirmed.toLocaleString()}
        />
        <MetricCard
          icon={<Sparkles aria-hidden="true" size={17} />}
          note="Confirmed meals ÷ meals offered"
          title="Rescue completion"
          value={`${impact.rescueRate}%`}
        />
        <MetricCard
          icon={<HeartHandshake aria-hidden="true" size={17} />}
          note="Unique organizations with confirmed handoffs"
          title="Community partners reached"
          value={communityPartnersReached.toLocaleString()}
        />
      </div>
      <div className="impact-page-grid">
        <Card className="panel impact-chart-card">
          <div className="panel-heading">
            <h2>Confirmed meals over time</h2>
            <Badge variant="neutral">RECEIPT HISTORY</Badge>
          </div>
          {receiptEvents.length > 0 ? (
            <div className="impact-chart">
              {weeklyReceipts.map((week) => (
                <div className="impact-chart-column" key={week.label}>
                  <span
                    style={{
                      height: `${week.quantity === 0 ? 2 : Math.max(8, (week.quantity / maxWeeklyQuantity) * 100)}%`,
                    }}
                    title={`${week.quantity} meals confirmed`}
                  />
                  <small>{week.label}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="impact-chart-empty">
              <span className="empty-icon"><CheckCircle2 aria-hidden="true" size={19} /></span>
              <strong>No confirmed handoffs yet</strong>
              <p>Weekly history will appear after recipients confirm a pickup.</p>
            </div>
          )}
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
    </div>
  )
}

type DonationDraft = {
  analysisId?: string
  itemName: string
  category: string
  quantity: number
  quantityWasSuggested: boolean
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

function nextPickupWindow(): { pickup: string; cutoff: string } {
  return {
    pickup: localDateTime(0.25),
    cutoff: localDateTime(5.25),
  }
}

function formatLocalDate(value: string): string {
  if (!value) return "Not set"
  return new Date(value).toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    prepared_meal: "Prepared meals",
    bakery: "Bakery",
    produce: "Produce",
    packaged_food: "Packaged food",
    other: "Other",
  }
  return labels[category] ?? category
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase())
}

const steps = [
  { title: "Food Passport", helper: "Food details" },
  { title: "Rescue plan", helper: "Feasibility & split" },
  { title: "Review", helper: "Confirm & start" },
]

export function NewDonationPage() {
  const navigate = useNavigate()
  const { analyzeImage, createDonation, previewPlan } = useDemoStore()
  const reducedMotion = useReducedMotion() ?? false
  const transition = { duration: reducedMotion ? 0.12 : 0.2, ease: "easeOut" as const }
  const [step, setStep] = useState(0)
  const [analysisResult, setAnalysisResult] = useState<ApiFoodAnalysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [planPreview, setPlanPreview] = useState<ApiRescuePlan | null>(null)
  const [planPreviewLoading, setPlanPreviewLoading] = useState(false)
  const [allergenEditorOpen, setAllergenEditorOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [passportReviewOpen, setPassportReviewOpen] = useState(false)
  const [passportReviewChecked, setPassportReviewChecked] = useState(false)
  const [passportReviewApproved, setPassportReviewApproved] = useState(false)
  const [fileMessage, setFileMessage] = useState("")
  const quantityInputRef = useRef<HTMLInputElement>(null)
  const foodNameInputRef = useRef<HTMLInputElement>(null)
  const continueButtonRef = useRef<HTMLButtonElement>(null)
  const passportDialogRef = useRef<HTMLElement>(null)
  const [draft, setDraft] = useState<DonationDraft>(() => {
    const pickupWindow = nextPickupWindow()
    return {
      itemName: "",
      category: "Prepared meals",
      quantity: 0,
      quantityWasSuggested: false,
      dietaryTags: [],
      potentialAllergens: "",
      allergenStatus: "UNKNOWN",
      preparedAt: localDateTime(-1),
      storageCondition: "Refrigerated",
      pickupAvailableAt: pickupWindow.pickup,
      usableUntil: pickupWindow.cutoff,
      donorConfirmed: false,
      imageName: "",
    }
  })
  const [error, setError] = useState("")
  useEffect(() => {
    if (!passportReviewOpen) return
    passportDialogRef.current?.focus()
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPassportReviewOpen(false)
        requestAnimationFrame(() => continueButtonRef.current?.focus())
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [passportReviewOpen])
  function updateDraft<Key extends keyof DonationDraft>(
    key: Key,
    value: DonationDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
    if (
      analysisResult &&
      [
        "itemName",
        "category",
        "dietaryTags",
        "potentialAllergens",
        "allergenStatus",
      ].includes(key)
    ) {
      setPassportReviewApproved(false)
    }
    if (analysisResult && key === "quantity" && draft.quantityWasSuggested) {
      setPassportReviewApproved(false)
    }
  }

  function toggleDietaryTag(tag: string) {
    if (analysisResult) setPassportReviewApproved(false)
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
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFileMessage("Choose a JPEG, PNG, or WEBP image.")
      return
    }
    setDraft((current) => ({
      ...current,
      imageName: file.name,
      analysisId: undefined,
      quantity: current.quantityWasSuggested ? 0 : current.quantity,
      quantityWasSuggested: false,
    }))
    setAnalysisResult(null)
    setPassportReviewApproved(false)
    setPlanPreview(null)
    setAnalysisLoading(true)
    setFileMessage("Sending the image to the configured backend for analysis…")
    void analyzeImage(file)
      .then((result) => {
        setAnalysisResult(result)
        const quantitySuggestion = result.candidate.quantitySuggestion?.value
        const suggestedQuantity =
          typeof quantitySuggestion === "number" &&
          Number.isInteger(quantitySuggestion) &&
          quantitySuggestion > 0
            ? quantitySuggestion
            : null
        setDraft((current) => ({
          ...current,
          analysisId: result.analysisId,
          itemName:
            typeof result.candidate.name?.value === "string"
              ? result.candidate.name.value
              : current.itemName,
          category:
            typeof result.candidate.category?.value === "string"
              ? categoryLabel(result.candidate.category.value)
              : current.category,
          dietaryTags: stringList(result.candidate.dietaryTags?.value).map(
            titleCase,
          ),
          potentialAllergens: stringList(
            result.candidate.potentialAllergens?.value,
          ).join(", "),
          quantity: suggestedQuantity ?? current.quantity,
          quantityWasSuggested: suggestedQuantity !== null,
          allergenStatus: "UNKNOWN",
          donorConfirmed: false,
        }))
        setFileMessage("")
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Image analysis failed."
        setFileMessage(`${message} You can continue with manual entry.`)
      })
      .finally(() => setAnalysisLoading(false))
  }

  function donationInput(): NewDonationInput {
    return {
      ...(draft.analysisId ? { analysisId: draft.analysisId } : {}),
      itemName: draft.itemName,
      category: draft.category,
      quantity: draft.quantity,
      dietaryTags: draft.dietaryTags,
      declaredAllergens: draft.potentialAllergens
        .split(/[,;]/)
        .map((allergen) => allergen.trim())
        .filter(Boolean),
      allergenStatus: draft.allergenStatus,
      preparedAt: draft.preparedAt,
      storageCondition: draft.storageCondition,
      pickupAvailableAt: draft.pickupAvailableAt,
      usableUntil: draft.usableUntil,
      donorConfirmed: draft.donorConfirmed,
      allocations: [],
    }
  }

  function validateStep(): boolean {
    if (step === 0) {
      if (analysisLoading) {
        setError("Wait for image analysis to finish, or continue with manual entry.")
        return false
      }
      if (!draft.itemName.trim()) {
        setError("Enter a food name before continuing.")
        foodNameInputRef.current?.focus()
        return false
      }
      if (draft.quantity < 1) {
        setError("Enter the actual quantity to donate. The photo cannot determine the count.")
        quantityInputRef.current?.focus()
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

  async function goNext() {
    if (step === 0 && analysisResult && !passportReviewApproved) {
      setPassportReviewChecked(false)
      setPassportReviewOpen(true)
      return
    }
    if (!validateStep()) return
    if (step === 1) {
      setPlanPreviewLoading(true)
      try {
        const preview = await previewPlan(donationInput())
        setPlanPreview(preview)
        if (preview.status === "NONE" || preview.status === "UNKNOWN") {
          const blockedReasons = new Set(
            preview.notReadyCandidates.flatMap(
              (candidate) => candidate.reasonCodes,
            ),
          )
          if (preview.status === "UNKNOWN") {
            setError("The backend could not verify a reliable route. No offer can be started.")
          } else if (
            draft.category === "Other" ||
            (blockedReasons.size > 0 &&
              [...blockedReasons].every((reason) => reason === "CATEGORY_NOT_ACCEPTED"))
          ) {
            setError(
              "No current recipient accepts “Other.” Go back, choose one homogeneous food lot, and select Prepared meals, Bakery, Produce, or Packaged food.",
            )
          } else {
            setError("The backend found no eligible recipient. Review the donor-entered cutoff, allergen details, and recipient readiness.")
          }
          return
        }
      } catch (previewError) {
        setError(
          previewError instanceof Error
            ? previewError.message
            : "Could not calculate a backend rescue plan.",
        )
        return
      } finally {
        setPlanPreviewLoading(false)
      }
    }
    setError("")
    setStep((current) => Math.min(2, current + 1))
  }

  function closePassportReview() {
    setPassportReviewOpen(false)
    requestAnimationFrame(() => continueButtonRef.current?.focus())
  }

  function approvePassportAndContinue() {
    if (!passportReviewChecked) return
    setPassportReviewApproved(true)
    setPassportReviewOpen(false)
    setError("")
    requestAnimationFrame(() => {
      if (validateStep()) setStep(1)
    })
  }

  async function startRescue() {
    if (!validateStep()) return
    setSubmitting(true)
    try {
      const id = await createDonation(donationInput())
      navigate(`/donor/donations/${id}`)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not start rescue offers.",
      )
    } finally {
      setSubmitting(false)
    }
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

              <label
                aria-busy={analysisLoading}
                className={`upload-zone${analysisLoading ? " upload-zone--loading" : ""}`}
              >
                <input
                  accept="image/png,image/jpeg,image/webp"
                  onChange={choosePhoto}
                  disabled={analysisLoading}
                  type="file"
                />
                <span className="upload-icon"><Camera aria-hidden="true" size={20} /></span>
                <strong>{draft.imageName || "Add a food photo"}</strong>
                {analysisResult ? (
                  <span className="upload-status-pill">
                    <CheckCircle2 aria-hidden="true" size={13} />
                    Gemini draft ready · review fields below
                  </span>
                ) : (
                  <span className="upload-file-hint">JPG, PNG, or WEBP · photo optional</span>
                )}
                <span className="upload-action">
                  {analysisLoading ? "Analyzing photo…" : "Choose image"}
                </span>
              </label>
              {analysisLoading ? (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  aria-live="polite"
                  className="analysis-loading-panel"
                  initial={{ opacity: 0, y: reducedMotion ? 0 : 5 }}
                  role="status"
                  transition={transition}
                >
                  <div className="analysis-loading-heading">
                    <span className="analysis-loading-icon">
                      <motion.span
                        animate={reducedMotion ? undefined : { rotate: 360 }}
                        transition={
                          reducedMotion
                            ? undefined
                            : { duration: 1.25, ease: "linear", repeat: Infinity }
                        }
                      >
                        <LoaderCircle aria-hidden="true" size={19} />
                      </motion.span>
                    </span>
                    <span>
                      <strong>Building your Food Passport</strong>
                      <span>Gemini is identifying visible food details for you to review.</span>
                    </span>
                  </div>
                  <div
                    aria-label="Image analysis in progress"
                    className="analysis-loading-track"
                    role="progressbar"
                  >
                    <span />
                  </div>
                  <div aria-hidden="true" className="analysis-loading-skeleton">
                    <span />
                    <span />
                    <span />
                  </div>
                  <p>
                    This may take a few seconds. Quantity, preparation time, storage,
                    and food safety always come from you—not the image analysis.
                  </p>
                </motion.div>
              ) : fileMessage && !analysisResult ? (
                <ReadinessNotice variant="warning">
                  {fileMessage}
                </ReadinessNotice>
              ) : null}
              {analysisResult && (
                <div aria-label="Gemini field suggestions" className="analysis-provenance-grid">
                  {[
                    ["name", "Food name"],
                    ["category", "Category"],
                    ["quantitySuggestion", "Quantity"],
                    ["dietaryTags", "Dietary tags"],
                    ["potentialAllergens", "Potential allergens"],
                    ["visiblePackaging", "Visible packaging"],
                  ].map(([key, label]) => {
                    const field = analysisResult.candidate[key]
                    return (
                      <span key={key}>
                        <strong>{label}</strong>
                        <small>
                          {key === "quantitySuggestion" && draft.quantity > 0
                            ? draft.quantityWasSuggested &&
                              field?.source === "AI_SUGGESTED"
                              ? `Gemini ballpark · ${Math.round(field.confidence * 100)}% confidence · verify`
                              : "Donor-entered · confirm"
                            : field?.source === "AI_SUGGESTED"
                            ? `Gemini suggestion · ${Math.round(field.confidence * 100)}% confidence · confirm`
                            : "Unknown · confirm manually"}
                        </small>
                      </span>
                    )
                  })}
                </div>
              )}
              {analysisResult?.candidate.category?.value === "other" && (
                <ReadinessNotice variant="warning">
                  <AlertTriangle aria-hidden="true" size={18} />
                  <span>
                    <strong>This photo appears to show several kinds of food.</strong>
                    <span>
                      The rescue flow accepts one homogeneous lot at a time. Choose one item,
                      edit its name and category, and create separate donations for other lots.
                    </span>
                  </span>
                </ReadinessNotice>
              )}

              <div className="form-grid">
                <label className="field-label field-span-2">
                  Food name
                  {analysisResult && (
                    <span className="field-provenance">
                      Gemini suggestion · donor review required
                    </span>
                  )}
                  <Input
                    ref={foodNameInputRef}
                    onChange={(event) => updateDraft("itemName", event.target.value)}
                    placeholder="e.g. Vegetarian pasta meals"
                    value={draft.itemName}
                  />
                </label>
                <label className="field-label">
                  Food category
                  <span className="field-hint field-hint--row">Choose the closest match for recipient planning.</span>
                  <div className="select-wrap">
                    <select
                      className="field-input"
                      onChange={(event) => updateDraft("category", event.target.value)}
                      value={draft.category}
                    >
                      <option>Prepared meals</option>
                      <option>Bakery</option>
                      <option>Produce</option>
                      <option>Packaged food</option>
                      <option>Other</option>
                    </select>
                  </div>
                </label>
                <label className="field-label">
                  Quantity
                  <span className="field-hint field-hint--row">
                    {draft.quantityWasSuggested
                      ? `Gemini ballpark · ${Math.round((analysisResult?.candidate.quantitySuggestion?.confidence ?? 0) * 100)}% confidence. Verify and correct the actual count.`
                      : analysisResult
                        ? "Gemini could not estimate countable portions in this photo. Enter the actual count."
                        : "Required · enter the actual count; a photo cannot determine quantity."}
                  </span>
                  <span className="quantity-input-wrap">
                    <Input
                      ref={quantityInputRef}
                      aria-invalid={Boolean(error && draft.quantity < 1)}
                      min={1}
                      onChange={(event) => {
                        const quantity = event.target.value
                          ? Math.max(1, Math.floor(Number(event.target.value) || 1))
                          : 0
                        updateDraft("quantity", quantity)
                        updateDraft("quantityWasSuggested", false)
                      }}
                      placeholder="Enter actual count"
                      type="number"
                      value={draft.quantity || ""}
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
                <div className="field-label field-span-2 allergen-review-field">
                  <span>Allergen confirmation <span className="field-optional">Optional</span></span>
                  <div className="allergen-review-card">
                    <div className="allergen-review-summary">
                      <span>
                        <strong>Allergen details</strong>
                        <small>
                          {draft.potentialAllergens.trim()
                            ? `AI suggestion: ${draft.potentialAllergens}`
                            : "No allergens were suggested from the image."}
                        </small>
                      </span>
                      <button
                        aria-expanded={allergenEditorOpen}
                        className="allergen-edit-button"
                        onClick={() => setAllergenEditorOpen((open) => !open)}
                        type="button"
                      >
                        {allergenEditorOpen ? "Done" : "Edit list"}
                      </button>
                    </div>
                    {allergenEditorOpen && (
                      <Input
                        aria-label="Known allergens"
                        onChange={(event) => updateDraft("potentialAllergens", event.target.value)}
                        placeholder="Enter known allergens, separated by commas"
                        value={draft.potentialAllergens}
                      />
                    )}
                    <label className="allergen-confirm-checkbox">
                      <input
                        checked={draft.allergenStatus === "DONOR_CONFIRMED"}
                        onChange={(event) =>
                          updateDraft(
                            "allergenStatus",
                            event.target.checked ? "DONOR_CONFIRMED" : "UNKNOWN",
                          )
                        }
                        type="checkbox"
                      />
                      <span>
                        I checked the ingredients and confirm this allergen information is accurate to the best of my knowledge.
                      </span>
                    </label>
                    {draft.allergenStatus !== "DONOR_CONFIRMED" && (
                      <small className="field-hint">Leave unchecked if you’re unsure.</small>
                    )}
                  </div>
                </div>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
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
                  <div className="select-wrap">
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
                  </div>
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

              <ReadinessNotice variant="info">
                <MapPin aria-hidden="true" size={18} />
                <span>
                  <strong>Recipients and split are calculated by the backend.</strong>
                  <span>
                    Continue to preview eligible organizations, capacity, live route
                    feasibility, and the donor cutoff. No offer starts during preview.
                  </span>
                </span>
              </ReadinessNotice>
              {planPreview && (
                <ReadinessNotice variant={planPreview.status === "FULL" ? "success" : "warning"}>
                  <MapPin aria-hidden="true" size={18} />
                  <span>
                    <strong>
                      {planPreview.status === "FULL"
                        ? "Backend preview covers the full quantity."
                        : `${planPreview.unallocatedQuantity} meals remain unallocated.`}
                    </strong>
                    <span>
                      {planPreview.route
                        ? `${planPreview.route.provider === "GOOGLE_ROUTES" ? "Google Routes" : "Route provider"} · ${Math.round((planPreview.route.durationSeconds ?? 0) / 60)} min · ${planPreview.route.distanceMeters ?? 0} m`
                        : "The backend did not return a verified route."}
                    </span>
                  </span>
                </ReadinessNotice>
              )}
              {error && <p className="form-error" role="alert">{error}</p>}
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
                <Badge variant={analysisResult ? "neutral" : "outline"}>
                  {analysisResult
                    ? "AI draft · donor review"
                    : "Manual entry"}
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
                <Badge
                  variant={
                    planPreview?.status === "PARTIAL"
                      ? "warning"
                      : "success"
                  }
                >
                  `${planPreview?.status ?? "NOT CHECKED"}`
                </Badge>
              </div>
              <div className="review-allocation-list">
                {planPreview?.allocations.map((item) => (
                  <motion.div
                    animate={{ opacity: 1, x: 0 }}
                    className="review-allocation"
                    initial={{ opacity: 0, x: reducedMotion ? 0 : -5 }}
                    key={item.allocationId}
                    layout
                    transition={transition}
                  >
                    <span className="candidate-avatar">
                      {item.recipientName.slice(0, 2).toUpperCase()}
                    </span>
                    <span>
                      <strong>{item.recipientName}</strong>
                      <small>
                        {item.reasonCodes.join(" · ").replaceAll("_", " ").toLowerCase()}
                      </small>
                    </span>
                    <b>{item.quantity} meals</b>
                  </motion.div>
                ))}
              </div>
              {planPreview && (
                <>
                  <ReadinessNotice variant={planPreview.status === "FULL" ? "success" : "warning"}>
                    <MapPin aria-hidden="true" size={18} />
                    <span>
                      <strong>
                        {planPreview.status === "FULL"
                          ? "Backend preview covers the full quantity."
                          : `${planPreview.unallocatedQuantity} meals remain unallocated.`}
                      </strong>
                      <span>
                        {planPreview.route
                          ? `${planPreview.route.provider === "GOOGLE_ROUTES" ? "Google Routes" : "Sample route"} · ${Math.round((planPreview.route.durationSeconds ?? 0) / 60)} min · ${planPreview.route.distanceMeters ?? 0} m`
                          : "No route was returned for this plan."}
                      </span>
                    </span>
                  </ReadinessNotice>
                  {planPreview.notReadyCandidates.length > 0 && (
                    <div className="candidate-reasons">
                      Not selected:{" "}
                      {planPreview.notReadyCandidates
                        .map(
                          (candidate) =>
                            `${candidate.recipientName || "Candidate"} (${candidate.reasonCodes.join(", ").toLowerCase().replaceAll("_", " ")})`,
                        )
                        .join(" · ")}
                    </div>
                  )}
                </>
              )}
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
                if (step === 1) setPassportReviewApproved(false)
                setStep((current) => Math.max(0, current - 1))
              }}
              type="button"
              variant="outline"
            >
              <ChevronLeft aria-hidden="true" size={17} /> Back
            </Button>
            {step < 2 ? (
              <Button
                disabled={analysisLoading || planPreviewLoading}
                onClick={() => void goNext()}
                type="button"
              >
                {planPreviewLoading ? "Checking feasibility…" : "Continue"}
                {!planPreviewLoading && <ChevronRight aria-hidden="true" size={17} />}
              </Button>
            ) : (
              <Button disabled={submitting} onClick={() => void startRescue()} type="button">
                {submitting ? "Starting…" : "Start rescue offers"}
                {!submitting && <ArrowRight aria-hidden="true" size={17} />}
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
        </aside>
      </div>
      <AnimatePresence>
        {passportReviewOpen && analysisResult && (
          <motion.div
            animate={{ opacity: 1 }}
            className="passport-review-backdrop"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
          >
            <motion.section
              animate={{ opacity: 1, y: 0, scale: 1 }}
              aria-labelledby="passport-review-title"
              aria-modal="true"
              className="passport-review-dialog"
              exit={{ opacity: 0, y: reducedMotion ? 0 : 8, scale: 0.98 }}
              initial={{ opacity: 0, y: reducedMotion ? 0 : 8, scale: 0.98 }}
              ref={passportDialogRef}
              role="dialog"
              tabIndex={-1}
              transition={transition}
            >
              <div className="passport-review-icon">
                <ShieldCheck aria-hidden="true" size={20} />
              </div>
              <span className="step-kicker">DONOR REVIEW REQUIRED</span>
              <h2 id="passport-review-title">Review the Gemini draft</h2>
              <p>
                These are visual suggestions, not verified facts. Correct anything
                that does not match the food you intend to donate.
              </p>
              <div className="passport-review-summary">
                <div>
                  <small>Food name</small>
                  <strong>{draft.itemName || "Not entered"}</strong>
                </div>
                <div>
                  <small>Category</small>
                  <strong>{draft.category || "Not selected"}</strong>
                </div>
                <div>
                  <small>Quantity</small>
                  <strong>
                    {draft.quantityWasSuggested
                      ? `${draft.quantity} meals · Gemini ballpark · verify`
                      : draft.quantity > 0
                        ? `${draft.quantity} meals · donor-entered`
                        : "No estimate · enter actual count"}
                  </strong>
                </div>
                <div>
                  <small>Dietary tags / allergens</small>
                  <strong>
                    {draft.dietaryTags.length || draft.potentialAllergens.trim()
                      ? "Review the fields on the form"
                      : "Unknown until you confirm labels"}
                  </strong>
                </div>
              </div>
              {draft.category === "Other" && (
                <ReadinessNotice variant="warning">
                  <AlertTriangle aria-hidden="true" size={18} />
                  <span>
                    <strong>This image appears to contain multiple food lots.</strong>
                    <span>
                      Choose one homogeneous lot and correct its name and category
                      before starting an offer. You can create separate donations
                      for the other items.
                    </span>
                  </span>
                </ReadinessNotice>
              )}
              <ReadinessNotice variant="warning">
                <AlertTriangle aria-hidden="true" size={18} />
                <span>
                  <strong>Gemini cannot verify food safety.</strong>
                  <span>
                    Quantity, ingredients/allergens, preparation, storage, and
                    usable-until cutoff remain your responsibility. An empty
                    allergen suggestion does not mean allergen-free.
                  </span>
                </span>
              </ReadinessNotice>
              <label className="confirmation-control passport-review-confirmation">
                <input
                  autoFocus
                  checked={passportReviewChecked}
                  onChange={(event) => setPassportReviewChecked(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  I reviewed the suggestions, corrected any inaccurate fields,
                  and will verify or enter the actual quantity and confirm all
                  donor-entered safety details.
                </span>
              </label>
              <div className="passport-review-actions">
                <Button
                  onClick={closePassportReview}
                  type="button"
                  variant="outline"
                >
                  Back to fields
                </Button>
                <Button
                  disabled={!passportReviewChecked}
                  onClick={() => {
                    approvePassportAndContinue()
                  }}
                  type="button"
                >
                  Approve and continue <ArrowRight aria-hidden="true" size={16} />
                </Button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
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

  if (!donation) {
    return (
      <div className="not-found-page">
        <PageHeading description="Check the donation link or reload your organization records." title="Donation not found" />
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
              <Badge variant="neutral">Live rescue events</Badge>
            </div>
            <div className="tracking-panel-content">
              <RescueTimeline status={donation.status} />
              <div className="tracking-event-list">
                {donation.events?.length ? (
                  donation.events.map((event) => {
                    const isReceipt = event.type === "RECEIPT_CONFIRMED"
                    const isActive = ["OFFER_STARTED", "OFFER_RELAYED"].includes(
                      event.type,
                    )
                    return (
                      <div
                        className={`tracking-event tracking-event--${isReceipt ? "received" : isActive ? "current" : "done"}`}
                        key={`${event.type}-${event.occurredAt}`}
                      >
                        <span className="event-marker">
                          {isReceipt ? (
                            <Check aria-hidden="true" size={13} />
                          ) : isActive ? (
                            <Clock3 aria-hidden="true" size={13} />
                          ) : (
                            <Check aria-hidden="true" size={13} />
                          )}
                        </span>
                        <div>
                          <strong>{event.type.replaceAll("_", " ").toLowerCase()}</strong>
                          <small>{event.detail}</small>
                        </div>
                        <small>
                          {new Date(event.occurredAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </small>
                      </div>
                    )
                  })
                ) : (
                  <p className="panel-empty-note">No rescue events have been recorded yet.</p>
                )}
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
                    <>
                      <div className="countdown-box">
                        <Clock3 aria-hidden="true" size={17} />
                        <span>
                          {donation.responseWindowEndsAt ? (
                            <>
                              <strong>Response due by</strong>
                              <small>
                                {new Date(donation.responseWindowEndsAt).toLocaleTimeString([], {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </small>
                            </>
                          ) : (
                            <>
                              <strong>Response deadline unavailable</strong>
                              <small>Refresh the donation or contact the recipient.</small>
                            </>
                          )}
                        </span>
                      </div>
                      {!donation.expiryScheduled && (
                        <ReadinessNotice variant="warning">
                          <Clock3 aria-hidden="true" size={16} />
                          <span>
                            <strong>Automatic timeout relay is unavailable locally.</strong>
                            <span>
                              The first response attempt after the deadline advances
                              the relay to the next eligible recipient.
                            </span>
                          </span>
                        </ReadinessNotice>
                      )}
                    </>
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
          <ReadinessNotice variant={active?.fallbackRecipientName ? "warning" : "info"}>
            <Clock3 aria-hidden="true" size={18} />
            <span>
              <strong>Sequential rescue relay</strong>
              <span>
                {active?.fallbackRecipientName
                  ? `Only one offer runs at a time. If declined, the offer can continue to ${active.fallbackRecipientName}.`
                  : "Only one offer runs at a time; each next step is determined by current eligibility and recorded responses."}
              </span>
            </span>
          </ReadinessNotice>
          <div className="cross-role-link">
            <strong>Testing the recipient journey?</strong>
            <p>Sign in with an account registered for the recipient organization.</p>
            <Link className="text-link" to="/">
              Return to role entry <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>
        </aside>
      </div>
    </>
  )
}
