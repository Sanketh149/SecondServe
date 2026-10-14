import {
  type DemoDonation,
  type NewDonationInput,
} from "@/lib/demo-data"
import { getFirebaseIdToken } from "@/lib/firebase"

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? ""

export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(
    message: string,
    status: number,
    code?: string,
  ) {
    super(message)
    this.status = status
    this.code = code
    this.name = "ApiError"
  }
}

export interface ApiFieldValue<T = unknown> {
  value: T
  source: "AI_SUGGESTED" | "DONOR_CONFIRMED" | "UNKNOWN"
  confidence: number
}

export interface ApiFoodAnalysis {
  analysisId: string
  expiresAt: string
  candidate: Record<string, ApiFieldValue>
  requiredConfirmations: string[]
  safetyNotice: string
}

export interface ApiPlanAllocation {
  allocationId: string
  recipientId: string
  recipientName: string
  quantity: number
  readiness: "READY" | "BLOCKED" | "UNKNOWN"
  estimatedArrivalAt: string | null
  needFit: number
  recipientCompletionRate: number | null
  completionHistorySampleSize: number
  reasonCodes: string[]
  fallbackCandidates: Array<{
    recipientId: string
    recipientName: string
    readiness: string
  }>
}

export interface ApiRescuePlan {
  planId: string
  donationId: string
  status: "FULL" | "PARTIAL" | "NONE" | "UNKNOWN"
  donationQuantity: number
  allocatedQuantity: number
  unallocatedQuantity: number
  allocations: ApiPlanAllocation[]
  route: {
    orderedRecipientIds: string[]
    distanceMeters: number | null
    durationSeconds: number | null
    provider: string
  } | null
  notReadyCandidates: Array<{
    recipientId: string
    recipientName: string
    readiness: string
    reasonCodes: string[]
  }>
  createdAt: string
  updatedAt: string
}

interface ApiAllocation {
  allocationId: string
  planId: string
  donationId: string
  recipientId: string
  recipientName: string
  quantity: number
  status: string
  confirmedQuantity: number
  receivedQuantity: number
  activeCandidateIndex: number
  assignedCandidateIds: string[]
  distance: string
  eta: string
}

interface ApiDonation {
  donationId: string
  donorOrganizationId: string
  donorOrganizationName?: string
  itemName: string
  category: string
  quantity: number
  unit: string
  estimatedTotalWeightKg: number | null
  dietaryTags: string[]
  declaredAllergens: string[]
  allergenStatus: string
  preparedAt: string
  storageCondition: string
  pickupAvailableAt: string
  usableUntil: string
  analysisId: string | null
  status: string
  planId: string | null
  confirmedQuantity: number
  createdAt: string
  updatedAt: string
}

export interface ApiDonationDetail extends ApiDonation {
  donorOrganizationName: string
  plan: ApiRescuePlan | null
  allocations: ApiAllocation[]
  events: Array<{
    eventId: string
    actorId: string
    eventType: string
    occurredAt: string
    payload: Record<string, unknown>
  }>
  currentOffer: ApiOffer | null
  handoffCode: string | null
}

export interface ApiOffer {
  offerId: string
  allocationId: string
  donationId: string
  recipientId: string
  status: string
  expiresAt: string
  decisionReason: string | null
  transitionCount: number
  expiryScheduled: boolean
  createdAt: string
  updatedAt: string
}

export interface ApiImpactSummary {
  confirmedQuantity: number
  rescuedMeals: number
  receiptsCount: number
  period: string
  donorReportedConfirmedWeightKg: number | null
}

export interface ApiNetworkInsights {
  heatmapCellSizeKm: number
  networkOrganizationCount: number
  heatmapCells: Array<{
    latitude: number
    longitude: number
    activeSurplusMeals: number
    unmetNeedMeals: number
    donorOrganizations: number
    recipientOrganizations: number
  }>
  partnerships: Array<{
    organizationName: string
    completedRescues: number
    confirmedMeals: number
    lastConfirmedAt: string
    reason: string
  }>
}

