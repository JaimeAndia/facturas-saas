'use client'

import { useState, useEffect } from 'react'

interface XrplStatus {
  connected: boolean
  network: 'testnet' | 'mainnet'
  address: string
  balance_xrp: number
  xrp_price_eur: number
  activations_paused: boolean
}

export function PanelXrpl() {
  const [abierto, setAbierto] = useState(false)
  const [status, setStatus] = useState<XrplStatus | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!abierto || status || error) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true)
    fetch('/api/blockchain/status')
      .then(r => r.json())
      .then(data => { if (!cancelled) setStatus(data as XrplStatus) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setCargando(false) })
    return () => { cancelled = true }
  }, [abierto, status, error])

  const isTestnet = status?.network === 'testnet'
  const explorerUrl = status?.address
    ? `https://${isTestnet ? 'testnet' : 'livenet'}.xrpl.org/accounts/${status.address}`
    : null

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Cabecera colapsable */}
      <button
        onClick={() => setAbierto(v => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className={`h-2 w-2 rounded-full ${
            !status ? 'bg-gray-300 dark:bg-gray-600' : status.connected ? 'bg-emerald-500' : 'bg-red-400'
          }`} />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Estado XRP Ledger</h2>
          {status?.network && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isTestnet ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30'
            }`}>
              {isTestnet ? 'Testnet' : 'Mainnet'}
            </span>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform ${abierto ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Contenido */}
      {abierto && (
        <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-700">
          {cargando ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Consultando estado…
            </div>
          ) : error ? (
            <p className="text-sm text-red-500 dark:text-red-400">No se pudo obtener el estado de XRPL.</p>
          ) : status ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Conexión */}
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Conexión</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${status.connected ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {status.connected ? 'Conectado' : 'Desconectado'}
                  </p>
                </div>
              </div>

              {/* Balance */}
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Saldo app wallet</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {status.balance_xrp.toFixed(2)} XRP
                </p>
                {status.xrp_price_eur > 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    ≈ {(status.balance_xrp * status.xrp_price_eur).toFixed(0)} €
                  </p>
                )}
              </div>

              {/* Precio XRP */}
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Precio XRP</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {status.xrp_price_eur > 0 ? `${status.xrp_price_eur.toFixed(4)} €` : '—'}
                </p>
                {status.activations_paused && (
                  <p className="text-xs font-medium text-red-500 dark:text-red-400">Activaciones pausadas</p>
                )}
              </div>

              {/* Address */}
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Dirección wallet</p>
                <p className="mt-0.5 break-all font-mono text-xs text-gray-700 dark:text-gray-300">{status.address}</p>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs font-medium text-blue-600 hover:underline"
                  >
                    Ver en explorador →
                  </a>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
