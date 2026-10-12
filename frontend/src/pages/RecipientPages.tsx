import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  Info,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Utensils,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import {
  MetricCard,
  PageHeading,
  ReadinessNotice,
} from "@/components/AppShell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  type DemoDonation,
} from "@/lib/demo-data"
import { useDemoStore } from "@/lib/demo-context"
import { useAuth } from "@/lib/auth-context"

function useRecipientAccount() {
  const { recipientId = "" } = useParams()
  const { profile } = useAuth()
  const name = profile?.organizationName ?? "Recipient organization"
  return {
    id: recipientId,
    name,
    initials: name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    candidateId: profile?.recipientId ?? "",
  }
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    prepared_meal: "Prepared meals",
    bakery: "Bakery",
    produce: "Produce",
    packaged_food: "Packaged food",
  }
  return labels[category] ?? category
}

function formatRecipientHours(
  hours: Record<string, Array<[string, string]>>,
  timeZone: string,
): string {
  const entry = Object.entries(hours).find(([, ranges]) => ranges.length > 0)
  if (!entry) return "No open hours listed"
  const [day, ranges] = entry
  const [hour, minute] = ranges[0][1].split(":").map(Number)
  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12
  const dayLabel = day.slice(0, 3).replace(/^./, (letter) => letter.toUpperCase())
  return `${dayLabel} until ${displayHour}:${String(minute).padStart(2, "0")} ${period} (${timeZone})`
}

function RecipientOfferCard({ donation }: { donation: DemoDonation }) {
  const account = useRecipientAccount()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion() ?? false
  const transition = { duration: reducedMotion ? 0.12 : 0.2, ease: "easeOut" as const }
  const allocation = donation.allocations.find(
    (item) =>
      item.recipientId === account.candidateId &&
      (item.status === "OFFERING" || item.status === "ACCEPTED"),
  )
  const { respondToOffer, submitReceipt } = useDemoStore()
  const [handoffCode, setHandoffCode] = useState("")
  const [quantityReceived, setQuantityReceived] = useState(
    allocation?.quantity ?? 1,
  )
  const [error, setError] = useState("")

  if (!allocation) return null

  const currentAllocation = allocation
  const isAccepted = currentAllocation.status === "ACCEPTED"

  async function respond(decision: "ACCEPT" | "DECLINE") {
    setError("")
    try {
      await respondToOffer(donation.id, currentAllocation.id, decision)
    } catch (responseError) {
      setError(
        responseError instanceof Error
          ? responseError.message
          : "Could not record your response. Refresh and try again.",
      )
    }
  }

  async function confirmReceipt() {
    if (handoffCode.trim().length !== 6) {
      setError("Enter the six-digit code shared by the donor at pickup.")
      return
    }
    if (
      !Number.isInteger(quantityReceived) ||
      quantityReceived < 1 ||
      quantityReceived > currentAllocation.quantity
    ) {
      setError(`Enter a whole number between 1 and ${currentAllocation.quantity}.`)
      return
    }
    try {
      await submitReceipt(
        donation.id,
        currentAllocation.id,
        handoffCode.trim(),
        quantityReceived,
      )
      setError("")
      navigate(`/recipient/${account.id}/received`, {
        state: {
          receiptConfirmation: {
            itemName: donation.itemName,
            quantity: quantityReceived,
          },
        },
      })
    } catch (receiptError) {
      setError(
        receiptError instanceof Error
          ? receiptError.message
          : "Could not confirm the handoff. Check the code and try again.",
      )
    }
  }

  return (
    <Card className="panel offer-card">
      <div className="offer-card-top">
        <span className="offer-food-icon"><Utensils aria-hidden="true" size={20} /></span>
        <div>
          <span className="offer-eyebrow">FOOD RESCUE OFFER</span>
          <h2>{donation.itemName}</h2>
          <p>{donation.category} · Offered by {donation.donorName ?? "Food business"}</p>
        </div>
        <Badge variant={isAccepted ? "success" : "warning"}>
          {isAccepted ? "Accepted" : "Response needed"}
        </Badge>
      </div>
      <div className="offer-details-grid">
        <div><small>Quantity offered</small><strong>{currentAllocation.quantity} meals</strong></div>
        <div><small>Estimated arrival</small><strong>{currentAllocation.eta}</strong></div>
        <div><small>Donor cutoff</small><strong>{donation.usableUntil}</strong></div>
      </div>
      <ReadinessNotice variant="info">
        <Info aria-hidden="true" size={18} />
        <span>
          <strong>Next: confirm this quantity still fits your needs.</strong>
          <span>Check your current capacity and estimated arrival; decline if the plan has changed.</span>
        </span>
      </ReadinessNotice>
      {!donation.expiryScheduled && !isAccepted && (
        <ReadinessNotice variant="warning">
          <Clock3 aria-hidden="true" size={17} />
          <span>
            <strong>Automatic timeout relay is unavailable locally.</strong>
            <span>
              Respond before the displayed deadline; the first response attempt
              after expiry advances the relay.
            </span>
          </span>
        </ReadinessNotice>
      )}

      <AnimatePresence initial={false} mode="wait">
      {!isAccepted ? (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="offer-actions"
          exit={{ opacity: 0, y: reducedMotion ? 0 : -4 }}
          initial={{ opacity: 0, y: reducedMotion ? 0 : 5 }}
          key="offer-actions"
          transition={transition}
        >
          <div className="offer-window-note">
            <Clock3 aria-hidden="true" size={16} />
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
                  <small>Refresh the offer or contact the donor.</small>
                </>
              )}
            </span>
          </div>
          <div>
            <Button
              onClick={() => void respond("DECLINE")}
              type="button"
              variant="outline"
            >
              Decline offer
            </Button>
            <Button onClick={() => void respond("ACCEPT")} type="button">
              Accept offer <Check aria-hidden="true" size={16} />
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="handoff-form"
          exit={{ opacity: 0, y: reducedMotion ? 0 : -4 }}
          initial={{ opacity: 0, y: reducedMotion ? 0 : 5 }}
          key="handoff-form"
          transition={transition}
        >
          <div className="handoff-form-heading">
            <span className="success-circle"><CheckCircle2 aria-hidden="true" size={20} /></span>
            <div>
              <h3>Confirm the handoff</h3>
              <p>Enter the donor’s one-time code and the actual quantity you received.</p>
            </div>
          </div>
          <ReadinessNotice variant="info">
            <Info aria-hidden="true" size={17} />
            <span>
              <strong>Ask the donor for the code at pickup.</strong>
              <span>
                The donor finds it in Track donation → Current offer. It is shown
                only on the donor side to protect the recipient-confirmed receipt.
              </span>
            </span>
          </ReadinessNotice>
          <div className="handoff-fields">
            <label className="field-label">
              Donor handoff code
              <Input
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setHandoffCode(event.target.value)}
                placeholder="6-digit code"
                value={handoffCode}
              />
            </label>
            <label className="field-label">
              Quantity received
              <span className="quantity-input-wrap">
                <Input
                  max={currentAllocation.quantity}
                  min={1}
                  onChange={(event) =>
                    setQuantityReceived(Math.max(1, Number(event.target.value) || 1))
                  }
                  type="number"
                  value={quantityReceived}
                />
                <span>of {currentAllocation.quantity}</span>
              </span>
            </label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <ReadinessNotice variant="warning">
            <ShieldCheck aria-hidden="true" size={17} />
            <span>
              <strong>Only confirmed quantity counts as rescued.</strong>
              <span>Enter the amount actually received, not the amount planned.</span>
            </span>
          </ReadinessNotice>
          <Button onClick={() => void confirmReceipt()} type="button">
            Confirm food received <PackageCheck aria-hidden="true" size={16} />
          </Button>
        </motion.div>
      )}
      </AnimatePresence>

    </Card>
  )
}

