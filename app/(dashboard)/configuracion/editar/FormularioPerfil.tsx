'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { actualizarPerfil, type DatosPerfil } from './actions'
import { Button } from '@/components/ui/Button'
import type { Profile } from '@/types'

interface FormularioPerfilProps {
  perfil: Profile
}

export function FormularioPerfil({ perfil }: FormularioPerfilProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    const datos: DatosPerfil = {
      nombre: fd.get('nombre') as string,
      apellidos: fd.get('apellidos') as string,
      nif: fd.get('nif') as string,
      telefono: (fd.get('telefono') as string) || null,
      direccion: (fd.get('direccion') as string) || null,
      ciudad: (fd.get('ciudad') as string) || null,
      codigo_postal: (fd.get('codigo_postal') as string) || null,
      provincia: (fd.get('provincia') as string) || null,
      iban: (fd.get('iban') as string) || null,
    }

    setError(null)
    startTransition(async () => {
      const resultado = await actualizarPerfil(datos)
      if (!resultado.ok) setError(resultado.error)
    })
  }

  const campos = [
    { name: 'nombre', label: 'Nombre', requerido: true, defaultValue: perfil.nombre ?? '' },
    { name: 'apellidos', label: 'Apellidos', requerido: true, defaultValue: perfil.apellidos ?? '' },
    { name: 'nif', label: 'NIF / DNI', requerido: true, defaultValue: perfil.nif ?? '' },
    { name: 'telefono', label: 'Teléfono', requerido: false, defaultValue: perfil.telefono ?? '' },
    { name: 'direccion', label: 'Dirección', requerido: false, defaultValue: perfil.direccion ?? '' },
    { name: 'ciudad', label: 'Ciudad', requerido: false, defaultValue: perfil.ciudad ?? '' },
    { name: 'codigo_postal', label: 'Código postal', requerido: false, defaultValue: perfil.codigo_postal ?? '' },
    { name: 'provincia', label: 'Provincia', requerido: false, defaultValue: perfil.provincia ?? '' },
    { name: 'iban', label: 'IBAN (para cobro por transferencia)', requerido: false, defaultValue: (perfil as unknown as { iban: string | null }).iban ?? '' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {campos.map(({ name, label, requerido, defaultValue }) => (
          <div key={name} className="flex flex-col gap-1">
            <label htmlFor={name} className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {label}{requerido && <span className="ml-0.5 text-red-500">*</span>}
            </label>
            <input
              id={name}
              name={name}
              type="text"
              required={requerido}
              defaultValue={defaultValue}
              className="h-9 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-gray-200 px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      <div className="flex items-center gap-3 border-t dark:border-gray-700 pt-4">
        <Button type="submit" cargando={isPending}>
          Guardar cambios
        </Button>
        <button
          type="button"
          onClick={() => router.push('/configuracion')}
          disabled={isPending}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
