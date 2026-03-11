import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Callback de Supabase Auth para confirmar email y OAuth
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? '/dashboard'
  // Prevenir open redirect: solo rutas internas (empiezan con / pero no con //)
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Error en el callback
  return NextResponse.redirect(`${origin}/login?error=auth-callback-error`)
}
