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
  nif?: string
  email?: string
  telefono?: string
  codigo_postal?: string
}

// Valida NIF (DNI/NIE) y CIF españoles, verificando el dígito de control
function validarNifCif(valor: string): boolean {
  const v = valor.trim().toUpperCase()

  // CIF: letra + 7 dígitos + dígito/letra de control
  // Letras de tipo de sociedad válidas
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(v)) {
    const letras = 'JABCDEFGHI'
    const cuerpo = v.slice(1, 8)
    let suma = 0
    for (let i = 0; i < cuerpo.length; i++) {
      let n = parseInt(cuerpo[i])
      if (i % 2 === 0) {
        n *= 2
        if (n > 9) n -= 9
      }
      suma += n
    }
    const control = (10 - (suma % 10)) % 10
    const ultimo = v.slice(-1)
    // Letras P, Q, R, S, W: el control es siempre letra
    // Letras A, B, E, H: el control es siempre número
    // El resto: puede ser letra o número
    return ultimo === String(control) || ultimo === letras[control]
  }

  // NIE: X/Y/Z + 7 dígitos + letra
  if (/^[XYZ]\d{7}[TRWAGMYFPDXBNJZSQVHLCKE]$/.test(v)) {
    const tabla = 'TRWAGMYFPDXBNJZSQVHLCKE'
    const sustitucion = { X: '0', Y: '1', Z: '2' } as Record<string, string>
    const num = parseInt(sustitucion[v[0]] + v.slice(1, 8))
    return v.slice(-1) === tabla[num % 23]
  }

  // DNI: 8 dígitos + letra
  if (/^\d{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/.test(v)) {
    const tabla = 'TRWAGMYFPDXBNJZSQVHLCKE'
    return v.slice(-1) === tabla[parseInt(v.slice(0, 8)) % 23]
  }

  return false
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
  pais: string
  notas: string
}

function validarForm(datos: CampoForm): ErroresForm {
  const errores: ErroresForm = {}

  if (!datos.nombre.trim()) {
    errores.nombre = 'El nombre es obligatorio'
  } else if (datos.nombre.trim().length < 2) {
    errores.nombre = 'El nombre debe tener al menos 2 caracteres'
  }

  if (datos.nif && !validarNifCif(datos.nif)) {
    errores.nif = 'NIF/CIF no válido (ej: 12345678Z, X1234567Z, B12345678)'
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
    pais: cliente?.pais ?? 'España',
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
      pais: form.pais.trim() || 'España',
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
        error={errores.nif}
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

      {/* País */}
      <Input
        label="País"
        name="pais"
        value={form.pais}
        onChange={handleChange}
        placeholder="España"
      />

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
