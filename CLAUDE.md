# CLAUDE.md

@~/orchestrator/CLAUDE.md

---

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## FacturX — SaaS de facturación para autónomos españoles

**Stack**: Next.js 16 App Router · TypeScript · Tailwind CSS · Supabase (RLS) · Stripe Connect · Resend · @react-pdf/renderer · Vercel

---

## Comandos

```bash
npm run dev                                  # desarrollo
npm run build && npm run start               # producción local
npm run lint                                 # ESLint
npm run test                                 # vitest run (todos)
npx vitest run __tests__/utils.test.ts       # test individual
npx vitest run --reporter=verbose            # con output detallado
```

Tests en `__tests__/`. Vitest `environment: 'node'`, alias `@` → raíz del proyecto.

---

## Patrones Críticos — con código

### 1. Dos cuentas Stripe: NUNCA mezclarlas

```typescript
// ✅ Cobro de factura → SIEMPRE en la cuenta Express del autónomo
stripe.checkout.sessions.create({ ... }, { stripeAccount: user.stripe_account_id })
stripe.customers.create({ ... },         { stripeAccount: user.stripe_account_id })
stripe.prices.create({ ... },            { stripeAccount: user.stripe_account_id })
stripe.subscriptions.cancel(id, {},      { stripeAccount: user.stripe_account_id })
stripe.billingPortal.sessions.create({}, { stripeAccount: user.stripe_account_id })

// ✅ Plan de FacturX → cuenta principal (getStripe() sin stripeAccount)
stripe.subscriptions.retrieve(subscriptionId)
stripe.customers.create({ email })

// ❌ NUNCA — mezcla que envía dinero a la cuenta de FacturX en lugar del autónomo
stripe.checkout.sessions.create({ metadata: { invoice_id } })  // sin stripeAccount
```

### 2. Acceso a cobros: una sola condición

```typescript
// ✅
const cobrosActivos = user.stripe_account_status === 'active'

// ❌ No existen estas columnas — fueron eliminadas
user.lemonway_kyc_status
user.iban_last4
```

### 3. Webhook: diferenciar Express vs cuenta principal

```typescript
// /api/webhooks/stripe/route.ts — webhook UNIFICADO
case 'invoice.payment_succeeded': {
  if (evento.account) {
    // Express → cobro automático de recurrente → generar factura
  } else {
    // Principal → renovación plan FacturX → actualizar profiles
  }
}
// Mismo patrón para: invoice.payment_failed, customer.subscription.deleted
```

### 4. XRPL: nunca bloquea el flujo principal

```typescript
// ✅ Fire-and-forget con try/catch
registrarEventoBlockchain(facturaId, userId, 'pago').catch((err) =>
  console.error('[XRPL] fallo silencioso:', err.message)
)
return { success: true }  // responde sin esperar XRPL

// ❌ Nunca await en el flujo principal
await registrarEventoBlockchain(facturaId, userId, 'pago')
```

### 5. xrpl_seed_encrypted: nunca en SELECT *, responses ni logs

```typescript
// ✅ Seleccionar campos explícitamente
supabase.from('profiles').select('id, email, stripe_account_id, plan, xrpl_address')

// ❌
supabase.from('profiles').select('*')           // expone xrpl_seed_encrypted
console.log('perfil:', perfil)                  // si perfil tiene la seed
res.json(perfil)                                // nunca devolver el objeto completo
```

### 6. Acceso a XRPL (Sello de autenticidad)

```typescript
const hasXrplAccess = (user: Profile) => user.plan === 'pro' || !!user.xrpl_addon
// En UI: siempre 'Sello de autenticidad' — nunca blockchain/hash/wallet/XRPL/ledger
```

### 7. Clientes Supabase: cuál usar en cada contexto

```typescript
// Server Components, Route Handlers autenticados → respeta RLS con sesión del usuario
import { createClient } from '@/lib/supabase/server'

// Webhooks, crons, operaciones admin (sin sesión activa) → service_role, bypassa RLS
import { createAdminClient } from '@/lib/supabase/server'
```

### 8. Server actions: tipo de retorno estándar

```typescript
// Todas las server actions retornan ResultadoAccion (de facturas/actions.ts)
type ResultadoAccion<T = void> = { ok: true; datos?: T } | { ok: false; error: string }
```

### 9. Migraciones SQL: mostrar y esperar confirmación

```typescript
// ANTES de cualquier ALTER TABLE, CREATE TABLE, DROP — mostrar SQL completo al usuario
// y esperar confirmación explícita. Archivos en supabase/migrations/v2_*.sql
```

---
## Rules
ALWAYS before making any change. Search on the web for the newest documentation.
And only implement if you are 100% sure it will work.

## Modelo de datos clave

### Tabla `profiles` (NO `users`)

```typescript
// plan: 'free' | 'basico' | 'pro'          ← NO 'basic'
// plan_status: 'active' | 'past_due' | 'canceled'
// stripe_account_status: 'not_connected' | 'pending' | 'active' | 'restricted'
// stripe_account_id   → acct_xxx  → Express → cobros de facturas
// stripe_customer_id  → cus_xxx   → cuenta principal → planes de la app
// xrpl_seed_encrypted → NUNCA exponer, cifrado AES-256-GCM con ENCRYPTION_KEY
```

