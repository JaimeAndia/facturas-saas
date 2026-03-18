import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Confirma tu email — FacturX',
}

// Página de confirmación tras el registro
export default function ConfirmacionPage() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
        <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h1 className="mb-2 text-lg font-bold text-gray-900">Revisa tu email</h1>
      <p className="mb-6 text-sm text-gray-500">
        Te hemos enviado un enlace de confirmación. Haz clic en él para activar tu cuenta.
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
