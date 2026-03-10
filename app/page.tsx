import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Página raíz: redirige según el estado de sesión
export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
