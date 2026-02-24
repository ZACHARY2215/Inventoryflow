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

  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('blast_users')
        .select('*')
        .eq('id', userId)
        .single()
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
    } catch {
      // Profile fetch failed
    }
    return null
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
    const getSessionWithTimeout = () => {
      const timeout = new Promise<{data: {session: any}, error: any}>((_, reject) => {
        setTimeout(() => reject(new Error('Session fetch timed out (Token refresh deadlock)')), 6000)
      })
      return Promise.race([supabase.auth.getSession(), timeout])
    }

    getSessionWithTimeout().then(({ data: { session }, error }) => {
      if (error) {
        console.warn('Supabase session warning:', error.message)
        throw error
      }
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      }
      setIsLoading(false)
    }).catch((err) => {
      console.error('Failed to get session:', err)
      // Nuke stuck tokens to prevent permanent deadlock
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          localStorage.removeItem(key)
        }
      }
      setSession(null)
      setUser(null)
      setIsLoading(false)
      toast.error('Session expired or connection dropped. Please log in again.')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          if (event === 'SIGNED_IN') {
            recordLogin(session.user.id)

            const foundProfile = await fetchProfile(session.user.id)

            // If user has no profile and signed in with OAuth (Google) → pending flow
            if (!foundProfile) {
              const provider = session.user.app_metadata?.provider
              if (provider === 'google') {
                await handleGooglePendingUser(session.user)
                await supabase.auth.signOut()
                toast.info('Your account is pending admin approval. You\'ll be notified once approved.')
                return
              }
            }
          } else {
            fetchProfile(session.user.id)
          }
        } else {
          setProfile(null)
        }
        setIsLoading(false)
      }
    )

    return () => {
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
