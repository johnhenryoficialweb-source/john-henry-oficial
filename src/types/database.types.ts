/**
 * Tipos de la base de datos Supabase, escritos a mano para reflejar
 * supabase/migrations/*.sql mientras no hay un proyecto Supabase enlazado.
 *
 * Reemplazar este archivo por el generado con:
 *   supabase gen types typescript --linked > src/types/database.types.ts
 * una vez el esquema esté aplicado contra un proyecto real (ver README).
 *
 * `Relationships: []` y `Functions: {}` son obligatorios para que el tipo
 * satisfaga `GenericSchema` de @supabase/postgrest-js; sin ellos, todas las
 * queries de supabase-js infieren `never` silenciosamente.
 */

export type UserRole = "admin" | "staff";
export type CurrencyCode = "COP" | "USD";
export type GarmentType = "saco" | "chaleco" | "camisa" | "pantalon" | "otro";
export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";
export type AppointmentSource = "public_form" | "cms";
export type OrderStatus =
  | "draft"
  | "confirmed"
  | "in_production"
  | "ready_for_delivery"
  | "delivered"
  | "cancelled";
export type PaymentMethod = "cash" | "card" | "transfer" | "other";
export type MeasurementSource = "profile" | "order_snapshot";
export type MeasurementUnit = "cm" | "in";
export type ExpenseKind = "fixed" | "sporadic";
/** Quién recibe la orden de trabajo. Ver 0035_workshop_recipients.sql. */
export type WorkshopRecipientRole = "tailor" | "sales" | "fabric_supplier";
export type RoyaltyStatus = "pending" | "paid";

