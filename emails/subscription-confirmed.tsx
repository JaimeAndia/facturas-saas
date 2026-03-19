import {
  Body, Button, Container, Head, Heading, Hr, Html, Section, Text,
} from '@react-email/components'

interface Props {
  clientName: string
  companyName: string
  amount: string
  interval: string
  startDate: string
  portalUrl: string
}

export function SubscriptionConfirmedEmail({
  clientName, companyName, amount, interval, startDate, portalUrl,
}: Props) {
  return (
    <Html lang="es">
      <Head />
      <Body style={styles.body}>
        <div style={{ display: 'none', overflow: 'hidden', maxHeight: 0, fontSize: '1px', color: '#f3f4f6' }}>
          Tu suscripción con {companyName} está activa — {amount} {interval}
        </div>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Heading style={styles.headerTitle}>Suscripción confirmada</Heading>
            <Text style={styles.headerSub}>{companyName}</Text>
          </Section>

          <Section style={styles.section}>
            <Text style={styles.text}>Hola, <strong>{clientName}</strong>.</Text>
            <Text style={styles.text}>
              Tu suscripción con <strong>{companyName}</strong> ha quedado activada correctamente.
              A partir de ahora los cobros son automáticos — no tendrás que hacer nada.
            </Text>

            <Section style={styles.infoBox}>
              <Text style={styles.infoRow}>
                <span style={styles.infoLabel}>Importe</span>
                <span style={styles.infoValue}>{amount}</span>
              </Text>
              <Text style={styles.infoRow}>
                <span style={styles.infoLabel}>Frecuencia</span>
                <span style={styles.infoValue}>{interval}</span>
              </Text>
              <Text style={styles.infoRow}>
                <span style={styles.infoLabel}>Primer cobro</span>
                <span style={styles.infoValue}>{startDate}</span>
              </Text>
            </Section>

            <Text style={styles.text}>
              Recibirás la factura correspondiente por email después de cada cobro.
            </Text>
          </Section>

          <Section style={styles.portalSection}>
            <Text style={{ ...styles.text, marginBottom: '16px' }}>
              Puedes cancelar o gestionar tu suscripción en cualquier momento desde el portal del cliente:
            </Text>
            <Section style={{ textAlign: 'center' }}>
              <Button href={portalUrl} style={styles.button}>Gestionar suscripción</Button>
            </Section>
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Este email ha sido enviado por <strong>{companyName}</strong> mediante FacturX.
              Si tienes alguna duda, responde a este correo o contacta directamente con {companyName}.
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
  header: { backgroundColor: '#7c3aed', padding: '28px 32px' },
  headerTitle: { color: '#ffffff', fontSize: '22px', fontWeight: '700', margin: '0 0 4px 0' },
  headerSub: { color: '#ddd6fe', fontSize: '14px', margin: '0' },
  section: { padding: '20px 32px' },
  text: { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 12px 0' },
  infoBox: { backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '4px 16px', margin: '16px 0' },
  infoRow: { fontSize: '14px', color: '#374151', margin: '10px 0', display: 'flex' as const, justifyContent: 'space-between' as const },
  infoLabel: { color: '#6b7280' },
  infoValue: { fontWeight: '700' as const, color: '#111827' },
  portalSection: { padding: '4px 32px 24px' },
  button: { backgroundColor: '#7c3aed', color: '#ffffff', fontSize: '15px', fontWeight: '700', borderRadius: '8px', padding: '12px 32px', textDecoration: 'none', display: 'inline-block' },
  hr: { borderColor: '#e5e7eb', margin: '0' },
  footer: { backgroundColor: '#f9fafb', padding: '16px 32px' },
  footerText: { fontSize: '12px', color: '#9ca3af', margin: '0', textAlign: 'center' as const },
}
