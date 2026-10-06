import { createContext, useContext } from "react"
import type { DemoStoreValue } from "@/lib/demo-store"

export const DemoStoreContext = createContext<DemoStoreValue | null>(null)

export function useDemoStore(): DemoStoreValue {
  const store = useContext(DemoStoreContext)
  if (!store) {
    throw new Error("useDemoStore must be used inside DemoStoreProvider")
  }
  return store
}
