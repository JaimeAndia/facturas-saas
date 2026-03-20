'use client'

import { useEffect, useState } from 'react'

interface Props {
  xrplAddress: string | null
  esPro: boolean // plan === 'pro' || xrpl_addon === true
  isTestnet: boolean
}

export function SeccionIdentidadDigital({ xrplAddress: initialAddress, esPro, isTestnet }: Props) {
  const [address, setAddress] = useState<string | null>(initialAddress)
  const [pollingActivo, setPollingActivo] = useState(!initialAddress && esPro)

  useEffect(() => {
    if (!pollingActivo) return

    const intervalo = setInterval(async () => {
      try {
        const res = await fetch('/api/xrpl/wallet-status')
        const data = await res.json()
        if (data.address) {
          setAddress(data.address)
          setPollingActivo(false)
          clearInterval(intervalo)
        }
      } catch {
        // Silencioso — reintentamos en el siguiente tick
      }
    }, 3000)

    return () => clearInterval(intervalo)
  }, [pollingActivo])

  // No mostrar si no es Pro ni tiene addon
  if (!esPro) return null

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">Tu identidad digital</h2>

      {address ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Tus facturas verificadas quedan firmadas con tu identidad única en la blockchain XRPL.
          </p>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3">
            <p className="mb-1 text-xs font-medium text-gray-400 dark:text-gray-500">Dirección XRPL</p>
            <p className="break-all font-mono text-sm text-gray-900 dark:text-gray-100">{address}</p>
          </div>
          <a
            href={`https://${isTestnet ? 'testnet' : 'livenet'}.xrpl.org/accounts/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center rounded-lg border border-gray-300 dark:border-gray-600 px-3 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Ver en explorador →
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
          Generando tu identidad digital...
        </div>
      )}
    </section>
  )
}
