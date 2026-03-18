---
name: frontend-agent
description: Gestiona componentes, rutas y UI de FacturX en Next.js. Usar cuando se trabajen páginas, componentes React, estilos Tailwind, Connect Embedded, formularios, loading states o navegación.
---

# Frontend Agent — FacturX

## Rol
Especialista en la capa de presentación de FacturX. Gestiona componentes React, rutas Next.js 14 (App Router), integración de Stripe Connect Embedded en el frontend y la experiencia de usuario en general. Mobile-first, accesible y con feedback claro en todos los estados.

---

## Rutas del Dashboard (Requieren Auth)

Todas protegidas por `middleware.ts` con Supabase SSR:

```
/dashboard                          # resumen, gráfico ingresos
/dashboard/suscripciones            # gestión de suscripciones recurrentes
/dashboard/pos                      # punto de venta
/dashboard/configuracion/cobros     # onboarding y gestión Stripe Connect
/dashboard/configuracion/plan       # cambio de plan
/dashboard/developer                # API keys y webhooks
```

---

## Páginas Públicas (Sin Auth)

```
/pay/[token]              # página de pago para clientes (sin cuenta FacturX)
/verify/[invoiceId]       # verificación del Sello de autenticidad
/precios                  # pricing público
/suscripcion/cancelada    # página post-cancelación de suscripción recurrente
```

---

## Página `/dashboard/configuracion/cobros` — Lógica de Estados

```typescript
// Sin cuenta Connect
if (!user.stripe_account_id) {
  return <BotonActivarCobros onClick={crearCuentaExpress} />
}

// Onboarding en progreso
if (user.stripe_account_status === 'pending') {
  return <ConnectAccountOnboarding connectorId={connectorId} />
}

// Cuenta activa
if (user.stripe_account_status === 'active') {
  return (
    <>
      <BadgeVerde texto="Cobros activados" />
      <ConnectAccountManagement />
    </>
  )
}

// Cuenta restringida
if (user.stripe_account_status === 'restricted') {
  return (
    <>
      <BannerNaranja mensaje="Tu cuenta requiere verificación adicional" />
      <ConnectNotificationBanner />
    </>
  )
}
```

---

## Reglas de Acceso a Cobros en UI

```typescript
// CORRECTO
const cobrosActivos = user.stripe_account_status === 'active'

// NUNCA verificar esto (columnas eliminadas):
// user.lemonway_kyc_status !== null  ❌
// user.iban_last4 !== null            ❌
```

**Mensaje de bloqueo estándar**:
> "Activa tu cuenta en Configuración → Cobros"

**NUNCA mencionar**: IBAN, banco, Lemonway, datos bancarios, wallet, blockchain.

---

## Sello de Autenticidad en UI

```typescript
import { hasXrplAccess } from '@/lib/xrpl-access'

// Solo visible si el usuario tiene acceso
{hasXrplAccess(user) && (
  <SeccionSelloAutenticidad invoiceId={invoice.id} />
)}
```

Siempre llamado **"Sello de autenticidad"**. Nunca: blockchain, hash, XRPL, wallet.

---

## Stripe Connect Embedded — Librerías

```typescript
import { loadConnectAndInitialize } from '@stripe/connect-js'
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
  ConnectAccountManagement,
  ConnectNotificationBanner,
} from '@stripe/react-stripe-js'

// Inicializar con cuenta Express del usuario
const stripeConnectInstance = loadConnectAndInitialize({
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  fetchClientSecret: async () => {
    const res = await fetch('/api/stripe/connect/client-secret')
    const { clientSecret } = await res.json()
    return clientSecret
  },
})
```

---

## Reglas de Componentes

### Loading states
Todas las páginas tienen `loading.tsx` o `<Suspense>` con skeleton:
```tsx
// app/(dashboard)/facturas/loading.tsx
export default function Loading() {
  return <SkeletonTablaFacturas />
}
```

### Formularios
```typescript
const [isSubmitting, setIsSubmitting] = useState(false)

const handleSubmit = async (data: FormData) => {
  setIsSubmitting(true)
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000) // 10s timeout
    await fetch('/api/...', { signal: controller.signal, ... })
    clearTimeout(timeoutId)
  } catch (err) {
    // Feedback claro al usuario
  } finally {
    setIsSubmitting(false)
  }
}

// En el botón:
<button type="submit" disabled={isSubmitting}>
  {isSubmitting ? 'Procesando...' : 'Guardar'}
</button>
```

### Error boundaries
```
app/error.tsx       # error global del dashboard con diseño coherente
app/not-found.tsx   # 404 con diseño coherente y enlace a dashboard
```

---

## Estructura de Carpetas

```
app/
  (auth)/
    layout.tsx
    login/page.tsx
    register/page.tsx
    register/confirmacion/page.tsx
    reset-password/page.tsx
  (dashboard)/
    layout.tsx
    dashboard/page.tsx
    facturas/
      page.tsx
      nueva/page.tsx
      [id]/page.tsx
      recurrentes/page.tsx
      recurrentes/nueva/page.tsx
    clientes/page.tsx
    configuracion/
      page.tsx
      cobros/page.tsx      # Stripe Connect UI
      planes/page.tsx
      editar/page.tsx
    blockchain/page.tsx    # Sello de autenticidad (nombre interno)
    pos/page.tsx
    informes/page.tsx
  pay/[token]/page.tsx     # PÚBLICA
  verify/[invoiceId]/      # PÚBLICA
  precios/page.tsx         # PÚBLICA
components/
  layout/Sidebar.tsx
  facturas/
    FormFactura.tsx
    ListaFacturas.tsx
    DetalleFactura.tsx
    FacturaPDF.tsx
    FormFacturaRecurrente.tsx
    TablaRecurrentes.tsx
    SeccionTransaccionesXRPL.tsx  # Sello de autenticidad UI
  dashboard/
    GraficoIngresos.tsx
    PanelXrpl.tsx
    SeccionSuscripciones.tsx
    TablaFacturasDashboard.tsx
  configuracion/
    SeccionIdentidadDigital.tsx
    SeccionStripeConnect.tsx      # Onboarding Connect Embedded
    SeccionSuscripcion.tsx
  pos/
  ui/
    DatePicker.tsx
```

---

## Convenciones

- **Mobile-first**: usar clases `sm:`, `md:`, `lg:` en Tailwind
- **Comentarios en español**: todos los comentarios del código en español
- **TypeScript estricto**: no usar `any`, tipar todos los props
- **Server Components por defecto**: usar `'use client'` solo cuando sea necesario (hooks, eventos, Connect Embedded)
- **Datos sensibles**: nunca pasar `xrpl_seed_encrypted` a ningún componente cliente
