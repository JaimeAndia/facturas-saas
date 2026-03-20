import {
  Body, Container, Head, Heading, Hr, Html, Link, Section, Text,
} from '@react-email/components'

interface Props {
  nombreCliente: string
  emailCliente: string
  recurrenteId: string
  importe: string
  appUrl: string
}

export function CobroFallidoEmail({
  nombreCliente,
  emailCliente,
  recurrenteId,
  importe,
  appUrl,
}: Props) {
  const urlRecurrente = `${appUrl}/facturas/recurrentes/${recurrenteId}`

  return (
    <Html lang="es">
      <Head />
      <Body style={styles.body}>
        <div style={{ display: 'none', overflow: 'hidden', maxHeight: 0, fontSize: '1px', color: '#f3f4f6' }}>
          Cobro fallido de {nombreCliente} — {importe}
        </div>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Heading style={styles.headerTitle}>Cobro fallido</Heading>
            <Text style={styles.headerSub}>El cobro automático no se ha podido procesar</Text>
          </Section>

          <Section style={styles.section}>
            <Text style={styles.text}>
              El cobro automático a <strong>{nombreCliente}</strong> ha fallado.
              Stripe intentará de nuevo en los próximos días, pero es posible que
              necesites contactar con el cliente para resolver el problema de pago.
            </Text>
          </Section>

          <Section style={styles.detailBox}>
            <Text style={styles.detailRow}>Cliente: <strong>{nombreCliente}</strong></Text>
            <Text style={styles.detailRow}>Email: <strong>{emailCliente}</strong></Text>
            <Text style={styles.detailRow}>Importe: <strong>{importe}</strong></Text>
          </Section>

          <Section style={styles.section}>
            <Link href={urlRecurrente} style={styles.button}>
              Ver recurrente en FacturX
            </Link>
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Este aviso ha sido generado automáticamente por FacturX.
              Accede a tu panel en app.facturx.es para gestionar tus cobros.
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
  header: { padding: '28px 32px', backgroundColor: '#92400e' },
  headerTitle: { color: '#ffffff', fontSize: '22px', fontWeight: '700', margin: '0 0 4px 0' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: '14px', margin: '0' },
  section: { padding: '20px 32px' },
  text: { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 12px 0' },
  detailBox: { margin: '0 32px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '16px' },
  detailRow: { fontSize: '14px', color: '#374151', margin: '0 0 6px 0' },
  button: { display: 'inline-block', backgroundColor: '#d97706', color: '#ffffff', fontSize: '14px', fontWeight: '600', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none' },
  hr: { borderColor: '#e5e7eb', margin: '0' },
  footer: { backgroundColor: '#f9fafb', padding: '16px 32px' },
  footerText: { fontSize: '12px', color: '#9ca3af', margin: '0', textAlign: 'center' as const },
}
