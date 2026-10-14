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
import { useState, type FormEvent } from "react"
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
import { NetworkInsightsPanel } from "@/components/NetworkInsightsPanel"
import { RescueAssistantCard } from "@/components/RescueAssistantCard"
import type {
  ApiRecipientProfile,
  RecipientProfileUpdate,
} from "@/lib/api-client"
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
  const dayLabel = day.slice(0, 3).replace(/^./, (letter) => letter.toUpperCase())
  const [hour, minute] = ranges[0][1].split(":").map(Number)
  if (hour === 0 && minute === 0 && ranges[0][0] === "00:00") {
    return `${dayLabel} all day (${timeZone})`
  }
  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12
  return `${dayLabel} until ${displayHour}:${String(minute).padStart(2, "0")} ${period} (${timeZone})`
}

const recipientDays = [
  ["monday", "Monday"],
  ["tuesday", "Tuesday"],
  ["wednesday", "Wednesday"],
  ["thursday", "Thursday"],
  ["friday", "Friday"],
  ["saturday", "Saturday"],
  ["sunday", "Sunday"],
] as const

type RecipientProfileDraft = {
  timezone: string
  hours: Record<string, Array<[string, string]>>
  capacity: string
  unmetDemand: string
  acceptedCategories: string[]
  dietaryTags: string
  allergenRestrictions: string
}

