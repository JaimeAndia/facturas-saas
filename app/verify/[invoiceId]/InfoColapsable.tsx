'use client'

import { useState } from 'react'

export function InfoColapsable() {
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          ¿Qué significa esta verificación?
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {abierto && (
        <div className="space-y-3 border-t border-gray-100 px-5 py-4">
          <p className="text-sm text-gray-600">
            Un <strong className="text-gray-800">sello de autenticidad</strong> es un registro público e inmutable
            que prueba que este documento existía exactamente en la forma en que lo ves, en la fecha indicada.
          </p>
          <p className="text-sm text-gray-600">
            Este registro está almacenado en el <strong className="text-gray-800">XRP Ledger</strong>, una red
            blockchain descentralizada operada por más de 150 validadores independientes en todo el mundo.
            <strong className="text-gray-800"> Nadie puede borrarlo ni modificarlo</strong>, ni siquiera FacturX.
          </p>
          <p className="text-sm text-gray-600">
            El <strong className="text-gray-800">hash SHA-256</strong> es una huella digital matemática del
            contenido de la factura. Si cualquier dato cambia (aunque sea un decimal), el hash cambia por completo.
            Puedes calcular el hash tú mismo usando los datos canónicos de abajo.
          </p>
          <p className="text-sm text-gray-600">
            Cada evento de la historia verificable tiene su propio registro en blockchain, con su propio hash de
            transacción y número de ledger, que actúa como <strong className="text-gray-800">sello de tiempo
            irrefutable</strong> reconocido internacionalmente.
          </p>
          <p className="text-sm text-gray-600">
            Puede ser presentado como <strong className="text-gray-800">prueba en reclamaciones, disputas
            comerciales o auditorías fiscales</strong>.
          </p>
        </div>
      )}
    </div>
  )
}

export function CanonicalColapsable({ canonical }: { canonical: string }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-950">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-900 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          Datos canónicos para verificación independiente
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {abierto && (
        <div className="border-t border-gray-700 px-5 py-4">
          <p className="mb-3 text-xs text-gray-400">
            Este es el objeto exacto que se convierte en hash SHA-256. Puedes calcularlo tú mismo
            con cualquier herramienta online (ej. <code className="text-emerald-400">echo -n &apos;...&apos; | sha256sum</code>).
          </p>
          <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-emerald-300 leading-relaxed">
            {canonical}
          </pre>
        </div>
      )}
    </div>
  )
}
