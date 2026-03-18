import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pago de factura',
}

// Layout mínimo para las páginas públicas de pago — sin navegación del dashboard
export default function PayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}
