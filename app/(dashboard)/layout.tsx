import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'

// Layout compartido para todas las páginas del dashboard
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Verificar sesión activa
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Cargar perfil del usuario
  const { data: perfil } = await supabase
    .from('profiles')
    .select('nombre, apellidos, email')
    .eq('id', user.id)
    .single()

  if (!perfil) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar: visible en desktop, oculto en móvil */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Contenido principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar perfil={perfil} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
