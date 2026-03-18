'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'

type EstadoPOS = 'idle' | 'generating' | 'esperando' | 'cobrado'

interface ClienteItem {
  id: string
  nombre: string
}

interface FacturaHistorial {
  id: string
  numero: string
  total: number
  estado: string
  paid_at: string | null
  created_at: string
  notas: string | null
  clientes: { nombre: string } | null
}

interface PantallaPosProps {
  stripeActivo: boolean
  clientes: ClienteItem[]
}

export function PantallaPos({ stripeActivo, clientes }: PantallaPosProps) {
  // ── Estados del flujo ───────────────────────────────────────────────────────
  const [estadoPOS, setEstadoPOS] = useState<EstadoPOS>('idle')
  const [importe, setImporte] = useState('')
  const [concepto, setConcepto] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Datos del cobro activo
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [numeroFactura, setNumeroFactura] = useState<string | null>(null)
  const [totalCobro, setTotalCobro] = useState(0)
  const [copiado, setCopiado] = useState(false)

  // QR
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  // Historial del día
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [historial, setHistorial] = useState<FacturaHistorial[]>([])
  const [totalDia, setTotalDia] = useState(0)

  // Ref para el polling
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Cargar historial ────────────────────────────────────────────────────────
  const cargarHistorial = useCallback(async () => {
    try {
      const res = await fetch('/api/pos/history')
      const data = await res.json() as { facturas: FacturaHistorial[]; totalCobrado: number }
      setHistorial(data.facturas ?? [])
      setTotalDia(data.totalCobrado ?? 0)
    } catch { /* silencioso */ }
  }, [])

  useEffect(() => {
    cargarHistorial()
  }, [cargarHistorial])

  // ── Generar QR ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!paymentUrl) { setQrDataUrl(null); return }
    // Import dinámico para evitar problemas SSR con qrcode
    import('qrcode').then(QRCode => {
      QRCode.default.toDataURL(paymentUrl, { width: 220, margin: 2, color: { dark: '#111827', light: '#ffffff' } })
        .then(setQrDataUrl)
    })
  }, [paymentUrl])

  // ── Polling de estado ───────────────────────────────────────────────────────
  useEffect(() => {
    if (estadoPOS !== 'esperando' || !invoiceId) return

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/status`)
        const data = await res.json() as { estado: string; paid_at: string | null }
        if (data.estado === 'pagada') {
          clearInterval(pollingRef.current!)
          setEstadoPOS('cobrado')
          cargarHistorial()
        }
      } catch { /* silencioso */ }
    }, 2000)

    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [estadoPOS, invoiceId, cargarHistorial])

  // ── Generar cobro ───────────────────────────────────────────────────────────
  async function handleGenerarQR() {
    setError(null)
    const importeNum = parseFloat(importe.replace(',', '.'))
    if (!importeNum || importeNum <= 0) { setError('Introduce un importe válido'); return }
    if (!concepto.trim()) { setError('El concepto es obligatorio'); return }

    setEstadoPOS('generating')
    try {
      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importe: importeNum, concepto: concepto.trim(), clienteId: clienteId || undefined }),
      })
      const data = await res.json() as { invoiceId?: string; paymentUrl?: string; numero?: string; total?: number; error?: string }

      if (!res.ok || !data.invoiceId) {
        setError(data.error ?? 'Error generando el cobro')
        setEstadoPOS('idle')
        return
      }

      setInvoiceId(data.invoiceId)
      setPaymentUrl(data.paymentUrl!)
      setNumeroFactura(data.numero!)
      setTotalCobro(data.total!)
      setEstadoPOS('esperando')
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
      setEstadoPOS('idle')
    }
  }

  function handleNuevoCobro() {
    setEstadoPOS('idle')
    setImporte('')
    setConcepto('')
    setClienteId('')
    setInvoiceId(null)
    setPaymentUrl(null)
    setNumeroFactura(null)
    setQrDataUrl(null)
    setError(null)
  }

  async function handleCopiarLink() {
    if (!paymentUrl) return
    await navigator.clipboard.writeText(paymentUrl)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function handleCierreDeCaja() {
    const lineas = historial.map(f => {
      const hora = new Date(f.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      const estado = f.estado === 'pagada' ? '✓' : '·'
      const concepto = f.notas?.replace('Cobro POS: ', '') ?? f.numero
      return `${estado} ${hora}  ${concepto.padEnd(30)}  ${formatCurrency(f.total)}`
    }).join('\n')

    const fecha = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const resumen = `CIERRE DE CAJA — ${fecha.toUpperCase()}\n${'─'.repeat(50)}\n\n${lineas}\n\n${'─'.repeat(50)}\nTOTAL COBRADO: ${formatCurrency(totalDia)}\n`

    const ventana = window.open('', '_blank', 'width=600,height=600')
    if (!ventana) return
    ventana.document.write(`<html><head><title>Cierre de caja</title><style>body{font-family:monospace;padding:32px;font-size:14px;white-space:pre;}</style></head><body>${resumen.replace(/\n/g, '<br>')}</body></html>`)
    ventana.document.close()
    ventana.print()
  }

  // ── Render: sin Stripe activo ───────────────────────────────────────────────
  if (!stripeActivo) {
    return (
      <div className="mx-auto max-w-sm px-4 py-10">
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
            <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="font-semibold text-yellow-900">Cobros no activados</p>
          <p className="mt-1 text-sm text-yellow-700">Para usar el TPV necesitas activar tu cuenta de cobros.</p>
          <Link
            href="/configuracion"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
          >
            Ir a Configuración → Cobros
          </Link>
        </div>
      </div>
    )
  }

  // ── Render: cobro completado ────────────────────────────────────────────────
  if (estadoPOS === 'cobrado') {
    return (
      <div className="mx-auto max-w-sm px-4 py-10">
        <div className="rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm">
          {/* Animación de éxito */}
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-xl font-bold text-gray-900">¡Cobro recibido!</p>
          <p className="mt-1 text-3xl font-bold text-green-600">{formatCurrency(totalCobro)}</p>
          {numeroFactura && (
            <p className="mt-1 text-xs text-gray-400">Factura {numeroFactura}</p>
          )}
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={handleNuevoCobro}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Nuevo cobro
            </button>
            {invoiceId && (
              <Link
                href={`/facturas/${invoiceId}`}
                className="w-full rounded-xl border border-gray-200 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Ver factura
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Render: esperando pago (QR visible) ────────────────────────────────────
  if (estadoPOS === 'esperando') {
    return (
      <div className="mx-auto max-w-sm px-4 py-6">
        <div className="mb-4 flex items-center gap-2">
          <button onClick={handleNuevoCobro} className="text-gray-500 hover:text-gray-700">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-600">Cancelar cobro</span>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-center text-sm font-medium text-gray-500">Esperando pago</p>
          <p className="mt-1 text-center text-3xl font-bold text-gray-900">{formatCurrency(totalCobro)}</p>
          <p className="mt-0.5 text-center text-xs text-gray-400">{concepto}</p>

          {/* QR */}
          <div className="mt-5 flex justify-center">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR de pago" className="h-52 w-52 rounded-xl border border-gray-100" />
            ) : (
              <div className="flex h-52 w-52 items-center justify-center rounded-xl border border-gray-100 bg-gray-50">
                <svg className="h-8 w-8 animate-spin text-gray-300" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
          </div>

          <p className="mt-3 text-center text-xs text-gray-400">
            El cliente escanea el QR con la cámara del móvil
          </p>

          {/* Indicador de polling */}
          <div className="mt-4 flex items-center justify-center gap-1.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" />
            <span className="ml-2 text-xs text-gray-400">Esperando confirmación…</span>
          </div>

          {/* Acciones del link */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCopiarLink}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              {copiado ? (
                <><svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Copiado</>
              ) : (
                <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copiar link</>
              )}
            </button>
            {paymentUrl && (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Pago de ${formatCurrency(totalCobro)}: ${paymentUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] py-2.5 text-sm font-medium text-white hover:bg-[#1ebe5d]"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Render: formulario de cobro (idle / generating) ─────────────────────────
  return (
    <div className="mx-auto max-w-sm px-4 py-6">

      {/* Formulario */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-base font-semibold text-gray-900">Cobro rápido</h2>

        {/* Importe */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-500">IMPORTE</label>
          <div className="flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 focus-within:border-blue-500 focus-within:bg-white">
            <span className="text-2xl font-bold text-gray-400">€</span>
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              value={importe}
              onChange={e => setImporte(e.target.value)}
              className="w-full bg-transparent text-3xl font-bold text-gray-900 placeholder:text-gray-300 focus:outline-none"
            />
          </div>
        </div>

        {/* Concepto */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-500">CONCEPTO</label>
          <input
            type="text"
            placeholder="Ej: Corte de pelo, Reparación, Clase…"
            value={concepto}
            onChange={e => setConcepto(e.target.value)}
            maxLength={80}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Cliente */}
        {clientes.length > 0 && (
          <div className="mb-5">
            <label className="mb-1 block text-xs font-medium text-gray-500">CLIENTE <span className="text-gray-300">(opcional)</span></label>
            <select
              value={clienteId}
              onChange={e => setClienteId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">— Cobro directo —</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <button
          onClick={handleGenerarQR}
          disabled={estadoPOS === 'generating'}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-base font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60"
        >
          {estadoPOS === 'generating' ? (
            <>
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generando…
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3m2 0V5m6 3V5m6 3V5" />
              </svg>
              Generar QR de cobro
            </>
          )}
        </button>
      </div>

      {/* Historial del día */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <button
          onClick={() => setHistorialAbierto(v => !v)}
          className="flex w-full items-center justify-between px-5 py-4"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">Hoy</span>
            {historial.length > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {historial.filter(f => f.estado === 'pagada').length} cobros
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-green-600">{formatCurrency(totalDia)}</span>
            <svg
              className={`h-4 w-4 text-gray-400 transition-transform ${historialAbierto ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {historialAbierto && (
          <>
            {historial.length === 0 ? (
              <p className="px-5 pb-4 text-sm text-gray-400">Sin cobros hoy todavía.</p>
            ) : (
              <ul className="divide-y divide-gray-50 border-t border-gray-100">
                {historial.map(f => {
                  const hora = new Date(f.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                  const concepto = f.notas?.replace('Cobro POS: ', '') ?? f.numero
                  return (
                    <li key={f.id} className="flex items-center justify-between px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{concepto}</p>
                        <p className="text-xs text-gray-400">{hora} · {f.clientes?.nombre ?? 'Cobro directo'}</p>
                      </div>
                      <div className="ml-3 flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          f.estado === 'pagada' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {f.estado === 'pagada' ? formatCurrency(f.total) : 'Pendiente'}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {historial.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-3">
                <button
                  onClick={handleCierreDeCaja}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Cierre de caja
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
