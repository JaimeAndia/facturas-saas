import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Crear cuenta — FacturApp',
}

// Server Action para el registro
async function registerAction(formData: FormData) {
  'use server'

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const nombre = formData.get('nombre') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nombre },
      // URL a la que redirigir tras confirmar el email
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`)
  }

  // Redirigir a página de confirmación de email
  redirect('/register/confirmacion')
}

interface PageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const params = await searchParams
  const errorMensaje = params.error

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="mb-1 text-xl font-bold text-gray-900">Crear cuenta</h1>
      <p className="mb-6 text-sm text-gray-500">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-medium text-blue-600 hover:underline">
          Inicia sesión
        </Link>
      </p>

      {errorMensaje && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {decodeURIComponent(errorMensaje)}
        </div>
      )}

      <form action={registerAction} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nombre" className="text-sm font-medium text-gray-700">
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            autoComplete="given-name"
            required
            placeholder="Tu nombre"
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="tu@email.com"
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-gray-700">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres"
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <button
          type="submit"
          className="h-10 w-full rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          Crear cuenta gratis
        </button>

        <p className="text-center text-xs text-gray-400">
          Al registrarte aceptas nuestros{' '}
          <a href="/terminos" className="underline hover:text-gray-600">términos de servicio</a>
        </p>
      </form>
    </div>
  )
}
