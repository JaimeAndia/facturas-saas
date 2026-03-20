import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPerfil } from '@/lib/data/profile'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { BannerSuscripcion } from '@/components/layout/BannerSuscripcion'

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

  // getPerfil usa React cache() — si dashboard/page.tsx ya lo llamó,
  // no se hace una segunda query a Supabase en el mismo request
  const perfil = await getPerfil(user.id)
  if (!perfil) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Sidebar: visible en desktop, oculto en móvil */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Contenido principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar perfil={perfil} />
        <BannerSuscripcion />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
