import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

// Cliente de Supabase para usar en componentes del lado del cliente
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
