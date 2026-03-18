'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CopiarTxClient } from './CopiarTxClient'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type EventType = 'emision' | 'pago' | 'cancelacion' | 'vencimiento' | 'generacion_recurrente'

export interface BlockchainEvento {
  id: string
  created_at: string
  event_type: EventType
  tx_hash: string | null
  tx_status: 'pending' | 'confirmed' | 'failed' | null
  ledger: number | null
  factura_numero: string | null
  factura_total: number | null
  cliente_nombre: string | null
  factura_id: string | null
}

export interface FacturaEventosCardProps {
  facturaId: string | null
  facturaNumero: string | null
  facturaTotal: number | null
  clienteNombre: string | null
  eventos: BlockchainEvento[]
  defaultOpen?: boolean
  isTestnet?: boolean
}

// ─── Configuración visual ─────────────────────────────────────────────────────

const TIPO_CONFIG: Record<EventType, {
  label: string
  bgIcon: string
  textIcon: string
  bgBadge: string
  textBadge: string
  line: string
  border: string
}> = {
  emision: {
    label: 'Emisión',
    bgIcon: 'bg-blue-500', textIcon: 'text-white',
    bgBadge: 'bg-blue-50', textBadge: 'text-blue-700',
    line: 'bg-blue-200',
    border: 'border-l-blue-400',
  },
  pago: {
    label: 'Pago',
    bgIcon: 'bg-emerald-500', textIcon: 'text-white',
    bgBadge: 'bg-emerald-50', textBadge: 'text-emerald-700',
    line: 'bg-emerald-200',
    border: 'border-l-emerald-400',
  },
  cancelacion: {
    label: 'Cancelación',
    bgIcon: 'bg-gray-400', textIcon: 'text-white',
    bgBadge: 'bg-gray-100', textBadge: 'text-gray-600',
    line: 'bg-gray-200',
    border: 'border-l-gray-300',
  },
  vencimiento: {
    label: 'Vencimiento',
    bgIcon: 'bg-red-500', textIcon: 'text-white',
    bgBadge: 'bg-red-50', textBadge: 'text-red-700',
    line: 'bg-red-200',
    border: 'border-l-red-400',
  },
  generacion_recurrente: {
    label: 'Recurrente',
    bgIcon: 'bg-violet-500', textIcon: 'text-white',
    bgBadge: 'bg-violet-50', textBadge: 'text-violet-700',
    line: 'bg-violet-200',
    border: 'border-l-violet-400',
  },
}

// ─── Icono por tipo ───────────────────────────────────────────────────────────

function IconoEvento({ tipo, className }: { tipo: EventType; className?: string }) {
  const cls = className ?? 'h-4 w-4'
  switch (tipo) {
    case 'emision':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    case 'pago':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'cancelacion':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'vencimiento':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'generacion_recurrente':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatImporte(total: number | null): string {
  if (total === null) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(total)
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function FacturaEventosCard({
  facturaId,
  facturaNumero,
  facturaTotal,
  clienteNombre,
  eventos,
  defaultOpen = false,
  isTestnet = true,
}: FacturaEventosCardProps) {
  const [abierto, setAbierto] = useState(defaultOpen)

  const explorerBase = isTestnet
    ? 'https://testnet.xrpl.org/transactions'
    : 'https://livenet.xrpl.org/transactions'

  // Último evento para mostrar el badge de estado en el header
  const ultimoEvento = eventos[eventos.length - 1]

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">

      {/* ── Cabecera desplegable ── */}
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        {/* Icono del último evento */}
        {ultimoEvento && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm ${TIPO_CONFIG[ultimoEvento.event_type].bgIcon}`}>
            <IconoEvento tipo={ultimoEvento.event_type} className={`h-4 w-4 ${TIPO_CONFIG[ultimoEvento.event_type].textIcon}`} />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Número de factura */}
            {facturaNumero && (
              facturaId ? (
                <Link
                  href={`/facturas/${facturaId}`}
                  onClick={e => e.stopPropagation()}
                  className="text-sm font-semibold text-blue-600 hover:underline"
                >
                  {facturaNumero}
                </Link>
              ) : (
                <span className="text-sm font-semibold text-gray-700">{facturaNumero}</span>
              )
            )}
            {/* Cliente */}
            {clienteNombre && (
              <span className="text-sm text-gray-500">{clienteNombre}</span>
            )}
            {/* Badge del último evento */}
            {ultimoEvento && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_CONFIG[ultimoEvento.event_type].bgBadge} ${TIPO_CONFIG[ultimoEvento.event_type].textBadge}`}>
                {TIPO_CONFIG[ultimoEvento.event_type].label}
              </span>
            )}
          </div>

          <div className="mt-0.5 flex items-center gap-2">
            {/* Importe */}
            <span className="text-sm font-semibold text-gray-900">
              {formatImporte(facturaTotal)}
            </span>
            {/* Contador de eventos */}
            <span className="text-xs text-gray-400">
              · {eventos.length} evento{eventos.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Chevron */}
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Timeline de eventos (desplegable) ── */}
      {abierto && (
        <div className="border-t border-gray-100 px-5 py-4">
          <ol className="relative">
            {eventos.map((evento, idx) => {
              const config = TIPO_CONFIG[evento.event_type]
              const esUltimo = idx === eventos.length - 1
              return (
                <li key={evento.id} className="relative pb-5 pl-9 last:pb-0">

                  {/* Línea vertical coloreada según el tipo del evento actual */}
                  {!esUltimo && (
                    <span className={`absolute left-3.5 top-7 -ml-px h-full w-0.5 ${config.line}`} />
                  )}

                  {/* Círculo sólido del tipo */}
                  <span className={`absolute left-0 flex h-7 w-7 items-center justify-center rounded-full shadow-sm ${config.bgIcon}`}>
                    <IconoEvento tipo={evento.event_type} className={`h-3.5 w-3.5 ${config.textIcon}`} />
                  </span>

                  {/* Contenido con borde izquierdo del color del tipo */}
                  <div className={`rounded-r-lg border-l-2 bg-gray-50 px-3 py-2 ${config.border}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Badge tipo */}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${config.bgBadge} ${config.textBadge}`}>
                        {config.label}
                      </span>
                      {/* Fecha */}
                      <span className="text-xs text-gray-400">{formatFechaHora(evento.created_at)}</span>
                    </div>

                    {/* TX hash + ledger */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {evento.ledger && (
                        <span className="text-xs text-gray-400">Ledger #{evento.ledger.toLocaleString('es-ES')}</span>
                      )}
                      {evento.tx_hash ? (
                        <div className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1 ring-1 ring-gray-200">
                          <span className="font-mono text-xs text-gray-600">
                            {evento.tx_hash.slice(0, 6)}...{evento.tx_hash.slice(-6)}
                          </span>
                          <CopiarTxClient txHash={evento.tx_hash} />
                          <a
                            href={`${explorerBase}/${evento.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Ver en XRPL Explorer"
                            className="text-gray-400 transition-colors hover:text-blue-600"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      ) : (
                        <span className={`rounded-md px-2 py-1 text-xs font-medium ${
                          evento.tx_status === 'failed'
                            ? 'bg-red-50 text-red-500'
                            : 'bg-amber-50 text-amber-600'
                        }`}>
                          {evento.tx_status === 'failed' ? 'Error en blockchain' : 'Registrando…'}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )
}
