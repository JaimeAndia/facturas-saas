import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

// Features destacadas
const FEATURES = [
  {
    titulo: 'Facturas en segundos',
    descripcion: 'Crea facturas profesionales con numeración automática y cálculo de IVA e IRPF.',
    icono: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    ),
  },
  {
    titulo: 'Cobra online',
    descripcion: 'Genera links de pago con Stripe y recibe el dinero directamente en tu cuenta bancaria.',
    icono: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    ),
  },
  {
    titulo: 'PDF con tu logo',
    descripcion: 'Descarga y envía facturas en PDF con tu imagen de marca directamente desde la app.',
    icono: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    ),
  },
  {
    titulo: 'Gestión de clientes',
    descripcion: 'Mantén un registro de todos tus clientes con sus datos fiscales y historial de facturas.',
    icono: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    ),
  },
]

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Navbar */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900">FacturX</span>
          </div>
          <nav className="flex items-center gap-2">
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex h-8 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
              >
                Ir al dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-8 items-center rounded-lg px-4 text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Entrar
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-8 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Empezar gratis
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-4 py-20 text-center">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
            Diseñado para autónomos españoles
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Factura sin complicaciones
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-500">
            Crea facturas profesionales, gestiona tus clientes y cobra online.
            Todo lo que necesitas como autónomo, en un solo lugar.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href={user ? '/dashboard' : '/register'}
              className="inline-flex h-11 items-center rounded-xl bg-blue-600 px-7 text-base font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              {user ? 'Ir al dashboard' : 'Empezar gratis'}
            </Link>
            {!user && (
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-xl border border-gray-200 px-7 text-base font-medium text-gray-600 hover:bg-gray-50"
              >
                Ya tengo cuenta
              </Link>
            )}
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-gray-100 bg-gray-50">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 className="mb-10 text-center text-xl font-bold text-gray-900">
              Todo lo que necesitas para facturar
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ titulo, descripcion, icono }) => (
                <div key={titulo} className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {icono}
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{titulo}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{descripcion}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="mx-auto max-w-5xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Empieza hoy, gratis</h2>
          <p className="mt-2 text-gray-500">Sin tarjeta de crédito. Cancela cuando quieras.</p>
          <Link
            href={user ? '/dashboard' : '/register'}
            className="mt-6 inline-flex h-11 items-center rounded-xl bg-blue-600 px-8 text-base font-semibold text-white hover:bg-blue-700"
          >
            {user ? 'Ir al dashboard' : 'Crear cuenta gratis'}
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6">
        <p className="text-center text-xs text-gray-400">
          © {new Date().getFullYear()} FacturX — Facturación para autónomos españoles
        </p>
      </footer>
    </div>
  )
}
