import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
