import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'

interface Props {
  invoiceNumber: string
  clientName: string
  amount: string
  paymentUrl: string
  companyName: string
}

export function PaymentLinkEmail({ invoiceNumber, clientName, amount, paymentUrl, companyName }: Props) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Factura {invoiceNumber} — Importe a pagar: {amount}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Heading style={styles.headerTitle}>Factura pendiente de pago</Heading>
            <Text style={styles.headerSub}>{invoiceNumber}</Text>
          </Section>

          <Section style={styles.section}>
            <Text style={styles.text}>Hola, <strong>{clientName}</strong>.</Text>
            <Text style={styles.text}>
              <strong>{companyName}</strong> te ha enviado una factura por importe de:
            </Text>
            <Text style={styles.amount}>{amount}</Text>
            <Text style={styles.text}>Puedes pagarla de forma segura usando el siguiente botón:</Text>
          </Section>

          <Section style={{ ...styles.section, textAlign: 'center' }}>
            <Button href={paymentUrl} style={styles.button}>Pagar ahora</Button>
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Este enlace de pago ha sido enviado por <strong>{companyName}</strong> mediante FacturX.
              Si no esperabas este email, puedes ignorarlo.
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
  header: { backgroundColor: '#1e40af', padding: '28px 32px' },
  headerTitle: { color: '#ffffff', fontSize: '22px', fontWeight: '700', margin: '0 0 4px 0' },
  headerSub: { color: '#bfdbfe', fontSize: '14px', margin: '0' },
  section: { padding: '20px 32px' },
  text: { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 12px 0' },
  amount: { fontSize: '36px', fontWeight: '700', color: '#111827', textAlign: 'center' as const, margin: '8px 0 20px 0' },
  button: { backgroundColor: '#1e40af', color: '#ffffff', fontSize: '16px', fontWeight: '700', borderRadius: '8px', padding: '14px 36px', textDecoration: 'none', display: 'inline-block' },
  hr: { borderColor: '#e5e7eb', margin: '0' },
  footer: { backgroundColor: '#f9fafb', padding: '16px 32px' },
  footerText: { fontSize: '12px', color: '#9ca3af', margin: '0', textAlign: 'center' as const },
}
