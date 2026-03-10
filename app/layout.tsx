import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
})

export const metadata: Metadata = {
  title: 'FacturApp — Facturación para autónomos',
  description: 'Crea y gestiona tus facturas de forma sencilla. Diseñado para autónomos españoles.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={`${geist.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
