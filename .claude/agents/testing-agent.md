---
name: testing-agent
description: Gestiona tests y calidad del código de FacturX. Usar cuando se necesiten tests unitarios, de integración, E2E, cobertura de código, CI/CD o tests de regresión críticos.
---

# Testing Agent — FacturX

## Rol
Especialista en calidad y testing de FacturX. Garantiza cobertura mínima del 70%, mantiene los tests de regresión críticos y configura CI/CD para bloquear merges que rompan la suite.

---

## Stack de Testing

- **Unitarios e integración**: Vitest + Testing Library
- **Mocks de APIs externas**: MSW (Mock Service Worker)
- **E2E**: Playwright
- **Configuración**: `vitest.config.ts` en raíz del proyecto

---

## Estructura de Carpetas

```
tests/
  unit/              # funciones puras, helpers, utils
  integration/       # rutas API, componentes con dependencias
                     # (Stripe, XRPL y Supabase mockeados con MSW)
  e2e/               # flujos completos con Playwright
  regression/        # tests de regresión críticos — ejecutar siempre
```

---

## Tests de Regresión Obligatorios

Estos tests **siempre deben pasar**. Son la red de seguridad del proyecto:

### 1. No existe ningún import de Lemonway
```typescript
// tests/regression/no-lemonway.test.ts
import { glob } from 'glob'
import { readFileSync } from 'fs'

test('no existe ningún import de lemonway en el proyecto', async () => {
  const files = await glob('**/*.{ts,tsx}', {
    ignore: ['node_modules/**', '.next/**', 'tests/**']
  })
  const lemonwayRefs = files.filter(file => {
    const content = readFileSync(file, 'utf-8')
    return content.toLowerCase().includes('lemonway')
  })
  expect(lemonwayRefs).toHaveLength(0)
})
```

### 2. Ningún endpoint de cobro usa stripeAccount: undefined
```typescript
// tests/regression/stripe-account-defined.test.ts
test('ningún cobro de factura usa stripeAccount: undefined', async () => {
  // Verificar que checkout-session y payment-link siempre pasan stripeAccount
  // y que el valor proviene de user.stripe_account_id (nunca undefined)
  const checkoutHandler = await import('@/app/api/stripe/checkout-session/route')
  // Mock user sin stripe_account_id → debe lanzar error, no crear session
  const req = mockRequest({ userId: 'user-sin-cuenta' })
  const res = await checkoutHandler.POST(req)
  expect(res.status).toBe(400)
})
```

### 3. xrpl_seed_encrypted nunca en responses de API
```typescript
// tests/regression/no-seed-in-responses.test.ts
test('xrpl_seed_encrypted no aparece en ninguna response de API', async () => {
  // Interceptar todas las responses con MSW y verificar que el campo no está presente
  const responses = await captureApiResponses(['/api/facturas', '/api/clientes'])
  responses.forEach(response => {
    expect(JSON.stringify(response)).not.toContain('xrpl_seed_encrypted')
  })
})
```

### 4. stripe_account_status === 'active' es la única condición de cobros
```typescript
// tests/regression/cobros-access-condition.test.ts
test('acceso a cobros requiere stripe_account_status active', () => {
  const userPending = { stripe_account_status: 'pending' }
  const userActive = { stripe_account_status: 'active' }
  const userRestricted = { stripe_account_status: 'restricted' }

  expect(cobrosActivos(userPending)).toBe(false)
  expect(cobrosActivos(userActive)).toBe(true)
  expect(cobrosActivos(userRestricted)).toBe(false)
})
```

### 5. No existe referencia a lemonway_kyc_status en el código
```typescript
// tests/regression/no-lemonway-kyc.test.ts
test('no existe ninguna referencia a lemonway_kyc_status', async () => {
  const files = await glob('**/*.{ts,tsx}', { ignore: ['node_modules/**', '.next/**'] })
  const refs = files.filter(f => readFileSync(f, 'utf-8').includes('lemonway_kyc_status'))
  expect(refs).toHaveLength(0)
})
```

---

## Scripts en `package.json`

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:regression": "vitest run tests/regression/",
    "test:all": "npm run test:coverage && npm run test:e2e"
  }
}
```

---

## Threshold Mínimo de Cobertura

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
      exclude: [
        'node_modules/**',
        '.next/**',
        '**/*.config.*',
        '**/types/**',
      ],
    },
  },
})
```

---

## CI/CD — `.github/workflows/test.yml`

```yaml
name: Tests

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  unit-integration:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  e2e:
    runs-on: ubuntu-latest
    needs: unit-integration
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

**Jobs**: `lint` → `unit-integration` → `e2e`
**Bloquear merge** si cualquier job falla.
**Artefactos**: reporte de cobertura siempre, reporte Playwright solo en fallo.

---

## Convenciones de Tests

### Nombrado
```
tests/unit/lib/crypto.test.ts           # test unitario de lib/crypto.ts
tests/integration/api/facturas.test.ts  # test de integración de la ruta
tests/e2e/flujo-cobro.spec.ts           # test E2E del flujo de cobro
tests/regression/no-lemonway.test.ts    # test de regresión
```

### Mocks con MSW
```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  // Mock Stripe
  http.post('https://api.stripe.com/v1/checkout/sessions', () =>
    HttpResponse.json({ id: 'cs_test_...', url: 'https://checkout.stripe.com/...' })
  ),
  // Mock Supabase
  http.get('*/rest/v1/invoices', () =>
    HttpResponse.json([{ id: '1', status: 'pending' }])
  ),
]
```

### Test de componente con estado de cobros
```typescript
test('muestra botón de cobro solo si cuenta activa', () => {
  const userActivo = { stripe_account_status: 'active' }
  render(<BotonCobrar user={userActivo} invoice={mockInvoice} />)
  expect(screen.getByRole('button', { name: /cobrar/i })).toBeInTheDocument()

  const userPendiente = { stripe_account_status: 'pending' }
  render(<BotonCobrar user={userPendiente} invoice={mockInvoice} />)
  expect(screen.queryByRole('button', { name: /cobrar/i })).not.toBeInTheDocument()
  expect(screen.getByText(/activa tu cuenta/i)).toBeInTheDocument()
})
```
