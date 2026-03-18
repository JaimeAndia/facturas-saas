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
          stripe_account_id: string | null
          stripe_account_status: 'not_connected' | 'pending' | 'active' | 'restricted' | null
          plan: 'free' | 'basico' | 'pro'
          plan_status: 'active' | 'canceled' | 'past_due' | 'trialing' | null
          xrpl_address: string | null
          xrpl_addon: boolean | null
          /** NUNCA seleccionar ni exponer en responses — cifrado AES-256-GCM */
          xrpl_seed_encrypted: string | null
          iban: string | null
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
          stripe_account_id?: string | null
          stripe_account_status?: 'not_connected' | 'pending' | 'active' | 'restricted' | null
          plan?: 'free' | 'basico' | 'pro'
          plan_status?: 'active' | 'canceled' | 'past_due' | 'trialing' | null
          xrpl_address?: string | null
          xrpl_addon?: boolean | null
          xrpl_seed_encrypted?: string | null
          iban?: string | null
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
          stripe_customer_id: string | null
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
          stripe_customer_id?: string | null
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
          payment_link_url: string | null
          payment_token: string | null
          paid_at: string | null
          blockchain_hash: string | null
          blockchain_tx: string | null
          blockchain_ledger: number | null
          blockchain_registered_at: string | null
          reminders_sent: number
          last_reminder_at: string | null
          source: string | null
          cancel_deadline: string | null
          factura_recurrente_id: string | null
          stripe_invoice_id: string | null
          xrpl_created_tx: string | null
          xrpl_paid_tx: string | null
          xrpl_overdue_tx: string | null
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
          payment_link_url?: string | null
          payment_token?: string | null
          paid_at?: string | null
          blockchain_hash?: string | null
          blockchain_tx?: string | null
          blockchain_ledger?: number | null
          blockchain_registered_at?: string | null
          reminders_sent?: number
          last_reminder_at?: string | null
          source?: string | null
          cancel_deadline?: string | null
          factura_recurrente_id?: string | null
          stripe_invoice_id?: string | null
          xrpl_created_tx?: string | null
          xrpl_paid_tx?: string | null
          xrpl_overdue_tx?: string | null
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
      subscriptions: {
        Row: {
          id: string
          created_at: string
          user_id: string
          cliente_id: string
          stripe_subscription_id: string | null
          stripe_product_id: string | null
          stripe_price_id: string | null
          stripe_customer_id: string | null
          gocardless_subscription_id: string | null
          plan_name: string
          amount: number
          currency: string
          interval: string
          status: string
          next_billing_date: string | null
          payment_method: string
          cancelled_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          cliente_id: string
          stripe_subscription_id?: string | null
          stripe_product_id?: string | null
          stripe_price_id?: string | null
          stripe_customer_id?: string | null
          gocardless_subscription_id?: string | null
          plan_name: string
          amount: number
          currency?: string
          interval: string
          status?: string
          next_billing_date?: string | null
          payment_method?: string
          cancelled_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>
      }
      facturas_recurrentes: {
        Row: {
          id: string
          created_at: string
          user_id: string
          factura_base_id: string
          frecuencia: string
          proxima_fecha: string
          activo: boolean
          ultima_generacion: string | null
          cancel_token: string
          cobro_automatico: boolean
          cobro_status: 'manual' | 'pending_setup' | 'active' | 'past_due' | 'canceled'
          stripe_subscription_id: string | null
          stripe_customer_id: string | null
          stripe_price_id: string | null
          setup_url: string | null
        }
        Insert: {
          id?: string
          user_id: string
          factura_base_id: string
          frecuencia: string
          proxima_fecha: string
          activo?: boolean
          ultima_generacion?: string | null
          cancel_token?: string
          cobro_automatico?: boolean
          cobro_status?: 'manual' | 'pending_setup' | 'active' | 'past_due' | 'canceled'
          stripe_subscription_id?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          setup_url?: string | null
        }
        Update: Partial<Database['public']['Tables']['facturas_recurrentes']['Insert']>
      }
      notificaciones: {
        Row: {
          id: string
          created_at: string
          user_id: string
          tipo: string
          mensaje: string
          leida: boolean
          metadata: Record<string, unknown> | null
        }
        Insert: {
          id?: string
          user_id: string
          tipo: string
          mensaje: string
          leida?: boolean
          metadata?: Record<string, unknown> | null
        }
        Update: Partial<Database['public']['Tables']['notificaciones']['Insert']>
      }
      app_config: {
        Row: {
          key: string
          value: string
          updated_at: string
        }
        Insert: {
          key: string
          value: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['app_config']['Insert']>
      }
      xrpl_events: {
        Row: {
          id: string
          created_at: string
          user_id: string
          invoice_id: string | null
          subscription_id: string | null
          event_type: 'invoice_created' | 'invoice_sent' | 'invoice_paid' | 'invoice_overdue' | 'invoice_cancelled' | 'invoice_seal' | 'subscription_created' | 'subscription_payment' | 'subscription_failed' | 'subscription_cancelled' | 'dispute_opened' | 'dispute_resolved'
          xrpl_tx: string | null
          xrpl_ledger: number | null
          xrpl_status: 'pending' | 'confirmed' | 'failed'
          payload: Json | null
          error_message: string | null
          confirmed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          invoice_id?: string | null
          subscription_id?: string | null
          event_type: 'invoice_created' | 'invoice_sent' | 'invoice_paid' | 'invoice_overdue' | 'invoice_cancelled' | 'invoice_seal' | 'subscription_created' | 'subscription_payment' | 'subscription_failed' | 'subscription_cancelled' | 'dispute_opened' | 'dispute_resolved'
          xrpl_tx?: string | null
          xrpl_ledger?: number | null
          xrpl_status?: 'pending' | 'confirmed' | 'failed'
          payload?: Json | null
          error_message?: string | null
          confirmed_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['xrpl_events']['Insert']>
      }
      blockchain_events: {
        Row: {
          id: string
          created_at: string
          user_id: string
          factura_id: string | null
          event_type: 'emision' | 'pago' | 'cancelacion' | 'vencimiento' | 'generacion_recurrente'
          tx_hash: string
          ledger: number | null
          invoice_hash: string | null
          factura_numero: string | null
          factura_total: number | null
          cliente_nombre: string | null
        }
        Insert: {
          id?: string
          user_id: string
          factura_id?: string | null
          event_type: 'emision' | 'pago' | 'cancelacion' | 'vencimiento' | 'generacion_recurrente'
          tx_hash: string
          ledger?: number | null
          invoice_hash?: string | null
          factura_numero?: string | null
          factura_total?: number | null
          cliente_nombre?: string | null
        }
        Update: Partial<Database['public']['Tables']['blockchain_events']['Insert']>
      }
      payment_logs: {
        Row: {
          id: string
          created_at: string
          invoice_id: string
          event_type: string
          provider: string
          provider_event_id: string | null
          amount: number
          status: string
          raw_payload: Json | null
          xrpl_settlement_tx: string | null
          xrpl_settlement_status: 'not_applicable' | 'pending' | 'settled' | 'failed'
          xrpl_settled_at: string | null
        }
        Insert: {
          id?: string
          invoice_id: string
          event_type: string
          provider: string
          provider_event_id?: string | null
          amount: number
          status: string
          raw_payload?: Json | null
          xrpl_settlement_tx?: string | null
          xrpl_settlement_status?: 'not_applicable' | 'pending' | 'settled' | 'failed'
          xrpl_settled_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['payment_logs']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
