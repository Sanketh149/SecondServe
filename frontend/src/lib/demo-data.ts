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

export interface RecipientCandidate {
  id: string
  name: string
  initials: string
  distance: string
  eta: string
  capacity: number
  unmetNeed: number
  openUntil: string
  readiness: "READY" | "BLOCKED"
  reasons: string[]
}

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
  category: string
  quantity: number
  unit: "meals"
  createdAt: string
  usableUntil: string
  status: DonationStatus
  handoffCode: string
  allocations: RescueAllocation[]
}

export interface NewDonationInput {
  itemName: string
  category: string
  quantity: number
  usableUntil: string
  allocations: Array<{
    recipientId: string
    quantity: number
  }>
}

export const recipientCandidates: RecipientCandidate[] = [
  {
    id: "hope-shelter",
    name: "Hope Shelter",
    initials: "HS",
    distance: "3.2 km",
    eta: "12 min",
    capacity: 40,
    unmetNeed: 24,
    openUntil: "8:00 PM",
    readiness: "READY",
    reasons: [
      "High unmet need",
      "Capacity fits",
      "Open at arrival",
      "Arrives before cutoff",
    ],
  },
  {
    id: "community-kitchen",
    name: "Community Kitchen",
    initials: "CK",
    distance: "5.1 km",
    eta: "19 min",
    capacity: 18,
    unmetNeed: 12,
    openUntil: "7:00 PM",
    readiness: "READY",
    reasons: [
      "Accepts prepared meals",
      "Capacity fits",
      "Open at arrival",
      "Arrives before cutoff",
    ],
  },
  {
    id: "community-pantry",
    name: "Community Pantry",
    initials: "CP",
    distance: "4.8 km",
    eta: "17 min",
    capacity: 12,
    unmetNeed: 0,
    openUntil: "6:00 PM",
    readiness: "BLOCKED",
    reasons: ["No current unmet need for prepared meals"],
  },
  {
    id: "neighborhood-kitchen",
    name: "Neighborhood Kitchen",
    initials: "NK",
    distance: "6.4 km",
    eta: "17 min",
    capacity: 30,
    unmetNeed: 20,
    openUntil: "7:30 PM",
    readiness: "READY",
    reasons: [
      "Accepts prepared meals",
      "Capacity fits",
      "Open at arrival",
      "Arrives before cutoff",
    ],
  },
]

export const initialDonations: DemoDonation[] = [
  {
    id: "dn-demo-1",
    itemName: "Vegetarian pasta meals",
    category: "Prepared meals",
    quantity: 32,
    unit: "meals",
    createdAt: "8 min ago",
    usableUntil: "Today, 4:00 PM",
    status: "OFFERING",
    handoffCode: "482916",
    allocations: [
      {
        id: "al-demo-1",
        recipientId: "hope-shelter",
        recipientName: "Hope Shelter",
        initials: "HS",
        quantity: 24,
        status: "OFFERING",
        distance: "3.2 km",
        eta: "12 min",
        fallbackRecipientId: "neighborhood-kitchen",
        fallbackRecipientName: "Neighborhood Kitchen",
        fallbackInitials: "NK",
      },
      {
        id: "al-demo-2",
        recipientId: "community-kitchen",
        recipientName: "Community Kitchen",
        initials: "CK",
        quantity: 8,
        status: "QUEUED",
        distance: "5.1 km",
        eta: "19 min",
      },
    ],
  },
  {
    id: "dn-demo-2",
    itemName: "Assorted bakery boxes",
    category: "Bakery",
    quantity: 18,
    unit: "meals",
    createdAt: "42 min ago",
    usableUntil: "Today, 5:30 PM",
    status: "ACCEPTED",
    handoffCode: "391204",
    allocations: [
      {
        id: "al-demo-3",
        recipientId: "community-kitchen",
        recipientName: "Community Kitchen",
        initials: "CK",
        quantity: 18,
        status: "ACCEPTED",
        distance: "5.1 km",
        eta: "19 min",
      },
    ],
  },
]

export const demoActivity = [
  {
    id: "activity-received",
    title: "24 meals confirmed received",
    detail: "Hope Shelter · Pasta meals",
    time: "Yesterday",
    kind: "received",
  },
  {
    id: "activity-plan",
    title: "Rescue plan started",
    detail: "Community Kitchen · Bakery boxes",
    time: "Mon",
    kind: "plan",
  },
]

export const seededImpact = {
  confirmedMeals: 248,
  offeredMeals: 326,
  rescueRate: 76,
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

export function getImpactTotals(donations: DemoDonation[]) {
  const sessionDonations = donations.filter(
    (donation) => donation.createdAt === "Just now",
  )
  const confirmedMeals =
    seededImpact.confirmedMeals +
    donations.reduce((total, donation) => total + getConfirmedQuantity(donation), 0)
  const offeredMeals =
    seededImpact.offeredMeals +
    sessionDonations.reduce((total, donation) => total + donation.quantity, 0)
  return {
    confirmedMeals,
    offeredMeals,
    rescueRate:
      offeredMeals === 0
        ? 0
        : Math.round((confirmedMeals / offeredMeals) * 100),
  }
}
