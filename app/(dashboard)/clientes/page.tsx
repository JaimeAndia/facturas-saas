import { createClient } from '@/lib/supabase/server'
import { TablaClientes } from '@/components/clientes/TablaClientes'
import type { Cliente } from '@/types'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Clientes — FacturApp',
}

// Página de clientes: Server Component que carga los datos y
// los pasa al componente interactivo TablaClientes
export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('clientes')
    .select('*')
    .eq('user_id', user!.id)
    .order('nombre', { ascending: true })

  const clientes = (data as Cliente[] | null) ?? []

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
      <TablaClientes clientes={clientes} />
    </div>
  )
}
