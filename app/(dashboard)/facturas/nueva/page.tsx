import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClientesCached } from '@/lib/data/clientes'
import { FormFactura } from '@/components/facturas/FormFactura'
import type { Cliente } from '@/types'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nueva factura — FacturX',
}

export default async function NuevaFacturaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Lista de clientes cacheada 30 s — se invalida al crear/editar/borrar un cliente
  const clientes = (await getClientesCached(user!.id)) as Pick<Cliente, 'id' | 'nombre' | 'nif'>[]

  // Si no hay clientes, redirigir a la página de clientes para crear uno primero
  if (clientes.length === 0) {
    redirect('/clientes?aviso=sin-clientes')
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Nueva factura</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Completa los datos de la factura. El número se asignará automáticamente.
        </p>
      </div>
      <FormFactura clientes={clientes} />
    </div>
  )
}