### Tabla `facturas_recurrentes` — dos modos

```typescript
// cobro_automatico = false (default)
//   → cron /api/cron/facturas-recurrentes (08:00 UTC) genera factura + email con link
//   → .eq('cobro_automatico', false) en la query del cron — no toca las automáticas

// cobro_automatico = true
//   → Stripe Subscription en Express gestiona cobro y timing
//   → cobro_status: 'manual'|'pending_setup'|'active'|'past_due'|'canceled'
//   → stripe_subscription_id: referencia en la cuenta Express (acct_xxx)
//   → stripe_customer_id: el cliente (cus_xxx) en la cuenta Express
```

### Columnas que NO existen — no crear ni referenciar

```
lemonway_wallet_id  lemonway_kyc_status  iban_last4  iban_bic
```

### Número de factura

```typescript
// Generado por función SQL — nunca calcular manualmente en código
supabase.rpc('fn_generar_numero_factura', { p_user_id: userId })
// Formato resultado: 'FAC-2026-0001'
```

---

## Flujos principales

### Cobro único de factura
```
POST /api/stripe/payment-link          → genera token → guarda en facturas.payment_token
GET  /pay/[token]                      → página pública (sin auth)
POST /api/stripe/checkout-session      → Checkout Session en cuenta Express
webhook checkout.session.completed     → marca factura pagada (metadata.invoice_id)
```

### Cobro automático en recurrentes
```
POST /api/stripe/recurrentes/[id]/activar-cobro
  → Customer + Product + Price + Checkout Session (mode:'subscription') en Express
  → setup_url para que el cliente introduzca tarjeta
webhook checkout.session.completed (metadata.recurrente_id)
  → guarda stripe_subscription_id, cobro_automatico=true
webhook invoice.payment_succeeded (evento.account=acct_xxx)
  → genera factura pagada + email con PDF + link portal
GET /api/stripe/recurrentes/[id]/portal-publico?cid={cus_xxx}
  → endpoint público → genera BillingPortal session en Express → redirect
```

### Onboarding Stripe Connect del autónomo
```
POST /api/stripe/connect/start    → crea cuenta Express + AccountLink URL
GET  /api/stripe/connect/return   → actualiza stripe_account_status
GET  /api/stripe/connect/refresh  → regenera AccountLink caducado
```

### Sello de autenticidad (XRPL, solo plan Pro o xrpl_addon=true)
```
lib/invoice-proof.ts    → hash SHA-256 del contenido → on-chain → invoices.blockchain_hash
lib/xrpl-settlement.ts  → liquidación interna tras pago (uso interno)
/verify/[invoiceId]     → página pública, sin auth, recalcula y compara hash
```

---

## Middleware y routing

- Middleware: `proxy.ts` (exporta `proxy` y `config`)
- Protegidas: `/dashboard`, `/facturas`, `/clientes`, `/informes`, `/configuracion`, `/ajustes`
- Públicas: `/pay/[token]`, `/verify/[invoiceId]`, `/api/webhooks/*`, `/precios`
- Webhook unificado: `/api/webhooks/stripe/route.ts` (usa `evento.account` para distinguir Express/principal)

---

## Crons (Vercel) — verifican `Authorization: Bearer ${CRON_SECRET}`

| Schedule | Endpoint | Acción |
|---|---|---|
| `0 8 * * *` | `/api/cron/facturas-recurrentes` | Genera recurrentes manuales (`cobro_automatico=false`) |
| `0 9 * * *` | `/api/cron/payment-reminders` | Recordatorios de pago |
| `0 * * * *` | `/api/cron/update-xrp-price` | Actualiza `app_config.xrp_price_eur` |

---

## Precios y variables de entorno Stripe

```
free:   0€    — plan_status='active' sin stripe
basico: 12€/mes — NEXT_PUBLIC_STRIPE_PRICE_BASIC / NEXT_PUBLIC_STRIPE_PRICE_BASIC_ANUAL
pro:    22€/mes — NEXT_PUBLIC_STRIPE_PRICE_PRO   / NEXT_PUBLIC_STRIPE_PRICE_PRO_ANUAL
xrpl_addon: +6€/mes (solo basico) — STRIPE_PRICE_XRPL_ADDON_MONTHLY/ANNUAL
Descuento anual: 15% en todos los planes (precioAnual = precio * 0.85)
```

---

## Subagentes disponibles (`.claude/agents/`)

Invocar con `@nombre-agente` cuando la tarea sea específicamente de ese dominio:

- **`stripe-agent`** — pagos, webhooks, Connect, suscripciones, variables Stripe
- **`xrpl-agent`** — Sello de autenticidad, wallets, cifrado seeds, `/verify`
- **`database-agent`** — migraciones SQL, RLS, índices, schema, queries
- **`frontend-agent`** — componentes, rutas, UI, Connect Embedded, formularios
- **`testing-agent`** — tests unitarios/integración/E2E, cobertura, CI
