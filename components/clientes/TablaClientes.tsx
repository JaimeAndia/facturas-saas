'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Toast, type TipoToast } from '@/components/ui/Toast'
import { FormCliente } from '@/components/clientes/FormCliente'
import { eliminarCliente } from '@/app/(dashboard)/clientes/actions'
import { formatDate } from '@/lib/utils'
import type { Cliente } from '@/types'

interface TablaClientesProps {
  clientes: Cliente[]
  avisoInicial?: string | null
}

// Estado del modal: cerrado | crear | editar
type EstadoModal =
  | { abierto: false }
  | { abierto: true; modo: 'crear' }
  | { abierto: true; modo: 'editar'; cliente: Cliente }

interface EstadoToast {
  mensaje: string
  tipo: TipoToast
}

export function TablaClientes({ clientes: clientesIniciales, avisoInicial }: TablaClientesProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Sincronizar con los datos del servidor cuando se refresca la página
  const [clientes, setClientes] = useState(clientesIniciales)
  useEffect(() => { setClientes(clientesIniciales) }, [clientesIniciales])

  // Mostrar aviso inicial si viene de una redirección (ej: sin clientes al crear factura)
  useEffect(() => {
    if (avisoInicial) setToast({ mensaje: avisoInicial, tipo: 'info' })
  // Solo al montar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<EstadoModal>({ abierto: false })
  const [toast, setToast] = useState<EstadoToast | null>(null)
  // ID del cliente pendiente de confirmar eliminación
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)

  // Filtrado local por nombre o NIF
  const clientesFiltrados = clientes.filter((c) => {
    const q = busqueda.toLowerCase().trim()
    if (!q) return true
    return (
      c.nombre.toLowerCase().includes(q) ||
      (c.nif ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    )
  })

  const mostrarToast = useCallback((mensaje: string, tipo: TipoToast) => {
    setToast({ mensaje, tipo })
  }, [])

  function cerrarModal() {
    setModal({ abierto: false })
  }

  function handleExito(mensaje: string) {
    cerrarModal()
    mostrarToast(mensaje, 'exito')
    startTransition(() => { router.refresh() })
  }

  function handleEliminar(id: string) {
    startTransition(async () => {
      const resultado = await eliminarCliente(id)
      setConfirmandoId(null)
      if (resultado.ok) {
        mostrarToast('Cliente eliminado correctamente', 'exito')
        router.refresh()
      } else {
        mostrarToast(resultado.error, 'error')
      }
    })
  }

  return (
    <>
      {/* Header: buscador + botón nuevo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Buscador */}
        <div className="relative w-full sm:max-w-xs">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Buscar por nombre, NIF o email..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <Button
          onClick={() => setModal({ abierto: true, modo: 'crear' })}
          className="shrink-0"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo cliente
        </Button>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {clientes.length === 0 ? (
          /* Estado vacío */
          <div className="py-16 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="mt-3 text-sm font-medium text-gray-900">Sin clientes</p>
            <p className="mt-1 text-sm text-gray-500">Empieza añadiendo tu primer cliente.</p>
            <div className="mt-5">
              <Button onClick={() => setModal({ abierto: true, modo: 'crear' })}>
                Añadir cliente
              </Button>
            </div>
          </div>
        ) : clientesFiltrados.length === 0 ? (
          /* Sin resultados de búsqueda */
          <div className="py-10 text-center text-sm text-gray-500">
            No se encontraron clientes con &ldquo;{busqueda}&rdquo;
          </div>
        ) : (
          <>
            {/* Cabecera tabla — solo desktop */}
            <div className="hidden border-b border-gray-200 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 md:grid md:grid-cols-[2fr_1fr_1.5fr_1fr_auto] md:gap-4">
              <span>Nombre</span>
              <span>NIF</span>
              <span>Email</span>
              <span>Alta</span>
              <span>Acciones</span>
            </div>

            <ul className="divide-y divide-gray-100">
              {clientesFiltrados.map((cliente) => (
                <li key={cliente.id} className="px-5 py-3.5">
                  {/* Layout desktop */}
                  <div className="hidden md:grid md:grid-cols-[2fr_1fr_1.5fr_1fr_auto] md:items-center md:gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{cliente.nombre}</p>
                      {cliente.ciudad && (
                        <p className="text-xs text-gray-400">{cliente.ciudad}</p>
                      )}
                    </div>
                    <span className="text-sm text-gray-600">{cliente.nif ?? '—'}</span>
                    <span className="truncate text-sm text-gray-600">{cliente.email ?? '—'}</span>
                    <span className="text-sm text-gray-400">{formatDate(cliente.created_at)}</span>

                    {/* Acciones desktop */}
                    <AccionesCliente
                      cliente={cliente}
                      confirmando={confirmandoId === cliente.id}
                      cargando={isPending && confirmandoId === cliente.id}
                      onEditar={() => setModal({ abierto: true, modo: 'editar', cliente })}
                      onIniciarEliminar={() => setConfirmandoId(cliente.id)}
                      onConfirmarEliminar={() => handleEliminar(cliente.id)}
                      onCancelarEliminar={() => setConfirmandoId(null)}
                    />
                  </div>

                  {/* Layout móvil: card */}
                  <div className="flex items-start justify-between md:hidden">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{cliente.nombre}</p>
                      <div className="mt-1 space-y-0.5">
                        {cliente.nif && <p className="text-xs text-gray-500">NIF: {cliente.nif}</p>}
                        {cliente.email && <p className="text-xs text-gray-500">{cliente.email}</p>}
                        {cliente.ciudad && <p className="text-xs text-gray-400">{cliente.ciudad}</p>}
                      </div>
                    </div>
                    <AccionesCliente
                      cliente={cliente}
                      confirmando={confirmandoId === cliente.id}
                      cargando={isPending && confirmandoId === cliente.id}
                      onEditar={() => setModal({ abierto: true, modo: 'editar', cliente })}
                      onIniciarEliminar={() => setConfirmandoId(cliente.id)}
                      onConfirmarEliminar={() => handleEliminar(cliente.id)}
                      onCancelarEliminar={() => setConfirmandoId(null)}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {/* Footer con conteo */}
            <div className="border-t border-gray-100 px-5 py-3">
              <p className="text-xs text-gray-400">
                {clientesFiltrados.length === clientes.length
                  ? `${clientes.length} cliente${clientes.length !== 1 ? 's' : ''}`
                  : `${clientesFiltrados.length} de ${clientes.length} clientes`}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Modal crear / editar */}
      <Modal
        abierto={modal.abierto}
        onCerrar={cerrarModal}
        titulo={modal.abierto && modal.modo === 'editar' ? 'Editar cliente' : 'Nuevo cliente'}
        className="max-w-lg"
      >
        {modal.abierto && (
          <FormCliente
            cliente={modal.modo === 'editar' ? modal.cliente : undefined}
            onExito={handleExito}
            onCancelar={cerrarModal}
          />
        )}
      </Modal>

      {/* Toast de notificación */}
      {toast && (
        <Toast
          mensaje={toast.mensaje}
          tipo={toast.tipo}
          onCerrar={() => setToast(null)}
        />
      )}
    </>
  )
}

// Subcomponente de acciones por fila (editar + eliminar con confirmación inline)
interface AccionesClienteProps {
  cliente: Cliente
  confirmando: boolean
  cargando: boolean
  onEditar: () => void
  onIniciarEliminar: () => void
  onConfirmarEliminar: () => void
  onCancelarEliminar: () => void
}

function AccionesCliente({
  confirmando,
  cargando,
  onEditar,
  onIniciarEliminar,
  onConfirmarEliminar,
  onCancelarEliminar,
}: AccionesClienteProps) {
  if (confirmando) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <span className="hidden text-xs text-gray-500 sm:block">¿Eliminar?</span>
        <Button
          variante="peligro"
          tamaño="sm"
          cargando={cargando}
          onClick={onConfirmarEliminar}
        >
          Sí
        </Button>
        <Button
          variante="secundario"
          tamaño="sm"
          disabled={cargando}
          onClick={onCancelarEliminar}
        >
          No
        </Button>
      </div>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      {/* Editar */}
      <button
        onClick={onEditar}
        title="Editar cliente"
        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      {/* Eliminar */}
      <button
        onClick={onIniciarEliminar}
        title="Eliminar cliente"
        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}
