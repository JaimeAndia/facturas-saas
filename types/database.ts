// Tipos generados de la base de datos de Supabase
// Se actualizarán conforme se creen las tablas

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          email: string
          nombre: string | null
          apellidos: string | null
          nif: string | null
          direccion: string | null
          ciudad: string | null
          codigo_postal: string | null
          provincia: string | null
          telefono: string | null
          logo_url: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          plan: 'free' | 'basico' | 'pro'
          plan_status: 'active' | 'canceled' | 'past_due' | 'trialing' | null
        }
        Insert: {
          id: string
          email: string
          nombre?: string | null
          apellidos?: string | null
          nif?: string | null
          direccion?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          provincia?: string | null
          telefono?: string | null
          logo_url?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          plan?: 'free' | 'basico' | 'pro'
          plan_status?: 'active' | 'canceled' | 'past_due' | 'trialing' | null
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      clientes: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          user_id: string
          nombre: string
          nif: string | null
          email: string | null
          telefono: string | null
          direccion: string | null
          ciudad: string | null
          codigo_postal: string | null
          provincia: string | null
          pais: string
          notas: string | null
        }
        Insert: {
          id?: string
          user_id: string
          nombre: string
          nif?: string | null
          email?: string | null
          telefono?: string | null
          direccion?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          provincia?: string | null
          pais?: string
          notas?: string | null
        }
        Update: Partial<Database['public']['Tables']['clientes']['Insert']>
      }
      facturas: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          user_id: string
          cliente_id: string
          numero: string
          fecha_emision: string
          fecha_vencimiento: string | null
          estado: 'borrador' | 'emitida' | 'pagada' | 'vencida' | 'cancelada'
          base_imponible: number
          iva_porcentaje: number
          iva_importe: number
          irpf_porcentaje: number
          irpf_importe: number
          total: number
          notas: string | null
          pdf_url: string | null
          fecha_envio: string | null
        }
        Insert: {
          id?: string
          user_id: string
          cliente_id: string
          numero: string
          fecha_emision: string
          fecha_vencimiento?: string | null
          estado?: 'borrador' | 'emitida' | 'pagada' | 'vencida' | 'cancelada'
          base_imponible: number
          iva_porcentaje?: number
          iva_importe: number
          irpf_porcentaje?: number
          irpf_importe: number
          total: number
          notas?: string | null
          pdf_url?: string | null
          fecha_envio?: string | null
        }
        Update: Partial<Database['public']['Tables']['facturas']['Insert']>
      }
      lineas_factura: {
        Row: {
          id: string
          factura_id: string
          descripcion: string
          cantidad: number
          precio_unitario: number
          subtotal: number
          orden: number
        }
        Insert: {
          id?: string
          factura_id: string
          descripcion: string
          cantidad: number
          precio_unitario: number
          subtotal: number
          orden?: number
        }
        Update: Partial<Database['public']['Tables']['lineas_factura']['Insert']>
      }
      facturas_recurrentes: {
        Row: {
          id: string
          created_at: string
          user_id: string
          factura_base_id: string
          frecuencia: 'mensual' | 'trimestral' | 'anual'
          proxima_fecha: string
          activo: boolean
          ultima_generacion: string | null
        }
        Insert: {
          id?: string
          user_id: string
          factura_base_id: string
          frecuencia: 'mensual' | 'trimestral' | 'anual'
          proxima_fecha: string
          activo?: boolean
          ultima_generacion?: string | null
        }
        Update: Partial<Database['public']['Tables']['facturas_recurrentes']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