export function RecipientOffersPage() {
  const account = useRecipientAccount()
  const { donations } = useDemoStore()
  const matchingDonations = donations.filter((donation) =>
    donation.allocations.some(
      (allocation) =>
        allocation.recipientId === account.candidateId &&
        (allocation.status === "OFFERING" || allocation.status === "ACCEPTED"),
    ),
  )
  const acceptedCount = matchingDonations.reduce(
    (count, donation) =>
      count +
      Number(
        donation.allocations.some(
          (allocation) =>
            allocation.recipientId === account.candidateId &&
            allocation.status === "ACCEPTED",
        ),
      ),
    0,
  )

  return (
    <>
      <PageHeading
        description={`Review active offers for ${account.name}. Respond before the donor-entered cutoff.`}
        title="Offers"
      />
      <ReadinessNotice variant="info">
        <HeartHandshake aria-hidden="true" size={18} />
        <span>
          <strong>One active offer at a time</strong>
          <span>Rescue Relay sends the next offer only when the current step is answered or completed.</span>
        </span>
      </ReadinessNotice>
      {matchingDonations.length > 0 ? (
        <div className="offer-list">
          {matchingDonations.map((donation) => (
            <RecipientOfferCard donation={donation} key={donation.id} />
          ))}
        </div>
      ) : (
        <Card className="panel recipient-empty-panel">
          <div className="empty-state">
            <span className="empty-icon"><HeartHandshake aria-hidden="true" size={20} /></span>
            <h2>No active offers</h2>
            <p>
              {acceptedCount > 0
                ? "Your response is recorded. Check Received for confirmed handoffs."
                : "There are no offers awaiting this organization right now."}
            </p>
            <Link className="text-link" to={`/recipient/${account.id}/received`}>
              View received food <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>
        </Card>
      )}
    </>
  )
}

