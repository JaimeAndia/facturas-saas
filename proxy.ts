import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rutas que requieren autenticación
const RUTAS_PROTEGIDAS = ['/dashboard', '/facturas', '/clientes', '/informes', '/configuracion', '/ajustes']

// Rutas solo para usuarios NO autenticados
const RUTAS_AUTH = ['/login', '/register', '/reset-password']

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresca la sesión del usuario si existe
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Sin sesión intentando acceder a ruta protegida → login con redirect de vuelta
  const esRutaProtegida = RUTAS_PROTEGIDAS.some(ruta => pathname.startsWith(ruta))
  if (esRutaProtegida && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Con sesión intentando entrar a login/register → dashboard
  const esRutaAuth = RUTAS_AUTH.some(ruta => pathname.startsWith(ruta))
  if (esRutaAuth && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.searchParams.delete('next')
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