export interface ApiGuidance {
  answer: string
  basedOn: string[]
  limitations: string
}

export interface ApiUserProfile {
  uid: string
  role: "donor" | "recipient" | null
  organizationId: string | null
  displayName: string | null
  organizationName: string | null
  organizationAddress: string | null
  recipientId: string | null
}

export interface ApiForecast {
  sampleSize: number
  source: string
  metric: "DONOR_SURPLUS" | "RECIPIENT_CONFIRMED_INTAKE"
  usesBaseline: boolean
  insufficientHistory: boolean
  opportunities: Array<{
    weekday: string
    predictedQuantity: number
    confidence: number
    sampleSize: number
    source: string
    isBaseline: boolean
  }>
}

export interface ApiRecipientProfile {
  recipientId: string
  organizationId: string
  organizationName: string
  active: boolean
  timezone: string
  hours: Record<string, Array<[string, string]>>
  capacity: number
  unmetDemand: number
  acceptedCategories: string[]
  dietaryTags: string[]
  allergenRestrictions: string[]
}

export type RecipientProfileUpdate = Pick<
  ApiRecipientProfile,
  | "timezone"
  | "hours"
  | "capacity"
  | "unmetDemand"
  | "acceptedCategories"
  | "dietaryTags"
  | "allergenRestrictions"
>

export interface DonationFormPayload {
  analysisId?: string
  itemName: string
  category: string
  quantity: number
  unit: string
  estimatedTotalWeightKg?: number
  dietaryTags: string[]
  declaredAllergens: string[]
  allergenStatus: string
  donorConfirmed: boolean
  preparedAt: string
  storageCondition: string
  pickupAvailableAt: string
  usableUntil: string
}

const categoryLabels: Record<string, string> = {
  prepared_meal: "Prepared meals",
  bakery: "Bakery",
  produce: "Produce",
  packaged_food: "Packaged food",
  other: "Other",
}

const donorStatuses: Record<string, DemoDonation["status"]> = {
  OPEN: "UNCLAIMED",
  PLANNED: "OFFERING",
  OFFERING: "OFFERING",
  PARTIALLY_ACCEPTED: "ACCEPTED",
  ACCEPTED: "ACCEPTED",
  IN_PROGRESS: "ACCEPTED",
  RESCUED: "RECEIVED",
  PARTIALLY_RESCUED: "PARTIALLY_RECEIVED",
  EXPIRED: "UNCLAIMED",
  CANCELLED: "UNCLAIMED",
}

