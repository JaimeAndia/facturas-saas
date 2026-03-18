import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Recuperar contraseña — FacturX',
}

// Server Action para solicitar reset de contraseña
async function resetPasswordAction(formData: FormData) {
  'use server'

  const email = formData.get('email') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/update-password`,
  })

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/reset-password?enviado=true')
}

interface PageProps {
  searchParams: Promise<{ error?: string; enviado?: string }>
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams

  if (params.enviado) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
          <svg className="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="mb-2 text-lg font-bold text-gray-900">Revisa tu email</h1>
        <p className="mb-6 text-sm text-gray-500">
          Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña.
        </p>
        <Link
          href="/login"
          className="inline-flex h-9 items-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Volver al login
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="mb-1 text-xl font-bold text-gray-900">Recuperar contraseña</h1>
      <p className="mb-6 text-sm text-gray-500">
        Introduce tu email y te enviaremos un enlace para restablecerla.
      </p>

      {params.error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {decodeURIComponent(params.error)}
        </div>
      )}

      <form action={resetPasswordAction} className="space-y-4">
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

        <button
          type="submit"
          className="h-10 w-full rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700"
        >
          Enviar enlace
        </button>

        <Link
          href="/login"
          className="flex justify-center text-sm text-gray-500 hover:text-gray-700"
        >
          ← Volver al login
        </Link>
      </form>
    </div>
  )
}
