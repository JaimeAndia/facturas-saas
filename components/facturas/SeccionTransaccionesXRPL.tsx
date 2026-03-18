'use client'

import { useEffect, useState } from 'react'
import type { XrplTx } from '@/app/api/xrpl/transactions/route'

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function hashCorto(hash: string): string {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`
}

function CeldaFactura({ tx }: { tx: XrplTx }) {
  if (!tx.invoiceId) return <span className="text-gray-400">—</span>
  if (tx.invoiceNumero) {
    return (
      <a href={`/facturas/${tx.invoiceId}`} className="text-blue-600 hover:underline">
        {tx.invoiceNumero}
      </a>
    )
  }
  // Factura eliminada — el registro blockchain sigue siendo válido
  return (
    <span className="inline-flex items-center gap-1 text-gray-400" title="Factura eliminada del sistema. El registro blockchain permanece inmutable.">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      Eliminada
    </span>
  )
}

function CeldaHash({ invoiceHash }: { invoiceHash: string | null }) {
  const [copiado, setCopiado] = useState(false)

  if (!invoiceHash) return <span className="text-gray-300 text-xs">—</span>

  async function copiar() {
    await navigator.clipboard.writeText(invoiceHash!)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <button
      onClick={copiar}
      title={`SHA-256: ${invoiceHash}\n\nClic para copiar`}
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600"
    >
      <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
      <span className="font-mono">{hashCorto(invoiceHash)}</span>
      {copiado && <span className="text-emerald-600">✓</span>}
    </button>
  )
}

export function SeccionTransaccionesXRPL() {
  const [txs, setTxs] = useState<XrplTx[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    fetch('/api/xrpl/transactions')
      .then(r => r.json())
      .then(data => setTxs(data.transactions ?? []))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  if (cargando || txs.length === 0) return null

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Registros blockchain</h2>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">XRPL</span>
        </div>
        <p className="text-xs text-gray-400">Inmutables · Verificables públicamente</p>
      </div>

      {/* Tabla desktop */}
      <table className="hidden w-full md:table">
        <thead>
          <tr className="border-b border-gray-100">
            {['Tx Hash', 'Factura', 'Hash SHA-256', 'Importe', 'Fecha', ''].map(h => (
              <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {txs.map(tx => (
            <tr key={tx.hash} className="hover:bg-gray-50/50">
              <td className="px-5 py-3">
                <span className="font-mono text-xs text-gray-500">{hashCorto(tx.hash)}</span>
              </td>
              <td className="px-5 py-3">
                <CeldaFactura tx={tx} />
              </td>
              <td className="px-5 py-3">
                <CeldaHash invoiceHash={tx.invoiceHash} />
              </td>
              <td className="px-5 py-3 text-sm font-medium text-gray-900">
                {tx.amountEur ? `${Number(tx.amountEur).toFixed(2)} €` : '—'}
              </td>
              <td className="px-5 py-3 text-sm text-gray-500">
                {formatTimestamp(tx.timestamp)}
              </td>
              <td className="px-5 py-3 text-right">
                <div className="flex items-center justify-end gap-3">
                  {tx.invoiceProofUrl && (
                    <a
                      href={tx.invoiceProofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800"
                      title="JSON con el contenido original de la factura — descargable para verificación independiente"
                    >
                      Prueba
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  )}
                  <a
                    href={tx.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    XRPL
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Lista móvil */}
      <ul className="divide-y divide-gray-100 md:hidden">
        {txs.map(tx => (
          <li key={tx.hash} className="px-5 py-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <CeldaFactura tx={tx} />
              {tx.amountEur && (
                <span className="text-sm font-semibold text-gray-900">
                  {Number(tx.amountEur).toFixed(2)} €
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{formatTimestamp(tx.timestamp)}</span>
              <div className="flex gap-3">
                {tx.invoiceProofUrl && (
                  <a href={tx.invoiceProofUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-emerald-600 hover:underline">
                    Prueba →
                  </a>
                )}
                <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:underline">
                  XRPL →
                </a>
              </div>
            </div>
            {tx.invoiceHash && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">SHA-256:</span>
                <CeldaHash invoiceHash={tx.invoiceHash} />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="border-t border-gray-100 px-5 py-3">
        <p className="text-xs text-gray-400">
          {txs.length} registro{txs.length !== 1 ? 's' : ''} inmutable{txs.length !== 1 ? 's' : ''} en XRP Ledger
        </p>
      </div>
    </section>
  )
}