const allocationStatuses: Record<string, DemoDonation["allocations"][number]["status"]> = {
  PLANNED: "QUEUED",
  OFFERING: "OFFERING",
  ACCEPTED: "ACCEPTED",
  DELIVERED: "RECEIVED",
  UNASSIGNED: "DECLINED",
  EXPIRED: "DECLINED",
  CANCELLED: "CANCELLED",
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  const token = await getFirebaseIdToken()
  headers.set("Authorization", `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
      ...options,
      headers,
    })
  } catch (error) {
    throw new ApiError(
      error instanceof Error
        ? `Could not reach the SecondServe API: ${error.message}`
        : "Could not reach the SecondServe API.",
      0,
    )
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const error =
      typeof body === "object" && body !== null && "error" in body
        ? (body as { error?: { message?: string; code?: string } }).error
        : undefined
    const detail =
      typeof body === "object" && body !== null && "detail" in body
        ? (body as { detail?: unknown }).detail
        : undefined
    throw new ApiError(
      error?.message ??
        (typeof detail === "string" ? detail : `API request failed (${response.status}).`),
      response.status,
      error?.code,
    )
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

function toIso(value: string): string {
  const timestamp = new Date(value)
  if (!Number.isFinite(timestamp.getTime())) {
    throw new ApiError("Enter a valid date and time before continuing.", 422)
  }
  return timestamp.toISOString()
}

export function toDonationPayload(
  input: NewDonationInput,
): DonationFormPayload {
  const categoryMap: Record<string, string> = {
    "Prepared meals": "prepared_meal",
    Bakery: "bakery",
    Produce: "produce",
    "Packaged food": "packaged_food",
    Other: "other",
  }
  return {
    ...(input.analysisId ? { analysisId: input.analysisId } : {}),
    itemName: input.itemName.trim(),
    category: categoryMap[input.category] ?? input.category.toLowerCase(),
    quantity: input.quantity,
    unit: "meals",
    ...(input.estimatedTotalWeightKg !== undefined
      ? { estimatedTotalWeightKg: input.estimatedTotalWeightKg }
      : {}),
    dietaryTags: input.dietaryTags,
    declaredAllergens:
      input.allergenStatus === "DONOR_CONFIRMED"
        ? input.declaredAllergens
        : [],
    allergenStatus: input.allergenStatus,
    donorConfirmed: input.donorConfirmed,
    preparedAt: toIso(input.preparedAt),
    storageCondition: input.storageCondition.toLowerCase(),
    pickupAvailableAt: toIso(input.pickupAvailableAt),
    usableUntil: toIso(input.usableUntil),
  }
}

export async function analyzeFoodImage(file: File): Promise<ApiFoodAnalysis> {
  const body = new FormData()
  body.append("file", file)
  return request<ApiFoodAnalysis>("/donations/analyze", {
    method: "POST",
    body,
  })
}

export async function previewRescuePlan(
  input: NewDonationInput,
): Promise<ApiRescuePlan> {
  return request<ApiRescuePlan>("/donations/rescue-plan-preview", {
    method: "POST",
    body: JSON.stringify(toDonationPayload(input)),
  })
}

export async function loadDonorDonations(): Promise<DemoDonation[]> {
  const result = await request<{ donations: ApiDonation[] }>("/donations")
  return Promise.all(result.donations.map((donation) => loadDonation(donation.donationId)))
}

export async function loadRecipientDonations(): Promise<DemoDonation[]> {
  const result = await request<{ offers: ApiOffer[] }>("/recipients/me/offers")
  const ids = [...new Set(result.offers.map((offer) => offer.donationId))]
  const donations = await Promise.all(
    ids.map(async (id) => {
      try {
        return await loadDonation(id)
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) return null
        throw error
      }
    }),
  )
  return donations.filter((donation): donation is DemoDonation => donation !== null)
}

export async function loadDonation(donationId: string): Promise<DemoDonation> {
  const donation = await request<ApiDonationDetail>(
    `/donations/${encodeURIComponent(donationId)}`,
  )
  return mapDonation(donation)
}

export async function updateDonation(
  donationId: string,
  input: NewDonationInput,
): Promise<ApiDonation> {
  return request<ApiDonation>(`/donations/${encodeURIComponent(donationId)}`, {
    method: "PUT",
    body: JSON.stringify(toDonationPayload(input)),
  })
}

export async function loadImpactSummary(): Promise<ApiImpactSummary> {
  return request<ApiImpactSummary>("/impact/summary")
}

export async function loadNetworkInsights(): Promise<ApiNetworkInsights> {
  return request<ApiNetworkInsights>("/network/insights")
}

export async function askRescueAssistant(
  question: string,
  donationId?: string,
): Promise<ApiGuidance> {
  return request<ApiGuidance>("/assistant/guidance", {
    method: "POST",
    body: JSON.stringify({
      question,
      ...(donationId ? { donationId } : {}),
    }),
  })
}

export async function getMe(): Promise<ApiUserProfile> {
  return request<ApiUserProfile>("/me")
}

export interface OrganizationProfilePayload {
  role: "donor" | "recipient"
  displayName: string
  organizationName: string
  address: string
  latitude: number
  longitude: number
  timezone: string
  capacity?: number
  unmetDemand?: number
  acceptedCategories?: string[]
  dietaryTags?: string[]
  allergenRestrictions?: string[]
  openTime?: string
  closeTime?: string
  openSaturday?: boolean
  openSunday?: boolean
}

export async function createOrganizationProfile(
  profile: OrganizationProfilePayload,
): Promise<ApiUserProfile> {
  return request<ApiUserProfile>("/me/profile", {
    method: "POST",
    body: JSON.stringify(profile),
  })
}

export async function loadForecast(): Promise<ApiForecast> {
  return request<ApiForecast>("/forecast/opportunities")
}

export async function loadRecipientProfile(): Promise<ApiRecipientProfile> {
  return request<ApiRecipientProfile>("/recipients/me/profile")
}

export async function updateRecipientProfile(
  profile: RecipientProfileUpdate,
): Promise<ApiRecipientProfile> {
  return request<ApiRecipientProfile>("/recipients/me/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  })
}

export async function saveDonationForMatching(
  input: NewDonationInput,
): Promise<string> {
  const created = await request<ApiDonation>("/donations", {
    method: "POST",
    body: JSON.stringify(toDonationPayload(input)),
  })
  return created.donationId
}

export async function retryDonationMatch(
  donationId: string,
): Promise<ApiRescuePlan> {
  const plan = await request<ApiRescuePlan>(
    `/donations/${encodeURIComponent(donationId)}/rescue-plan`,
    { method: "POST" },
  )
  if (plan.status === "FULL" || plan.status === "PARTIAL") {
    await request(
      `/rescue-plans/${encodeURIComponent(plan.planId)}/start`,
      { method: "POST" },
    )
  }
  return plan
}

export async function createDonationAndStart(
  input: NewDonationInput,
): Promise<string> {
  const created = await request<ApiDonation>("/donations", {
    method: "POST",
    body: JSON.stringify(toDonationPayload(input)),
  })
  const plan = await request<ApiRescuePlan>(
    `/donations/${encodeURIComponent(created.donationId)}/rescue-plan`,
    { method: "POST" },
  )
  if (!["FULL", "PARTIAL"].includes(plan.status)) {
    return created.donationId
  }
  await request("/rescue-plans/" + encodeURIComponent(plan.planId) + "/start", {
    method: "POST",
  })
  return created.donationId
}

export async function respondToBackendOffer(
  donationId: string,
  allocationId: string,
  decision: "ACCEPT" | "DECLINE",
): Promise<void> {
  const donation = await request<ApiDonationDetail>(
    `/donations/${encodeURIComponent(donationId)}`,
  )
  const offer = donation.currentOffer
  if (!offer || offer.allocationId !== allocationId) {
    throw new ApiError("This offer is no longer active. Refresh and review the latest status.", 409)
  }
  await request(`/recipients/me/offers/${encodeURIComponent(offer.offerId)}/response`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  })
}

export async function updateRecipientPickupStatus(
  offerId: string,
  status: "EN_ROUTE" | "ARRIVED",
): Promise<void> {
  await request(
    `/recipients/me/offers/${encodeURIComponent(offerId)}/pickup-status`,
    {
      method: "POST",
      body: JSON.stringify({ status }),
    },
  )
}

export async function submitBackendReceipt(
  allocationId: string,
  handoffCode: string,
  quantityReceived: number,
): Promise<void> {
  await request(`/allocations/${encodeURIComponent(allocationId)}/receipt`, {
    method: "POST",
    body: JSON.stringify({ handoffCode, quantityReceived, exceptionReason: null }),
  })
}

function mapDonation(donation: ApiDonationDetail): DemoDonation {
  const allocations = donation.allocations.map((allocation) => {
    const mappedRecipientId = allocation.recipientId
    const fallbackId =
      allocation.assignedCandidateIds[allocation.activeCandidateIndex + 1]
    return {
      id: allocation.allocationId,
      recipientId: mappedRecipientId,
      recipientName: allocation.recipientName,
      initials: allocation.recipientName.slice(0, 2).toUpperCase(),
      quantity: allocation.quantity,
      status: allocationStatuses[allocation.status] ?? "QUEUED",
      distance: allocation.distance,
      eta: allocation.eta,
      receivedQuantity: allocation.receivedQuantity,
      ...(fallbackId ? { fallbackRecipientId: fallbackId } : {}),
    }
  })
  const status = donorStatuses[donation.status] ?? "UNCLAIMED"
  const isRelayed = donation.events.some((event) => event.eventType === "OFFER_RELAYED")
  const createdAt = new Date(donation.createdAt)
  return {
    id: donation.donationId,
    backendStatus: donation.status,
    itemName: donation.itemName,
    donorName: donation.donorOrganizationName,
    category: categoryLabels[donation.category] ?? donation.category,
    quantity: donation.quantity,
    unit: "meals",
    estimatedTotalWeightKg: donation.estimatedTotalWeightKg,
    preparedAt: donation.preparedAt,
    storageCondition: donation.storageCondition,
    pickupAvailableAt: donation.pickupAvailableAt,
    createdAt: Number.isFinite(createdAt.getTime())
      ? createdAt.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      : "Recently",
    usableUntil: new Date(donation.usableUntil).toLocaleString([], {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }),
    usableUntilAt: donation.usableUntil,
    dietaryTags: donation.dietaryTags,
    declaredAllergens: donation.declaredAllergens,
    allergenStatus:
      donation.allergenStatus === "DONOR_CONFIRMED" ||
      donation.allergenStatus === "NOT_APPLICABLE"
        ? donation.allergenStatus
        : "UNKNOWN",
    status:
      status === "OFFERING" && isRelayed
        ? "RELAYED"
        : status,
    handoffCode: donation.handoffCode ?? "",
    currentOfferId: donation.currentOffer?.offerId,
    responseWindowEndsAt: donation.currentOffer?.expiresAt,
    expiryScheduled: donation.currentOffer?.expiryScheduled ?? false,
    events: donation.events.map((event) => ({
      type: event.eventType,
      occurredAt: event.occurredAt,
      detail: eventDetail(event.eventType, event.payload, allocations),
      payload: event.payload,
    })),
    allocations,
  }
}

function eventDetail(
  eventType: string,
  payload: Record<string, unknown>,
  allocations: DemoDonation["allocations"],
): string {
  const allocationId =
    typeof payload.allocationId === "string" ? payload.allocationId : undefined
  const recipientName = allocations.find((item) => item.id === allocationId)?.recipientName
  switch (eventType) {
    case "DONATION_CREATED":
      return "Donor-entered food and cutoff details saved."
    case "RESCUE_PLAN_CREATED":
      return "Backend readiness and route checks completed."
    case "DYNAMIC_REMATCH_TRIGGERED":
      return "Recipient availability changed; the rescue plan was recalculated."
    case "OFFER_STARTED":
      return `First rescue offer sent${recipientName ? ` to ${recipientName}` : ""}.`
    case "OFFER_RELAYED":
      return `Offer relayed${recipientName ? ` to ${recipientName}` : " to the next recipient"}.`
    case "OFFER_ACCEPTED":
      return `${recipientName ?? "Recipient"} accepted the offer.`
    case "PICKUP_WINDOW_CONFIRMED":
      return "Recipient accepted the donor-provided pickup window."
    case "OFFER_DECLINED":
      return `${recipientName ?? "Recipient"} declined the offer.`
    case "OFFER_EXPIRED":
      return "The response window expired and the offer was relayed."
    case "PICKUP_STATUS_UPDATED":
      return payload.status === "ARRIVED"
        ? "Recipient reported arrival at the pickup."
        : "Recipient reported being on the way to the pickup."
    case "RECEIPT_CONFIRMED":
      return `${String(payload.quantityReceived ?? 0)} meals were recipient-confirmed.`
    default:
      return eventType.toLowerCase().replaceAll("_", " ")
  }
}
