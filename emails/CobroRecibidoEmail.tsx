import {
  Body, Button, Container, Head, Heading, Hr, Html, Section, Text,
} from '@react-email/components'

interface Props {
  nombreCliente: string
  numeroFactura: string
  importe: string
  urlFactura: string
}

export function CobroRecibidoEmail({
  nombreCliente,
  numeroFactura,
  importe,
  urlFactura,
}: Props) {
  return (
    <Html lang="es">
      <Head />
      <Body style={styles.body}>
        {/* Preheader oculto */}
        <div style={{ display: 'none', overflow: 'hidden', maxHeight: 0, fontSize: '1px', color: '#f3f4f6' }}>
          {nombreCliente} ha pagado {importe} · Factura {numeroFactura}
        </div>

        <Container style={styles.container}>

          {/* Cabecera verde con importe destacado */}
          <Section style={styles.header}>
            <Text style={styles.headerLabel}>Cobro recibido</Text>
            <Heading style={styles.headerImporte}>{importe}</Heading>
            <Text style={styles.headerSub}>de <strong style={{ color: '#ffffff' }}>{nombreCliente}</strong></Text>
          </Section>

          {/* Cuerpo principal */}
          <Section style={styles.section}>
            <Text style={styles.text}>
              El pago se ha procesado correctamente. El dinero llegará a tu cuenta en los próximos días hábiles.
            </Text>

            {/* Caja de resumen */}
            <Section style={styles.infoBox}>
              <Text style={styles.infoRow}>
                <span style={styles.infoLabel}>Cliente</span>
                <span style={styles.infoValue}>{nombreCliente}</span>
              </Text>
              <Hr style={styles.infoHr} />
              <Text style={styles.infoRow}>
                <span style={styles.infoLabel}>Factura</span>
                <span style={styles.infoValue}>{numeroFactura}</span>
              </Text>
              <Hr style={styles.infoHr} />
              <Text style={styles.infoRow}>
                <span style={styles.infoLabel}>Importe cobrado</span>
                <span style={{ ...styles.infoValue, color: '#059669' }}>{importe}</span>
              </Text>
            </Section>
          </Section>

          {/* CTA */}
          <Section style={styles.ctaSection}>
            <Button href={urlFactura} style={styles.button}>
              Ver factura en FacturX
            </Button>
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              FacturX · Gestión de facturas para autónomos españoles
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}

const styles = {
  body: {
    backgroundColor: '#f3f4f6',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: {
    margin: '32px auto',
    maxWidth: '520px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
  },
  // Cabecera verde — el importe es lo más importante, va grande y visible
  header: {
    backgroundColor: '#059669',
    padding: '32px 32px 28px',
    textAlign: 'center' as const,
  },
  headerLabel: {
    color: '#a7f3d0',
    fontSize: '13px',
    fontWeight: '600',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    margin: '0 0 8px 0',
  },
  headerImporte: {
    color: '#ffffff',
    fontSize: '42px',
    fontWeight: '800',
    margin: '0 0 8px 0',
    lineHeight: '1',
  },
  headerSub: {
    color: '#a7f3d0',
    fontSize: '15px',
    margin: '0',
  },
  section: { padding: '24px 32px 8px' },
  text: { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 20px 0' },
  // Caja de resumen con filas separadas por líneas
  infoBox: {
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    padding: '0 16px',
    margin: '0 0 8px 0',
  },
  infoRow: {
    fontSize: '14px',
    color: '#374151',
    margin: '14px 0',
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
  },
  infoLabel: { color: '#6b7280' },
  infoValue: { fontWeight: '700' as const, color: '#111827' },
  infoHr: { borderColor: '#e5e7eb', margin: '0' },
  // CTA centrado
  ctaSection: { padding: '16px 32px 28px', textAlign: 'center' as const },
  button: {
    backgroundColor: '#059669',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '700',
    borderRadius: '8px',
    padding: '12px 32px',
    textDecoration: 'none',
    display: 'inline-block',
  },
  hr: { borderColor: '#e5e7eb', margin: '0' },
  footer: { backgroundColor: '#f9fafb', padding: '16px 32px' },
  footerText: { fontSize: '12px', color: '#9ca3af', margin: '0', textAlign: 'center' as const },
}
