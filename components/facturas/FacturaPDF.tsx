import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Factura, LineaFactura, Cliente, Profile } from '@/types'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PerfilPDF = Pick<
  Profile,
  | 'nombre' | 'apellidos' | 'nif' | 'email'
  | 'telefono' | 'direccion' | 'ciudad' | 'codigo_postal' | 'provincia'
  | 'logo_url'
>

export interface FacturaPDFProps {
  factura: Factura & { lineas: LineaFactura[]; cliente: Cliente }
  perfil: PerfilPDF | null
}

// ─── Paleta ───────────────────────────────────────────────────────────────────

const AZUL       = '#1e40af'
const AZUL_CLARO = '#dbeafe'
const GRIS_900   = '#111827'
const GRIS_600   = '#4b5563'
const GRIS_400   = '#9ca3af'
const GRIS_100   = '#f3f4f6'
const ROJO       = '#dc2626'
const BLANCO     = '#ffffff'

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: GRIS_900,
    backgroundColor: BLANCO,
  },

  // Franja superior de acento
  acento: {
    height: 6,
    backgroundColor: AZUL,
  },

  contenido: {
    paddingHorizontal: 48,
    paddingTop: 32,
    paddingBottom: 64, // espacio para el footer absoluto
    flexGrow: 1,
  },

  // ── Cabecera ──────────────────────────────────────────────────────────────

  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  logoBox: {
    marginBottom: 8,
  },
  logo: {
    width: 80,
    height: 40,
    objectFit: 'contain',
  },
  emisorNombre: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: GRIS_900,
    marginBottom: 3,
  },
  emisorLinea: {
    fontSize: 9,
    color: GRIS_600,
    marginBottom: 2,
  },

  // Bloque derecho: título + número
  tituloBloq: {
    alignItems: 'flex-end',
  },
  titulo: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: AZUL,
    letterSpacing: 2,
  },
  numero: {
    fontSize: 13,
    color: GRIS_600,
    marginTop: 4,
  },

  // ── Fechas ────────────────────────────────────────────────────────────────

  fechasBox: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  fechaCelda: {
    backgroundColor: GRIS_100,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  fechaLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: GRIS_400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fechaValor: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: GRIS_900,
  },

  // ── Separador ─────────────────────────────────────────────────────────────

  separador: {
    borderBottom: `1px solid ${GRIS_100}`,
    marginBottom: 20,
  },

  // ── Cliente ───────────────────────────────────────────────────────────────

  clienteBox: {
    marginBottom: 28,
  },
  seccionLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: GRIS_400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  clienteNombre: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: GRIS_900,
    marginBottom: 3,
  },
  clienteLinea: {
    fontSize: 9,
    color: GRIS_600,
    marginBottom: 2,
  },

  // ── Tabla de líneas ───────────────────────────────────────────────────────

  tablaHeader: {
    flexDirection: 'row',
    backgroundColor: AZUL,
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 2,
  },
  thDesc:   { flex: 1,   fontSize: 8, fontFamily: 'Helvetica-Bold', color: BLANCO, textTransform: 'uppercase' },
  thCant:   { width: 44, fontSize: 8, fontFamily: 'Helvetica-Bold', color: BLANCO, textTransform: 'uppercase', textAlign: 'right' },
  thPrecio: { width: 76, fontSize: 8, fontFamily: 'Helvetica-Bold', color: BLANCO, textTransform: 'uppercase', textAlign: 'right' },
  thTotal:  { width: 76, fontSize: 8, fontFamily: 'Helvetica-Bold', color: BLANCO, textTransform: 'uppercase', textAlign: 'right' },

  fila: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 3,
  },
  filaImpar: {
    backgroundColor: GRIS_100,
  },
  tdDesc:   { flex: 1,   fontSize: 10, color: GRIS_900 },
  tdCant:   { width: 44, fontSize: 10, color: GRIS_600, textAlign: 'right' },
  tdPrecio: { width: 76, fontSize: 10, color: GRIS_600, textAlign: 'right' },
  tdTotal:  { width: 76, fontSize: 10, fontFamily: 'Helvetica-Bold', color: GRIS_900, textAlign: 'right' },

  // ── Totales ───────────────────────────────────────────────────────────────

  totalesBox: {
    alignItems: 'flex-end',
    marginTop: 20,
  },
  totalesPanel: {
    width: 230,
    border: `1px solid ${GRIS_100}`,
    borderRadius: 8,
    overflow: 'hidden',
  },
  totalesCuerpo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  totalFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 9,
    color: GRIS_600,
  },
  totalValor: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: GRIS_900,
  },
  totalIrpf: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: ROJO,
  },

  // Fila final "Total a pagar"
  grandTotalFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: AZUL,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  grandTotalLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: BLANCO,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grandTotalValor: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: BLANCO,
  },

  // ── Notas ─────────────────────────────────────────────────────────────────

  notasBox: {
    marginTop: 32,
    borderTop: `1px solid ${GRIS_100}`,
    paddingTop: 14,
  },
  notasTexto: {
    fontSize: 9,
    color: GRIS_600,
    lineHeight: 1.6,
  },

  // ── Aviso legal ───────────────────────────────────────────────────────────

  avisoBox: {
    marginTop: 16,
    backgroundColor: AZUL_CLARO,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  avisoTexto: {
    fontSize: 8,
    color: AZUL,
    lineHeight: 1.5,
  },

  // ── Footer ────────────────────────────────────────────────────────────────

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: `1px solid ${GRIS_100}`,
    paddingHorizontal: 48,
    paddingVertical: 10,
  },
  footerTexto: {
    fontSize: 8,
    color: GRIS_400,
  },
  footerAzul: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: AZUL,
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lineas(partes: (string | null | undefined)[], sep = ', ') {
  return partes.filter(Boolean).join(sep)
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function FacturaPDF({ factura, perfil }: FacturaPDFProps) {
  const nombreEmisor = lineas([perfil?.nombre, perfil?.apellidos]) || 'Sin nombre'
  const dirEmisor    = lineas([perfil?.direccion, perfil?.codigo_postal, perfil?.ciudad, perfil?.provincia])
  const dirCliente   = lineas([
    factura.cliente.direccion,
    factura.cliente.codigo_postal,
    factura.cliente.ciudad,
    factura.cliente.provincia,
    factura.cliente.pais !== 'ES' ? factura.cliente.pais : null,
  ])

  const lineasOrdenadas = [...factura.lineas].sort((a, b) => a.orden - b.orden)

  return (
    <Document title={`Factura ${factura.numero}`} author={nombreEmisor} creator="FacturApp">
      <Page size="A4" style={s.page}>

        {/* Franja de acento */}
        <View style={s.acento} />

        <View style={s.contenido}>

          {/* ── Cabecera ── */}
          <View style={s.cabecera}>
            {/* Columna izquierda: logo + emisor */}
            <View>
              {perfil?.logo_url && (
                <View style={s.logoBox}>
                  <Image src={perfil.logo_url} style={s.logo} />
                </View>
              )}
              <Text style={s.emisorNombre}>{nombreEmisor}</Text>
              {perfil?.nif       && <Text style={s.emisorLinea}>NIF: {perfil.nif}</Text>}
              {dirEmisor         && <Text style={s.emisorLinea}>{dirEmisor}</Text>}
              {perfil?.email     && <Text style={s.emisorLinea}>{perfil.email}</Text>}
              {perfil?.telefono  && <Text style={s.emisorLinea}>{perfil.telefono}</Text>}
            </View>

            {/* Columna derecha: FACTURA + número */}
            <View style={s.tituloBloq}>
              <Text style={s.titulo}>FACTURA</Text>
              <Text style={s.numero}>{factura.numero}</Text>
            </View>
          </View>

          {/* ── Fechas ── */}
          <View style={s.fechasBox}>
            <View style={s.fechaCelda}>
              <Text style={s.fechaLabel}>Fecha de emisión</Text>
              <Text style={s.fechaValor}>{formatDate(factura.fecha_emision)}</Text>
            </View>
            {factura.fecha_vencimiento && (
              <View style={s.fechaCelda}>
                <Text style={s.fechaLabel}>Fecha de vencimiento</Text>
                <Text style={s.fechaValor}>{formatDate(factura.fecha_vencimiento)}</Text>
              </View>
            )}
          </View>

          <View style={s.separador} />

          {/* ── Datos del cliente ── */}
          <View style={s.clienteBox}>
            <Text style={s.seccionLabel}>Facturado a</Text>
            <Text style={s.clienteNombre}>{factura.cliente.nombre}</Text>
            {factura.cliente.nif    && <Text style={s.clienteLinea}>NIF/CIF: {factura.cliente.nif}</Text>}
            {dirCliente             && <Text style={s.clienteLinea}>{dirCliente}</Text>}
            {factura.cliente.email  && <Text style={s.clienteLinea}>{factura.cliente.email}</Text>}
            {factura.cliente.telefono && <Text style={s.clienteLinea}>{factura.cliente.telefono}</Text>}
          </View>

          {/* ── Tabla de líneas ── */}
          <View style={s.tablaHeader}>
            <Text style={s.thDesc}>Descripción</Text>
            <Text style={s.thCant}>Cant.</Text>
            <Text style={s.thPrecio}>P. Unit.</Text>
            <Text style={s.thTotal}>Subtotal</Text>
          </View>

          {lineasOrdenadas.map((linea, i) => (
            <View key={linea.id} style={[s.fila, i % 2 !== 0 ? s.filaImpar : {}]}>
              <Text style={s.tdDesc}>{linea.descripcion}</Text>
              <Text style={s.tdCant}>{linea.cantidad}</Text>
              <Text style={s.tdPrecio}>{formatCurrency(linea.precio_unitario)}</Text>
              <Text style={s.tdTotal}>{formatCurrency(linea.subtotal)}</Text>
            </View>
          ))}

          {/* ── Resumen económico ── */}
          <View style={s.totalesBox}>
            <View style={s.totalesPanel}>
              <View style={s.totalesCuerpo}>
                <View style={s.totalFila}>
                  <Text style={s.totalLabel}>Base imponible</Text>
                  <Text style={s.totalValor}>{formatCurrency(factura.base_imponible)}</Text>
                </View>
                {factura.iva_porcentaje > 0 && (
                  <View style={s.totalFila}>
                    <Text style={s.totalLabel}>IVA ({factura.iva_porcentaje}%)</Text>
                    <Text style={s.totalValor}>+ {formatCurrency(factura.iva_importe)}</Text>
                  </View>
                )}
                {factura.iva_porcentaje === 0 && (
                  <View style={s.totalFila}>
                    <Text style={s.totalLabel}>IVA (exento)</Text>
                    <Text style={s.totalValor}>—</Text>
                  </View>
                )}
                {factura.irpf_porcentaje > 0 && (
                  <View style={s.totalFila}>
                    <Text style={s.totalLabel}>Retención IRPF ({factura.irpf_porcentaje}%)</Text>
                    <Text style={s.totalIrpf}>− {formatCurrency(factura.irpf_importe)}</Text>
                  </View>
                )}
              </View>

              {/* Total final */}
              <View style={s.grandTotalFila}>
                <Text style={s.grandTotalLabel}>Total a pagar</Text>
                <Text style={s.grandTotalValor}>{formatCurrency(factura.total)}</Text>
              </View>
            </View>
          </View>

          {/* ── Notas ── */}
          {factura.notas && (
            <View style={s.notasBox}>
              <Text style={s.seccionLabel}>Notas y condiciones</Text>
              <Text style={s.notasTexto}>{factura.notas}</Text>
            </View>
          )}

          {/* ── Aviso legal ── */}
          <View style={s.avisoBox}>
            <Text style={s.avisoTexto}>
              Factura emitida conforme al artículo 164 de la Ley 37/1992 del IVA y al Real Decreto 1619/2012
              sobre obligaciones de facturación. Conserve este documento durante un mínimo de 4 años.
            </Text>
          </View>

        </View>

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerTexto}>{factura.numero} · {nombreEmisor}</Text>
          <Text style={s.footerAzul}>FacturApp</Text>
        </View>

      </Page>
    </Document>
  )
}
