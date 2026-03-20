import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { retryEventoBlockchain } from '@/lib/blockchain-event'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let eventoId: string
  try {
    const body = await request.json() as { eventoId?: string }
    if (!body.eventoId) {
      return NextResponse.json({ error: 'eventoId requerido' }, { status: 400 })
    }
    eventoId = body.eventoId
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const resultado = await retryEventoBlockchain(eventoId, user.id)

  if (!resultado) {
    return NextResponse.json({ ok: false, error: 'El reintento falló. Inténtalo de nuevo más tarde.' }, { status: 200 })
  }

  return NextResponse.json({ ok: true, txHash: resultado.txHash, ledger: resultado.ledger })
}
