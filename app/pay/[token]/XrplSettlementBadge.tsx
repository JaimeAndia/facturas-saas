'use client'

import { useEffect, useState } from 'react'

interface SettlementData {
  status: string
  txHash: string | null
  settledAt: string | null
  explorerUrl: string | null
}

const MAX_INTENTOS = 20  // 20 × 2s = 40s — suficiente para que XRPL confirme

export function XrplSettlementBadge({ token }: { token: string }) {
  const [data, setData] = useState<SettlementData | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [agotado, setAgotado] = useState(false)

  useEffect(() => {
    // Poll hasta que esté settled, failed o not_applicable — máx 8 intentos (~16s)
    async function check() {
      try {
        const res = await fetch(`/api/pay/${token}/settlement-status`)
        const json = await res.json() as SettlementData
        setData(json)

        // 'pending' y 'unknown' (payment_log aún no creado) → seguir esperando
        // cualquier otro status no-settled → parar
        if (json.status === 'pending' || json.status === 'unknown') {
          if (attempts < MAX_INTENTOS) {
            setTimeout(() => setAttempts(a => a + 1), 2000)
          } else {
            setAgotado(true)
          }
        } else if (json.status !== 'settled') {
          setAgotado(true)
        }
      } catch {
        // silencioso
      }
    }
    check()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, attempts])

  // No aplica (factura sin XRPL) → no mostrar nada
  if (data?.status === 'not_applicable') return null

  // Determinar si hay error definitivo
  const haFallado =
    data?.status === 'failed' ||
    (agotado && data?.status !== 'settled')

  return (
    <div className={`mt-4 overflow-hidden rounded-2xl border shadow-sm transition-all ${
      data?.status === 'settled'
        ? 'border-emerald-200 bg-gradient-to-br from-emerald-950 to-slate-900'
        : haFallado
          ? 'border-red-900/40 bg-gradient-to-br from-red-950/60 to-slate-900'
          : 'animate-breathe border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800'
    }`}>
      <div className="px-5 py-4">
        {/* Cabecera */}
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            data?.status === 'settled'
              ? 'bg-emerald-500/20'
              : haFallado
                ? 'bg-red-500/20'
                : 'bg-slate-600/40'
          }`}>
            {haFallado ? (
              <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className={`h-4 w-4 ${data?.status === 'settled' ? 'text-emerald-400' : 'text-slate-400'}`}
                viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8zm-1 4v4.586l-2.293-2.293-1.414 1.414L12 16.414l4.707-4.707-1.414-1.414L13 12.586V8h-2z" />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {data?.status === 'settled' ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                  Verificado en blockchain
                </p>
                <p className="mt-0.5 text-sm font-medium text-white">
                  XRP Ledger · Registro inmutable
                </p>
              </>
            ) : haFallado ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-widest text-red-400">
                  Verificación no completada
                </p>
                <p className="mt-0.5 text-sm text-red-300">
                  No se pudo registrar el sello en XRP Ledger
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Registrando en blockchain
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-300">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                  Verificando en XRP Ledger…
                </p>
              </>
            )}
          </div>

          {data?.status === 'settled' && (
            <div className="shrink-0 rounded-full bg-emerald-500/20 p-1.5">
              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>

        {/* Hash + enlace */}
        {data?.status === 'settled' && data.txHash && (
          <div className="mt-3 rounded-lg bg-black/30 px-3 py-2.5">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">
              Transaction Hash
            </p>
            <p className="break-all font-mono text-xs text-slate-300">
              {data.txHash}
            </p>
            {data.explorerUrl && (
              <a
                href={data.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                Verificar en XRP Ledger
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        )}

        {/* Nota según estado */}
        {data?.status === 'settled' && (
          <p className="mt-2.5 text-xs text-slate-500">
            Este pago ha quedado registrado de forma permanente e inalterable en el XRP Ledger.
            Puede verificarse públicamente en cualquier momento usando el hash anterior.
          </p>
        )}
        {haFallado && (
          <p className="mt-2.5 text-xs text-red-400/70">
            El pago ha sido procesado correctamente. El registro en blockchain puede completarse
            más tarde de forma automática.
          </p>
        )}
      </div>
    </div>
  )
}
