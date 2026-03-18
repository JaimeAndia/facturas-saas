import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { generateUserWallet } from '@/lib/xrpl-wallet'

// Delay entre activaciones para no saturar el faucet/red XRPL
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Solo accesible con x-admin-key correcto
export async function GET() {
  const headersList = await headers()
  const adminKey = headersList.get('x-admin-key')

  if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = await createAdminClient()

  // Buscar usuarios Pro o con addon que aún no tienen wallet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: usuarios, error } = await (supabase as any)
    .from('profiles')
    .select('id')
    .or('plan.eq.pro,xrpl_addon.eq.true')
    .is('xrpl_address', null) as { data: { id: string }[] | null; error: unknown }

  if (error || !usuarios) {
    return NextResponse.json({ error: 'Error consultando usuarios' }, { status: 500 })
  }

  const errors: { userId: string; error: string }[] = []
  let processed = 0

  for (const { id: userId } of usuarios) {
    const address = await generateUserWallet(userId)
    if (address) {
      processed++
    } else {
      errors.push({ userId, error: 'generateUserWallet devolvió null' })
    }
    // Esperar 2s entre llamadas para no saturar la red XRPL
    if (usuarios.indexOf({ id: userId }) < usuarios.length - 1) {
      await delay(2000)
    }
  }

  return NextResponse.json({ processed, total: usuarios.length, errors })
}