function profileDraft(
  profile: ApiRecipientProfile,
): RecipientProfileDraft {
  return {
    timezone: profile.timezone,
    hours: Object.fromEntries(
      recipientDays.map(([day]) => [
        day,
        (profile.hours[day] ?? []).map(
          ([opens, closes]) => [opens, closes] as [string, string],
        ),
      ]),
    ),
    capacity: String(profile.capacity),
    unmetDemand: String(profile.unmetDemand),
    acceptedCategories: [...profile.acceptedCategories],
    dietaryTags: profile.dietaryTags.join(", "),
    allergenRestrictions: profile.allergenRestrictions.join(", "),
  }
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
  const { respondToOffer, updatePickupStatus, submitReceipt } = useDemoStore()
  const [handoffCode, setHandoffCode] = useState("")
  const [quantityReceived, setQuantityReceived] = useState(
    allocation?.quantity ?? 1,
  )
  const [error, setError] = useState("")

  if (!allocation) return null

  const currentAllocation = allocation
  const isAccepted = currentAllocation.status === "ACCEPTED"
  const pickupEvents =
    donation.events?.filter(
      (event) =>
        event.type === "PICKUP_STATUS_UPDATED" &&
        event.payload.offerId === donation.currentOfferId,
    ) ?? []
  const lastPickupStatus = pickupEvents.at(-1)?.payload.status
  const pickupStatus =
    lastPickupStatus === "EN_ROUTE" || lastPickupStatus === "ARRIVED"
      ? lastPickupStatus
      : null

  async function setPickupStatus(status: "EN_ROUTE" | "ARRIVED") {
    if (!donation.currentOfferId) {
      setError("Pickup coordination is not available for this offer. Refresh and try again.")
      return
    }
    setError("")
    try {
      await updatePickupStatus(donation.currentOfferId, status)
    } catch (pickupError) {
      setError(
        pickupError instanceof Error
          ? pickupError.message
          : "Could not update pickup status.",
      )
    }
  }

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
        <div><small>Pickup available</small><strong>{donation.pickupAvailableAt ? new Date(donation.pickupAvailableAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : "See donor"}</strong></div>
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
          <ReadinessNotice variant="info">
            <Clock3 aria-hidden="true" size={17} />
            <span>
              <strong>
                {pickupStatus === "ARRIVED"
                  ? "You’ve marked that you arrived."
                  : pickupStatus === "EN_ROUTE"
                    ? "You’re on the way to the pickup."
                    : "Coordinate your pickup in the app."}
              </strong>
              <span>
                {pickupStatus === "ARRIVED"
                  ? "Ask the donor for the handoff code and confirm only the quantity received."
                  : "Update your travel status so the donor knows when you are heading over."}
              </span>
            </span>
          </ReadinessNotice>
          <div className="pickup-coordination-actions">
            <Button
              disabled={pickupStatus !== null}
              onClick={() => void setPickupStatus("EN_ROUTE")}
              type="button"
              variant="outline"
            >
              Mark on the way
            </Button>
            <Button
              disabled={pickupStatus === "ARRIVED"}
              onClick={() => void setPickupStatus("ARRIVED")}
              type="button"
            >
              Mark arrived
            </Button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
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
      <RescueAssistantCard donationId={matchingDonations[0]?.id} />
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
  const { recipientProfile, updateRecipientProfile } = useDemoStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<RecipientProfileDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [savedMessage, setSavedMessage] = useState("")
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
  const editableProfile = recipientProfile

  function beginEditing() {
    setDraft(profileDraft(editableProfile))
    setError("")
    setSavedMessage("")
    setEditing(true)
  }

  function toggleCategory(category: string) {
    setDraft((current) => {
      if (!current) return current
      const acceptedCategories = current.acceptedCategories.includes(category)
        ? current.acceptedCategories.filter((item) => item !== category)
        : [...current.acceptedCategories, category]
      return { ...current, acceptedCategories }
    })
  }

  function updateHours(day: string, ranges: Array<[string, string]>) {
    setDraft((current) =>
      current
        ? { ...current, hours: { ...current.hours, [day]: ranges } }
        : current,
    )
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    setError("")
    const capacity = Number(draft.capacity)
    const unmetDemand = Number(draft.unmetDemand)
    if (!Number.isInteger(capacity) || capacity < 1) {
      setError("Meal capacity must be a whole number greater than zero.")
      return
    }
    if (!Number.isInteger(unmetDemand) || unmetDemand < 0 || unmetDemand > capacity) {
      setError("Current unmet need must be between zero and meal capacity.")
      return
    }
    if (draft.acceptedCategories.length === 0) {
      setError("Choose at least one accepted food category.")
      return
    }
    for (const [day, ranges] of Object.entries(draft.hours)) {
      const allDay =
        ranges.length === 1 &&
        ranges[0][0] === "00:00" &&
        ranges[0][1] === "00:00"
      if (allDay) continue
      const parsed = ranges.map(([opens, closes]) => [opens, closes] as const)
      if (
        parsed.some(([opens, closes]) => !opens || !closes || opens >= closes) ||
        parsed
          .map(([opens, closes]) => [opens, closes] as const)
          .sort(([firstOpen], [secondOpen]) => firstOpen.localeCompare(secondOpen))
          .some(
            ([opens], index, ordered) =>
              index > 0 && opens < ordered[index - 1][1],
          )
      ) {
        setError(`Check the opening periods for ${day}. They must be valid and not overlap.`)
        return
      }
    }

    const input: RecipientProfileUpdate = {
      timezone: draft.timezone.trim(),
      hours: draft.hours,
      capacity,
      unmetDemand,
      acceptedCategories: draft.acceptedCategories,
      dietaryTags: draft.dietaryTags
        .split(/[,;]/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
      allergenRestrictions: draft.allergenRestrictions
        .split(/[,;]/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    }
    setSaving(true)
    try {
      await updateRecipientProfile(input)
      setEditing(false)
      setDraft(null)
      setSavedMessage("Organization capacity and readiness settings updated.")
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not update your recipient organization profile.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeading
        description="Recipient capacity and needs reported by your organization."
        action={
          editing ? (
            <Button
              onClick={() => {
                setEditing(false)
                setDraft(null)
                setError("")
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          ) : (
            <Button onClick={beginEditing} type="button" variant="outline">
              Edit profile
            </Button>
          )
        }
        title="Capacity & needs"
      />
      {savedMessage && <p className="recipient-profile-saved" role="status">{savedMessage}</p>}
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
          {editing && draft ? (
            <form className="recipient-profile-editor" onSubmit={(event) => void saveProfile(event)}>
              <div className="auth-coordinate-grid">
                <label className="field-label">
                  Meal capacity
                  <Input
                    max={100000}
                    min={1}
                    onChange={(event) =>
                      setDraft({ ...draft, capacity: event.target.value })
                    }
                    required
                    type="number"
                    value={draft.capacity}
                  />
                </label>
                <label className="field-label">
                  Current unmet need
                  <Input
                    max={100000}
                    min={0}
                    onChange={(event) =>
                      setDraft({ ...draft, unmetDemand: event.target.value })
                    }
                    required
                    type="number"
                    value={draft.unmetDemand}
                  />
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
                      aria-pressed={draft.acceptedCategories.includes(value)}
                      className={`choice-chip${draft.acceptedCategories.includes(value) ? " choice-chip--selected" : ""}`}
                      key={value}
                      onClick={() => toggleCategory(value)}
                      type="button"
                    >
                      {draft.acceptedCategories.includes(value) && (
                        <CheckCircle2 aria-hidden="true" size={13} />
                      )}
                      {label}
                    </button>
                  ))}
                </span>
              </label>
              <label className="field-label">
                Dietary requirements
                <Input
                  onChange={(event) =>
                    setDraft({ ...draft, dietaryTags: event.target.value })
                  }
                  placeholder="e.g. vegetarian, halal"
                  value={draft.dietaryTags}
                />
              </label>
              <label className="field-label">
                Allergen exclusions
                <Input
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      allergenRestrictions: event.target.value,
                    })
                  }
                  placeholder="e.g. peanut, shellfish"
                  value={draft.allergenRestrictions}
                />
              </label>
              <label className="field-label">
                Organization time zone
                <Input
                  onChange={(event) =>
                    setDraft({ ...draft, timezone: event.target.value })
                  }
                  placeholder="e.g. America/Los_Angeles"
                  required
                  value={draft.timezone}
                />
              </label>
              <div className="panel-subheading"><h3>Operating hours</h3></div>
              <p className="field-hint">
                Choose open days and set one or more opening periods for each.
                These hours are used in recipient readiness checks.
              </p>
              <div className="recipient-hours-editor">
                {recipientDays.map(([day, label]) => {
                  const ranges = draft.hours[day] ?? []
                  const allDay =
                    ranges.length === 1 &&
                    ranges[0][0] === "00:00" &&
                    ranges[0][1] === "00:00"
                  return (
                    <div className="recipient-hours-day" key={day}>
                      <div className="recipient-hours-day-header">
                        <label className="recipient-hours-day-toggle">
                          <input
                            checked={ranges.length > 0}
                            onChange={(event) =>
                              updateHours(
                                day,
                                event.target.checked
                                  ? [["09:00", "17:00"]]
                                  : [],
                              )
                            }
                            type="checkbox"
                          />
                          <span>{label}</span>
                        </label>
                        {ranges.length > 0 && (
                          <label className="recipient-hours-all-day">
                            <input
                              checked={allDay}
                              onChange={(event) =>
                                updateHours(
                                  day,
                                  event.target.checked
                                    ? [["00:00", "00:00"]]
                                    : [["09:00", "17:00"]],
                                )
                              }
                              type="checkbox"
                            />
                            <span>Available all day</span>
                          </label>
                        )}
                      </div>
                      {ranges.length > 0 ? (
                        allDay ? (
                          <span className="recipient-hours-closed">
                            Open all day
                          </span>
                        ) : (
                          <div className="recipient-hours-periods">
                            {ranges.map(([opens, closes], index) => (
                              <div
                                className="recipient-hours-period"
                                key={`${day}-${index}`}
                              >
                                <Input
                                  aria-label={`${label} opening time, period ${index + 1}`}
                                  onChange={(event) => {
                                    const updated = [...ranges] as Array<
                                      [string, string]
                                    >
                                    updated[index] = [event.target.value, closes]
                                    updateHours(day, updated)
                                  }}
                                  required
                                  type="time"
                                  value={opens}
                                />
                                <span>to</span>
                                <Input
                                  aria-label={`${label} closing time, period ${index + 1}`}
                                  onChange={(event) => {
                                    const updated = [...ranges] as Array<
                                      [string, string]
                                    >
                                    updated[index] = [opens, event.target.value]
                                    updateHours(day, updated)
                                  }}
                                  required
                                  type="time"
                                  value={closes}
                                />
                                <Button
                                  aria-label={`Remove ${label} period ${index + 1}`}
                                  onClick={() =>
                                    updateHours(
                                      day,
                                      ranges.filter(
                                        (_, itemIndex) => itemIndex !== index,
                                      ),
                                    )
                                  }
                                  type="button"
                                  variant="ghost"
                                >
                                  Remove
                                </Button>
                              </div>
                            ))}
                            <Button
                              onClick={() =>
                                updateHours(day, [
                                  ...ranges,
                                  ["", ""] as [string, string],
                                ])
                              }
                              type="button"
                              variant="outline"
                            >
                              Add hours
                            </Button>
                          </div>
                        )
                      ) : (
                        <span className="recipient-hours-closed">Closed</span>
                      )}
                    </div>
                  )
                })}
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <ReadinessNotice variant="info">
                <Info aria-hidden="true" size={18} />
                <span>
                  <strong>Changes affect future readiness checks.</strong>
                  <span>Existing offers and handoffs are not changed.</span>
                </span>
              </ReadinessNotice>
              <div className="recipient-profile-actions">
                <Button disabled={saving} type="submit">
                  {saving ? "Saving profile…" : "Save changes"}
                </Button>
              </div>
            </form>
          ) : (
            <>
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
            </>
          )}
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
  const { donations, impactSummary, recipientProfile, forecast } = useDemoStore()
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
  const completedRescues = impactSummary?.receiptsCount ?? receiptCount
  const receivedDonations = donations.filter((donation) =>
    donation.allocations.some(
      (allocation) =>
        allocation.recipientId === account.candidateId &&
        allocation.status === "RECEIVED",
    ),
  )

  return (
    <>
      <PageHeading
        description={`Confirmed deliveries and rescue impact for ${account.name}.`}
        title="Received & impact"
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
          value={String(completedRescues)}
        />
        <MetricCard
          icon={<MapPin aria-hidden="true" size={17} />}
          note="Current recipient profile"
          title="Active unmet need"
          value={`${recipientProfile?.unmetDemand ?? 0} meals`}
        />
        <MetricCard
          icon={<PackageCheck aria-hidden="true" size={17} />}
          note="Proportional to confirmed meals; donor-reported weight"
          title="Food weight received"
          value={
            impactSummary?.donorReportedConfirmedWeightKg == null
              ? "Not reported"
              : `${impactSummary.donorReportedConfirmedWeightKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`
          }
        />
      </div>
      <Card className="panel recipient-demand-forecast">
        <div className="panel-heading">
          <div>
            <h2>Recipient demand outlook</h2>
            <span className="panel-subtitle">
              {forecast?.sampleSize
                ? `Based on ${forecast.sampleSize} weeks of confirmed receipts`
                : "Based on recipient-confirmed meal history"}
            </span>
          </div>
          <Badge variant="neutral">
            {forecast?.insufficientHistory ? "Building history" : "History-based"}
          </Badge>
        </div>
        {forecast?.metric === "RECIPIENT_CONFIRMED_INTAKE" &&
        forecast.opportunities.length > 0 ? (
          <div className="recipient-demand-days">
            {forecast.opportunities.map((day) => (
              <div className="recipient-demand-day" key={day.weekday}>
                <span>{day.weekday.slice(0, 3)}</span>
                <strong>{day.predictedQuantity}</strong>
                <small>meals</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="panel-empty-note">
            More confirmed handoff history is needed before a reliable weekly
            intake forecast is available. Current unmet need remains the live
            recipient-entered value.
          </p>
        )}
      </Card>
      <NetworkInsightsPanel />
      <Card className="panel impact-receipt-table recipient-received-history">
        <div className="panel-heading">
          <h2>Recipient-confirmed deliveries</h2>
        </div>
        {receivedDonations.length > 0 ? (
          receivedDonations.map((donation) => (
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
            <p>Offers appear here after you confirm the actual quantity at handoff.</p>
            <Link className="text-link" to={`/recipient/${account.id}/offers`}>
              View offers <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>
        )}
      </Card>
    </>
  )
}
