import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DetalleFactura } from '@/components/facturas/DetalleFactura'
import type { Factura, LineaFactura, Cliente, Profile } from '@/types'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('facturas').select('numero').eq('id', id).single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const numero = (data as any)?.numero ?? 'Factura'
  return { title: `${numero} — FacturApp` }
}

export default async function DetalleFacturaPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Cargar factura con líneas y cliente
  const { data: rawFactura } = await supabase
    .from('facturas')
    .select('*, clientes(*), lineas_factura(*)')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!rawFactura) notFound()

  // Cargar perfil del autónomo (para mostrar en la factura)
  const { data: rawPerfil } = await supabase
    .from('profiles')
    .select('nombre, apellidos, nif, email, telefono, direccion, ciudad, codigo_postal, provincia')
    .eq('id', user!.id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = rawFactura as any
  const factura = {
    ...(raw as Factura),
    lineas: (raw.lineas_factura ?? []) as LineaFactura[],
    cliente: raw.clientes as Cliente,
  }

  const perfil = (rawPerfil as Pick<
    Profile,
    'nombre' | 'apellidos' | 'nif' | 'email' | 'telefono' | 'direccion' | 'ciudad' | 'codigo_postal' | 'provincia'
  > | null) ?? {
    nombre: null,
    apellidos: null,
    nif: null,
    email: '',
    telefono: null,
    direccion: null,
    ciudad: null,
    codigo_postal: null,
    provincia: null,
  }

  return <DetalleFactura factura={factura} perfil={perfil} />
}
