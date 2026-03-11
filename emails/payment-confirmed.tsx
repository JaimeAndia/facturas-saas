import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'

interface Props {
  invoiceNumber: string
  clientName: string
  amount: string
  paidAt: string
  verifyUrl: string
}

export function PaymentConfirmedEmail({ invoiceNumber, clientName, amount, paidAt, verifyUrl }: Props) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Pago confirmado — Factura {invoiceNumber}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.checkmark}>✓</Text>
            <Heading style={styles.headerTitle}>Pago confirmado</Heading>
            <Text style={styles.headerSub}>Factura {invoiceNumber}</Text>
          </Section>

          <Section style={styles.section}>
            <Text style={styles.text}>Hola, <strong>{clientName}</strong>.</Text>
            <Text style={styles.text}>
              Hemos recibido correctamente tu pago de <strong>{amount}</strong> el {paidAt}.
            </Text>
            <Text style={styles.text}>
              Este pago ha quedado registrado en la blockchain de XRP Ledger, lo que garantiza
              su autenticidad e inmutabilidad. Puedes verificarlo en cualquier momento:
            </Text>
          </Section>

          <Section style={{ ...styles.section, textAlign: 'center' }}>
            <Button href={verifyUrl} style={styles.button}>Verificar en blockchain</Button>
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Conserva este email como justificante de pago. La verificación blockchain
              es pública y permanente.
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
  header: { backgroundColor: '#059669', padding: '28px 32px', textAlign: 'center' as const },
  checkmark: { fontSize: '40px', color: '#ffffff', margin: '0 0 8px 0' },
  headerTitle: { color: '#ffffff', fontSize: '22px', fontWeight: '700', margin: '0 0 4px 0' },
  headerSub: { color: '#a7f3d0', fontSize: '14px', margin: '0' },
  section: { padding: '20px 32px' },
  text: { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 12px 0' },
  button: { backgroundColor: '#059669', color: '#ffffff', fontSize: '15px', fontWeight: '700', borderRadius: '8px', padding: '12px 32px', textDecoration: 'none', display: 'inline-block' },
  hr: { borderColor: '#e5e7eb', margin: '0' },
  footer: { backgroundColor: '#f9fafb', padding: '16px 32px' },
  footerText: { fontSize: '12px', color: '#9ca3af', margin: '0', textAlign: 'center' as const },
}
