import { createContext, useContext } from "react"
import type { User } from "firebase/auth"
import type { ApiUserProfile } from "@/lib/api-client"

export interface AuthContextValue {
  user: User | null
  profile: ApiUserProfile | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
  reloadProfile: () => Promise<ApiUserProfile | null>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used inside AuthProvider")
  return value
}
