import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FormularioPerfil } from './FormularioPerfil'
import type { Profile } from '@/types'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Editar datos — FacturX',
}

export default async function EditarPerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const perfil = data as Profile | null
  if (!perfil) redirect('/configuracion')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <a href="/configuracion" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <h1 className="text-xl font-bold text-gray-900">Editar datos</h1>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <FormularioPerfil perfil={perfil} />
      </section>
    </div>
  )
}
