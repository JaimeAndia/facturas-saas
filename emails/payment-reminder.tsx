import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'

interface Props {
  invoiceNumber: string
  clientName: string
  amount: string
  dueDate: string
  paymentUrl: string
  reminderNumber: number
}

export function PaymentReminderEmail({ invoiceNumber, clientName, amount, dueDate, paymentUrl, reminderNumber }: Props) {
  const isUrgent = reminderNumber > 1

  const subject = isUrgent
    ? `URGENTE — Factura ${invoiceNumber} pendiente de pago`
    : `Recordatorio — Factura ${invoiceNumber} pendiente de pago`

  const headerBg = isUrgent ? '#dc2626' : '#d97706'

  const bodyText = isUrgent
    ? `Han pasado varios días desde el vencimiento de tu factura. Por favor, regulariza el pago a la mayor brevedad posible para evitar posibles recargos.`
    : `Te recordamos que tienes una factura pendiente de pago que venció el ${dueDate}. Si ya has realizado el pago, por favor ignora este mensaje.`

  return (
    <Html lang="es">
      <Head />
      <Preview>{subject}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={{ ...styles.header, backgroundColor: headerBg }}>
            <Heading style={styles.headerTitle}>
              {isUrgent ? '⚠ Recordatorio urgente' : 'Recordatorio de pago'}
            </Heading>
            <Text style={styles.headerSub}>Factura {invoiceNumber} — Recordatorio nº {reminderNumber}</Text>
          </Section>

          <Section style={styles.section}>
            <Text style={styles.text}>Estimado/a <strong>{clientName}</strong>,</Text>
            <Text style={styles.text}>{bodyText}</Text>
          </Section>

          <Section style={styles.detailBox}>
            <Text style={styles.detailRow}>Factura: <strong>{invoiceNumber}</strong></Text>
            <Text style={styles.detailRow}>Importe: <strong>{amount}</strong></Text>
            <Text style={styles.detailRow}>Fecha de vencimiento: <strong>{dueDate}</strong></Text>
          </Section>

          <Section style={{ ...styles.section, textAlign: 'center' }}>
            <Button href={paymentUrl} style={{ ...styles.button, backgroundColor: headerBg }}>
              Pagar ahora
            </Button>
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Si tienes alguna duda sobre esta factura, contacta directamente con el emisor.
              Este email ha sido generado automáticamente por FacturApp.
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
  header: { padding: '28px 32px' },
  headerTitle: { color: '#ffffff', fontSize: '22px', fontWeight: '700', margin: '0 0 4px 0' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: '14px', margin: '0' },
  section: { padding: '20px 32px' },
  text: { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 12px 0' },
  detailBox: { margin: '0 32px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' },
  detailRow: { fontSize: '14px', color: '#374151', margin: '0 0 6px 0' },
  button: { color: '#ffffff', fontSize: '16px', fontWeight: '700', borderRadius: '8px', padding: '14px 36px', textDecoration: 'none', display: 'inline-block' },
  hr: { borderColor: '#e5e7eb', margin: '0' },
  footer: { backgroundColor: '#f9fafb', padding: '16px 32px' },
  footerText: { fontSize: '12px', color: '#9ca3af', margin: '0', textAlign: 'center' as const },
}
