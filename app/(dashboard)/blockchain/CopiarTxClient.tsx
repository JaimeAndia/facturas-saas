'use client'

import { useState } from 'react'

/**
 * Botón de copiar el TX hash al portapapeles.
 * Separado como componente client por el uso de navigator.clipboard y useState.
 */
export function CopiarTxClient({ txHash }: { txHash: string }) {
  const [copiado, setCopiado] = useState(false)

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(txHash)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Silenciar error si el portapapeles no está disponible
    }
  }

  return (
    <button
      onClick={handleCopiar}
      title={copiado ? 'Copiado' : 'Copiar TX hash'}
      className="text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-500 dark:hover:text-gray-300"
    >
      {copiado ? (
        <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  )
}
