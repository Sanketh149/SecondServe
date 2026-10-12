import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as updateFirebaseProfile,
  type User,
} from "firebase/auth"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { getMe } from "@/lib/api-client"
import { AuthContext } from "@/lib/auth-context"
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase"
import type { ApiUserProfile } from "@/lib/api-client"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ApiUserProfile | null>(null)
  const [loading, setLoading] = useState(firebaseAuth !== null)
  const [error, setError] = useState<string | null>(
    firebaseConfigured ? null : "Firebase web app configuration is missing.",
  )

  const reloadProfile = useCallback(async () => {
    if (!firebaseAuth?.currentUser) {
      setProfile(null)
      return null
    }
    const loaded = await getMe()
    setProfile(loaded)
    return loaded
  }, [])

  useEffect(() => {
    if (!firebaseAuth) return
    return onAuthStateChanged(firebaseAuth, async (currentUser) => {
      setUser(currentUser)
      setError(null)
      if (!currentUser) {
        setProfile(null)
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        setProfile(await getMe())
      } catch (profileError) {
        setProfile(null)
        setError(
          profileError instanceof Error
            ? profileError.message
            : "Could not load the organization profile.",
        )
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      error,
      async signIn(email: string, password: string) {
        if (!firebaseAuth) throw new Error("Firebase is not configured.")
        setError(null)
        await signInWithEmailAndPassword(firebaseAuth, email.trim(), password)
      },
      async signUp(email: string, password: string, displayName: string) {
        if (!firebaseAuth) throw new Error("Firebase is not configured.")
        setError(null)
        const result = await createUserWithEmailAndPassword(
          firebaseAuth,
          email.trim(),
          password,
        )
        await updateFirebaseProfile(result.user, { displayName: displayName.trim() })
      },
      async signOut() {
        if (!firebaseAuth) return
        await firebaseSignOut(firebaseAuth)
      },
      reloadProfile,
    }),
    [error, loading, profile, reloadProfile, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
