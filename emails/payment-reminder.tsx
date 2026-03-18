import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'

interface Props {
  invoiceNumber: string
  clientName: string
  amount: string
  dueDate: string
  paymentUrl: string
  reminderNumber: 1 | 2 | 3
}

// Configuración de tono por número de recordatorio
const CONFIG = {
  1: {
    previewText: (n: string) => `Recordatorio de pago — Factura ${n}`,
    headerBg: '#d97706',
    headerTitle: 'Recordatorio de pago',
    intro: (client: string, dueDate: string) =>
      `Estimado/a ${client}, te recordamos que la factura que figura a continuación venció el ${dueDate}. Si ya has realizado el pago, por favor ignora este mensaje.`,
    cta: 'Pagar ahora',
  },
  2: {
    previewText: (n: string) => `2º recordatorio — Factura ${n} pendiente de pago`,
    headerBg: '#ea580c',
    headerTitle: '2º recordatorio de pago',
    intro: (client: string, dueDate: string) =>
      `Estimado/a ${client}, te informamos de que seguimos sin recibir el pago de la siguiente factura, vencida el ${dueDate}. Te pedimos que regularices la situación a la mayor brevedad posible.`,
    cta: 'Realizar el pago',
  },
  3: {
    previewText: (n: string) => `AVISO FINAL — Factura ${n} impagada`,
    headerBg: '#dc2626',
    headerTitle: 'Aviso final de pago',
    intro: (client: string, dueDate: string) =>
      `Estimado/a ${client}, este es el último aviso antes de proceder a iniciar las acciones oportunas para el cobro de la siguiente factura, vencida el ${dueDate}. Si no se recibe el pago, la deuda será trasladada a un servicio de recobro.`,
    cta: 'Pagar de inmediato',
  },
}

export function PaymentReminderEmail({
  invoiceNumber,
  clientName,
  amount,
  dueDate,
  paymentUrl,
  reminderNumber,
}: Props) {
  const cfg = CONFIG[reminderNumber]

  return (
    <Html lang="es">
      <Head />
      <Preview>{cfg.previewText(invoiceNumber)}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={{ ...styles.header, backgroundColor: cfg.headerBg }}>
            <Heading style={styles.headerTitle}>{cfg.headerTitle}</Heading>
            <Text style={styles.headerSub}>Factura {invoiceNumber} — Recordatorio nº {reminderNumber} de 3</Text>
          </Section>

          <Section style={styles.section}>
            <Text style={styles.text}>{cfg.intro(clientName, dueDate)}</Text>
          </Section>

          <Section style={styles.detailBox}>
            <Text style={styles.detailRow}>Factura: <strong>{invoiceNumber}</strong></Text>
            <Text style={styles.detailRow}>Importe: <strong>{amount}</strong></Text>
            <Text style={styles.detailRow}>Fecha de vencimiento: <strong>{dueDate}</strong></Text>
          </Section>

          <Section style={{ ...styles.section, textAlign: 'center' as const }}>
            <Button href={paymentUrl} style={{ ...styles.button, backgroundColor: cfg.headerBg }}>
              {cfg.cta}
            </Button>
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Si tienes alguna duda sobre esta factura, contacta directamente con el emisor.
              Este email ha sido generado automáticamente por FacturX.
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
