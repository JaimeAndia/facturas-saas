import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Factura, LineaFactura, Cliente, Profile } from '@/types'

interface FacturaPDFProps {
  factura: Factura & { lineas: LineaFactura[]; cliente: Cliente }
  perfil: Pick<Profile, 'nombre' | 'apellidos' | 'nif' | 'email' | 'telefono' | 'direccion' | 'ciudad' | 'codigo_postal' | 'provincia'>
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 48, color: '#111827', backgroundColor: '#ffffff' },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  titulo: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#1e40af' },
  numero: { fontSize: 13, color: '#374151', marginTop: 4 },
  emisorNombre: { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  emisorDato: { fontSize: 9, color: '#6b7280', textAlign: 'right', marginTop: 2 },
  // Fechas
  fechasBox: { flexDirection: 'row', gap: 16, backgroundColor: '#f9fafb', borderRadius: 6, padding: 12, marginBottom: 24 },
  fechaLabel: { fontSize: 8, color: '#9ca3af', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 3 },
  fechaValor: { fontSize: 10, color: '#111827', fontFamily: 'Helvetica-Bold' },
  // Cliente
  seccionLabel: { fontSize: 8, color: '#9ca3af', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 4 },
  clienteNombre: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111827' },
  clienteDato: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  // Líneas
  tablaHeader: { flexDirection: 'row', borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginTop: 24, marginBottom: 4 },
  thDesc: { flex: 1, fontSize: 8, color: '#9ca3af', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  thNum: { width: 50, fontSize: 8, color: '#9ca3af', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', textAlign: 'right' },
  thPrecio: { width: 70, fontSize: 8, color: '#9ca3af', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', textAlign: 'right' },
  thTotal: { width: 70, fontSize: 8, color: '#9ca3af', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', textAlign: 'right' },
  fila: { flexDirection: 'row', borderBottom: '1px solid #f3f4f6', paddingVertical: 7 },
  tdDesc: { flex: 1, fontSize: 10, color: '#111827' },
  tdNum: { width: 50, fontSize: 10, color: '#4b5563', textAlign: 'right' },
  tdPrecio: { width: 70, fontSize: 10, color: '#4b5563', textAlign: 'right' },
  tdTotal: { width: 70, fontSize: 10, color: '#111827', fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  // Totales
  totalesBox: { alignItems: 'flex-end', marginTop: 16 },
  totalesInner: { width: 200 },
  totalFila: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  totalLabel: { fontSize: 9, color: '#6b7280' },
  totalValor: { fontSize: 9, color: '#111827', fontFamily: 'Helvetica-Bold' },
  totalIrpf: { fontSize: 9, color: '#dc2626', fontFamily: 'Helvetica-Bold' },
  totalLinea: { borderTop: '1px solid #e5e7eb', marginVertical: 6 },
  grandTotalFila: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  grandTotalLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111827' },
  grandTotalValor: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1e40af' },
  // Notas
  notasBox: { marginTop: 32, borderTop: '1px solid #f3f4f6', paddingTop: 12 },
  notasLabel: { fontSize: 8, color: '#9ca3af', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 4 },
  notasTexto: { fontSize: 9, color: '#6b7280', lineHeight: 1.5 },
  // Footer
  footer: { position: 'absolute', bottom: 24, left: 48, right: 48, textAlign: 'center', fontSize: 8, color: '#d1d5db' },
})

export function FacturaPDF({ factura, perfil }: FacturaPDFProps) {
  const nombreEmisor = [perfil.nombre, perfil.apellidos].filter(Boolean).join(' ') || 'Sin nombre'
  const direccionEmisor = [perfil.direccion, perfil.ciudad, perfil.codigo_postal, perfil.provincia].filter(Boolean).join(', ')
  const direccionCliente = [factura.cliente.direccion, factura.cliente.ciudad, factura.cliente.codigo_postal, factura.cliente.provincia].filter(Boolean).join(', ')

  const lineasOrdenadas = [...factura.lineas].sort((a, b) => a.orden - b.orden)

  return (
    <Document title={factura.numero} author={nombreEmisor}>
      <Page size="A4" style={s.page}>
        {/* Cabecera */}
        <View style={s.header}>
          <View>
            <Text style={s.titulo}>FACTURA</Text>
            <Text style={s.numero}>{factura.numero}</Text>
          </View>
          <View>
            <Text style={s.emisorNombre}>{nombreEmisor}</Text>
            {perfil.nif && <Text style={s.emisorDato}>NIF: {perfil.nif}</Text>}
            {direccionEmisor && <Text style={s.emisorDato}>{direccionEmisor}</Text>}
            {perfil.email && <Text style={s.emisorDato}>{perfil.email}</Text>}
            {perfil.telefono && <Text style={s.emisorDato}>{perfil.telefono}</Text>}
          </View>
        </View>

        {/* Fechas */}
        <View style={s.fechasBox}>
          <View>
            <Text style={s.fechaLabel}>Fecha de emisión</Text>
            <Text style={s.fechaValor}>{formatDate(factura.fecha_emision)}</Text>
          </View>
          {factura.fecha_vencimiento && (
            <View>
              <Text style={s.fechaLabel}>Fecha de vencimiento</Text>
              <Text style={s.fechaValor}>{formatDate(factura.fecha_vencimiento)}</Text>
            </View>
          )}
        </View>

        {/* Cliente */}
        <View style={{ marginBottom: 8 }}>
          <Text style={s.seccionLabel}>Facturado a</Text>
          <Text style={s.clienteNombre}>{factura.cliente.nombre}</Text>
          {factura.cliente.nif && <Text style={s.clienteDato}>NIF: {factura.cliente.nif}</Text>}
          {direccionCliente && <Text style={s.clienteDato}>{direccionCliente}</Text>}
          {factura.cliente.email && <Text style={s.clienteDato}>{factura.cliente.email}</Text>}
        </View>

        {/* Líneas */}
        <View style={s.tablaHeader}>
          <Text style={s.thDesc}>Descripción</Text>
          <Text style={s.thNum}>Cant.</Text>
          <Text style={s.thPrecio}>P. Unit.</Text>
          <Text style={s.thTotal}>Total</Text>
        </View>
        {lineasOrdenadas.map((linea) => (
          <View key={linea.id} style={s.fila}>
            <Text style={s.tdDesc}>{linea.descripcion}</Text>
            <Text style={s.tdNum}>{linea.cantidad}</Text>
            <Text style={s.tdPrecio}>{formatCurrency(linea.precio_unitario)}</Text>
            <Text style={s.tdTotal}>{formatCurrency(linea.subtotal)}</Text>
          </View>
        ))}

        {/* Totales */}
        <View style={s.totalesBox}>
          <View style={s.totalesInner}>
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
            {factura.irpf_porcentaje > 0 && (
              <View style={s.totalFila}>
                <Text style={s.totalLabel}>IRPF ({factura.irpf_porcentaje}%)</Text>
                <Text style={s.totalIrpf}>− {formatCurrency(factura.irpf_importe)}</Text>
              </View>
            )}
            <View style={s.totalLinea} />
            <View style={s.grandTotalFila}>
              <Text style={s.grandTotalLabel}>Total</Text>
              <Text style={s.grandTotalValor}>{formatCurrency(factura.total)}</Text>
            </View>
          </View>
        </View>

        {/* Notas */}
        {factura.notas && (
          <View style={s.notasBox}>
            <Text style={s.notasLabel}>Notas</Text>
            <Text style={s.notasTexto}>{factura.notas}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={s.footer}>
          Generado con FacturApp · {factura.numero}
        </Text>
      </Page>
    </Document>
  )
}
