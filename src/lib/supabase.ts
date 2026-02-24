import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * A custom fetch wrapper ensuring ALL Supabase requests (Auth, DB, Storage) timeout
 * after 15 seconds. If a browser extension drops a token refresh request, this
 * prevents the app from being stuck on a permanent loading screen.
 */
const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    })
    return response
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('Supabase network request timed out:', input)
      throw new Error('Network request timed out. Please check your connection or browser extensions.')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
  global: {
    fetch: customFetch,
  },
})

/**
 * A wrapper around supabase.functions.invoke that enforces a timeout.
 * This prevents the UI from freezing indefinitely if a browser extension
 * (like an adblocker or password manager) intercepts the fetch request 
 * and fails to resolve the Promise.
 */
export async function invokeEdgeFunction<T = any>(
  functionName: string, 
  options?: any, 
  timeoutMs = 15000
): Promise<{ data: T | null; error: any | null }> {
  const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) => {
    setTimeout(() => {
      resolve({ 
        data: null, 
        error: new Error(`Request to ${functionName} timed out. If you are using a browser extension (like an adblocker), please whitelist this site.`) 
      })
    }, timeoutMs)
  })

  try {
    const response = await Promise.race([
      supabase.functions.invoke<T>(functionName, options),
      timeoutPromise
    ])
    return response as { data: T | null; error: any | null }
  } catch (err: any) {
    // Catch standard fetch network errors (e.g. CORS, offline)
    return { data: null, error: err }
  }
}