export interface Database {
  public: {
    Tables: {
      locations: {
        Row: {
          id: string;
          code: string;
          name: string;
          country: string;
          currency: CurrencyCode;
          timezone: string;
          address: string | null;
          phone: string | null;
          google_calendar_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["locations"]["Row"]> & {
          code: string;
          name: string;
          country: string;
          currency: CurrencyCode;
          timezone: string;
        };
        Update: Partial<Database["public"]["Tables"]["locations"]["Row"]>;
        Relationships: [];
      };
      staff_users: {
        Row: {
          id: string;
          location_id: string | null;
          role: UserRole;
          full_name: string;
          email: string;
          phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["staff_users"]["Row"]> & {
          id: string;
          full_name: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_users"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "staff_users_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          id: string;
          home_location_id: string;
          full_name: string;
          email: string | null;
          phone: string;
          document_id: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          import_source_key: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["clients"]["Row"]> & {
          home_location_id: string;
          full_name: string;
          phone: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "clients_home_location_id_fkey";
            columns: ["home_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      fabrics: {
        Row: {
          id: string;
          code: string | null;
          name: string;
          color: string | null;
          composition: string | null;
          supplier: string | null;
          fabric_type: string | null;
          price_per_meter: number | null;
          price_currency: CurrencyCode;
          price_cop: number | null;
          price_usd: number | null;
          image_url: string | null;
          stock_meters: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fabrics"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["fabrics"]["Row"]>;
        Relationships: [];
      };
      garment_models: {
        Row: {
          id: string;
          garment_type: GarmentType;
          name: string;
          code: string | null;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["garment_models"]["Row"]> & {
          garment_type: GarmentType;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["garment_models"]["Row"]>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string | null;
          location_id: string;
          client_id: string;
          currency: CurrencyCode | null;
          exchange_rate_to_usd: number;
          status: OrderStatus;
          expected_delivery_date: string | null;
          assigned_staff_id: string | null;
          subtotal: number;
          discount: number;
          total: number;
          notes: string | null;
          created_by: string | null;
          import_source_key: string | null;
          /** Papelera de órdenes (migración 0036). */
          deleted_at: string | null;
          deleted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["orders"]["Row"]> & {
          location_id: string;
          client_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "orders_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      client_measurements: {
        Row: {
          id: string;
          client_id: string;
          garment_type: GarmentType;
          values: Record<string, number>;
          unit: MeasurementUnit;
          notes: string | null;
          source: MeasurementSource;
          order_id: string | null;
          is_latest: boolean;
          taken_by: string | null;
          taken_at: string;
          created_at: string;
          import_source_key: string | null;
        };
        Insert: Partial<
          Database["public"]["Tables"]["client_measurements"]["Row"]
        > & {
          client_id: string;
          garment_type: GarmentType;
        };
        Update: Partial<
          Database["public"]["Tables"]["client_measurements"]["Row"]
        >;
        Relationships: [
          {
            foreignKeyName: "client_measurements_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          garment_type: GarmentType;
          fabric_id: string | null;
          garment_model_id: string | null;
          measurement_id: string | null;
          quantity: number;
          unit_price: number;
          item_discount: number;
          line_total: number;
          unit_cost: number;
          line_cost: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["order_items"]["Row"]> & {
          order_id: string;
          garment_type: GarmentType;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_fabric_id_fkey";
            columns: ["fabric_id"];
            isOneToOne: false;
            referencedRelation: "fabrics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_garment_model_id_fkey";
            columns: ["garment_model_id"];
            isOneToOne: false;
            referencedRelation: "garment_models";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_measurement_id_fkey";
            columns: ["measurement_id"];
            isOneToOne: false;
            referencedRelation: "client_measurements";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_channels: {
        Row: {
          id: string;
          code: string | null;
          name: string;
          method: PaymentMethod;
          /** Porcentaje que retiene el datáfono o la pasarela. */
          fee_percent: number;
          /** Costo fijo por transacción, en la moneda del pago. */
          fee_fixed: number;
          /** null = disponible en todas las sedes. */
          location_id: string | null;
          notes: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["payment_channels"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_channels"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "payment_channels_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          amount: number;
          currency: CurrencyCode;
          method: PaymentMethod;
          channel_id: string | null;
          /** Comisión congelada al registrar el pago (ver 0033). */
          fee_percent: number;
          fee_amount: number;
          /** Columna generada: amount − fee_amount. */
          net_amount: number;
          paid_at: string;
          reference: string | null;
          recorded_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["payments"]["Row"]> & {
          order_id: string;
          amount: number;
          currency: CurrencyCode;
          method: PaymentMethod;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "payment_channels";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          id: string;
          location_id: string;
          client_id: string;
          staff_user_id: string | null;
          appointment_type: string;
          starts_at: string;
          ends_at: string;
          status: AppointmentStatus;
          notes: string | null;
          google_calendar_event_id: string | null;
          created_via: AppointmentSource;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["appointments"]["Row"]> & {
          location_id: string;
          client_id: string;
          starts_at: string;
          ends_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["appointments"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "appointments_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      availability_slots: {
        Row: {
          id: string;
          location_id: string;
          staff_user_id: string | null;
          day_of_week: number | null;
          specific_date: string | null;
          start_time: string;
          end_time: string;
          slot_duration_minutes: number;
          is_blocked: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["availability_slots"]["Row"]
        > & {
          location_id: string;
          start_time: string;
          end_time: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["availability_slots"]["Row"]
        >;
        Relationships: [];
      };
      settings: {
        Row: {
          key: string;
          value: Record<string, unknown>;
          description: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["settings"]["Row"]> & {
          key: string;
          value: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["settings"]["Row"]>;
        Relationships: [];
      };
      expense_categories: {
        Row: {
          id: string;
          name: string;
          code: string | null;
          kind: ExpenseKind;
          description: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["expense_categories"]["Row"]
        > & {
          name: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["expense_categories"]["Row"]
        >;
        Relationships: [];
      };
      recurring_expenses: {
        Row: {
          id: string;
          location_id: string;
          category_id: string;
          description: string;
          amount: number;
          currency: CurrencyCode;
          day_of_month: number;
          method: PaymentMethod;
          vendor: string | null;
          notes: string | null;
          is_active: boolean;
          starts_on: string;
          ends_on: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["recurring_expenses"]["Row"]
        > & {
          location_id: string;
          category_id: string;
          description: string;
          amount: number;
          currency: CurrencyCode;
        };
        Update: Partial<
          Database["public"]["Tables"]["recurring_expenses"]["Row"]
        >;
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          id: string;
          location_id: string;
          category_id: string | null;
          description: string;
          amount: number;
          currency: CurrencyCode;
          exchange_rate_to_usd: number;
          expense_date: string;
          method: PaymentMethod;
          vendor: string | null;
          reference: string | null;
          notes: string | null;
          recurring_expense_id: string | null;
          period_key: string | null;
          recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["expenses"]["Row"]> & {
          location_id: string;
          description: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "expenses_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      garment_base_costs: {
        Row: {
          id: string;
          garment_type: GarmentType;
          garment_model_id: string | null;
          location_id: string | null;
          currency: CurrencyCode;
          fabric_cost: number;
          labor_cost: number;
          overhead_cost: number;
          total_cost: number;
          notes: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["garment_base_costs"]["Row"]
        > & {
          garment_type: GarmentType;
          currency: CurrencyCode;
        };
        Update: Partial<
          Database["public"]["Tables"]["garment_base_costs"]["Row"]
        >;
        Relationships: [
          {
            foreignKeyName: "garment_base_costs_garment_model_id_fkey";
            columns: ["garment_model_id"];
            isOneToOne: false;
            referencedRelation: "garment_models";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "garment_base_costs_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      royalty_settlements: {
        Row: {
          id: string;
          period_start: string;
          period_end: string;
          source_location_id: string;
          beneficiary_location_id: string;
          percent: number;
          base_amount: number;
          base_currency: CurrencyCode;
          exchange_rate_to_usd: number;
          amount: number;
          amount_usd: number;
          status: RoyaltyStatus;
          paid_at: string | null;
          reference: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["royalty_settlements"]["Row"]
        > & {
          period_start: string;
          period_end: string;
          source_location_id: string;
          beneficiary_location_id: string;
          percent: number;
          base_currency: CurrencyCode;
        };
        Update: Partial<
          Database["public"]["Tables"]["royalty_settlements"]["Row"]
        >;
        Relationships: [
          {
            foreignKeyName: "royalty_settlements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "royalty_settlements_beneficiary_location_id_fkey";
            columns: ["beneficiary_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      email_templates: {
        Row: {
          /** Corresponde a EmailTemplateKey en src/lib/email/registry.ts. */
          key: string;
          subject: string | null;
          heading: string | null;
          intro: string | null;
          outro: string | null;
          cta_label: string | null;
          is_enabled: boolean;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["email_templates"]["Row"]> & {
          key: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_templates"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "email_templates_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "staff_users";
            referencedColumns: ["id"];
          },
        ];
      };
      email_log: {
        Row: {
          id: string;
          template_key: string;
          recipient: string;
          subject: string;
          status: "sent" | "failed" | "skipped";
          error: string | null;
          provider_message_id: string | null;
          /** Distingue el envío real del botón «enviar prueba». */
          is_test: boolean;
          order_id: string | null;
          appointment_id: string | null;
          triggered_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["email_log"]["Row"]> & {
          template_key: string;
          recipient: string;
          subject: string;
          status: "sent" | "failed" | "skipped";
        };
        Update: Partial<Database["public"]["Tables"]["email_log"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "email_log_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_log_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      workshop_recipients: {
        Row: {
          id: string;
          /** null = recibe las órdenes de trabajo de todas las sedes. */
          location_id: string | null;
          role: WorkshopRecipientRole;
          name: string;
          email: string;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["workshop_recipients"]["Row"]> & {
          role: WorkshopRecipientRole;
          name: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["workshop_recipients"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "workshop_recipients_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_orders_consolidated: {
        Row: Database["public"]["Tables"]["orders"]["Row"] & {
          total_usd: number;
        };
        Relationships: [];
      };
      v_payments_consolidated: {
        Row: Database["public"]["Tables"]["payments"]["Row"] & {
          amount_usd: number;
        };
        Relationships: [];
      };
      v_expenses_consolidated: {
        Row: Database["public"]["Tables"]["expenses"]["Row"] & {
          amount_usd: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      currency_code: CurrencyCode;
      garment_type: GarmentType;
      appointment_status: AppointmentStatus;
      appointment_source: AppointmentSource;
      order_status: OrderStatus;
      payment_method: PaymentMethod;
      measurement_source: MeasurementSource;
      measurement_unit: MeasurementUnit;
      expense_kind: ExpenseKind;
      royalty_status: RoyaltyStatus;
    };
  };
}
