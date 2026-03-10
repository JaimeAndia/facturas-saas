'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { crearCliente, actualizarCliente } from '@/app/(dashboard)/clientes/actions'
import type { Cliente } from '@/types'

interface FormClienteProps {
  cliente?: Cliente
  onExito: (mensaje: string) => void
  onCancelar: () => void
}

// Campos con posible error de validación
interface ErroresForm {
  nombre?: string
  email?: string
  telefono?: string
  codigo_postal?: string
}

type CampoForm = {
  nombre: string
  nif: string
  email: string
  telefono: string
  direccion: string
  ciudad: string
  codigo_postal: string
  provincia: string
  notas: string
}

function validarForm(datos: CampoForm): ErroresForm {
  const errores: ErroresForm = {}

  if (!datos.nombre.trim()) {
    errores.nombre = 'El nombre es obligatorio'
  } else if (datos.nombre.trim().length < 2) {
    errores.nombre = 'El nombre debe tener al menos 2 caracteres'
  }

  if (datos.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) {
    errores.email = 'El email no tiene un formato válido'
  }

  if (datos.telefono && !/^\+?[\d\s\-()/]{7,20}$/.test(datos.telefono)) {
    errores.telefono = 'El teléfono no tiene un formato válido'
  }

  if (datos.codigo_postal && !/^\d{5}$/.test(datos.codigo_postal)) {
    errores.codigo_postal = 'El código postal debe tener 5 dígitos'
  }

  return errores
}

// Convierte string vacío a null para la base de datos
function vacioANull(v: string): string | null {
  return v.trim() || null
}

export function FormCliente({ cliente, onExito, onCancelar }: FormClienteProps) {
  const [isPending, startTransition] = useTransition()
  const [errores, setErrores] = useState<ErroresForm>({})
  const [errorServidor, setErrorServidor] = useState<string | null>(null)

  const [form, setForm] = useState<CampoForm>({
    nombre: cliente?.nombre ?? '',
    nif: cliente?.nif ?? '',
    email: cliente?.email ?? '',
    telefono: cliente?.telefono ?? '',
    direccion: cliente?.direccion ?? '',
    ciudad: cliente?.ciudad ?? '',
    codigo_postal: cliente?.codigo_postal ?? '',
    provincia: cliente?.provincia ?? '',
    notas: cliente?.notas ?? '',
  })

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    // Limpiar el error del campo al empezar a corregirlo
    if (errores[name as keyof ErroresForm]) {
      setErrores((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorServidor(null)

    const nuevosErrores = validarForm(form)
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores)
      return
    }

    const datos = {
      nombre: form.nombre.trim(),
      nif: vacioANull(form.nif),
      email: vacioANull(form.email),
      telefono: vacioANull(form.telefono),
      direccion: vacioANull(form.direccion),
      ciudad: vacioANull(form.ciudad),
      codigo_postal: vacioANull(form.codigo_postal),
      provincia: vacioANull(form.provincia),
      notas: vacioANull(form.notas),
    }

    startTransition(async () => {
      const resultado = cliente
        ? await actualizarCliente(cliente.id, datos)
        : await crearCliente(datos)

      if (resultado.ok) {
        onExito(cliente ? 'Cliente actualizado correctamente' : 'Cliente creado correctamente')
      } else {
        setErrorServidor(resultado.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Error del servidor */}
      {errorServidor && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorServidor}
        </div>
      )}

      {/* Nombre */}
      <Input
        label="Nombre o razón social"
        name="nombre"
        value={form.nombre}
        onChange={handleChange}
        error={errores.nombre}
        placeholder="Empresa S.L. o Nombre Apellidos"
        required
        autoFocus
      />

      {/* NIF / CIF */}
      <Input
        label="NIF / CIF"
        name="nif"
        value={form.nif}
        onChange={handleChange}
        placeholder="B12345678 o 12345678Z"
        ayuda="Opcional"
      />

      {/* Email y Teléfono en fila */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          error={errores.email}
          placeholder="cliente@empresa.com"
        />
        <Input
          label="Teléfono"
          name="telefono"
          type="tel"
          value={form.telefono}
          onChange={handleChange}
          error={errores.telefono}
          placeholder="612 345 678"
        />
      </div>

      {/* Dirección */}
      <Input
        label="Dirección"
        name="direccion"
        value={form.direccion}
        onChange={handleChange}
        placeholder="Calle Mayor, 1, 2ºA"
      />

      {/* Ciudad, CP y Provincia en fila */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Input
          label="Ciudad"
          name="ciudad"
          value={form.ciudad}
          onChange={handleChange}
          placeholder="Madrid"
          className="col-span-2 sm:col-span-1"
        />
        <Input
          label="Código postal"
          name="codigo_postal"
          value={form.codigo_postal}
          onChange={handleChange}
          error={errores.codigo_postal}
          placeholder="28001"
          maxLength={5}
        />
        <Input
          label="Provincia"
          name="provincia"
          value={form.provincia}
          onChange={handleChange}
          placeholder="Madrid"
        />
      </div>

      {/* Notas */}
      <Textarea
        label="Notas"
        name="notas"
        value={form.notas}
        onChange={handleChange}
        placeholder="Condiciones de pago, persona de contacto..."
        ayuda="Opcional. Solo visible para ti."
      />

      {/* Acciones */}
      <div className="flex gap-3 border-t pt-4">
        <Button
          type="button"
          variante="secundario"
          onClick={onCancelar}
          disabled={isPending}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button type="submit" cargando={isPending} className="flex-1">
          {cliente ? 'Guardar cambios' : 'Crear cliente'}
        </Button>
      </div>
    </form>
  )
}
