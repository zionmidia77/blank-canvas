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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_usage_logs: {
        Row: {
          created_at: string
          function_name: string
          id: string
          tokens_used: number | null
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          tokens_used?: number | null
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          tokens_used?: number | null
        }
        Relationships: []
      }
      bot_configs: {
        Row: {
          bot_id: string | null
          bot_type: string | null
          created_at: string
          delay_seconds: number
          dry_mode: boolean
          facebook_account: string | null
          id: string
          is_active: boolean
          last_heartbeat_at: string | null
          last_reset_at: string | null
          last_run_at: string | null
          leads_captured_today: number
          max_per_cycle: number
          platform: string
          schedule_time: string | null
          seller_email: string | null
          seller_name: string
          updated_at: string
        }
        Insert: {
          bot_id?: string | null
          bot_type?: string | null
          created_at?: string
          delay_seconds?: number
          dry_mode?: boolean
          facebook_account?: string | null
          id?: string
          is_active?: boolean
          last_heartbeat_at?: string | null
          last_reset_at?: string | null
          last_run_at?: string | null
          leads_captured_today?: number
          max_per_cycle?: number
          platform?: string
          schedule_time?: string | null
          seller_email?: string | null
          seller_name: string
          updated_at?: string
        }
        Update: {
          bot_id?: string | null
          bot_type?: string | null
          created_at?: string
          delay_seconds?: number
          dry_mode?: boolean
          facebook_account?: string | null
          id?: string
          is_active?: boolean
          last_heartbeat_at?: string | null
          last_reset_at?: string | null
          last_run_at?: string | null
          leads_captured_today?: number
          max_per_cycle?: number
          platform?: string
          schedule_time?: string | null
          seller_email?: string | null
          seller_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      bot_logs: {
        Row: {
          bot_config_id: string
          client_id: string | null
          contact_name: string | null
          created_at: string
          error: string | null
          event_type: string
          id: string
          lead_created: boolean
          message_in: string | null
          message_out: string | null
          platform: string
        }
        Insert: {
          bot_config_id: string
          client_id?: string | null
          contact_name?: string | null
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          lead_created?: boolean
          message_in?: string | null
          message_out?: string | null
          platform?: string
        }
        Update: {
          bot_config_id?: string
          client_id?: string | null
          contact_name?: string | null
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          lead_created?: boolean
          message_in?: string | null
          message_out?: string | null
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_logs_bot_config_id_fkey"
            columns: ["bot_config_id"]
            isOneToOne: false
            referencedRelation: "bot_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_posting_queue: {
        Row: {
          created_at: string
          error_msg: string | null
          id: string
          local_bot_id: string
          posted_at: string | null
          scheduled_for: string | null
          status: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          error_msg?: string | null
          id?: string
          local_bot_id: string
          posted_at?: string | null
          scheduled_for?: string | null
          status?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          error_msg?: string | null
          id?: string
          local_bot_id?: string
          posted_at?: string | null
          scheduled_for?: string | null
          status?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_posting_queue_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "stock_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      cadence_steps: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          id: string
          pipeline_stage: string
          scheduled_for: string
          skipped: boolean
          step_number: number
          task_id: string | null
          template_id: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          pipeline_stage: string
          scheduled_for: string
          skipped?: boolean
          step_number: number
          task_id?: string | null
          template_id: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          pipeline_stage?: string
          scheduled_for?: string
          skipped?: boolean
          step_number?: number
          task_id?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadence_steps_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_steps_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "cadence_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      cadence_templates: {
        Row: {
          action_type: string
          created_at: string
          delay_days: number
          id: string
          is_active: boolean
          pipeline_stage: string
          step_number: number
          suggested_message: string | null
          task_reason: string
        }
        Insert: {
          action_type?: string
          created_at?: string
          delay_days?: number
          id?: string
          is_active?: boolean
          pipeline_stage: string
          step_number: number
          suggested_message?: string | null
          task_reason: string
        }
        Update: {
          action_type?: string
          created_at?: string
          delay_days?: number
          id?: string
          is_active?: boolean
          pipeline_stage?: string
          step_number?: number
          suggested_message?: string | null
          task_reason?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          messages: Json
          session_id: string
          status: string
          transferred_at: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          messages?: Json
          session_id: string
          status?: string
          transferred_at?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          messages?: Json
          session_id?: string
          status?: string
          transferred_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tag_assignments: {
        Row: {
          client_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_tag_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "client_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address_cep: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          approval_probability: number | null
          arsenal_score: number
          birth_city: string | null
          birthdate: string | null
          budget_range: string | null
          churn_risk: number | null
          city: string | null
          client_promise: string | null
          client_promise_due: string | null
          client_promise_status:
            | Database["public"]["Enums"]["client_promise_status"]
            | null
          cnh_category: string | null
          cnh_number: string | null
          cpf: string | null
          created_at: string
          credit_status: Database["public"]["Enums"]["credit_status"] | null
          deal_type: Database["public"]["Enums"]["deal_type"] | null
          deal_value: number | null
          dependents: number | null
          docs_status: Database["public"]["Enums"]["docs_status"] | null
          down_payment_amount: number | null
          education_level: string | null
          email: string | null
          employer: string | null
          employer_address: string | null
          employer_cep: string | null
          employer_cnpj: string | null
          employer_phone: string | null
          employment_time: string | null
          estimated_margin: number | null
          father_name: string | null
          financing_docs: Json | null
          financing_status: string | null
          funnel_data: Json | null
          gender: string | null
          gross_income: number | null
          has_clean_credit: boolean | null
          has_down_payment: boolean | null
          has_trade_in: boolean | null
          housing_type: string | null
          id: string
          interest: string | null
          last_contact_at: string | null
          lead_score: number
          loss_notes: string | null
          loss_reason: Database["public"]["Enums"]["loss_reason"] | null
          marital_status: string | null
          mother_name: string | null
          name: string
          next_action: string | null
          next_action_due: string | null
          next_action_type:
            | Database["public"]["Enums"]["next_action_type"]
            | null
          notes: string | null
          objection_type: Database["public"]["Enums"]["objection_type"] | null
          payment_type: string | null
          phone: string | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"]
          position: string | null
          priority_score: number | null
          profession: string | null
          queue_reason: string | null
          reference_name: string | null
          reference_name_2: string | null
          reference_phone: string | null
          reference_phone_2: string | null
          reference_relation: string | null
          reference_relation_2: string | null
          referred_by: string | null
          residence_time: string | null
          response_time_hours: number | null
          rg: string | null
          rg_issuer: string | null
          salary: number | null
          source: string | null
          status: Database["public"]["Enums"]["client_status"]
          substatus: Database["public"]["Enums"]["client_substatus"] | null
          temperature: Database["public"]["Enums"]["lead_temperature"]
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          address_cep?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          approval_probability?: number | null
          arsenal_score?: number
          birth_city?: string | null
          birthdate?: string | null
          budget_range?: string | null
          churn_risk?: number | null
          city?: string | null
          client_promise?: string | null
          client_promise_due?: string | null
          client_promise_status?:
            | Database["public"]["Enums"]["client_promise_status"]
            | null
          cnh_category?: string | null
          cnh_number?: string | null
          cpf?: string | null
          created_at?: string
          credit_status?: Database["public"]["Enums"]["credit_status"] | null
          deal_type?: Database["public"]["Enums"]["deal_type"] | null
          deal_value?: number | null
          dependents?: number | null
          docs_status?: Database["public"]["Enums"]["docs_status"] | null
          down_payment_amount?: number | null
          education_level?: string | null
          email?: string | null
          employer?: string | null
          employer_address?: string | null
          employer_cep?: string | null
          employer_cnpj?: string | null
          employer_phone?: string | null
          employment_time?: string | null
          estimated_margin?: number | null
          father_name?: string | null
          financing_docs?: Json | null
          financing_status?: string | null
          funnel_data?: Json | null
          gender?: string | null
          gross_income?: number | null
          has_clean_credit?: boolean | null
          has_down_payment?: boolean | null
          has_trade_in?: boolean | null
          housing_type?: string | null
          id?: string
          interest?: string | null
          last_contact_at?: string | null
          lead_score?: number
          loss_notes?: string | null
          loss_reason?: Database["public"]["Enums"]["loss_reason"] | null
          marital_status?: string | null
          mother_name?: string | null
          name: string
          next_action?: string | null
          next_action_due?: string | null
          next_action_type?:
            | Database["public"]["Enums"]["next_action_type"]
            | null
          notes?: string | null
          objection_type?: Database["public"]["Enums"]["objection_type"] | null
          payment_type?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          position?: string | null
          priority_score?: number | null
          profession?: string | null
          queue_reason?: string | null
          reference_name?: string | null
          reference_name_2?: string | null
          reference_phone?: string | null
          reference_phone_2?: string | null
          reference_relation?: string | null
          reference_relation_2?: string | null
          referred_by?: string | null
          residence_time?: string | null
          response_time_hours?: number | null
          rg?: string | null
          rg_issuer?: string | null
          salary?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          substatus?: Database["public"]["Enums"]["client_substatus"] | null
          temperature?: Database["public"]["Enums"]["lead_temperature"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          address_cep?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          approval_probability?: number | null
          arsenal_score?: number
          birth_city?: string | null
          birthdate?: string | null
          budget_range?: string | null
          churn_risk?: number | null
          city?: string | null
          client_promise?: string | null
          client_promise_due?: string | null
          client_promise_status?:
            | Database["public"]["Enums"]["client_promise_status"]
            | null
          cnh_category?: string | null
          cnh_number?: string | null
          cpf?: string | null
          created_at?: string
          credit_status?: Database["public"]["Enums"]["credit_status"] | null
          deal_type?: Database["public"]["Enums"]["deal_type"] | null
          deal_value?: number | null
          dependents?: number | null
          docs_status?: Database["public"]["Enums"]["docs_status"] | null
          down_payment_amount?: number | null
          education_level?: string | null
          email?: string | null
          employer?: string | null
          employer_address?: string | null
          employer_cep?: string | null
          employer_cnpj?: string | null
          employer_phone?: string | null
          employment_time?: string | null
          estimated_margin?: number | null
          father_name?: string | null
          financing_docs?: Json | null
          financing_status?: string | null
          funnel_data?: Json | null
          gender?: string | null
          gross_income?: number | null
          has_clean_credit?: boolean | null
          has_down_payment?: boolean | null
          has_trade_in?: boolean | null
          housing_type?: string | null
          id?: string
          interest?: string | null
          last_contact_at?: string | null
          lead_score?: number
          loss_notes?: string | null
          loss_reason?: Database["public"]["Enums"]["loss_reason"] | null
          marital_status?: string | null
          mother_name?: string | null
          name?: string
          next_action?: string | null
          next_action_due?: string | null
          next_action_type?:
            | Database["public"]["Enums"]["next_action_type"]
            | null
          notes?: string | null
          objection_type?: Database["public"]["Enums"]["objection_type"] | null
          payment_type?: string | null
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          position?: string | null
          priority_score?: number | null
          profession?: string | null
          queue_reason?: string | null
          reference_name?: string | null
          reference_name_2?: string | null
          reference_phone?: string | null
          reference_phone_2?: string | null
          reference_relation?: string | null
          reference_relation_2?: string | null
          referred_by?: string | null
          residence_time?: string | null
          response_time_hours?: number | null
          rg?: string | null
          rg_issuer?: string | null
          salary?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          substatus?: Database["public"]["Enums"]["client_substatus"] | null
          temperature?: Database["public"]["Enums"]["lead_temperature"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "stock_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_verifications: {
        Row: {
          address: string | null
          client_id: string
          cnpj: string | null
          cnpj_validated: boolean | null
          company_name: string | null
          created_at: string
          employer_name: string | null
          extracted_data: Json | null
          founded_year: string | null
          id: string
          legal_nature: string | null
          location: string | null
          positive_flags: Json | null
          reliability_score: number | null
          risk_flags: Json | null
          sector: string | null
          share_capital: number | null
          size: string | null
          source: string | null
          status: string | null
          trading_name: string | null
          verified: boolean | null
        }
        Insert: {
          address?: string | null
          client_id: string
          cnpj?: string | null
          cnpj_validated?: boolean | null
          company_name?: string | null
          created_at?: string
          employer_name?: string | null
          extracted_data?: Json | null
          founded_year?: string | null
          id?: string
          legal_nature?: string | null
          location?: string | null
          positive_flags?: Json | null
          reliability_score?: number | null
          risk_flags?: Json | null
          sector?: string | null
          share_capital?: number | null
          size?: string | null
          source?: string | null
          status?: string | null
          trading_name?: string | null
          verified?: boolean | null
        }
        Update: {
          address?: string | null
          client_id?: string
          cnpj?: string | null
          cnpj_validated?: boolean | null
          company_name?: string | null
          created_at?: string
          employer_name?: string | null
          extracted_data?: Json | null
          founded_year?: string | null
          id?: string
          legal_nature?: string | null
          location?: string | null
          positive_flags?: Json | null
          reliability_score?: number | null
          risk_flags?: Json | null
          sector?: string | null
          share_capital?: number | null
          size?: string | null
          source?: string | null
          status?: string | null
          trading_name?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "employer_verifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      exclusive_offers: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number | null
          id: string
          is_active: boolean
          target_segment: string
          title: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean
          target_segment?: string
          title: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean
          target_segment?: string
          title?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      financing_simulations: {
        Row: {
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          down_payment: number
          financed_amount: number
          id: string
          interest_rate: number
          monthly_payment: number
          months: number
          moto_value: number
          source: string
          status: string
          total_interest: number
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          down_payment?: number
          financed_amount: number
          id?: string
          interest_rate?: number
          monthly_payment: number
          months: number
          moto_value: number
          source?: string
          status?: string
          total_interest?: number
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          down_payment?: number
          financed_amount?: number
          id?: string
          interest_rate?: number
          monthly_payment?: number
          months?: number
          moto_value?: number
          source?: string
          status?: string
          total_interest?: number
        }
        Relationships: [
          {
            foreignKeyName: "financing_simulations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          client_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          type?: Database["public"]["Enums"]["interaction_type"]
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          type?: Database["public"]["Enums"]["interaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_memory: {
        Row: {
          ai_tags: string[] | null
          behavior_patterns: string[] | null
          client_id: string
          created_at: string
          decisions: string[] | null
          id: string
          interests: string[] | null
          last_analyzed_at: string | null
          lead_temperature_ai: string | null
          objections: string[] | null
          recommended_action: string | null
          recommended_message: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          ai_tags?: string[] | null
          behavior_patterns?: string[] | null
          client_id: string
          created_at?: string
          decisions?: string[] | null
          id?: string
          interests?: string[] | null
          last_analyzed_at?: string | null
          lead_temperature_ai?: string | null
          objections?: string[] | null
          recommended_action?: string | null
          recommended_message?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          ai_tags?: string[] | null
          behavior_patterns?: string[] | null
          client_id?: string
          created_at?: string
          decisions?: string[] | null
          id?: string
          interests?: string[] | null
          last_analyzed_at?: string | null
          lead_temperature_ai?: string | null
          objections?: string[] | null
          recommended_action?: string | null
          recommended_message?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_memory_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_timeline_events: {
        Row: {
          client_id: string
          content: string
          created_at: string
          event_type: Database["public"]["Enums"]["timeline_event_type"]
          id: string
          metadata: Json | null
          source: string
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          event_type: Database["public"]["Enums"]["timeline_event_type"]
          id?: string
          metadata?: Json | null
          source?: string
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["timeline_event_type"]
          id?: string
          metadata?: Json | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_timeline_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          category: string
          created_at: string
          emoji: string | null
          id: string
          message: string
          title: string
          usage_count: number
          variables: string[] | null
        }
        Insert: {
          category: string
          created_at?: string
          emoji?: string | null
          id?: string
          message: string
          title: string
          usage_count?: number
          variables?: string[] | null
        }
        Update: {
          category?: string
          created_at?: string
          emoji?: string | null
          id?: string
          message?: string
          title?: string
          usage_count?: number
          variables?: string[] | null
        }
        Relationships: []
      }
      messages_sent: {
        Row: {
          channel: string
          client_id: string
          id: string
          message_content: string
          sent_at: string
          template_id: string | null
        }
        Insert: {
          channel?: string
          client_id: string
          id?: string
          message_content: string
          sent_at?: string
          template_id?: string | null
        }
        Update: {
          channel?: string
          client_id?: string
          id?: string
          message_content?: string
          sent_at?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_sent_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sent_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_goals: {
        Row: {
          created_at: string
          id: string
          month: number
          target_contacts: number
          target_leads: number
          target_ltv: number
          target_revenue: number
          target_sales: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          target_contacts?: number
          target_leads?: number
          target_ltv?: number
          target_revenue?: number
          target_sales?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          target_contacts?: number
          target_leads?: number
          target_ltv?: number
          target_revenue?: number
          target_sales?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      nps_responses: {
        Row: {
          client_id: string
          created_at: string
          feedback: string | null
          id: string
          score: number
        }
        Insert: {
          client_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          score: number
        }
        Update: {
          client_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "nps_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_claims: {
        Row: {
          claimed_at: string
          client_id: string
          id: string
          offer_id: string
        }
        Insert: {
          claimed_at?: string
          client_id: string
          id?: string
          offer_id: string
        }
        Update: {
          claimed_at?: string
          client_id?: string
          id?: string
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_claims_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_claims_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "exclusive_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          acted_at: string | null
          client_id: string
          created_at: string
          id: string
          message: string | null
          priority: number
          status: string
          title: string
          type: Database["public"]["Enums"]["opportunity_type"]
        }
        Insert: {
          acted_at?: string | null
          client_id: string
          created_at?: string
          id?: string
          message?: string | null
          priority?: number
          status?: string
          title: string
          type: Database["public"]["Enums"]["opportunity_type"]
        }
        Update: {
          acted_at?: string | null
          client_id?: string
          created_at?: string
          id?: string
          message?: string | null
          priority?: number
          status?: string
          title?: string
          type?: Database["public"]["Enums"]["opportunity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_client_id: string | null
          referred_name: string | null
          referred_phone: string | null
          referrer_id: string
          reward_amount: number | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referred_client_id?: string | null
          referred_name?: string | null
          referred_phone?: string | null
          referrer_id: string
          reward_amount?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referred_client_id?: string | null
          referred_name?: string | null
          referred_phone?: string | null
          referrer_id?: string
          reward_amount?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_client_id_fkey"
            columns: ["referred_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_automations: {
        Row: {
          created_at: string | null
          days_inactive: number
          id: string
          is_active: boolean
          last_reset_at: string | null
          max_sends_per_day: number
          message_template: string
          name: string
          sends_today: number
          target_segment: string
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          days_inactive?: number
          id?: string
          is_active?: boolean
          last_reset_at?: string | null
          max_sends_per_day?: number
          message_template: string
          name: string
          sends_today?: number
          target_segment?: string
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          days_inactive?: number
          id?: string
          is_active?: boolean
          last_reset_at?: string | null
          max_sends_per_day?: number
          message_template?: string
          name?: string
          sends_today?: number
          target_segment?: string
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          client_id: string
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          message: string
          phone: string
          sent_at: string | null
          smsdev_id: string | null
          status: string
          template_key: string | null
          trigger_type: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message: string
          phone: string
          sent_at?: string | null
          smsdev_id?: string | null
          status?: string
          template_key?: string | null
          trigger_type?: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message?: string
          phone?: string
          sent_at?: string | null
          smsdev_id?: string | null
          status?: string
          template_key?: string | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_vehicles: {
        Row: {
          brand: string
          chassis: string | null
          color: string | null
          condition: string
          created_at: string
          description: string | null
          documents_cost: number | null
          features: string[] | null
          fipe_brand_code: string | null
          fipe_model_code: string | null
          fipe_updated_at: string | null
          fipe_value: number | null
          fipe_vehicle_type: string | null
          fipe_year_code: string | null
          fuel: string | null
          id: string
          image_url: string | null
          km: number | null
          local_bot_id: string | null
          model: string
          photos: string[] | null
          plate: string | null
          price: number
          purchase_date: string | null
          purchase_price: number | null
          renavam: string | null
          seller_name: string | null
          seller_phone: string | null
          selling_price: number | null
          status: string
          total_costs: number | null
          updated_at: string
          year: number | null
        }
        Insert: {
          brand: string
          chassis?: string | null
          color?: string | null
          condition?: string
          created_at?: string
          description?: string | null
          documents_cost?: number | null
          features?: string[] | null
          fipe_brand_code?: string | null
          fipe_model_code?: string | null
          fipe_updated_at?: string | null
          fipe_value?: number | null
          fipe_vehicle_type?: string | null
          fipe_year_code?: string | null
          fuel?: string | null
          id?: string
          image_url?: string | null
          km?: number | null
          local_bot_id?: string | null
          model: string
          photos?: string[] | null
          plate?: string | null
          price: number
          purchase_date?: string | null
          purchase_price?: number | null
          renavam?: string | null
          seller_name?: string | null
          seller_phone?: string | null
          selling_price?: number | null
          status?: string
          total_costs?: number | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          brand?: string
          chassis?: string | null
          color?: string | null
          condition?: string
          created_at?: string
          description?: string | null
          documents_cost?: number | null
          features?: string[] | null
          fipe_brand_code?: string | null
          fipe_model_code?: string | null
          fipe_updated_at?: string | null
          fipe_value?: number | null
          fipe_vehicle_type?: string | null
          fipe_year_code?: string | null
          fuel?: string | null
          id?: string
          image_url?: string | null
          km?: number | null
          local_bot_id?: string | null
          model?: string
          photos?: string[] | null
          plate?: string | null
          price?: number
          purchase_date?: string | null
          purchase_price?: number | null
          renavam?: string | null
          seller_name?: string | null
          seller_phone?: string | null
          selling_price?: number | null
          status?: string
          total_costs?: number | null
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          due_date: string
          id: string
          max_retries: number | null
          notes: string | null
          priority: number | null
          reason: string
          retry_count: number | null
          scheduled_time: string | null
          source: string | null
          status: string
          type: Database["public"]["Enums"]["task_type"]
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          max_retries?: number | null
          notes?: string | null
          priority?: number | null
          reason: string
          retry_count?: number | null
          scheduled_time?: string | null
          source?: string | null
          status?: string
          type?: Database["public"]["Enums"]["task_type"]
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          max_retries?: number | null
          notes?: string | null
          priority?: number | null
          reason?: string
          retry_count?: number | null
          scheduled_time?: string | null
          source?: string | null
          status?: string
          type?: Database["public"]["Enums"]["task_type"]
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      vehicle_costs: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          date: string | null
          description: string
          id: string
          vehicle_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string | null
          date?: string | null
          description: string
          id?: string
          vehicle_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          date?: string | null
          description?: string
          id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "stock_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string
          client_id: string
          created_at: string
          estimated_value: number | null
          id: string
          installments_paid: number | null
          installments_total: number | null
          is_financed: boolean | null
          km: number | null
          model: string
          monthly_payment: number | null
          status: Database["public"]["Enums"]["vehicle_status"]
          updated_at: string
          year: number | null
        }
        Insert: {
          brand: string
          client_id: string
          created_at?: string
          estimated_value?: number | null
          id?: string
          installments_paid?: number | null
          installments_total?: number | null
          is_financed?: boolean | null
          km?: number | null
          model: string
          monthly_payment?: number | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          year?: number | null
        }
        Update: {
          brand?: string
          client_id?: string
          created_at?: string
          estimated_value?: number | null
          id?: string
          installments_paid?: number | null
          installments_total?: number | null
          is_financed?: boolean | null
          km?: number | null
          model?: string
          monthly_payment?: number | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_cadence: { Args: never; Returns: undefined }
      auto_birthday_alerts: { Args: never; Returns: undefined }
      auto_checkin_schedule: { Args: never; Returns: undefined }
      auto_cool_leads: { Args: never; Returns: undefined }
      auto_escalate_stale_leads: { Args: never; Returns: undefined }
      auto_revision_reminders: { Args: never; Returns: undefined }
      auto_upgrade_alerts: { Args: never; Returns: undefined }
      calculate_churn_risk: {
        Args: { client_id_param: string }
        Returns: number
      }
      calculate_lead_score: {
        Args: { client_id_param: string }
        Returns: number
      }
      calculate_priority_score: {
        Args: { client_id_param: string }
        Returns: number
      }
      calculate_queue_reason: {
        Args: { client_id_param: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      start_cadence: {
        Args: { p_client_id: string; p_pipeline_stage: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      client_promise_status: "pending" | "overdue" | "fulfilled" | "broken"
      client_status: "lead" | "active" | "inactive" | "lost"
      client_substatus:
        | "active"
        | "scheduled"
        | "waiting_client"
        | "thinking"
        | "no_response"
        | "docs_pending"
      credit_status:
        | "pending"
        | "submitted"
        | "approved"
        | "denied"
        | "renegotiating"
      deal_type:
        | "cash"
        | "financing_down"
        | "financing_full"
        | "trade_financing"
        | "trade_only"
      docs_status: "incomplete" | "collecting" | "complete"
      interaction_type:
        | "whatsapp"
        | "call"
        | "visit"
        | "system"
        | "email"
        | "sms"
      lead_temperature: "hot" | "warm" | "cold" | "frozen"
      loss_reason:
        | "price_too_high"
        | "no_down_payment"
        | "installment_too_high"
        | "credit_denied"
        | "bought_elsewhere"
        | "better_offer"
        | "trade_value_disagreement"
        | "ghosted"
        | "postponed"
        | "changed_mind"
        | "vehicle_sold"
        | "slow_response"
        | "other"
      next_action_type:
        | "call"
        | "send_proposal"
        | "send_message"
        | "collect_docs"
        | "follow_up"
        | "schedule_visit"
        | "submit_credit"
        | "wait_client"
        | "close_deal"
        | "send_content"
      objection_type:
        | "price"
        | "down_payment"
        | "installment"
        | "credit"
        | "trust"
        | "comparison"
        | "trade_undervalued"
        | "indecision"
        | "timing"
        | "none"
      opportunity_type:
        | "trade"
        | "refinance"
        | "upsell"
        | "reactivation"
        | "birthday"
        | "milestone"
      pipeline_stage:
        | "new"
        | "contacted"
        | "interested"
        | "negotiating"
        | "closed_won"
        | "closed_lost"
        | "attending"
        | "thinking"
        | "waiting_response"
        | "scheduled"
        | "proposal_sent"
        | "financing_analysis"
        | "approved"
        | "rejected"
        | "reactivation"
        | "first_contact"
        | "qualification"
        | "proposal"
        | "negotiation"
        | "closing"
      task_type: "opportunity" | "relationship" | "value" | "follow_up"
      timeline_event_type:
        | "message_sent"
        | "message_received"
        | "whatsapp_paste"
        | "status_change"
        | "proposal_sent"
        | "document_uploaded"
        | "ai_analysis"
        | "inactivity_detected"
        | "note"
        | "call"
        | "visit"
      vehicle_status: "current" | "sold" | "traded"
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
      app_role: ["admin", "moderator", "user"],
      client_promise_status: ["pending", "overdue", "fulfilled", "broken"],
      client_status: ["lead", "active", "inactive", "lost"],
      client_substatus: [
        "active",
        "scheduled",
        "waiting_client",
        "thinking",
        "no_response",
        "docs_pending",
      ],
      credit_status: [
        "pending",
        "submitted",
        "approved",
        "denied",
        "renegotiating",
      ],
      deal_type: [
        "cash",
        "financing_down",
        "financing_full",
        "trade_financing",
        "trade_only",
      ],
      docs_status: ["incomplete", "collecting", "complete"],
      interaction_type: ["whatsapp", "call", "visit", "system", "email", "sms"],
      lead_temperature: ["hot", "warm", "cold", "frozen"],
      loss_reason: [
        "price_too_high",
        "no_down_payment",
        "installment_too_high",
        "credit_denied",
        "bought_elsewhere",
        "better_offer",
        "trade_value_disagreement",
        "ghosted",
        "postponed",
        "changed_mind",
        "vehicle_sold",
        "slow_response",
        "other",
      ],
      next_action_type: [
        "call",
        "send_proposal",
        "send_message",
        "collect_docs",
        "follow_up",
        "schedule_visit",
        "submit_credit",
        "wait_client",
        "close_deal",
        "send_content",
      ],
      objection_type: [
        "price",
        "down_payment",
        "installment",
        "credit",
        "trust",
        "comparison",
        "trade_undervalued",
        "indecision",
        "timing",
        "none",
      ],
      opportunity_type: [
        "trade",
        "refinance",
        "upsell",
        "reactivation",
        "birthday",
        "milestone",
      ],
      pipeline_stage: [
        "new",
        "contacted",
        "interested",
        "negotiating",
        "closed_won",
        "closed_lost",
        "attending",
        "thinking",
        "waiting_response",
        "scheduled",
        "proposal_sent",
        "financing_analysis",
        "approved",
        "rejected",
        "reactivation",
        "first_contact",
        "qualification",
        "proposal",
        "negotiation",
        "closing",
      ],
      task_type: ["opportunity", "relationship", "value", "follow_up"],
      timeline_event_type: [
        "message_sent",
        "message_received",
        "whatsapp_paste",
        "status_change",
        "proposal_sent",
        "document_uploaded",
        "ai_analysis",
        "inactivity_detected",
        "note",
        "call",
        "visit",
      ],
      vehicle_status: ["current", "sold", "traded"],
    },
  },
} as const
