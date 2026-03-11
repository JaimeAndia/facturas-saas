import {
  Body,
  Button,
  Container,
  Column,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'

interface LineaEmail {
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

interface FacturaEmailProps {
  numeroFactura: string
  nombreEmisor: string
  nombreCliente: string
  fechaEmision: string
  fechaVencimiento?: string | null
  lineas: LineaEmail[]
  baseImponible: number
  ivaPorcentaje: number
  ivaImporte: number
  irpfPorcentaje: number
  irpfImporte: number
  total: number
  notas?: string | null
  urlDescarga: string
}

function eur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

export function FacturaEmail({
  numeroFactura,
  nombreEmisor,
  nombreCliente,
  fechaEmision,
  fechaVencimiento,
  lineas,
  baseImponible,
  ivaPorcentaje,
  ivaImporte,
  irpfPorcentaje,
  irpfImporte,
  total,
  notas,
  urlDescarga,
}: FacturaEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Factura {numeroFactura} de {nombreEmisor} — {eur(total)}</Preview>
      <Body style={estilos.body}>
        <Container style={estilos.container}>

          {/* Cabecera */}
          <Section style={estilos.header}>
            <Heading style={estilos.headerTitle}>FACTURA</Heading>
            <Text style={estilos.headerNumero}>{numeroFactura}</Text>
          </Section>

          {/* Saludo */}
          <Section style={estilos.section}>
            <Text style={estilos.texto}>
              Estimado/a <strong>{nombreCliente}</strong>,
            </Text>
            <Text style={estilos.texto}>
              Le remitimos la factura correspondiente a los servicios prestados.
              Encontrará el detalle a continuación y el PDF adjunto a este email.
            </Text>
          </Section>

          <Hr style={estilos.hr} />

          {/* Fechas */}
          <Section style={estilos.section}>
            <Row>
              <Column style={estilos.fechaCol}>
                <Text style={estilos.etiqueta}>Fecha de emisión</Text>
                <Text style={estilos.valor}>{fechaEmision}</Text>
              </Column>
              {fechaVencimiento && (
                <Column style={estilos.fechaCol}>
                  <Text style={estilos.etiqueta}>Fecha de vencimiento</Text>
                  <Text style={estilos.valorRojo}>{fechaVencimiento}</Text>
                </Column>
              )}
              <Column style={estilos.fechaCol}>
                <Text style={estilos.etiqueta}>Emisor</Text>
                <Text style={estilos.valor}>{nombreEmisor}</Text>
              </Column>
            </Row>
          </Section>

          <Hr style={estilos.hr} />

          {/* Tabla de líneas */}
          <Section style={estilos.section}>
            <Text style={estilos.subtitulo}>Detalle</Text>
            {/* Cabecera */}
            <Row style={estilos.tablaHeader}>
              <Column style={{ ...estilos.thDesc }}>
                <Text style={estilos.thTexto}>Descripción</Text>
              </Column>
              <Column style={estilos.thNum}>
                <Text style={estilos.thTexto}>Cant.</Text>
              </Column>
              <Column style={estilos.thNum}>
                <Text style={estilos.thTexto}>P. Unit.</Text>
              </Column>
              <Column style={estilos.thNum}>
                <Text style={estilos.thTexto}>Subtotal</Text>
              </Column>
            </Row>
            {/* Filas */}
            {lineas.map((l, i) => (
              <Row key={i} style={i % 2 === 0 ? estilos.filaClara : estilos.filaOscura}>
                <Column style={estilos.thDesc}>
                  <Text style={estilos.tdTexto}>{l.descripcion}</Text>
                </Column>
                <Column style={estilos.thNum}>
                  <Text style={estilos.tdTexto}>{l.cantidad}</Text>
                </Column>
                <Column style={estilos.thNum}>
                  <Text style={estilos.tdTexto}>{eur(l.precio_unitario)}</Text>
                </Column>
                <Column style={estilos.thNum}>
                  <Text style={{ ...estilos.tdTexto, fontWeight: '600' }}>{eur(l.subtotal)}</Text>
                </Column>
              </Row>
            ))}
          </Section>

          <Hr style={estilos.hr} />

          {/* Totales */}
          <Section style={estilos.section}>
            <Row>
              <Column style={{ width: '60%' }} />
              <Column style={{ width: '40%' }}>
                <Row>
                  <Column><Text style={estilos.totalLabel}>Base imponible</Text></Column>
                  <Column><Text style={estilos.totalValor}>{eur(baseImponible)}</Text></Column>
                </Row>
                {ivaPorcentaje > 0 && (
                  <Row>
                    <Column><Text style={estilos.totalLabel}>IVA ({ivaPorcentaje}%)</Text></Column>
                    <Column><Text style={estilos.totalValor}>+ {eur(ivaImporte)}</Text></Column>
                  </Row>
                )}
                {irpfPorcentaje > 0 && (
                  <Row>
                    <Column><Text style={estilos.totalLabel}>IRPF ({irpfPorcentaje}%)</Text></Column>
                    <Column><Text style={{ ...estilos.totalValor, color: '#dc2626' }}>− {eur(irpfImporte)}</Text></Column>
                  </Row>
                )}
                <Row style={estilos.totalFinalFila}>
                  <Column><Text style={estilos.totalFinalLabel}>TOTAL</Text></Column>
                  <Column><Text style={estilos.totalFinalValor}>{eur(total)}</Text></Column>
                </Row>
              </Column>
            </Row>
          </Section>

          {/* Notas */}
          {notas && (
            <>
              <Hr style={estilos.hr} />
              <Section style={estilos.section}>
                <Text style={estilos.subtitulo}>Notas</Text>
                <Text style={estilos.textoGris}>{notas}</Text>
              </Section>
            </>
          )}

          <Hr style={estilos.hr} />

          {/* CTA descarga */}
          <Section style={{ ...estilos.section, textAlign: 'center' }}>
            <Text style={estilos.texto}>
              Puede descargar el PDF de la factura usando el siguiente botón:
            </Text>
            <Button href={urlDescarga} style={estilos.boton}>
              Descargar factura PDF
            </Button>
          </Section>

          {/* Footer */}
          <Section style={estilos.footer}>
            <Text style={estilos.footerTexto}>
              Este email ha sido enviado por <strong>{nombreEmisor}</strong> mediante FacturApp.
              Por favor, no responda a este correo.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}

// ─── Estilos inline (requeridos por React Email) ──────────────────────────────

const estilos = {
  body: {
    backgroundColor: '#f3f4f6',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: {
    margin: '32px auto',
    maxWidth: '600px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
  },
  header: {
    backgroundColor: '#1e40af',
    padding: '28px 32px',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: '28px',
    fontWeight: '700',
    margin: '0 0 4px 0',
    letterSpacing: '2px',
  },
  headerNumero: {
    color: '#bfdbfe',
    fontSize: '16px',
    margin: '0',
  },
  section: {
    padding: '20px 32px',
  },
  texto: {
    fontSize: '15px',
    color: '#374151',
    lineHeight: '1.6',
    margin: '0 0 12px 0',
  },
  textoGris: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.6',
    margin: '0',
  },
  subtitulo: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    margin: '0 0 12px 0',
  },
  hr: {
    borderColor: '#e5e7eb',
    margin: '0',
  },
  etiqueta: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    margin: '0 0 4px 0',
  },
  valor: {
    fontSize: '14px',
    color: '#111827',
    fontWeight: '600',
    margin: '0',
  },
  valorRojo: {
    fontSize: '14px',
    color: '#dc2626',
    fontWeight: '600',
    margin: '0',
  },
  fechaCol: {
    paddingRight: '24px',
  },
  tablaHeader: {
    backgroundColor: '#1e40af',
    borderRadius: '6px',
  },
  thDesc: { width: '45%', padding: '8px 10px' },
  thNum: { width: '18%', padding: '8px 10px', textAlign: 'right' as const },
  thTexto: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase' as const,
    margin: '0',
  },
  filaClara: { backgroundColor: '#ffffff' },
  filaOscura: { backgroundColor: '#f9fafb' },
  tdTexto: {
    fontSize: '13px',
    color: '#374151',
    margin: '0',
    padding: '6px 10px',
  },
  totalLabel: {
    fontSize: '13px',
    color: '#6b7280',
    margin: '0 0 6px 0',
  },
  totalValor: {
    fontSize: '13px',
    color: '#111827',
    fontWeight: '600',
    margin: '0 0 6px 0',
    textAlign: 'right' as const,
  },
  totalFinalFila: {
    backgroundColor: '#1e40af',
    borderRadius: '6px',
    padding: '4px',
    marginTop: '4px',
  },
  totalFinalLabel: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#ffffff',
    margin: '0',
    padding: '6px 10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  totalFinalValor: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffffff',
    margin: '0',
    textAlign: 'right' as const,
    padding: '6px 10px',
  },
  boton: {
    backgroundColor: '#1e40af',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '600',
    borderRadius: '8px',
    padding: '12px 28px',
    textDecoration: 'none',
    display: 'inline-block',
  },
  footer: {
    backgroundColor: '#f9fafb',
    padding: '16px 32px',
    borderTop: '1px solid #e5e7eb',
  },
  footerTexto: {
    fontSize: '12px',
    color: '#9ca3af',
    margin: '0',
    textAlign: 'center' as const,
  },
}
