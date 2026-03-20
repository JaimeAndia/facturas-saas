import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Envuelve el valor en comillas si contiene el separador, comillas o saltos de línea
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// Formato numérico europeo: separador decimal = coma
function num(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return value.toFixed(2).replace('.', ',')
}

// Formato porcentaje sin decimales si es entero
function pct(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',')
}

const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: 'Borrador',
  emitida: 'Emitida',
  pagada: 'Pagada',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const estado = searchParams.get('estado')
  const clienteId = searchParams.get('cliente_id')
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('facturas')
    .select(`
      numero,
      fecha_emision,
      fecha_vencimiento,
      base_imponible,
      iva_porcentaje,
      iva_importe,
      irpf_porcentaje,
      irpf_importe,
      total,
      estado,
      paid_at,
      clientes ( nombre, nif )
    `)
    .eq('user_id', user.id)
    .or('source.is.null,and(source.neq.pos,source.neq.recurrente_base),and(source.eq.pos,estado.eq.pagada)')
    .order('fecha_emision', { ascending: false })

  if (estado && estado !== 'todas') query = query.eq('estado', estado)
  if (clienteId) query = query.eq('cliente_id', clienteId)
  if (desde) query = query.gte('fecha_emision', desde)
  if (hasta) query = query.lte('fecha_emision', hasta)

  const { data, error } = await query

  if (error) {
    console.error('[CSV export]', error)
    return NextResponse.json({ error: 'Error al obtener facturas' }, { status: 500 })
  }

  // Cabecera
  const HEADERS = [
    'Número',
    'Cliente',
    'NIF Cliente',
    'Fecha Emisión',
    'Fecha Vencimiento',
    'Base Imponible',
    'IVA %',
    'IVA Importe',
    'IRPF %',
    'IRPF Importe',
    'Total',
    'Estado',
    'Fecha Pago',
  ]

  const rows: string[] = [HEADERS.join(';')]

  for (const f of (data ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cliente = (f.clientes as any) ?? {}
    rows.push([
      cell(f.numero),
      cell(cliente.nombre),
      cell(cliente.nif),
      cell(f.fecha_emision),
      cell(f.fecha_vencimiento),
      num(f.base_imponible),
      pct(f.iva_porcentaje),
      num(f.iva_importe),
      pct(f.irpf_porcentaje),
      num(f.irpf_importe),
      num(f.total),
      cell(ETIQUETA_ESTADO[f.estado] ?? f.estado),
      cell(f.paid_at ? f.paid_at.slice(0, 10) : ''),
    ].join(';'))
  }

  // BOM UTF-8 para que Excel en Windows abra correctamente con tildes/ñ
  const bom = '\uFEFF'
  const csv = bom + rows.join('\r\n')

  const ahora = new Date()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const filename = `facturas-${ahora.getFullYear()}-${mes}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
