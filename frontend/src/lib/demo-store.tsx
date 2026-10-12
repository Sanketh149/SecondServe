import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { DemoStoreContext } from "@/lib/demo-context"
import { useAuth } from "@/lib/auth-context"
import {
  isPendingMatch,
  type DemoDonation,
  type NewDonationInput,
} from "@/lib/demo-data"
import {
  analyzeFoodImage,
  createDonationAndStart,
  loadDonorDonations,
  loadForecast,
  loadImpactSummary,
  loadRecipientDonations,
  loadRecipientProfile,
  previewRescuePlan,
  retryDonationMatch as retryDonationMatchRequest,
  saveDonationForMatching as saveDonationForMatchingRequest,
  respondToBackendOffer,
  submitBackendReceipt,
  type ApiFoodAnalysis,
  type ApiForecast,
  type ApiImpactSummary,
  type ApiRecipientProfile,
  type ApiRescuePlan,
  updateRecipientProfile as updateRecipientProfileRequest,
  type RecipientProfileUpdate,
} from "@/lib/api-client"

export interface DemoStoreValue {
  donations: DemoDonation[]
  loading: boolean
  initialLoading: boolean
  apiError: string | null
  impactSummary: ApiImpactSummary | null
  forecast: ApiForecast | null
  recipientProfile: ApiRecipientProfile | null
  refresh: () => Promise<void>
  analyzeImage: (file: File) => Promise<ApiFoodAnalysis>
  previewPlan: (input: NewDonationInput) => Promise<ApiRescuePlan>
  createDonation: (input: NewDonationInput) => Promise<string>
  saveDonationForMatching: (input: NewDonationInput) => Promise<string>
  updateRecipientProfile: (
    input: RecipientProfileUpdate,
  ) => Promise<ApiRecipientProfile>
  respondToOffer: (
    donationId: string,
    allocationId: string,
    decision: "ACCEPT" | "DECLINE",
  ) => Promise<void>
  submitReceipt: (
    donationId: string,
    allocationId: string,
    handoffCode: string,
    quantityReceived: number,
  ) => Promise<void>
}

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const recipientRoute = profile?.role === "recipient"
  const initialLoadStarted = useRef(false)
  const [donations, setDonations] = useState<DemoDonation[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [impactSummary, setImpactSummary] = useState<ApiImpactSummary | null>(null)
  const [forecast, setForecast] = useState<ApiForecast | null>(null)
  const [recipientProfile, setRecipientProfile] =
    useState<ApiRecipientProfile | null>(null)

  const pendingMatchIds = donations
    .filter(isPendingMatch)
    .map((donation) => donation.id)
  const pendingMatchKey = pendingMatchIds.join("|")
  const matchRetryInFlight = useRef(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      const [loadedDonations, impact, loadedRecipientProfile, forecastResult] = await Promise.all([
        recipientRoute ? loadRecipientDonations() : loadDonorDonations(),
        loadImpactSummary(),
        recipientRoute ? loadRecipientProfile() : Promise.resolve(null),
        loadForecast(),
      ])
      setDonations(loadedDonations)
      setImpactSummary(impact)
      setRecipientProfile(loadedRecipientProfile)
      setForecast(forecastResult)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not load organization data."
      setApiError(message)
      throw error
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }, [recipientRoute])

  useEffect(() => {
    if (initialLoadStarted.current) return
    initialLoadStarted.current = true
    void refresh().catch(() => undefined)
  }, [refresh])

  useEffect(() => {
    if (recipientRoute || !hasLoaded || !pendingMatchKey) return
    let active = true
    const donationIds = pendingMatchKey.split("|")
    const timer = window.setInterval(async () => {
      if (!active || matchRetryInFlight.current) return
      matchRetryInFlight.current = true
      setApiError(null)
      try {
        for (const donationId of donationIds) {
          const donation = donations.find((item) => item.id === donationId)
          if (!donation || !isPendingMatch(donation)) continue
          const plan = await retryDonationMatchRequest(donationId)
          if (plan.status === "FULL" || plan.status === "PARTIAL") {
            await refresh()
            break
          }
        }
      } catch (error) {
        setApiError(
          error instanceof Error
            ? error.message
            : "Could not retry matching this donation.",
        )
      } finally {
        matchRetryInFlight.current = false
      }
    }, 30_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [donations, hasLoaded, pendingMatchKey, recipientRoute, refresh])

  const value: DemoStoreValue = {
    donations,
    loading,
    initialLoading: loading && !hasLoaded,
    apiError,
    impactSummary,
    forecast,
    recipientProfile,
    refresh,
    analyzeImage: analyzeFoodImage,
    previewPlan: previewRescuePlan,
    async createDonation(input) {
      const id = await createDonationAndStart(input)
      await refresh()
      return id
    },
    async saveDonationForMatching(input) {
      const id = await saveDonationForMatchingRequest(input)
      await refresh()
      return id
    },
    async updateRecipientProfile(input) {
      const updatedProfile = await updateRecipientProfileRequest(input)
      setRecipientProfile(updatedProfile)
      return updatedProfile
    },
    async respondToOffer(donationId, allocationId, decision) {
      await respondToBackendOffer(donationId, allocationId, decision)
      await refresh()
    },
    async submitReceipt(_donationId, allocationId, handoffCode, quantityReceived) {
      await submitBackendReceipt(allocationId, handoffCode, quantityReceived)
      await refresh()
    },
  }

  return (
    <DemoStoreContext.Provider value={value}>
      {children}
    </DemoStoreContext.Provider>
  )
}
