import {
  Body, Container, Head, Heading, Hr, Html, Section, Text,
} from '@react-email/components'

interface Props {
  invoiceNumber: string
  clientName: string
  amount: string
  dueDate: string
  emisorEmail: string
}

export function InvoiceUncollectibleEmail({
  invoiceNumber,
  clientName,
  amount,
  dueDate,
  emisorEmail,
}: Props) {
  return (
    <Html lang="es">
      <Head />
      <Body style={styles.body}>
        <div style={{ display: 'none', overflow: 'hidden', maxHeight: 0, fontSize: '1px', color: '#f3f4f6' }}>
          Factura {invoiceNumber} marcada como incobrable
        </div>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Heading style={styles.headerTitle}>Factura incobrable</Heading>
            <Text style={styles.headerSub}>Factura {invoiceNumber} — sin cobro tras 30 días</Text>
          </Section>

          <Section style={styles.section}>
            <Text style={styles.text}>
              La factura <strong>{invoiceNumber}</strong> emitida a <strong>{clientName}</strong> ha
              sido marcada automáticamente como <strong>incobrable</strong> al superar los 30 días
              desde su vencimiento sin recibir pago, y haberse agotado los tres recordatorios automáticos.
            </Text>
          </Section>

          <Section style={styles.detailBox}>
            <Text style={styles.detailRow}>Factura: <strong>{invoiceNumber}</strong></Text>
            <Text style={styles.detailRow}>Cliente: <strong>{clientName}</strong></Text>
            <Text style={styles.detailRow}>Importe: <strong>{amount}</strong></Text>
            <Text style={styles.detailRow}>Vencimiento: <strong>{dueDate}</strong></Text>
          </Section>

          <Section style={styles.section}>
            <Text style={styles.text}>
              Si deseas reclamar esta deuda, considera las siguientes opciones:
            </Text>
            <Text style={styles.listItem}>• Contactar directamente con el cliente para negociar el pago.</Text>
            <Text style={styles.listItem}>• Emitir una reclamación formal mediante burofax.</Text>
            <Text style={styles.listItem}>• Acudir a un servicio de recobro profesional.</Text>
            <Text style={styles.listItem}>• Consultar con un asesor fiscal para deducir el impago.</Text>
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Este aviso ha sido generado automáticamente por FacturX.
              Para cualquier consulta, accede a tu panel en app.facturx.es.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const styles = {
  body: { backgroundColor: '#f3f4f6', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  container: { margin: '32px auto', maxWidth: '560px', backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb' },
  header: { padding: '28px 32px', backgroundColor: '#7f1d1d' },
  headerTitle: { color: '#ffffff', fontSize: '22px', fontWeight: '700', margin: '0 0 4px 0' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: '14px', margin: '0' },
  section: { padding: '20px 32px' },
  text: { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 12px 0' },
  listItem: { fontSize: '14px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 4px 0', paddingLeft: '4px' },
  detailBox: { margin: '0 32px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px' },
  detailRow: { fontSize: '14px', color: '#374151', margin: '0 0 6px 0' },
  hr: { borderColor: '#e5e7eb', margin: '0' },
  footer: { backgroundColor: '#f9fafb', padding: '16px 32px' },
  footerText: { fontSize: '12px', color: '#9ca3af', margin: '0', textAlign: 'center' as const },
}
