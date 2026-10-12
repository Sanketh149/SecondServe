export type AllocationStatus =
  | "OFFERING"
  | "QUEUED"
  | "ACCEPTED"
  | "DECLINED"
  | "RECEIVED"

export type DonationStatus =
  | "OFFERING"
  | "RELAYED"
  | "ACCEPTED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "UNCLAIMED"

export interface RescueAllocation {
  id: string
  recipientId: string
  recipientName: string
  initials: string
  quantity: number
  status: AllocationStatus
  distance: string
  eta: string
  fallbackRecipientId?: string
  fallbackRecipientName?: string
  fallbackInitials?: string
  receivedQuantity?: number
}

export interface DemoDonation {
  id: string
  itemName: string
  donorName?: string
  category: string
  quantity: number
  unit: "meals"
  createdAt: string
  usableUntil: string
  status: DonationStatus
  handoffCode: string
  responseWindowEndsAt?: string
  expiryScheduled: boolean
  events?: Array<{
    type: string
    occurredAt: string
    detail: string
    payload: Record<string, unknown>
  }>
  allocations: RescueAllocation[]
}

export interface NewDonationInput {
  analysisId?: string
  itemName: string
  category: string
  quantity: number
  dietaryTags: string[]
  declaredAllergens: string[]
  allergenStatus: "DONOR_CONFIRMED" | "UNKNOWN" | "NOT_APPLICABLE"
  preparedAt: string
  storageCondition: string
  pickupAvailableAt: string
  usableUntil: string
  donorConfirmed: boolean
  allocations: Array<{
    recipientId: string
    quantity: number
  }>
}

export function getCurrentAllocation(
  donation: DemoDonation,
): RescueAllocation | undefined {
  return donation.allocations.find(
    (allocation) =>
      allocation.status === "OFFERING" || allocation.status === "ACCEPTED",
  )
}

export function getConfirmedQuantity(donation: DemoDonation): number {
  return donation.allocations.reduce(
    (total, allocation) => total + (allocation.receivedQuantity ?? 0),
    0,
  )
}
