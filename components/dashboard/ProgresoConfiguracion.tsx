import Link from 'next/link'

interface Props {
  perfil: {
    nombre: string | null
    apellidos: string | null
    nif: string | null
    telefono: string | null
    direccion: string | null
    ciudad: string | null
    codigo_postal: string | null
    provincia: string | null
  }
}

const CAMPOS: Array<{ key: keyof Props['perfil']; etiqueta: string }> = [
  { key: 'nombre', etiqueta: 'Nombre' },
  { key: 'apellidos', etiqueta: 'Apellidos' },
  { key: 'nif', etiqueta: 'NIF/CIF' },
  { key: 'telefono', etiqueta: 'Teléfono' },
  { key: 'direccion', etiqueta: 'Dirección' },
  { key: 'ciudad', etiqueta: 'Ciudad' },
  { key: 'codigo_postal', etiqueta: 'Código postal' },
  { key: 'provincia', etiqueta: 'Provincia' },
]

export function ProgresoConfiguracion({ perfil }: Props) {
  const rellenos = CAMPOS.filter((c) => !!perfil[c.key])
  const porcentaje = Math.round((rellenos.length / CAMPOS.length) * 100)
  const faltantes = CAMPOS.filter((c) => !perfil[c.key])

  // Ocultar cuando el perfil está completo
  if (porcentaje === 100) return null

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">
          Completa tu perfil
          <span className="ml-2 text-xs font-normal text-gray-400">
            {rellenos.length}/{CAMPOS.length} campos
          </span>
        </p>
        <Link
          href="/configuracion/editar"
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          Completar →
        </Link>
      </div>

      {/* Barra de progreso */}
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-500"
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      {/* Campos que faltan */}
      {faltantes.length > 0 && (
        <p className="mt-2 text-xs text-gray-400">
          Falta: {faltantes.map((c) => c.etiqueta).join(', ')}
        </p>
      )}
    </div>
  )
}
