import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Iniciar sesión — FacturApp',
}

// Server Action para el login
async function loginAction(formData: FormData) {
  'use server'

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/dashboard')
}

interface PageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams
  const errorMensaje = params.error

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="mb-1 text-xl font-bold text-gray-900">Iniciar sesión</h1>
      <p className="mb-6 text-sm text-gray-500">
        ¿No tienes cuenta?{' '}
        <Link href="/register" className="font-medium text-blue-600 hover:underline">
          Regístrate gratis
        </Link>
      </p>

      {errorMensaje && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {decodeURIComponent(errorMensaje)}
        </div>
      )}

      <form action={loginAction} className="space-y-4">
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
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <Link href="/reset-password" className="text-xs text-blue-600 hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <button
          type="submit"
          className="h-10 w-full rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          Iniciar sesión
        </button>
      </form>
    </div>
  )
}
