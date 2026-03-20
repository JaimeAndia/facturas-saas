'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import type { Profile } from '@/types'

interface NavbarProps {
  perfil: Pick<Profile, 'nombre' | 'apellidos' | 'email'>
}

export function Navbar({ perfil }: NavbarProps) {
  const router = useRouter()
  const [menuAbierto, setMenuAbierto] = useState(false)

  const nombreMostrado = perfil.nombre
    ? `${perfil.nombre}${perfil.apellidos ? ' ' + perfil.apellidos : ''}`
    : perfil.email

  async function cerrarSesion() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-700 dark:bg-gray-900">
      {/* Título de la página actual - renderizado por cada página */}
      <div id="navbar-titulo" />

      <div className="flex items-center gap-1">
        <ThemeToggle />

      {/* Menú de usuario */}
      <div className="relative">
        <button
          onClick={() => setMenuAbierto(!menuAbierto)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {/* Avatar */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
            {(perfil.nombre?.[0] ?? perfil.email[0]).toUpperCase()}
          </div>
          <span className="hidden max-w-[160px] truncate text-gray-700 md:block dark:text-gray-200">
            {nombreMostrado}
          </span>
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {menuAbierto && (
          <>
            {/* Capa de cierre */}
            <div className="fixed inset-0 z-10" onClick={() => setMenuAbierto(false)} />
            {/* Dropdown */}
            <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-700">
                <p className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">{nombreMostrado}</p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{perfil.email}</p>
              </div>
              <button
                onClick={cerrarSesion}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar sesión
              </button>
            </div>
          </>
        )}
      </div>
      </div>
    </header>
  )
}
