import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Verificar autorización del cron
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    // Obtener precio XRP/EUR de CoinGecko
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=eur',
      { next: { revalidate: 0 } }
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'CoinGecko no disponible' }, { status: 502 })
    }

    const json = await res.json() as { ripple?: { eur?: number } }
    const precio = json?.ripple?.eur

    if (typeof precio !== 'number' || precio <= 0) {
      return NextResponse.json({ error: 'Precio inválido de CoinGecko' }, { status: 502 })
    }

    const supabase = await createAdminClient()
    const ahora = new Date().toISOString()

    // Actualizar precio en app_config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('app_config') as any)
      .upsert({ key: 'xrp_price_eur', value: precio.toString(), updated_at: ahora })

    // Pausar activaciones si XRP supera 6€ (protección anti-volatilidad)
    const paused = precio > 6
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('app_config') as any)
      .upsert({ key: 'xrpl_activations_paused', value: paused.toString(), updated_at: ahora })

    return NextResponse.json({
      ok: true,
      xrp_price_eur: precio,
      activations_paused: paused,
    })
  } catch (err) {
    console.error('[cron/update-xrp-price]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
