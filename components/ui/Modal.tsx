'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  abierto: boolean
  onCerrar: () => void
  titulo?: string
  children: React.ReactNode
  className?: string
}

export function Modal({ abierto, onCerrar, titulo, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (abierto) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [abierto])

  // Cerrar al hacer clic en el backdrop
  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    const rect = dialogRef.current?.getBoundingClientRect()
    if (!rect) return
    const clickFueraDeContenido =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    if (clickFueraDeContenido) onCerrar()
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onCancel={onCerrar}
      className={cn(
        'w-full max-w-md rounded-xl bg-white p-0 shadow-xl',
        'backdrop:bg-black/50 backdrop:backdrop-blur-sm',
        'open:animate-in open:fade-in open:zoom-in-95',
        className
      )}
    >
      <div className="flex flex-col">
        {titulo && (
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">{titulo}</h2>
            <button
              onClick={onCerrar}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
      </div>
    </dialog>
  )
}
