import { createClient } from '@/lib/supabase/server'
import { TablaClientes } from '@/components/clientes/TablaClientes'
import type { Cliente } from '@/types'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Clientes — FacturX',
}

interface PageProps {
  searchParams: Promise<{ aviso?: string }>
}

export default async function ClientesPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { aviso } = await searchParams

  const { data } = await supabase
    .from('clientes')
    .select('*')
    .eq('user_id', user!.id)
    .order('nombre', { ascending: true })

  const clientes = (data as Cliente[] | null) ?? []

  const mensajes: Record<string, string> = {
    'sin-clientes': 'Necesitas al menos un cliente para crear una factura.',
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Clientes</h1>
      <TablaClientes clientes={clientes} avisoInicial={aviso ? (mensajes[aviso] ?? null) : null} />
    </div>
  )
}
