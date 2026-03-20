import Link from 'next/link'

interface Props {
  perfil: {
    nombre: string | null
    apellidos: string | null
    nif: string | null
    direccion: string | null
    logo_url: string | null
    iban: string | null
  }
}

interface Paso {
  id: string
  etiqueta: string
  descripcion: string
  completado: boolean
  href: string
}

function calcularPasos(perfil: Props['perfil']): Paso[] {
  return [
    {
      id: 'nombre',
      etiqueta: 'Nombre y apellidos',
      descripcion: 'Aparece como emisor en tus facturas',
      completado: !!(perfil.nombre?.trim() && perfil.apellidos?.trim()),
      href: '/configuracion/editar',
    },
    {
      id: 'nif',
      etiqueta: 'NIF / CIF',
      descripcion: 'Obligatorio para emitir facturas legales',
      completado: !!perfil.nif?.trim(),
      href: '/configuracion/editar',
    },
    {
      id: 'direccion',
      etiqueta: 'Dirección fiscal',
      descripcion: 'Requerida en todas tus facturas',
      completado: !!perfil.direccion?.trim(),
      href: '/configuracion/editar',
    },
    {
      id: 'logo',
      etiqueta: 'Logo',
      descripcion: 'Da imagen profesional a tus facturas',
      completado: !!perfil.logo_url,
      href: '/configuracion/editar',
    },
    {
      id: 'iban',
      etiqueta: 'IBAN',
      descripcion: 'Para recibir pagos por transferencia',
      completado: !!perfil.iban?.trim(),
      href: '/configuracion/editar',
    },
  ]
}

export function ProgresoConfiguracion({ perfil }: Props) {
  const pasos = calcularPasos(perfil)
  const completados = pasos.filter((p) => p.completado).length
  const total = pasos.length
  const porcentaje = Math.round((completados / total) * 100)
  const pendientes = pasos.filter((p) => !p.completado)

  if (porcentaje === 100) return null

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-4 dark:border-blue-800 dark:bg-blue-900/20">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Configura tu perfil
          <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
            {completados}/{total} completados
          </span>
        </p>
        <span className="text-xs font-semibold text-blue-600">{porcentaje}%</span>
      </div>

      {/* Barra de progreso */}
      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/40">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-500"
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      {/* Pasos pendientes */}
      <ul className="mt-3 space-y-1.5">
        {pendientes.map((paso) => (
          <li key={paso.id}>
            <Link
              href={paso.href}
              className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-blue-100/60 transition-colors dark:hover:bg-blue-900/30"
            >
              {/* Icono círculo vacío */}
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-blue-300 bg-white group-hover:border-blue-500 dark:bg-gray-800 dark:border-blue-700" />
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-medium text-gray-700 group-hover:text-blue-700 dark:text-gray-300 dark:group-hover:text-blue-400">
                  {paso.etiqueta}
                </span>
                <span className="block text-xs text-gray-400 dark:text-gray-500">{paso.descripcion}</span>
              </span>
              <svg
                className="h-3.5 w-3.5 shrink-0 text-blue-400 group-hover:text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
