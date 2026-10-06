import {
  useReducer,
  type ReactNode,
} from "react"
import { DemoStoreContext } from "@/lib/demo-context"
import {
  initialDonations,
  recipientCandidates,
  type DemoDonation,
  type NewDonationInput,
} from "@/lib/demo-data"

type DemoAction =
  | { type: "create"; donation: DemoDonation }
  | {
      type: "respond"
      donationId: string
      allocationId: string
      decision: "ACCEPT" | "DECLINE"
    }
  | {
      type: "receipt"
      donationId: string
      allocationId: string
      handoffCode: string
      quantityReceived: number
    }

export interface DemoStoreValue {
  donations: DemoDonation[]
  createDonation: (input: NewDonationInput) => string
  respondToOffer: (
    donationId: string,
    allocationId: string,
    decision: "ACCEPT" | "DECLINE",
  ) => void
  submitReceipt: (
    donationId: string,
    allocationId: string,
    handoffCode: string,
    quantityReceived: number,
  ) => void
}

function nextDonationState(
  donations: DemoDonation[],
  action: Exclude<DemoAction, { type: "create" }>,
): DemoDonation[] {
  return donations.map((donation) => {
    if (donation.id !== action.donationId) return donation

    if (action.type === "respond") {
      let relayed = false
      let movedToNextAllocation = false
      const allocations = donation.allocations.map((allocation) => {
        if (allocation.id === action.allocationId) {
          if (action.decision === "ACCEPT") {
            return { ...allocation, status: "ACCEPTED" as const }
          }
          if (
            allocation.fallbackRecipientId &&
            allocation.fallbackRecipientName &&
            allocation.fallbackInitials
          ) {
            relayed = true
            return {
              ...allocation,
              recipientId: allocation.fallbackRecipientId,
              recipientName: allocation.fallbackRecipientName,
              initials: allocation.fallbackInitials,
              distance: "6.4 km",
              eta: "17 min",
              status: "OFFERING" as const,
              fallbackRecipientId: undefined,
              fallbackRecipientName: undefined,
              fallbackInitials: undefined,
            }
          }
          return { ...allocation, status: "DECLINED" as const }
        }

        if (
          action.decision === "DECLINE" &&
          !relayed &&
          !movedToNextAllocation &&
          allocation.status === "QUEUED"
        ) {
          movedToNextAllocation = true
          return { ...allocation, status: "OFFERING" as const }
        }

        return allocation
      })
      return {
        ...donation,
        allocations,
        status:
          action.decision === "ACCEPT"
            ? "ACCEPTED"
            : relayed
              ? "RELAYED"
              : allocations.some((allocation) => allocation.status === "OFFERING")
                ? "OFFERING"
                : "UNCLAIMED",
      }
    }

    const allocation = donation.allocations.find(
      (item) => item.id === action.allocationId,
    )
    if (
      !allocation ||
      allocation.status !== "ACCEPTED" ||
      donation.handoffCode !== action.handoffCode ||
      !Number.isInteger(action.quantityReceived) ||
      action.quantityReceived < 1 ||
      action.quantityReceived > allocation.quantity
    ) {
      return donation
    }

    let activatedNext = false
    const allocations = donation.allocations.map((item) => {
      if (item.id === action.allocationId) {
        return {
          ...item,
          status: "RECEIVED" as const,
          receivedQuantity: action.quantityReceived,
        }
      }
      if (!activatedNext && item.status === "QUEUED") {
        activatedNext = true
        return { ...item, status: "OFFERING" as const }
      }
      return item
    })
    const receivedTotal = allocations.reduce(
      (total, item) => total + (item.receivedQuantity ?? 0),
      0,
    )
    return {
      ...donation,
      allocations,
      status: activatedNext
        ? "OFFERING"
        : receivedTotal === donation.quantity
          ? "RECEIVED"
          : "PARTIALLY_RECEIVED",
    }
  })
}

function reducer(
  donations: DemoDonation[],
  action: DemoAction,
): DemoDonation[] {
  if (action.type === "create") return [action.donation, ...donations]
  return nextDonationState(donations, action)
}

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [donations, dispatch] = useReducer(reducer, initialDonations)
  const value: DemoStoreValue = {
    donations,
    createDonation(input) {
      const id = `dn-${crypto.randomUUID()}`
      const donation: DemoDonation = {
        id,
        itemName: input.itemName,
        category: input.category,
        quantity: input.quantity,
        unit: "meals",
        createdAt: "Just now",
        usableUntil: input.usableUntil,
        status: "OFFERING",
        handoffCode: String(Math.floor(100000 + Math.random() * 900000)),
        allocations: input.allocations.map((item, index) => {
          const recipient = recipientCandidates.find(
            (candidate) => candidate.id === item.recipientId,
          )
          if (!recipient) {
            throw new Error(`Unknown demo recipient: ${item.recipientId}`)
          }
          return {
            id: `${id}-allocation-${index + 1}`,
            recipientId: recipient.id,
            recipientName: recipient.name,
            initials: recipient.initials,
            quantity: item.quantity,
            status: index === 0 ? "OFFERING" : "QUEUED",
            distance: recipient.distance,
            eta: recipient.eta,
            fallbackRecipientId:
              index === 0 && recipient.id === "hope-shelter"
                ? "neighborhood-kitchen"
                : undefined,
            fallbackRecipientName:
              index === 0 && recipient.id === "hope-shelter"
                ? "Neighborhood Kitchen"
                : undefined,
            fallbackInitials:
              index === 0 && recipient.id === "hope-shelter"
                ? "NK"
                : undefined,
          }
        }),
      }
      dispatch({ type: "create", donation })
      return id
    },
    respondToOffer(donationId, allocationId, decision) {
      dispatch({ type: "respond", donationId, allocationId, decision })
    },
    submitReceipt(donationId, allocationId, handoffCode, quantityReceived) {
      dispatch({
        type: "receipt",
        donationId,
        allocationId,
        handoffCode,
        quantityReceived,
      })
    },
  }
  return (
    <DemoStoreContext.Provider value={value}>
      {children}
    </DemoStoreContext.Provider>
  )
}
