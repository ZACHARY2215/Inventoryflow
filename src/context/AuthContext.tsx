import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000 // 8 hours
const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes idle logout

export interface UserProfile {
  id: string
  email: string
  role: 'admin' | 'staff'
  display_name: string | null
  created_at: string
}

type AuthContextType = {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  isLoading: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAdmin: false,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const authInitializedRef = useRef(false)
  const profileFetchPromiseRef = useRef<Promise<UserProfile | null> | null>(null)
  const profileFetchUserIdRef = useRef<string | null>(null)

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    })
    try {
      return await Promise.race([promise, timeoutPromise])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }

  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    if (profileFetchPromiseRef.current && profileFetchUserIdRef.current === userId) {
      return profileFetchPromiseRef.current
    }

    const run = async (): Promise<UserProfile | null> => {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('blast_users')
          .select('*')
          .eq('id', userId)
          .single(),
        7000,
        'fetchProfile query'
      )
      if (!error && data) {
        if (data.is_active === false) {
          await supabase.auth.signOut()
          setProfile(null)
          return null
        }
        setProfile(data as UserProfile)
        // Clear pending flag if they're now approved
        localStorage.removeItem('pendingApproval')
        return data as UserProfile
      }
    } catch (err: any) {
      const message = err?.message || String(err)
      // If the initial query timed out, don't block auth with another long retry.
      if (message.includes('timed out')) return null
      // Profile fetch failed
    }
    // Single retry for transient network/RLS timing issues right after sign-in.
    try {
      await new Promise(resolve => setTimeout(resolve, 400))
      const { data, error } = await withTimeout(
        supabase
          .from('blast_users')
          .select('*')
          .eq('id', userId)
          .single(),
        7000,
        'fetchProfile retry query'
      )
      if (!error && data) {
        if (data.is_active === false) {
          await supabase.auth.signOut()
          setProfile(null)
          return null
        }
        setProfile(data as UserProfile)
        localStorage.removeItem('pendingApproval')
        return data as UserProfile
      }
    } catch {
    }
    return null
    }

    const promise = run().finally(() => {
      if (profileFetchPromiseRef.current === promise) {
        profileFetchPromiseRef.current = null
        profileFetchUserIdRef.current = null
      }
    })

    profileFetchPromiseRef.current = promise
    profileFetchUserIdRef.current = userId
    return promise
  }

  // Handle Google OAuth users who haven't been approved yet
  const handleGooglePendingUser = async (u: User) => {
    try {
      // Check if they already submitted a request
      const { data: existing } = await supabase
        .from('blast_registration_requests')
        .select('id, status')
        .eq('email', u.email!)
        .maybeSingle()

      if (existing) {
        // Already has a request (pending or rejected)
        localStorage.setItem('pendingApproval', existing.status === 'rejected' ? 'rejected' : 'true')
        return
      }

      // Auto-create registration request from Google profile
      const meta = u.user_metadata || {}
      const firstName = meta.given_name || meta.name?.split(' ')[0] || ''
      const lastName = meta.family_name || meta.name?.split(' ').slice(1).join(' ') || ''
      const username = meta.full_name || meta.name || u.email?.split('@')[0] || ''

      await supabase.from('blast_registration_requests').insert({
        first_name: firstName,
        last_name: lastName,
        username,
        email: u.email!,
        phone: '', // Google users can update this later
        auth_user_id: u.id,
        provider: 'google',
      })
      localStorage.setItem('pendingApproval', 'true')
    } catch {
      localStorage.setItem('pendingApproval', 'true')
    }
  }

  const recordLogin = async (userId: string) => {
    try {
      await supabase.from('blast_users').update({ last_login_at: new Date().toISOString() }).eq('id', userId)
    } catch { /* ignore */ }
  }

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  // Idle timeout - auto logout after 30 min inactivity
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (session) {
      idleTimerRef.current = setTimeout(() => {
        signOut()
      }, IDLE_TIMEOUT_MS)
    }
  }, [session, signOut])

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => document.addEventListener(e, resetIdleTimer, { passive: true }))
    resetIdleTimer()
    return () => {
      events.forEach(e => document.removeEventListener(e, resetIdleTimer))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [resetIdleTimer])

  // Session timeout - check if session is older than 8 hours
  useEffect(() => {
    if (!session) return
    const sessionStart = new Date(session.expires_at ? (session.expires_at * 1000 - 3600000) : Date.now()).getTime()
    const elapsed = Date.now() - sessionStart
    if (elapsed > SESSION_TIMEOUT_MS) {
      signOut()
    }
  }, [session, signOut])

  useEffect(() => {
    let disposed = false
    const readSessionFromStorage = (): Session | null => {
      try {
        const url = new URL(import.meta.env.VITE_SUPABASE_URL as string)
        const projectRef = url.hostname.split('.')[0]
        const key = `sb-${projectRef}-auth-token`
        const raw = localStorage.getItem(key)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        const session = parsed?.currentSession ?? parsed
        if (session?.access_token && session?.user?.id) {
          return session as Session
        }
      } catch {
        // ignore local fallback parse errors
      }
      return null
    }

    const applySession = async (event: string, nextSession: Session | null) => {
      authInitializedRef.current = true
      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (nextSession?.user) {
        const provider = nextSession.user.app_metadata?.provider
        if (event === 'SIGNED_IN') {
          // Non-blocking bookkeeping.
          void recordLogin(nextSession.user.id)

          // Only block on Google because we need pending-approval gating behavior.
          if (provider === 'google') {
            const foundProfile = await fetchProfile(nextSession.user.id)
          // If user has no profile and signed in with OAuth (Google) → pending flow
            if (!foundProfile) {
              await handleGooglePendingUser(nextSession.user)
              await supabase.auth.signOut()
              toast.info('Your account is pending admin approval. You\'ll be notified once approved.')
              return
            }
          }
        }
        // For refresh/email sign-in flows, don't block route loading on profile query.
        if (!disposed) setIsLoading(false)
        void fetchProfile(nextSession.user.id)
      } else {
        setProfile(null)
        if (!disposed) setIsLoading(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (disposed) return
        await applySession(event, session)
      }
    )

    // Fallback bootstrap: if INITIAL_SESSION callback is delayed, fetch once directly.
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (disposed || authInitializedRef.current) return
        await applySession('INITIAL_SESSION', session)
      })
      .catch(() => {
        if (disposed || authInitializedRef.current) return
        setIsLoading(false)
      })

    // Absolute failsafe to avoid an infinite spinner if browser extensions block auth plumbing.
    const loadingFailsafe = setTimeout(() => {
      if (!disposed && !authInitializedRef.current) {
        const fallback = readSessionFromStorage()
        if (fallback?.user) {
          applySession('INITIAL_SESSION', fallback)
          return
        }
        setIsLoading(false)
      }
    }, 8000)

    return () => {
      disposed = true
      clearTimeout(loadingFailsafe)
      subscription.unsubscribe()
    }
  }, [])

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      isLoading,
      isAdmin: profile?.role === 'admin',
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  return useContext(AuthContext)
}
