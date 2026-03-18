import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Devuelve el address XRPL del usuario autenticado (o null si aún no tiene).
// Usado para polling desde el componente SeccionIdentidadDigital.
// El seed cifrado NUNCA se devuelve aquí.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('profiles')
    .select('xrpl_address')
    .eq('id', user.id)
    .single() as { data: { xrpl_address: string | null } | null }

  return NextResponse.json({ address: data?.xrpl_address ?? null })
}