export function RecipientCapacityPage() {
  const account = useRecipientAccount()
  const { recipientProfile } = useDemoStore()
  if (!recipientProfile) {
    return (
      <>
        <PageHeading
          description="Capacity and accepted food details from the configured backend."
          title="Capacity & needs"
        />
        <ReadinessNotice variant="warning">
          <Info aria-hidden="true" size={18} />
          <span>
            <strong>Recipient profile is unavailable.</strong>
            <span>
              Check your organization profile or reload this page.
            </span>
          </span>
        </ReadinessNotice>
      </>
    )
  }
  const acceptedCategories = recipientProfile.acceptedCategories.map(categoryLabel)
  const restrictions = recipientProfile.allergenRestrictions
  const hoursText = formatRecipientHours(
    recipientProfile.hours,
    recipientProfile.timezone,
  )

  return (
    <>
      <PageHeading
        description="Recipient capacity and needs reported by your organization."
        title="Capacity & needs"
      />
      <ReadinessNotice variant="warning">
        <Info aria-hidden="true" size={18} />
        <span>
          <strong>Organization profile</strong>
          <span>
            Keep capacity, operating hours, accepted categories, and restrictions
            up to date to support accurate readiness checks.
          </span>
        </span>
      </ReadinessNotice>
      <div className="recipient-profile-grid">
        <Card className="panel recipient-profile-card">
          <div className="recipient-profile-heading">
            <span className="candidate-avatar candidate-avatar--large">{account.initials}</span>
            <div>
              <span className="side-card-kicker">RECIPIENT ORGANIZATION</span>
              <h2>{account.name}</h2>
              <p>Community organization · {hoursText}</p>
            </div>
          </div>
          <div className="capacity-stat-grid">
            <div><small>Meal capacity</small><strong>{recipientProfile.capacity}</strong></div>
            <div><small>Current unmet need</small><strong>{recipientProfile.unmetDemand}</strong></div>
            <div><small>Route distance</small><strong>Calculated per donation</strong></div>
          </div>
          <div className="panel-subheading"><h3>Accepted food categories</h3></div>
          <div className="tag-options">
            {acceptedCategories.map((tag) => (
              <Badge key={tag} variant="success">{tag}</Badge>
            ))}
          </div>
          <div className="panel-subheading"><h3>Recipient restrictions</h3></div>
          <p className="body-copy">
            {restrictions.length > 0
              ? `Allergen exclusions: ${restrictions.join(", ")}.`
              : "No allergen exclusions recorded. Unknown donor allergen information is not treated as compatible."}
          </p>
        </Card>
        <Card className="panel readiness-explainer">
          <div className="aside-icon"><MapPin aria-hidden="true" size={18} /></div>
          <h3>What readiness means</h3>
          <p>A nearby recipient is not recommended unless a rescue is feasible before the donor cutoff.</p>
          <ul>
            <li><CheckCircle2 aria-hidden="true" size={16} /> Food category accepted</li>
            <li><CheckCircle2 aria-hidden="true" size={16} /> Need and capacity fit</li>
            <li><CheckCircle2 aria-hidden="true" size={16} /> Open at estimated arrival</li>
            <li><CheckCircle2 aria-hidden="true" size={16} /> Arrival before usable-until</li>
          </ul>
        </Card>
      </div>
    </>
  )
}

function ReceiptHistoryRow({ donation, recipientId }: { donation: DemoDonation; recipientId: string }) {
  const allocation = donation.allocations.find(
    (item) => item.recipientId === recipientId && item.status === "RECEIVED",
  )
  if (!allocation) return null
  return (
    <div className="receipt-history-row">
      <span className="activity-icon activity-icon--received"><Check aria-hidden="true" size={16} /></span>
      <span className="activity-copy">
        <strong>{donation.itemName}</strong>
        <span>{allocation.receivedQuantity ?? 0} of {allocation.quantity} meals · donor-confirmed cutoff {donation.usableUntil}</span>
      </span>
      <Badge variant="success">Confirmed</Badge>
    </div>
  )
}

function getReceiptConfirmation(state: unknown): {
  itemName: string
  quantity: number
} | null {
  if (
    typeof state !== "object" ||
    state === null ||
    !("receiptConfirmation" in state)
  ) {
    return null
  }
  const confirmation = state.receiptConfirmation
  if (
    typeof confirmation !== "object" ||
    confirmation === null ||
    !("itemName" in confirmation) ||
    !("quantity" in confirmation)
  ) {
    return null
  }
  const { itemName, quantity } = confirmation
  return typeof itemName === "string" &&
    typeof quantity === "number" &&
    Number.isInteger(quantity)
    ? { itemName, quantity }
    : null
}

