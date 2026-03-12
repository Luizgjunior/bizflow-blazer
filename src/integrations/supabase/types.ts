export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      automations: {
        Row: {
          ativa: boolean
          created_at: string
          frequencia: string
          icp_id: string
          id: string
          proxima_execucao: string | null
          tenant_id: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          frequencia?: string
          icp_id: string
          id?: string
          proxima_execucao?: string | null
          tenant_id: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          frequencia?: string
          icp_id?: string
          id?: string
          proxima_execucao?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_icp_id_fkey"
            columns: ["icp_id"]
            isOneToOne: false
            referencedRelation: "icps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_activities: {
        Row: {
          created_at: string
          deal_id: string
          descricao: string
          id: string
          metadata: Json | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          descricao: string
          id?: string
          metadata?: Json | null
          tenant_id: string
          tipo?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          descricao?: string
          id?: string
          metadata?: Json | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          closed_at: string | null
          cnpj: string | null
          contato_nome: string | null
          created_at: string
          ganho: boolean
          id: string
          lead_id: string | null
          notas: string | null
          perdido: boolean
          stage_id: string
          telefone: string | null
          tenant_id: string
          titulo: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          closed_at?: string | null
          cnpj?: string | null
          contato_nome?: string | null
          created_at?: string
          ganho?: boolean
          id?: string
          lead_id?: string | null
          notas?: string | null
          perdido?: boolean
          stage_id: string
          telefone?: string | null
          tenant_id: string
          titulo: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          closed_at?: string | null
          cnpj?: string | null
          contato_nome?: string | null
          created_at?: string
          ganho?: boolean
          id?: string
          lead_id?: string | null
          notas?: string | null
          perdido?: boolean
          stage_id?: string
          telefone?: string | null
          tenant_id?: string
          titulo?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipeline_stages: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
          posicao: number
          tenant_id: string
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          nome: string
          posicao?: number
          tenant_id: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          posicao?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipeline_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_contacts: {
        Row: {
          campaign_id: string
          created_at: string
          email: string
          error_message: string | null
          id: string
          lead_id: string | null
          nome: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          nome?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          nome?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          assunto: string
          created_at: string
          enviados: number
          falhas: number
          finished_at: string | null
          id: string
          mensagem: string | null
          nome: string
          started_at: string | null
          status: string
          tenant_id: string
          total_contatos: number
          use_ai_variations: boolean
        }
        Insert: {
          assunto?: string
          created_at?: string
          enviados?: number
          falhas?: number
          finished_at?: string | null
          id?: string
          mensagem?: string | null
          nome: string
          started_at?: string | null
          status?: string
          tenant_id: string
          total_contatos?: number
          use_ai_variations?: boolean
        }
        Update: {
          assunto?: string
          created_at?: string
          enviados?: number
          falhas?: number
          finished_at?: string | null
          id?: string
          mensagem?: string | null
          nome?: string
          started_at?: string | null
          status?: string
          tenant_id?: string
          total_contatos?: number
          use_ai_variations?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exports: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          rows_count: number
          run_id: string
          tenant_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          rows_count?: number
          run_id: string
          tenant_id: string
          tipo?: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          rows_count?: number
          run_id?: string
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "exports_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      icps: {
        Row: {
          created_at: string
          id: string
          nome: string
          payload_json: Json
          tenant_id: string
          versao: number
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          payload_json?: Json
          tenant_id: string
          versao?: number
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          payload_json?: Json
          tenant_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "icps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          cnae_principal: string | null
          cnpj: string
          created_at: string
          data_abertura: string | null
          id: string
          municipio: string | null
          notas: string | null
          raw_json: Json | null
          razao_social: string
          run_id: string | null
          score: number | null
          situacao: string | null
          tags: string[] | null
          tenant_id: string
          uf: string | null
        }
        Insert: {
          cnae_principal?: string | null
          cnpj: string
          created_at?: string
          data_abertura?: string | null
          id?: string
          municipio?: string | null
          notas?: string | null
          raw_json?: Json | null
          razao_social: string
          run_id?: string | null
          score?: number | null
          situacao?: string | null
          tags?: string[] | null
          tenant_id: string
          uf?: string | null
        }
        Update: {
          cnae_principal?: string | null
          cnpj?: string
          created_at?: string
          data_abertura?: string | null
          id?: string
          municipio?: string | null
          notas?: string | null
          raw_json?: Json | null
          razao_social?: string
          run_id?: string | null
          score?: number | null
          situacao?: string | null
          tags?: string[] | null
          tenant_id?: string
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          nome?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          casadosdados_job_id: string | null
          created_at: string
          error_json: Json | null
          finished_at: string | null
          icp_id: string
          id: string
          requested_at: string
          status: string
          tenant_id: string
          total_leads: number
        }
        Insert: {
          casadosdados_job_id?: string | null
          created_at?: string
          error_json?: Json | null
          finished_at?: string | null
          icp_id: string
          id?: string
          requested_at?: string
          status?: string
          tenant_id: string
          total_leads?: number
        }
        Update: {
          casadosdados_job_id?: string | null
          created_at?: string
          error_json?: Json | null
          finished_at?: string | null
          icp_id?: string
          id?: string
          requested_at?: string
          status?: string
          tenant_id?: string
          total_leads?: number
        }
        Relationships: [
          {
            foreignKeyName: "runs_icp_id_fkey"
            columns: ["icp_id"]
            isOneToOne: false
            referencedRelation: "icps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_conversations: {
        Row: {
          created_at: string
          id: string
          status: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          ativo: boolean
          cakto_customer_email: string | null
          cakto_subscription_id: string | null
          created_at: string
          id: string
          limites_consulta: number
          nome: string
          plano: string
          stripe_customer_id: string | null
          stripe_status: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          ativo?: boolean
          cakto_customer_email?: string | null
          cakto_subscription_id?: string | null
          created_at?: string
          id?: string
          limites_consulta?: number
          nome: string
          plano?: string
          stripe_customer_id?: string | null
          stripe_status?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          ativo?: boolean
          cakto_customer_email?: string | null
          cakto_subscription_id?: string | null
          created_at?: string
          id?: string
          limites_consulta?: number
          nome?: string
          plano?: string
          stripe_customer_id?: string | null
          stripe_status?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_tokens: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          tenant_id: string
          token: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          tenant_id: string
          token?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaign_contacts: {
        Row: {
          campaign_id: string
          cnpj: string | null
          created_at: string
          error_message: string | null
          id: string
          lead_id: string | null
          nome: string | null
          sent_at: string | null
          status: string
          telefone: string
        }
        Insert: {
          campaign_id: string
          cnpj?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          nome?: string | null
          sent_at?: string | null
          status?: string
          telefone: string
        }
        Update: {
          campaign_id?: string
          cnpj?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          nome?: string | null
          sent_at?: string | null
          status?: string
          telefone?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaign_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaign_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaigns: {
        Row: {
          created_at: string
          enviados: number
          falhas: number
          finished_at: string | null
          id: string
          media_type: string | null
          media_url: string | null
          mensagem: string | null
          nome: string
          started_at: string | null
          status: string
          tenant_id: string
          tipo: string
          total_contatos: number
          use_ai_variations: boolean
        }
        Insert: {
          created_at?: string
          enviados?: number
          falhas?: number
          finished_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          mensagem?: string | null
          nome: string
          started_at?: string | null
          status?: string
          tenant_id: string
          tipo?: string
          total_contatos?: number
          use_ai_variations?: boolean
        }
        Update: {
          created_at?: string
          enviados?: number
          falhas?: number
          finished_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          mensagem?: string | null
          nome?: string
          started_at?: string | null
          status?: string
          tenant_id?: string
          tipo?: string
          total_contatos?: number
          use_ai_variations?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          created_at: string
          id: string
          instance_name: string
          instance_token: string | null
          phone_number: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_name: string
          instance_token?: string | null
          phone_number?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_name?: string
          instance_token?: string | null
          phone_number?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_tenant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_global: { Args: never; Returns: boolean }
      is_tenant_member: { Args: { _tenant_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin_global" | "empresa"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin_global", "empresa"],
    },
  },
} as const
