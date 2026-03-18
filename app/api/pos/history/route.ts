import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Devuelve las facturas POS de hoy (emitidas o pagadas) con el total acumulado cobrado.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const hoy = new Date().toISOString().split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('facturas')
    .select('id, numero, total, estado, paid_at, created_at, notas, clientes(nombre)')
    .eq('user_id', user.id)
    .eq('source', 'pos')
    .gte('created_at', `${hoy}T00:00:00`)
    .order('created_at', { ascending: false }) as {
      data: Array<{
        id: string
        numero: string
        total: number
        estado: string
        paid_at: string | null
        created_at: string
        notas: string | null
        clientes: { nombre: string } | null
      }> | null
    }

  const facturas = data ?? []
  const totalCobrado = facturas
    .filter(f => f.estado === 'pagada')
    .reduce((sum, f) => sum + f.total, 0)

  return NextResponse.json({ facturas, totalCobrado })
}