export function RecipientReceivedPage() {
  const account = useRecipientAccount()
  const location = useLocation()
  const reducedMotion = useReducedMotion() ?? false
  const receiptConfirmation = getReceiptConfirmation(location.state)
  const { donations } = useDemoStore()
  const receiptCount = donations.reduce(
    (total, donation) =>
      total +
      donation.allocations.filter(
        (allocation) =>
          allocation.recipientId === account.candidateId &&
          allocation.status === "RECEIVED",
      ).length,
    0,
  )

  return (
    <>
      <PageHeading
        description="Handoffs that this recipient account has confirmed."
        title="Received food"
      />
      <AnimatePresence initial={false}>
        {receiptConfirmation && (
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="notice notice--success receipt-confirmation"
            initial={{
              opacity: 0,
              scale: reducedMotion ? 1 : 0.97,
              y: reducedMotion ? 0 : 6,
            }}
            key={`${receiptConfirmation.itemName}-${receiptConfirmation.quantity}`}
            role="status"
            transition={{
              duration: reducedMotion ? 0.12 : 0.24,
              ease: "easeOut",
            }}
          >
            <motion.span
              animate={{ scale: 1 }}
              initial={{ scale: reducedMotion ? 1 : 0.7 }}
              transition={{
                duration: reducedMotion ? 0.12 : 0.28,
                ease: "backOut",
              }}
            >
              <CheckCircle2 aria-hidden="true" size={20} />
            </motion.span>
            <span>
              <strong>Receipt confirmed.</strong>
              <span>{receiptConfirmation.quantity} meals of {receiptConfirmation.itemName} now count as recipient-confirmed.</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <MetricCard
        icon={<CheckCircle2 aria-hidden="true" size={17} />}
        note="Only recipient-confirmed handoffs"
        title="Confirmed receipts"
        value={String(receiptCount)}
      />
      <Card className="panel receipt-history">
        {donations.some((donation) =>
          donation.allocations.some(
            (allocation) =>
              allocation.recipientId === account.candidateId &&
              allocation.status === "RECEIVED",
          ),
        ) ? (
          donations.map((donation) => (
            <ReceiptHistoryRow
              donation={donation}
              key={donation.id}
              recipientId={account.candidateId}
            />
          ))
        ) : (
          <div className="empty-state compact-empty">
            <span className="empty-icon"><PackageCheck aria-hidden="true" size={20} /></span>
            <h2>No confirmed receipts yet</h2>
            <p>Accept an offer, then confirm the actual quantity at handoff.</p>
            <Link className="text-link" to={`/recipient/${account.id}/offers`}>
              Return to offers <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>
        )}
      </Card>
    </>
  )
}

export function RecipientImpactPage() {
  const account = useRecipientAccount()
  const { donations, impactSummary, recipientProfile } = useDemoStore()
  const confirmed = donations.reduce(
    (total, donation) =>
      total +
      donation.allocations.reduce(
        (allocationTotal, allocation) =>
          allocationTotal +
          (allocation.recipientId === account.candidateId
            ? allocation.receivedQuantity ?? 0
            : 0),
        0,
      ),
    0,
  )
  const confirmedTotal = impactSummary?.confirmedQuantity ?? confirmed

  return (
    <>
      <PageHeading
        description={`Food received and confirmed by ${account.name}.`}
        title="Recipient impact"
      />
      <ReadinessNotice variant="success">
        <ShieldCheck aria-hidden="true" size={18} />
        <span>
          <strong>Confirmed, not assumed.</strong>
          <span>Offers and acceptances do not count as received food.</span>
        </span>
      </ReadinessNotice>
      <div className="metrics-grid impact-metrics">
        <MetricCard
          icon={<CheckCircle2 aria-hidden="true" size={17} />}
          note="Recipient-confirmed handoffs"
          title="Meals received"
          value={confirmedTotal.toLocaleString()}
        />
        <MetricCard
          icon={<Utensils aria-hidden="true" size={17} />}
          note="Confirmed receipt records"
          title="Completed rescues"
          value={String(impactSummary?.receiptsCount ?? 0)}
        />
        <MetricCard
          icon={<MapPin aria-hidden="true" size={17} />}
          note="Current recipient profile"
          title="Active unmet need"
          value={`${recipientProfile?.unmetDemand ?? 0} meals`}
        />
      </div>
      <Card className="panel impact-receipt-table">
        <div className="panel-heading"><h2>Recipient-confirmed deliveries</h2></div>
        {donations.map((donation) => (
          <ReceiptHistoryRow
            donation={donation}
            key={donation.id}
            recipientId={account.candidateId}
          />
        ))}
        {confirmed === 0 && (
          <p className="panel-empty-note">
            New confirmations appear here after the actual handoff is recorded.
          </p>
        )}
      </Card>
    </>
  )
}
