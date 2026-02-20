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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      account_lockouts: {
        Row: {
          created_at: string | null
          email: string | null
          failed_attempts: number | null
          id: string
          locked_until: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          failed_attempts?: number | null
          id?: string
          locked_until?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          failed_attempts?: number | null
          id?: string
          locked_until?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      admin_activity_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_logs_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          admin_user_id: string
          created_at: string
          id: string
          incident_id: string | null
          message: string
          notification_type: string | null
          priority: string | null
          read_at: string | null
          title: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          id?: string
          incident_id?: string | null
          message: string
          notification_type?: string | null
          priority?: string | null
          read_at?: string | null
          title: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          id?: string
          incident_id?: string | null
          message?: string
          notification_type?: string | null
          priority?: string | null
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "security_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_action_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_action_executions: {
        Row: {
          action_instance_id: string
          completed_at: string | null
          conversation_id: string | null
          error_details: string | null
          execution_status: Database["public"]["Enums"]["execution_status"]
          execution_time_ms: number | null
          id: string
          input_data: Json | null
          output_data: Json | null
          triggered_at: string
          user_id: string | null
        }
        Insert: {
          action_instance_id: string
          completed_at?: string | null
          conversation_id?: string | null
          error_details?: string | null
          execution_status: Database["public"]["Enums"]["execution_status"]
          execution_time_ms?: number | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          triggered_at?: string
          user_id?: string | null
        }
        Update: {
          action_instance_id?: string
          completed_at?: string | null
          conversation_id?: string | null
          error_details?: string | null
          execution_status?: Database["public"]["Enums"]["execution_status"]
          execution_time_ms?: number | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          triggered_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_executions_action_instance_id_fkey"
            columns: ["action_instance_id"]
            isOneToOne: false
            referencedRelation: "ai_action_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_action_executions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_action_instances: {
        Row: {
          action_type: Database["public"]["Enums"]["ai_action_type"]
          chatbot_id: string | null
          configuration: Json
          created_at: string
          description: string | null
          error_message: string | null
          id: string
          is_enabled: boolean | null
          last_used_at: string | null
          name: string
          status: Database["public"]["Enums"]["ai_action_status"] | null
          success_message: string | null
          template_id: string | null
          updated_at: string
          usage_count: number | null
          user_id: string
          when_to_use: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["ai_action_type"]
          chatbot_id?: string | null
          configuration?: Json
          created_at?: string
          description?: string | null
          error_message?: string | null
          id?: string
          is_enabled?: boolean | null
          last_used_at?: string | null
          name: string
          status?: Database["public"]["Enums"]["ai_action_status"] | null
          success_message?: string | null
          template_id?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id: string
          when_to_use: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["ai_action_type"]
          chatbot_id?: string | null
          configuration?: Json
          created_at?: string
          description?: string | null
          error_message?: string | null
          id?: string
          is_enabled?: boolean | null
          last_used_at?: string | null
          name?: string
          status?: Database["public"]["Enums"]["ai_action_status"] | null
          success_message?: string | null
          template_id?: string | null
          updated_at?: string
          usage_count?: number | null
          user_id?: string
          when_to_use?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_instances_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_action_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "ai_action_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_action_templates: {
        Row: {
          action_type: Database["public"]["Enums"]["ai_action_type"]
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          instructions_template: string | null
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          status: string
          template_config: Json
          updated_at: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["ai_action_type"]
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          instructions_template?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          status?: string
          template_config?: Json
          updated_at?: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["ai_action_type"]
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          instructions_template?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          status?: string
          template_config?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ai_action_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_action_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_results: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_favorite: boolean | null
          labels: string[] | null
          metadata: Json | null
          organization_id: string | null
          original_text: string
          processing_time_ms: number | null
          result_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          labels?: string[] | null
          metadata?: Json | null
          organization_id?: string | null
          original_text: string
          processing_time_ms?: number | null
          result_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          labels?: string[] | null
          metadata?: Json | null
          organization_id?: string | null
          original_text?: string
          processing_time_ms?: number | null
          result_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_integrations: {
        Row: {
          auth_config: Json | null
          created_at: string
          endpoint_url: string
          error_message: string | null
          headers: Json | null
          http_method: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          name: string
          record_count: number | null
          status: string | null
          sync_interval_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_config?: Json | null
          created_at?: string
          endpoint_url: string
          error_message?: string | null
          headers?: Json | null
          http_method?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name: string
          record_count?: number | null
          status?: string | null
          sync_interval_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_config?: Json | null
          created_at?: string
          endpoint_url?: string
          error_message?: string | null
          headers?: Json | null
          http_method?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name?: string
          record_count?: number | null
          status?: string | null
          sync_interval_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          admin_only: boolean
          created_at: string
          created_by_admin: boolean
          encrypted_key: string
          id: string
          is_active: boolean | null
          key_name: string
          organization_id: string | null
          scope: Database["public"]["Enums"]["api_key_scope"]
          service_name: string
          tier: Database["public"]["Enums"]["api_key_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_only?: boolean
          created_at?: string
          created_by_admin?: boolean
          encrypted_key: string
          id?: string
          is_active?: boolean | null
          key_name: string
          organization_id?: string | null
          scope?: Database["public"]["Enums"]["api_key_scope"]
          service_name: string
          tier?: Database["public"]["Enums"]["api_key_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_only?: boolean
          created_at?: string
          created_by_admin?: boolean
          encrypted_key?: string
          id?: string
          is_active?: boolean | null
          key_name?: string
          organization_id?: string | null
          scope?: Database["public"]["Enums"]["api_key_scope"]
          service_name?: string
          tier?: Database["public"]["Enums"]["api_key_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_configurations: {
        Row: {
          backup_name: string
          backup_schedule: Json | null
          backup_type: string
          compression_enabled: boolean
          created_at: string
          created_by: string | null
          encryption_enabled: boolean
          frequency: string
          id: string
          is_active: boolean
          last_backup_at: string | null
          last_backup_size_bytes: number | null
          last_backup_status: string | null
          notification_settings: Json | null
          retention_period_days: number
          storage_location: string
          updated_at: string
        }
        Insert: {
          backup_name: string
          backup_schedule?: Json | null
          backup_type: string
          compression_enabled?: boolean
          created_at?: string
          created_by?: string | null
          encryption_enabled?: boolean
          frequency: string
          id?: string
          is_active?: boolean
          last_backup_at?: string | null
          last_backup_size_bytes?: number | null
          last_backup_status?: string | null
          notification_settings?: Json | null
          retention_period_days?: number
          storage_location: string
          updated_at?: string
        }
        Update: {
          backup_name?: string
          backup_schedule?: Json | null
          backup_type?: string
          compression_enabled?: boolean
          created_at?: string
          created_by?: string | null
          encryption_enabled?: boolean
          frequency?: string
          id?: string
          is_active?: boolean
          last_backup_at?: string | null
          last_backup_size_bytes?: number | null
          last_backup_status?: string | null
          notification_settings?: Json | null
          retention_period_days?: number
          storage_location?: string
          updated_at?: string
        }
        Relationships: []
      }
      backup_execution_logs: {
        Row: {
          backup_config_id: string
          backup_location: string | null
          backup_size_bytes: number | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          execution_details: Json | null
          execution_id: string
          id: string
          started_at: string
          status: string
          verification_status: string | null
        }
        Insert: {
          backup_config_id: string
          backup_location?: string | null
          backup_size_bytes?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_details?: Json | null
          execution_id: string
          id?: string
          started_at?: string
          status?: string
          verification_status?: string | null
        }
        Update: {
          backup_config_id?: string
          backup_location?: string | null
          backup_size_bytes?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_details?: Json | null
          execution_id?: string
          id?: string
          started_at?: string
          status?: string
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backup_execution_logs_backup_config_id_fkey"
            columns: ["backup_config_id"]
            isOneToOne: false
            referencedRelation: "backup_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          created_at: string
          data: Json | null
          event_type: string
          id: string
          processed_at: string | null
          stripe_event_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json | null
          event_type: string
          id?: string
          processed_at?: string | null
          stripe_event_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json | null
          event_type?: string
          id?: string
          processed_at?: string | null
          stripe_event_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bot_templates: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          template_data: Json
          updated_at: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          template_data: Json
          updated_at?: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          template_data?: Json
          updated_at?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      business_continuity_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          description: string | null
          id: string
          implementation_steps: Json | null
          last_tested_at: string | null
          next_review_date: string | null
          owner_id: string | null
          plan_name: string
          plan_type: string
          priority: string
          resources_required: Json | null
          rollback_procedures: Json | null
          status: string
          success_criteria: Json | null
          test_results: Json | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          implementation_steps?: Json | null
          last_tested_at?: string | null
          next_review_date?: string | null
          owner_id?: string | null
          plan_name: string
          plan_type: string
          priority?: string
          resources_required?: Json | null
          rollback_procedures?: Json | null
          status?: string
          success_criteria?: Json | null
          test_results?: Json | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          implementation_steps?: Json | null
          last_tested_at?: string | null
          next_review_date?: string | null
          owner_id?: string | null
          plan_name?: string
          plan_type?: string
          priority?: string
          resources_required?: Json | null
          rollback_procedures?: Json | null
          status?: string
          success_criteria?: Json | null
          test_results?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      business_intelligence_reports: {
        Row: {
          created_at: string
          embedded_chatbot_id: string | null
          id: string
          insights: Json | null
          is_active: boolean | null
          last_generated_at: string | null
          next_generation_at: string | null
          recipients: Json | null
          report_config: Json
          report_data: Json | null
          report_name: string
          report_type: string
          schedule_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          embedded_chatbot_id?: string | null
          id?: string
          insights?: Json | null
          is_active?: boolean | null
          last_generated_at?: string | null
          next_generation_at?: string | null
          recipients?: Json | null
          report_config?: Json
          report_data?: Json | null
          report_name: string
          report_type: string
          schedule_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          embedded_chatbot_id?: string | null
          id?: string
          insights?: Json | null
          is_active?: boolean | null
          last_generated_at?: string | null
          next_generation_at?: string | null
          recipients?: Json | null
          report_config?: Json
          report_data?: Json | null
          report_name?: string
          report_type?: string
          schedule_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_intelligence_reports_embedded_chatbot_id_fkey"
            columns: ["embedded_chatbot_id"]
            isOneToOne: false
            referencedRelation: "embedded_chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbots: {
        Row: {
          created_at: string
          description: string | null
          id: string
          industry: string | null
          max_tokens: number | null
          model_name: string | null
          name: string
          organization_id: string | null
          status: Database["public"]["Enums"]["chatbot_status"] | null
          system_prompt: string | null
          temperature: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          max_tokens?: number | null
          model_name?: string | null
          name: string
          organization_id?: string | null
          status?: Database["public"]["Enums"]["chatbot_status"] | null
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          max_tokens?: number | null
          model_name?: string | null
          name?: string
          organization_id?: string | null
          status?: Database["public"]["Enums"]["chatbot_status"] | null
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clean_profiles: {
        Row: {
          avatar_url: string | null
          business_description: string | null
          chat_interface_config: Json | null
          company_name: string | null
          contact_number: string | null
          created_at: string
          default_chatbot_config: Json | null
          default_document_agent_id: string | null
          designation: string | null
          email: string | null
          full_name: string | null
          id: string
          industry: string | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_step: number | null
          role: Database["public"]["Enums"]["app_role"]
          selected_template_id: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          business_description?: string | null
          chat_interface_config?: Json | null
          company_name?: string | null
          contact_number?: string | null
          created_at?: string
          default_chatbot_config?: Json | null
          default_document_agent_id?: string | null
          designation?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          industry?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_step?: number | null
          role?: Database["public"]["Enums"]["app_role"]
          selected_template_id?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          business_description?: string | null
          chat_interface_config?: Json | null
          company_name?: string | null
          contact_number?: string | null
          created_at?: string
          default_chatbot_config?: Json | null
          default_document_agent_id?: string | null
          designation?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          industry?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_step?: number | null
          role?: Database["public"]["Enums"]["app_role"]
          selected_template_id?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      clean_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          current_period_start: string
          features: Json | null
          id: string
          monthly_message_limit: number | null
          monthly_notes_limit: number
          monthly_token_limit: number | null
          plan_name: string
          status: Database["public"]["Enums"]["clean_subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end: string
          current_period_start: string
          features?: Json | null
          id?: string
          monthly_message_limit?: number | null
          monthly_notes_limit?: number
          monthly_token_limit?: number | null
          plan_name?: string
          status?: Database["public"]["Enums"]["clean_subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          features?: Json | null
          id?: string
          monthly_message_limit?: number | null
          monthly_notes_limit?: number
          monthly_token_limit?: number | null
          plan_name?: string
          status?: Database["public"]["Enums"]["clean_subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clean_voice_notes: {
        Row: {
          audio_url: string | null
          created_at: string
          duration_seconds: number | null
          enhanced_content: string | null
          id: string
          organization_id: string | null
          status: Database["public"]["Enums"]["clean_voice_note_status"]
          tags: string[] | null
          title: string
          transcription: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          enhanced_content?: string | null
          id?: string
          organization_id?: string | null
          status?: Database["public"]["Enums"]["clean_voice_note_status"]
          tags?: string[] | null
          title: string
          transcription?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          enhanced_content?: string | null
          id?: string
          organization_id?: string | null
          status?: Database["public"]["Enums"]["clean_voice_note_status"]
          tags?: string[] | null
          title?: string
          transcription?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clean_voice_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_context: {
        Row: {
          confidence_score: number | null
          conversation_id: string
          created_at: string
          document_chunks: string[] | null
          id: string
          message_id: string | null
          retrieval_metadata: Json | null
          vector_ids: string[] | null
        }
        Insert: {
          confidence_score?: number | null
          conversation_id: string
          created_at?: string
          document_chunks?: string[] | null
          id?: string
          message_id?: string | null
          retrieval_metadata?: Json | null
          vector_ids?: string[] | null
        }
        Update: {
          confidence_score?: number | null
          conversation_id?: string
          created_at?: string
          document_chunks?: string[] | null
          id?: string
          message_id?: string | null
          retrieval_metadata?: Json | null
          vector_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_context_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_agent_id: string | null
          chatbot_id: string
          created_at: string
          handoff_requested_at: string | null
          handoff_status: string | null
          id: string
          organization_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_agent_id?: string | null
          chatbot_id: string
          created_at?: string
          handoff_requested_at?: string | null
          handoff_status?: string | null
          id?: string
          organization_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_agent_id?: string | null
          chatbot_id?: string
          created_at?: string
          handoff_requested_at?: string | null
          handoff_status?: string | null
          id?: string
          organization_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "human_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversion_funnel_analytics: {
        Row: {
          created_at: string
          embedded_chatbot_id: string
          funnel_step: string
          id: string
          metadata: Json | null
          page_url: string | null
          referrer_url: string | null
          session_id: string
          step_order: number
          timestamp: string
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          embedded_chatbot_id: string
          funnel_step: string
          id?: string
          metadata?: Json | null
          page_url?: string | null
          referrer_url?: string | null
          session_id: string
          step_order: number
          timestamp?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          embedded_chatbot_id?: string
          funnel_step?: string
          id?: string
          metadata?: Json | null
          page_url?: string | null
          referrer_url?: string | null
          session_id?: string
          step_order?: number
          timestamp?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversion_funnel_analytics_embedded_chatbot_id_fkey"
            columns: ["embedded_chatbot_id"]
            isOneToOne: false
            referencedRelation: "embedded_chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      csv_files: {
        Row: {
          column_headers: string[] | null
          created_at: string
          file_size: number
          filename: string
          id: string
          is_active: boolean | null
          processing_error: string | null
          row_count: number | null
          status: string | null
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          column_headers?: string[] | null
          created_at?: string
          file_size: number
          filename: string
          id?: string
          is_active?: boolean | null
          processing_error?: string | null
          row_count?: number | null
          status?: string | null
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          column_headers?: string[] | null
          created_at?: string
          file_size?: number
          filename?: string
          id?: string
          is_active?: boolean | null
          processing_error?: string | null
          row_count?: number | null
          status?: string | null
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      data_archival_policies: {
        Row: {
          access_controls: Json | null
          archive_after_days: number
          archive_location: string
          auto_archive_enabled: boolean
          compliance_requirements: Json | null
          compression_type: string | null
          created_at: string
          created_by: string | null
          data_type: string
          encryption_required: boolean
          id: string
          is_active: boolean
          next_execution_date: string | null
          policy_name: string
          retention_period_days: number
          updated_at: string
        }
        Insert: {
          access_controls?: Json | null
          archive_after_days: number
          archive_location: string
          auto_archive_enabled?: boolean
          compliance_requirements?: Json | null
          compression_type?: string | null
          created_at?: string
          created_by?: string | null
          data_type: string
          encryption_required?: boolean
          id?: string
          is_active?: boolean
          next_execution_date?: string | null
          policy_name: string
          retention_period_days: number
          updated_at?: string
        }
        Update: {
          access_controls?: Json | null
          archive_after_days?: number
          archive_location?: string
          auto_archive_enabled?: boolean
          compliance_requirements?: Json | null
          compression_type?: string | null
          created_at?: string
          created_by?: string | null
          data_type?: string
          encryption_required?: boolean
          id?: string
          is_active?: boolean
          next_execution_date?: string | null
          policy_name?: string
          retention_period_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      deployment_status: {
        Row: {
          chatbot_id: string
          completed_at: string | null
          created_at: string
          deployment_config: Json | null
          deployment_type: string
          error_message: string | null
          id: string
          logs: Json | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chatbot_id: string
          completed_at?: string | null
          created_at?: string
          deployment_config?: Json | null
          deployment_type: string
          error_message?: string | null
          id?: string
          logs?: Json | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chatbot_id?: string
          completed_at?: string | null
          created_at?: string
          deployment_config?: Json | null
          deployment_type?: string
          error_message?: string | null
          id?: string
          logs?: Json | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployment_status_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      disaster_recovery_procedures: {
        Row: {
          contact_information: Json | null
          created_at: string
          created_by: string | null
          dependencies: Json | null
          disaster_type: string
          estimated_recovery_time_hours: number | null
          id: string
          is_active: boolean
          last_tested_at: string | null
          procedure_name: string
          procedure_steps: Json
          recovery_point_objective_hours: number
          recovery_time_objective_hours: number
          required_resources: Json | null
          responsible_teams: Json | null
          severity_level: string
          test_success_rate: number | null
          testing_schedule: string | null
          updated_at: string
        }
        Insert: {
          contact_information?: Json | null
          created_at?: string
          created_by?: string | null
          dependencies?: Json | null
          disaster_type: string
          estimated_recovery_time_hours?: number | null
          id?: string
          is_active?: boolean
          last_tested_at?: string | null
          procedure_name: string
          procedure_steps?: Json
          recovery_point_objective_hours: number
          recovery_time_objective_hours: number
          required_resources?: Json | null
          responsible_teams?: Json | null
          severity_level: string
          test_success_rate?: number | null
          testing_schedule?: string | null
          updated_at?: string
        }
        Update: {
          contact_information?: Json | null
          created_at?: string
          created_by?: string | null
          dependencies?: Json | null
          disaster_type?: string
          estimated_recovery_time_hours?: number | null
          id?: string
          is_active?: boolean
          last_tested_at?: string | null
          procedure_name?: string
          procedure_steps?: Json
          recovery_point_objective_hours?: number
          recovery_time_objective_hours?: number
          required_resources?: Json | null
          responsible_teams?: Json | null
          severity_level?: string
          test_success_rate?: number | null
          testing_schedule?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      document_processing_config: {
        Row: {
          chunk_overlap: number
          chunk_size: number
          chunking_strategy: string
          created_at: string
          embedding_model: string
          id: string
          n8n_webhook_url: string | null
          processing_strategy: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chunk_overlap?: number
          chunk_size?: number
          chunking_strategy?: string
          created_at?: string
          embedding_model?: string
          id?: string
          n8n_webhook_url?: string | null
          processing_strategy?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chunk_overlap?: number
          chunk_size?: number
          chunking_strategy?: string
          created_at?: string
          embedding_model?: string
          id?: string
          n8n_webhook_url?: string | null
          processing_strategy?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_search_index: {
        Row: {
          chunk_id: string
          created_at: string
          document_id: string
          id: string
          keywords: string[] | null
          metadata: Json | null
          search_text: string
        }
        Insert: {
          chunk_id: string
          created_at?: string
          document_id: string
          id?: string
          keywords?: string[] | null
          metadata?: Json | null
          search_text: string
        }
        Update: {
          chunk_id?: string
          created_at?: string
          document_id?: string
          id?: string
          keywords?: string[] | null
          metadata?: Json | null
          search_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_search_index_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "document_vectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_search_index_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_vectors: {
        Row: {
          chunk_index: number
          chunk_metadata: Json | null
          chunk_text: string
          created_at: string
          document_id: string
          embedding: string | null
          embedding_model: string | null
          id: string
          vector_id: string | null
        }
        Insert: {
          chunk_index: number
          chunk_metadata?: Json | null
          chunk_text: string
          created_at?: string
          document_id: string
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          vector_id?: string | null
        }
        Update: {
          chunk_index?: number
          chunk_metadata?: Json | null
          chunk_text?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          vector_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_vectors_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          chatbot_id: string | null
          chunk_count: number | null
          content_type: string
          created_at: string
          file_size: number
          filename: string
          id: string
          organization_id: string | null
          processing_error: string | null
          processing_metadata: Json | null
          processing_stage: string | null
          status: Database["public"]["Enums"]["document_status"] | null
          storage_path: string
          updated_at: string
          user_id: string
          vector_count: number | null
        }
        Insert: {
          chatbot_id?: string | null
          chunk_count?: number | null
          content_type: string
          created_at?: string
          file_size: number
          filename: string
          id?: string
          organization_id?: string | null
          processing_error?: string | null
          processing_metadata?: Json | null
          processing_stage?: string | null
          status?: Database["public"]["Enums"]["document_status"] | null
          storage_path: string
          updated_at?: string
          user_id: string
          vector_count?: number | null
        }
        Update: {
          chatbot_id?: string | null
          chunk_count?: number | null
          content_type?: string
          created_at?: string
          file_size?: number
          filename?: string
          id?: string
          organization_id?: string | null
          processing_error?: string | null
          processing_metadata?: Json | null
          processing_stage?: string | null
          status?: Database["public"]["Enums"]["document_status"] | null
          storage_path?: string
          updated_at?: string
          user_id?: string
          vector_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      embedded_analytics: {
        Row: {
          avg_conversation_length: number | null
          avg_response_time_ms: number | null
          bounce_rate: number | null
          conversations_started: number
          created_at: string
          date: string
          embedded_chatbot_id: string
          error_count: number
          hour: number | null
          id: string
          messages_sent: number
          total_tokens_used: number
        }
        Insert: {
          avg_conversation_length?: number | null
          avg_response_time_ms?: number | null
          bounce_rate?: number | null
          conversations_started?: number
          created_at?: string
          date: string
          embedded_chatbot_id: string
          error_count?: number
          hour?: number | null
          id?: string
          messages_sent?: number
          total_tokens_used?: number
        }
        Update: {
          avg_conversation_length?: number | null
          avg_response_time_ms?: number | null
          bounce_rate?: number | null
          conversations_started?: number
          created_at?: string
          date?: string
          embedded_chatbot_id?: string
          error_count?: number
          hour?: number | null
          id?: string
          messages_sent?: number
          total_tokens_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "embedded_analytics_embedded_chatbot_id_fkey"
            columns: ["embedded_chatbot_id"]
            isOneToOne: false
            referencedRelation: "embedded_chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      embedded_chatbots: {
        Row: {
          ai_actions_config: Json
          behavior_config: Json
          chatbot_id: string
          created_at: string
          domain_whitelist: string[] | null
          id: string
          is_active: boolean
          is_system_chatbot: boolean | null
          last_accessed_at: string | null
          n8n_workflow_id: string | null
          name: string
          processing_mode: string
          theme_name: string
          total_conversations: number
          total_messages: number
          ui_config: Json
          updated_at: string
          user_id: string
          widget_id: string
        }
        Insert: {
          ai_actions_config?: Json
          behavior_config?: Json
          chatbot_id: string
          created_at?: string
          domain_whitelist?: string[] | null
          id?: string
          is_active?: boolean
          is_system_chatbot?: boolean | null
          last_accessed_at?: string | null
          n8n_workflow_id?: string | null
          name: string
          processing_mode?: string
          theme_name?: string
          total_conversations?: number
          total_messages?: number
          ui_config?: Json
          updated_at?: string
          user_id: string
          widget_id: string
        }
        Update: {
          ai_actions_config?: Json
          behavior_config?: Json
          chatbot_id?: string
          created_at?: string
          domain_whitelist?: string[] | null
          id?: string
          is_active?: boolean
          is_system_chatbot?: boolean | null
          last_accessed_at?: string | null
          n8n_workflow_id?: string | null
          name?: string
          processing_mode?: string
          theme_name?: string
          total_conversations?: number
          total_messages?: number
          ui_config?: Json
          updated_at?: string
          user_id?: string
          widget_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_embedded_chatbots_chatbot_id"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      embedded_conversations: {
        Row: {
          assigned_agent_id: string | null
          country_code: string | null
          created_at: string
          embedded_chatbot_id: string
          first_message_at: string | null
          handoff_requested_at: string | null
          handoff_status: string | null
          id: string
          ip_address: unknown | null
          last_message_at: string | null
          message_count: number
          page_url: string | null
          referrer_url: string | null
          session_id: string
          total_tokens_used: number
          updated_at: string
          user_agent: string | null
          user_id: string | null
          visitor_metadata: Json | null
        }
        Insert: {
          assigned_agent_id?: string | null
          country_code?: string | null
          created_at?: string
          embedded_chatbot_id: string
          first_message_at?: string | null
          handoff_requested_at?: string | null
          handoff_status?: string | null
          id?: string
          ip_address?: unknown | null
          last_message_at?: string | null
          message_count?: number
          page_url?: string | null
          referrer_url?: string | null
          session_id: string
          total_tokens_used?: number
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          visitor_metadata?: Json | null
        }
        Update: {
          assigned_agent_id?: string | null
          country_code?: string | null
          created_at?: string
          embedded_chatbot_id?: string
          first_message_at?: string | null
          handoff_requested_at?: string | null
          handoff_status?: string | null
          id?: string
          ip_address?: unknown | null
          last_message_at?: string | null
          message_count?: number
          page_url?: string | null
          referrer_url?: string | null
          session_id?: string
          total_tokens_used?: number
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          visitor_metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "embedded_conversations_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "human_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embedded_conversations_embedded_chatbot_id_fkey"
            columns: ["embedded_chatbot_id"]
            isOneToOne: false
            referencedRelation: "embedded_chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      embedded_message_feedback: {
        Row: {
          created_at: string
          embedded_message_id: string
          feedback_type: string
          id: string
          metadata: Json | null
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          embedded_message_id: string
          feedback_type: string
          id?: string
          metadata?: Json | null
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          embedded_message_id?: string
          feedback_type?: string
          id?: string
          metadata?: Json | null
          session_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      embedded_messages: {
        Row: {
          ai_action_result: Json | null
          ai_action_used: string | null
          content: string
          created_at: string
          embedded_conversation_id: string
          id: string
          rag_context: Json | null
          response_time_ms: number | null
          role: string
          tokens_used: number | null
        }
        Insert: {
          ai_action_result?: Json | null
          ai_action_used?: string | null
          content: string
          created_at?: string
          embedded_conversation_id: string
          id?: string
          rag_context?: Json | null
          response_time_ms?: number | null
          role: string
          tokens_used?: number | null
        }
        Update: {
          ai_action_result?: Json | null
          ai_action_used?: string | null
          content?: string
          created_at?: string
          embedded_conversation_id?: string
          id?: string
          rag_context?: Json | null
          response_time_ms?: number | null
          role?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "embedded_messages_embedded_conversation_id_fkey"
            columns: ["embedded_conversation_id"]
            isOneToOne: false
            referencedRelation: "embedded_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_response_contacts: {
        Row: {
          availability_hours: string | null
          contact_name: string
          contact_priority: number
          contact_type: string
          created_at: string
          email: string | null
          escalation_level: number
          id: string
          is_active: boolean
          last_contacted_at: string | null
          primary_phone: string | null
          role: string
          secondary_phone: string | null
          specialization: Json | null
          updated_at: string
        }
        Insert: {
          availability_hours?: string | null
          contact_name: string
          contact_priority?: number
          contact_type: string
          created_at?: string
          email?: string | null
          escalation_level?: number
          id?: string
          is_active?: boolean
          last_contacted_at?: string | null
          primary_phone?: string | null
          role: string
          secondary_phone?: string | null
          specialization?: Json | null
          updated_at?: string
        }
        Update: {
          availability_hours?: string | null
          contact_name?: string
          contact_priority?: number
          contact_type?: string
          created_at?: string
          email?: string | null
          escalation_level?: number
          id?: string
          is_active?: boolean
          last_contacted_at?: string | null
          primary_phone?: string | null
          role?: string
          secondary_phone?: string | null
          specialization?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      encrypted_credentials: {
        Row: {
          access_count: number | null
          created_at: string
          credential_name: string
          encrypted_value: string
          encryption_key_id: string
          id: string
          is_active: boolean | null
          last_accessed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_count?: number | null
          created_at?: string
          credential_name: string
          encrypted_value: string
          encryption_key_id: string
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_count?: number | null
          created_at?: string
          credential_name?: string
          encrypted_value?: string
          encryption_key_id?: string
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      form_abandonment_logs: {
        Row: {
          abandoned_at_field: string | null
          abandonment_reason: string | null
          completion_percentage: number | null
          created_at: string
          device_type: string | null
          embedded_chatbot_id: string
          fields_completed: Json | null
          form_start_time: string
          id: string
          last_interaction_time: string
          page_url: string | null
          session_id: string
          time_on_form_seconds: number | null
          total_fields: number | null
          user_agent: string | null
        }
        Insert: {
          abandoned_at_field?: string | null
          abandonment_reason?: string | null
          completion_percentage?: number | null
          created_at?: string
          device_type?: string | null
          embedded_chatbot_id: string
          fields_completed?: Json | null
          form_start_time: string
          id?: string
          last_interaction_time: string
          page_url?: string | null
          session_id: string
          time_on_form_seconds?: number | null
          total_fields?: number | null
          user_agent?: string | null
        }
        Update: {
          abandoned_at_field?: string | null
          abandonment_reason?: string | null
          completion_percentage?: number | null
          created_at?: string
          device_type?: string | null
          embedded_chatbot_id?: string
          fields_completed?: Json | null
          form_start_time?: string
          id?: string
          last_interaction_time?: string
          page_url?: string | null
          session_id?: string
          time_on_form_seconds?: number | null
          total_fields?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_abandonment_logs_embedded_chatbot_id_fkey"
            columns: ["embedded_chatbot_id"]
            isOneToOne: false
            referencedRelation: "embedded_chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      global_ai_agents: {
        Row: {
          agent_type: string
          configuration: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          agent_type?: string
          configuration?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          agent_type?: string
          configuration?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "global_ai_agents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      handoff_requests: {
        Row: {
          assigned_agent_id: string | null
          assigned_at: string | null
          conversation_id: string | null
          created_at: string
          embedded_conversation_id: string | null
          id: string
          metadata: Json | null
          reason: string | null
          requested_by_user: boolean
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          assigned_at?: string | null
          conversation_id?: string | null
          created_at?: string
          embedded_conversation_id?: string | null
          id?: string
          metadata?: Json | null
          reason?: string | null
          requested_by_user?: boolean
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          assigned_at?: string | null
          conversation_id?: string | null
          created_at?: string
          embedded_conversation_id?: string | null
          id?: string
          metadata?: Json | null
          reason?: string | null
          requested_by_user?: boolean
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "handoff_requests_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "human_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      human_agents: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_chat_count: number
          display_name: string
          email: string
          id: string
          is_online: boolean
          last_seen_at: string | null
          max_concurrent_chats: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_chat_count?: number
          display_name: string
          email: string
          id?: string
          is_online?: boolean
          last_seen_at?: string | null
          max_concurrent_chats?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_chat_count?: number
          display_name?: string
          email?: string
          id?: string
          is_online?: boolean
          last_seen_at?: string | null
          max_concurrent_chats?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      incident_auto_response_rules: {
        Row: {
          auto_escalate: boolean | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          response_action: string
          severity_threshold: string
          trigger_condition: string
          updated_at: string
        }
        Insert: {
          auto_escalate?: boolean | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          response_action: string
          severity_threshold: string
          trigger_condition: string
          updated_at?: string
        }
        Update: {
          auto_escalate?: boolean | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          response_action?: string
          severity_threshold?: string
          trigger_condition?: string
          updated_at?: string
        }
        Relationships: []
      }
      incident_responses: {
        Row: {
          action_type: string
          auto_triggered: boolean | null
          created_at: string
          details: Json | null
          executed_at: string | null
          executed_by: string | null
          id: string
          incident_id: string
          rule_id: string | null
          status: string
        }
        Insert: {
          action_type: string
          auto_triggered?: boolean | null
          created_at?: string
          details?: Json | null
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          incident_id: string
          rule_id?: string | null
          status?: string
        }
        Update: {
          action_type?: string
          auto_triggered?: boolean | null
          created_at?: string
          details?: Json | null
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          incident_id?: string
          rule_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_responses_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "security_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          created_at: string
          credentials: Json | null
          description: string | null
          error_message: string | null
          id: string
          integration_type: string
          is_active: boolean
          last_sync_at: string | null
          metadata: Json | null
          name: string
          sync_status: string | null
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          credentials?: Json | null
          description?: string | null
          error_message?: string | null
          id?: string
          integration_type: string
          is_active?: boolean
          last_sync_at?: string | null
          metadata?: Json | null
          name: string
          sync_status?: string | null
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          credentials?: Json | null
          description?: string | null
          error_message?: string | null
          id?: string
          integration_type?: string
          is_active?: boolean
          last_sync_at?: string | null
          metadata?: Json | null
          name?: string
          sync_status?: string | null
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string | null
          due_date: string
          hosted_invoice_url: string | null
          id: string
          invoice_number: string
          paid_at: string | null
          pdf_url: string | null
          status: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          subscription_id: string | null
          tax_cents: number | null
          total_cents: number
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string | null
          due_date: string
          hosted_invoice_url?: string | null
          id?: string
          invoice_number: string
          paid_at?: string | null
          pdf_url?: string | null
          status?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          tax_cents?: number | null
          total_cents: number
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string | null
          due_date?: string
          hosted_invoice_url?: string | null
          id?: string
          invoice_number?: string
          paid_at?: string | null
          pdf_url?: string | null
          status?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          tax_cents?: number | null
          total_cents?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_blocklist: {
        Row: {
          blocked_until: string | null
          created_at: string
          created_by: string | null
          id: string
          incident_id: string | null
          ip_address: unknown
          reason: string
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id?: string | null
          ip_address: unknown
          reason: string
        }
        Update: {
          blocked_until?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id?: string | null
          ip_address?: unknown
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "ip_blocklist_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "security_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_capture_configs: {
        Row: {
          created_at: string
          embedded_chatbot_id: string
          form_config: Json
          id: string
          is_enabled: boolean
          success_config: Json
          template_id: string | null
          trigger_config: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          embedded_chatbot_id: string
          form_config?: Json
          id?: string
          is_enabled?: boolean
          success_config?: Json
          template_id?: string | null
          trigger_config?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          embedded_chatbot_id?: string
          form_config?: Json
          id?: string
          is_enabled?: boolean
          success_config?: Json
          template_id?: string | null
          trigger_config?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_lead_capture_embedded_chatbot"
            columns: ["embedded_chatbot_id"]
            isOneToOne: false
            referencedRelation: "embedded_chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_capture_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          form_config: Json
          id: string
          is_featured: boolean
          name: string
          preview_image_url: string | null
          success_config: Json
          trigger_config: Json
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          form_config: Json
          id: string
          is_featured?: boolean
          name: string
          preview_image_url?: string | null
          success_config: Json
          trigger_config: Json
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          form_config?: Json
          id?: string
          is_featured?: boolean
          name?: string
          preview_image_url?: string | null
          success_config?: Json
          trigger_config?: Json
        }
        Relationships: []
      }
      lead_quality_scores: {
        Row: {
          calculated_at: string
          created_at: string
          device_type: string | null
          embedded_chatbot_id: string
          engagement_time_seconds: number | null
          form_completion_time_seconds: number | null
          id: string
          lead_submission_id: string
          message_count: number | null
          page_views: number | null
          quality_score: number
          returning_visitor: boolean | null
          scoring_factors: Json | null
          traffic_source: string | null
        }
        Insert: {
          calculated_at?: string
          created_at?: string
          device_type?: string | null
          embedded_chatbot_id: string
          engagement_time_seconds?: number | null
          form_completion_time_seconds?: number | null
          id?: string
          lead_submission_id: string
          message_count?: number | null
          page_views?: number | null
          quality_score: number
          returning_visitor?: boolean | null
          scoring_factors?: Json | null
          traffic_source?: string | null
        }
        Update: {
          calculated_at?: string
          created_at?: string
          device_type?: string | null
          embedded_chatbot_id?: string
          engagement_time_seconds?: number | null
          form_completion_time_seconds?: number | null
          id?: string
          lead_submission_id?: string
          message_count?: number | null
          page_views?: number | null
          quality_score?: number
          returning_visitor?: boolean | null
          scoring_factors?: Json | null
          traffic_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_quality_scores_embedded_chatbot_id_fkey"
            columns: ["embedded_chatbot_id"]
            isOneToOne: false
            referencedRelation: "embedded_chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_quality_scores_lead_submission_id_fkey"
            columns: ["lead_submission_id"]
            isOneToOne: false
            referencedRelation: "lead_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_submissions: {
        Row: {
          action_instance_id: string
          additional_data: Json | null
          conversation_id: string | null
          email: string | null
          id: string
          name: string | null
          phone: string | null
          source: string | null
          submitted_at: string
          user_id: string | null
        }
        Insert: {
          action_instance_id: string
          additional_data?: Json | null
          conversation_id?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          source?: string | null
          submitted_at?: string
          user_id?: string | null
        }
        Update: {
          action_instance_id?: string
          additional_data?: Json | null
          conversation_id?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          source?: string | null
          submitted_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_submissions_action_instance_id_fkey"
            columns: ["action_instance_id"]
            isOneToOne: false
            referencedRelation: "ai_action_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_submissions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          response_time_ms: number | null
          role: Database["public"]["Enums"]["message_role"]
          tokens_used: number | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          response_time_ms?: number | null
          role: Database["public"]["Enums"]["message_role"]
          tokens_used?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          response_time_ms?: number | null
          role?: Database["public"]["Enums"]["message_role"]
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_executions: {
        Row: {
          completed_at: string | null
          created_at: string
          embedded_chatbot_id: string | null
          error_message: string | null
          execution_id: string | null
          execution_time_ms: number | null
          id: string
          input_data: Json | null
          output_data: Json | null
          started_at: string
          status: string
          workflow_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          embedded_chatbot_id?: string | null
          error_message?: string | null
          execution_id?: string | null
          execution_time_ms?: number | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          started_at?: string
          status: string
          workflow_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          embedded_chatbot_id?: string | null
          error_message?: string | null
          execution_id?: string | null
          execution_time_ms?: number | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          started_at?: string
          status?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "n8n_executions_embedded_chatbot_id_fkey"
            columns: ["embedded_chatbot_id"]
            isOneToOne: false
            referencedRelation: "embedded_chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "n8n_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "n8n_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_workflows: {
        Row: {
          avg_execution_time_ms: number | null
          created_at: string
          description: string | null
          execution_count: number
          id: string
          is_active: boolean
          last_executed_at: string | null
          success_rate: number
          updated_at: string
          user_id: string
          webhook_url: string
          workflow_id: string
          workflow_name: string
        }
        Insert: {
          avg_execution_time_ms?: number | null
          created_at?: string
          description?: string | null
          execution_count?: number
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          success_rate?: number
          updated_at?: string
          user_id: string
          webhook_url: string
          workflow_id: string
          workflow_name: string
        }
        Update: {
          avg_execution_time_ms?: number | null
          created_at?: string
          description?: string | null
          execution_count?: number
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          success_rate?: number
          updated_at?: string
          user_id?: string
          webhook_url?: string
          workflow_id?: string
          workflow_name?: string
        }
        Relationships: []
      }
      network_security_policies: {
        Row: {
          configuration: Json
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          policy_name: string
          policy_type: string
          priority: number
          updated_at: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          policy_name: string
          policy_type: string
          priority?: number
          updated_at?: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          policy_name?: string
          policy_type?: string
          priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      notion_pages: {
        Row: {
          content_preview: string | null
          created_at: string
          id: string
          is_selected: boolean | null
          last_modified: string | null
          notion_page_id: string
          title: string
          updated_at: string
          url: string | null
          workspace_id: string | null
        }
        Insert: {
          content_preview?: string | null
          created_at?: string
          id?: string
          is_selected?: boolean | null
          last_modified?: string | null
          notion_page_id: string
          title: string
          updated_at?: string
          url?: string | null
          workspace_id?: string | null
        }
        Update: {
          content_preview?: string | null
          created_at?: string
          id?: string
          is_selected?: boolean | null
          last_modified?: string | null
          notion_page_id?: string
          title?: string
          updated_at?: string
          url?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notion_pages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "notion_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notion_workspaces: {
        Row: {
          access_token: string
          created_at: string
          error_message: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          name: string
          page_count: number | null
          status: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          access_token: string
          created_at?: string
          error_message?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name: string
          page_count?: number | null
          status?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string
          error_message?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name?: string
          page_count?: number | null
          status?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          id: string
          status: string | null
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          status?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          status?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invitation_token: string | null
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invitation_token?: string | null
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["organization_role"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invitation_token?: string | null
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          is_active: boolean | null
          joined_at: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["organization_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          current_period_start: string
          features: Json | null
          id: string
          max_members: number | null
          max_storage_gb: number | null
          max_voice_notes: number | null
          organization_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          features?: Json | null
          id?: string
          max_members?: number | null
          max_storage_gb?: number | null
          max_voice_notes?: number | null
          organization_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          features?: Json | null
          id?: string
          max_members?: number | null
          max_storage_gb?: number | null
          max_voice_notes?: number | null
          organization_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          avatar_url: string | null
          company_size: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          industry: string | null
          is_active: boolean | null
          max_members: number | null
          name: string
          settings: Json | null
          slug: string
          subscription_status: string | null
          subscription_tier: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_size?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          max_members?: number | null
          name: string
          settings?: Json | null
          slug: string
          subscription_status?: string | null
          subscription_tier?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_size?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          max_members?: number | null
          name?: string
          settings?: Json | null
          slug?: string
          subscription_status?: string | null
          subscription_tier?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      password_history: {
        Row: {
          created_at: string | null
          id: string
          password_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          password_hash: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          password_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_logs: {
        Row: {
          created_at: string
          email: string
          error_code: string | null
          error_message: string | null
          id: string
          ip_address: unknown | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          ip_address?: unknown | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          ip_address?: unknown | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      password_reset_rate_limits: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: unknown | null
          last_attempt_at: string
          locked_until: string | null
          reset_attempts: number
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: unknown | null
          last_attempt_at?: string
          locked_until?: string | null
          reset_attempts?: number
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: unknown | null
          last_attempt_at?: string
          locked_until?: string | null
          reset_attempts?: number
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean | null
          last4: string | null
          stripe_payment_method_id: string
          type: string
          user_id: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean | null
          last4?: string | null
          stripe_payment_method_id: string
          type: string
          user_id?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean | null
          last4?: string | null
          stripe_payment_method_id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      processing_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          input_data: Json
          job_type: string
          output_data: Json | null
          started_at: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_data: Json
          job_type: string
          output_data?: Json | null
          started_at?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_data?: Json
          job_type?: string
          output_data?: Json | null
          started_at?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      processing_pipelines: {
        Row: {
          completed_at: string | null
          created_at: string
          current_stage: string
          document_id: string
          error_details: Json | null
          id: string
          job_ids: Json | null
          pipeline_config: Json
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_stage?: string
          document_id: string
          error_details?: Json | null
          id?: string
          job_ids?: Json | null
          pipeline_config?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_stage?: string
          document_id?: string
          error_details?: Json | null
          id?: string
          job_ids?: Json | null
          pipeline_config?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_pipelines_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_description: string | null
          chat_interface_config: Json | null
          company_name: string | null
          contact_number: string | null
          created_at: string
          default_chatbot_config: Json | null
          default_document_agent_id: string | null
          designation: string | null
          email: string | null
          full_name: string | null
          id: string
          industry: string | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_step: number | null
          selected_template_id: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          business_description?: string | null
          chat_interface_config?: Json | null
          company_name?: string | null
          contact_number?: string | null
          created_at?: string
          default_chatbot_config?: Json | null
          default_document_agent_id?: string | null
          designation?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          industry?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_step?: number | null
          selected_template_id?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          business_description?: string | null
          chat_interface_config?: Json | null
          company_name?: string | null
          contact_number?: string | null
          created_at?: string
          default_chatbot_config?: Json | null
          default_document_agent_id?: string | null
          designation?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          industry?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_step?: number | null
          selected_template_id?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_document_agent_id_fkey"
            columns: ["default_document_agent_id"]
            isOneToOne: false
            referencedRelation: "global_ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_pairs: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_active: boolean | null
          last_asked_at: string | null
          question_variations: string[] | null
          times_asked: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_asked_at?: string | null
          question_variations?: string[] | null
          times_asked?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_asked_at?: string | null
          question_variations?: string[] | null
          times_asked?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_attempts: {
        Row: {
          attempt_count: number
          created_at: string
          endpoint: string
          id: string
          identifier: string
          window_start: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          window_start?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          window_start?: string
        }
        Relationships: []
      }
      recovery_test_executions: {
        Row: {
          actual_recovery_time_hours: number | null
          completed_at: string | null
          conducted_by: string | null
          created_at: string
          id: string
          improvement_recommendations: Json | null
          issues_identified: Json | null
          lessons_learned: string | null
          participants: Json | null
          procedure_id: string
          scheduled_at: string | null
          started_at: string | null
          status: string
          success_criteria_met: boolean | null
          test_name: string
          test_results: Json | null
          test_type: string
        }
        Insert: {
          actual_recovery_time_hours?: number | null
          completed_at?: string | null
          conducted_by?: string | null
          created_at?: string
          id?: string
          improvement_recommendations?: Json | null
          issues_identified?: Json | null
          lessons_learned?: string | null
          participants?: Json | null
          procedure_id: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          success_criteria_met?: boolean | null
          test_name: string
          test_results?: Json | null
          test_type: string
        }
        Update: {
          actual_recovery_time_hours?: number | null
          completed_at?: string | null
          conducted_by?: string | null
          created_at?: string
          id?: string
          improvement_recommendations?: Json | null
          issues_identified?: Json | null
          lessons_learned?: string | null
          participants?: Json | null
          procedure_id?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          success_criteria_met?: boolean | null
          test_name?: string
          test_results?: Json | null
          test_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_test_executions_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "disaster_recovery_procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referral_configuration: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          friend_discount_percentage: number
          id: string
          is_active: boolean
          max_earnings_per_referral: number
          max_total_earnings: number
          payment_processing_day: number
          payment_processing_delay_days: number
          referral_bonus_amount: number
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          friend_discount_percentage?: number
          id?: string
          is_active?: boolean
          max_earnings_per_referral?: number
          max_total_earnings?: number
          payment_processing_day?: number
          payment_processing_delay_days?: number
          referral_bonus_amount?: number
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          friend_discount_percentage?: number
          id?: string
          is_active?: boolean
          max_earnings_per_referral?: number
          max_total_earnings?: number
          payment_processing_day?: number
          payment_processing_delay_days?: number
          referral_bonus_amount?: number
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      referral_earnings: {
        Row: {
          created_at: string | null
          id: string
          max_earnings: number | null
          paid_amount: number | null
          pending_amount: number | null
          referral_count: number | null
          total_earned: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_earnings?: number | null
          paid_amount?: number | null
          pending_amount?: number | null
          referral_count?: number | null
          total_earned?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          max_earnings?: number | null
          paid_amount?: number | null
          pending_amount?: number | null
          referral_count?: number | null
          total_earned?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_amount: number | null
          created_at: string | null
          discount_applied: boolean | null
          discount_percentage: number | null
          id: string
          paid_at: string | null
          referral_code: string
          referred_user_id: string
          referrer_id: string
          status: Database["public"]["Enums"]["referral_status"] | null
          updated_at: string | null
        }
        Insert: {
          bonus_amount?: number | null
          created_at?: string | null
          discount_applied?: boolean | null
          discount_percentage?: number | null
          id?: string
          paid_at?: string | null
          referral_code: string
          referred_user_id: string
          referrer_id: string
          status?: Database["public"]["Enums"]["referral_status"] | null
          updated_at?: string | null
        }
        Update: {
          bonus_amount?: number | null
          created_at?: string | null
          discount_applied?: boolean | null
          discount_percentage?: number | null
          id?: string
          paid_at?: string | null
          referral_code?: string
          referred_user_id?: string
          referrer_id?: string
          status?: Database["public"]["Enums"]["referral_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      request_rate_limits: {
        Row: {
          created_at: string
          id: string
          identifier: string
          last_request_at: string
          max_requests: number
          request_count: number
          updated_at: string
          window_seconds: number
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          last_request_at?: string
          max_requests?: number
          request_count?: number
          updated_at?: string
          window_seconds?: number
          window_start: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          last_request_at?: string
          max_requests?: number
          request_count?: number
          updated_at?: string
          window_seconds?: number
          window_start?: string
        }
        Relationships: []
      }
      security_alert_rules: {
        Row: {
          alert_frequency: number | null
          condition: string
          created_at: string
          id: string
          is_active: boolean | null
          last_triggered: string | null
          name: string
          severity: string
          threshold: number
          updated_at: string
        }
        Insert: {
          alert_frequency?: number | null
          condition: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_triggered?: string | null
          name: string
          severity: string
          threshold: number
          updated_at?: string
        }
        Update: {
          alert_frequency?: number | null
          condition?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_triggered?: string | null
          name?: string
          severity?: string
          threshold?: number
          updated_at?: string
        }
        Relationships: []
      }
      security_audit_logs: {
        Row: {
          created_at: string
          details: Json | null
          event_category: string
          event_source: string
          id: string
          ip_address: unknown | null
          payload_size_bytes: number | null
          request_method: string | null
          request_path: string | null
          response_status: number | null
          response_time_ms: number | null
          risk_score: number | null
          security_headers: Json | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_category: string
          event_source: string
          id?: string
          ip_address?: unknown | null
          payload_size_bytes?: number | null
          request_method?: string | null
          request_path?: string | null
          response_status?: number | null
          response_time_ms?: number | null
          risk_score?: number | null
          security_headers?: Json | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_category?: string
          event_source?: string
          id?: string
          ip_address?: unknown | null
          payload_size_bytes?: number | null
          request_method?: string | null
          request_path?: string | null
          response_status?: number | null
          response_time_ms?: number | null
          risk_score?: number | null
          security_headers?: Json | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: unknown | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_incidents: {
        Row: {
          affected_systems: string[] | null
          assignee_id: string | null
          created_at: string
          created_by: string | null
          description: string
          escalation_level: number
          id: string
          impact_assessment: string | null
          incident_type: string
          related_events: string[] | null
          resolved_at: string | null
          response_actions: Json | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          affected_systems?: string[] | null
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          escalation_level?: number
          id?: string
          impact_assessment?: string | null
          incident_type: string
          related_events?: string[] | null
          resolved_at?: string | null
          response_actions?: Json | null
          severity: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          affected_systems?: string[] | null
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          escalation_level?: number
          id?: string
          impact_assessment?: string | null
          incident_type?: string
          related_events?: string[] | null
          resolved_at?: string | null
          response_actions?: Json | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_policy_violations: {
        Row: {
          attempted_data: Json | null
          created_at: string | null
          id: string
          ip_address: unknown | null
          operation: string
          policy_violated: string
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          attempted_data?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          operation: string
          policy_violated: string
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          attempted_data?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          operation?: string
          policy_violated?: string
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          billing_address: Json | null
          created_at: string
          email: string
          id: string
          payment_method_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_start: string | null
          subscription_status: string | null
          subscription_tier: string | null
          trial_end: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          billing_address?: Json | null
          created_at?: string
          email: string
          id?: string
          payment_method_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_start?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          billing_address?: Json | null
          created_at?: string
          email?: string
          id?: string
          payment_method_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_start?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          current_period_start: string
          features: Json | null
          id: string
          monthly_message_limit: number | null
          monthly_token_limit: number | null
          plan_name: string
          status: Database["public"]["Enums"]["subscription_status"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end: string
          current_period_start: string
          features?: Json | null
          id?: string
          monthly_message_limit?: number | null
          monthly_token_limit?: number | null
          plan_name: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          features?: Json | null
          id?: string
          monthly_message_limit?: number | null
          monthly_token_limit?: number | null
          plan_name?: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_api_keys_config: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          key_name: string
          key_type: string
          last_used_date: string | null
          updated_at: string
          usage_count_today: number | null
          usage_limit_per_day: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key_name: string
          key_type: string
          last_used_date?: string | null
          updated_at?: string
          usage_count_today?: number | null
          usage_limit_per_day?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key_name?: string
          key_type?: string
          last_used_date?: string | null
          updated_at?: string
          usage_count_today?: number | null
          usage_limit_per_day?: number | null
        }
        Relationships: []
      }
      system_configuration: {
        Row: {
          allowed_file_types: string[] | null
          created_at: string
          created_by: string | null
          default_ai_model: string | null
          default_chunk_overlap: number
          default_chunk_size: number
          default_chunking_strategy: string
          default_embedding_dimensions: number
          default_embedding_model: string
          global_webhook_retry_count: number
          global_webhook_timeout_seconds: number
          id: string
          max_audio_duration_seconds: number | null
          max_concurrent_processing_jobs: number
          max_document_size_mb: number
          max_file_size_n8n_mb: number | null
          max_monthly_notes_free: number | null
          max_monthly_notes_premium: number | null
          n8n_enabled: boolean
          n8n_enhance_endpoint: string | null
          n8n_fallback_enabled: boolean
          n8n_health_check_endpoint: string | null
          n8n_primary_mode: boolean
          n8n_retry_attempts: number | null
          n8n_transcribe_endpoint: string | null
          n8n_voice_upload_endpoint: string | null
          n8n_webhook_base_url: string | null
          n8n_webhook_secret: string | null
          n8n_workflow_timeout_seconds: number
          processing_mode: string
          processing_queue_timeout_minutes: number
          processing_timeout_seconds: number | null
          require_api_key_encryption: boolean
          updated_at: string
          updated_by: string | null
          webhook_rate_limit_per_minute: number
        }
        Insert: {
          allowed_file_types?: string[] | null
          created_at?: string
          created_by?: string | null
          default_ai_model?: string | null
          default_chunk_overlap?: number
          default_chunk_size?: number
          default_chunking_strategy?: string
          default_embedding_dimensions?: number
          default_embedding_model?: string
          global_webhook_retry_count?: number
          global_webhook_timeout_seconds?: number
          id?: string
          max_audio_duration_seconds?: number | null
          max_concurrent_processing_jobs?: number
          max_document_size_mb?: number
          max_file_size_n8n_mb?: number | null
          max_monthly_notes_free?: number | null
          max_monthly_notes_premium?: number | null
          n8n_enabled?: boolean
          n8n_enhance_endpoint?: string | null
          n8n_fallback_enabled?: boolean
          n8n_health_check_endpoint?: string | null
          n8n_primary_mode?: boolean
          n8n_retry_attempts?: number | null
          n8n_transcribe_endpoint?: string | null
          n8n_voice_upload_endpoint?: string | null
          n8n_webhook_base_url?: string | null
          n8n_webhook_secret?: string | null
          n8n_workflow_timeout_seconds?: number
          processing_mode?: string
          processing_queue_timeout_minutes?: number
          processing_timeout_seconds?: number | null
          require_api_key_encryption?: boolean
          updated_at?: string
          updated_by?: string | null
          webhook_rate_limit_per_minute?: number
        }
        Update: {
          allowed_file_types?: string[] | null
          created_at?: string
          created_by?: string | null
          default_ai_model?: string | null
          default_chunk_overlap?: number
          default_chunk_size?: number
          default_chunking_strategy?: string
          default_embedding_dimensions?: number
          default_embedding_model?: string
          global_webhook_retry_count?: number
          global_webhook_timeout_seconds?: number
          id?: string
          max_audio_duration_seconds?: number | null
          max_concurrent_processing_jobs?: number
          max_document_size_mb?: number
          max_file_size_n8n_mb?: number | null
          max_monthly_notes_free?: number | null
          max_monthly_notes_premium?: number | null
          n8n_enabled?: boolean
          n8n_enhance_endpoint?: string | null
          n8n_fallback_enabled?: boolean
          n8n_health_check_endpoint?: string | null
          n8n_primary_mode?: boolean
          n8n_retry_attempts?: number | null
          n8n_transcribe_endpoint?: string | null
          n8n_voice_upload_endpoint?: string | null
          n8n_webhook_base_url?: string | null
          n8n_webhook_secret?: string | null
          n8n_workflow_timeout_seconds?: number
          processing_mode?: string
          processing_queue_timeout_minutes?: number
          processing_timeout_seconds?: number | null
          require_api_key_encryption?: boolean
          updated_at?: string
          updated_by?: string | null
          webhook_rate_limit_per_minute?: number
        }
        Relationships: []
      }
      system_health_metrics: {
        Row: {
          alert_frequency_minutes: number | null
          created_at: string
          current_value: number
          id: string
          last_alert_sent_at: string | null
          metadata: Json | null
          metric_name: string
          metric_type: string
          monitoring_enabled: boolean
          status: string
          threshold_critical: number
          threshold_warning: number
          unit: string
          updated_at: string
        }
        Insert: {
          alert_frequency_minutes?: number | null
          created_at?: string
          current_value: number
          id?: string
          last_alert_sent_at?: string | null
          metadata?: Json | null
          metric_name: string
          metric_type: string
          monitoring_enabled?: boolean
          status?: string
          threshold_critical: number
          threshold_warning: number
          unit: string
          updated_at?: string
        }
        Update: {
          alert_frequency_minutes?: number | null
          created_at?: string
          current_value?: number
          id?: string
          last_alert_sent_at?: string | null
          metadata?: Json | null
          metric_name?: string
          metric_type?: string
          monitoring_enabled?: boolean
          status?: string
          threshold_critical?: number
          threshold_warning?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_quarantine: {
        Row: {
          id: string
          incident_id: string | null
          quarantine_reason: string
          quarantined_at: string
          released_at: string | null
          status: string | null
          system_id: string
        }
        Insert: {
          id?: string
          incident_id?: string | null
          quarantine_reason: string
          quarantined_at?: string
          released_at?: string | null
          status?: string | null
          system_id: string
        }
        Update: {
          id?: string
          incident_id?: string | null
          quarantine_reason?: string
          quarantined_at?: string
          released_at?: string | null
          status?: string | null
          system_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_quarantine_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "security_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      text_snippets: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      traffic_attribution: {
        Row: {
          attribution_model: string | null
          conversion_value_cents: number | null
          cost_per_click_cents: number | null
          created_at: string
          embedded_chatbot_id: string
          first_touch_campaign: string | null
          first_touch_medium: string | null
          first_touch_source: string | null
          first_touch_timestamp: string | null
          id: string
          last_touch_campaign: string | null
          last_touch_medium: string | null
          last_touch_source: string | null
          last_touch_timestamp: string | null
          lead_submission_id: string | null
          roi_percentage: number | null
          session_id: string
          touchpoints: Json | null
        }
        Insert: {
          attribution_model?: string | null
          conversion_value_cents?: number | null
          cost_per_click_cents?: number | null
          created_at?: string
          embedded_chatbot_id: string
          first_touch_campaign?: string | null
          first_touch_medium?: string | null
          first_touch_source?: string | null
          first_touch_timestamp?: string | null
          id?: string
          last_touch_campaign?: string | null
          last_touch_medium?: string | null
          last_touch_source?: string | null
          last_touch_timestamp?: string | null
          lead_submission_id?: string | null
          roi_percentage?: number | null
          session_id: string
          touchpoints?: Json | null
        }
        Update: {
          attribution_model?: string | null
          conversion_value_cents?: number | null
          cost_per_click_cents?: number | null
          created_at?: string
          embedded_chatbot_id?: string
          first_touch_campaign?: string | null
          first_touch_medium?: string | null
          first_touch_source?: string | null
          first_touch_timestamp?: string | null
          id?: string
          last_touch_campaign?: string | null
          last_touch_medium?: string | null
          last_touch_source?: string | null
          last_touch_timestamp?: string | null
          lead_submission_id?: string | null
          roi_percentage?: number | null
          session_id?: string
          touchpoints?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "traffic_attribution_embedded_chatbot_id_fkey"
            columns: ["embedded_chatbot_id"]
            isOneToOne: false
            referencedRelation: "embedded_chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traffic_attribution_lead_submission_id_fkey"
            columns: ["lead_submission_id"]
            isOneToOne: false
            referencedRelation: "lead_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_analytics: {
        Row: {
          chatbot_id: string | null
          cost_cents: number | null
          created_at: string
          id: string
          metadata: Json | null
          quantity: number
          usage_type: Database["public"]["Enums"]["usage_type"]
          user_id: string
        }
        Insert: {
          chatbot_id?: string | null
          cost_cents?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          quantity?: number
          usage_type: Database["public"]["Enums"]["usage_type"]
          user_id: string
        }
        Update: {
          chatbot_id?: string | null
          cost_cents?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          quantity?: number
          usage_type?: Database["public"]["Enums"]["usage_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_analytics_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_records: {
        Row: {
          created_at: string
          id: string
          period_end: string
          period_start: string
          quantity: number
          subscription_id: string | null
          total_cost_cents: number
          unit_cost_cents: number
          usage_type: Database["public"]["Enums"]["usage_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          quantity: number
          subscription_id?: string | null
          total_cost_cents: number
          unit_cost_cents: number
          usage_type: Database["public"]["Enums"]["usage_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          quantity?: number
          subscription_id?: string | null
          total_cost_cents?: number
          unit_cost_cents?: number
          usage_type?: Database["public"]["Enums"]["usage_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_labels: {
        Row: {
          color_hex: string | null
          created_at: string | null
          id: string
          label_name: string
          updated_at: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          color_hex?: string | null
          created_at?: string | null
          id?: string
          label_name: string
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          color_hex?: string | null
          created_at?: string | null
          id?: string
          label_name?: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_passes: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          purchased_at: string
          source: string | null
          status: string
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          purchased_at?: string
          source?: string | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          purchased_at?: string
          source?: string | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          ip_address: unknown | null
          is_active: boolean | null
          last_activity: string | null
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown | null
          is_active?: boolean | null
          last_activity?: string | null
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown | null
          is_active?: boolean | null
          last_activity?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          auto_enhance: boolean | null
          auto_transcribe: boolean | null
          created_at: string
          dark_mode_preference: boolean | null
          default_ai_style: string | null
          id: string
          output_language: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_enhance?: boolean | null
          auto_transcribe?: boolean | null
          created_at?: string
          dark_mode_preference?: boolean | null
          default_ai_style?: string | null
          id?: string
          output_language?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_enhance?: boolean | null
          auto_transcribe?: boolean | null
          created_at?: string
          dark_mode_preference?: boolean | null
          default_ai_style?: string | null
          id?: string
          output_language?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_notes: {
        Row: {
          audio_url: string | null
          content: string | null
          created_at: string
          duration_seconds: number | null
          enhanced_content: string | null
          fallback_reason: string | null
          id: string
          is_favorite: boolean | null
          language: string | null
          n8n_workflow_id: string | null
          organization_id: string | null
          processing_metadata: Json | null
          processing_method: string | null
          processing_started_at: string | null
          processing_steps: Json | null
          status: string | null
          tags: string[] | null
          title: string
          transcription: string | null
          updated_at: string
          upload_source: string | null
          uploaded_file_path: string | null
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          content?: string | null
          created_at?: string
          duration_seconds?: number | null
          enhanced_content?: string | null
          fallback_reason?: string | null
          id?: string
          is_favorite?: boolean | null
          language?: string | null
          n8n_workflow_id?: string | null
          organization_id?: string | null
          processing_metadata?: Json | null
          processing_method?: string | null
          processing_started_at?: string | null
          processing_steps?: Json | null
          status?: string | null
          tags?: string[] | null
          title: string
          transcription?: string | null
          updated_at?: string
          upload_source?: string | null
          uploaded_file_path?: string | null
          user_id: string
        }
        Update: {
          audio_url?: string | null
          content?: string | null
          created_at?: string
          duration_seconds?: number | null
          enhanced_content?: string | null
          fallback_reason?: string | null
          id?: string
          is_favorite?: boolean | null
          language?: string | null
          n8n_workflow_id?: string | null
          organization_id?: string | null
          processing_metadata?: Json | null
          processing_method?: string | null
          processing_started_at?: string | null
          processing_steps?: Json | null
          status?: string | null
          tags?: string[] | null
          title?: string
          transcription?: string | null
          updated_at?: string
          upload_source?: string | null
          uploaded_file_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_processing_limits: {
        Row: {
          created_at: string
          id: string
          processing_count: number
          processing_date: string
          total_duration_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          processing_count?: number
          processing_date?: string
          total_duration_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          processing_count?: number
          processing_date?: string
          total_duration_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      web_crawl_links: {
        Row: {
          content: string | null
          crawled_at: string | null
          created_at: string
          error_message: string | null
          id: string
          is_included: boolean | null
          status: string | null
          title: string | null
          updated_at: string
          url: string
          web_source_id: string | null
          word_count: number | null
        }
        Insert: {
          content?: string | null
          crawled_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          is_included?: boolean | null
          status?: string | null
          title?: string | null
          updated_at?: string
          url: string
          web_source_id?: string | null
          word_count?: number | null
        }
        Update: {
          content?: string | null
          crawled_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          is_included?: boolean | null
          status?: string | null
          title?: string | null
          updated_at?: string
          url?: string
          web_source_id?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "web_crawl_links_web_source_id_fkey"
            columns: ["web_source_id"]
            isOneToOne: false
            referencedRelation: "web_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      web_sources: {
        Row: {
          crawl_config: Json | null
          crawl_method: string | null
          created_at: string
          error_message: string | null
          exclude_paths: string[] | null
          id: string
          include_paths: string[] | null
          is_active: boolean | null
          last_crawled_at: string | null
          links_crawled: number | null
          links_total: number | null
          max_pages: number | null
          name: string
          pages_crawled: number | null
          status: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          crawl_config?: Json | null
          crawl_method?: string | null
          created_at?: string
          error_message?: string | null
          exclude_paths?: string[] | null
          id?: string
          include_paths?: string[] | null
          is_active?: boolean | null
          last_crawled_at?: string | null
          links_crawled?: number | null
          links_total?: number | null
          max_pages?: number | null
          name: string
          pages_crawled?: number | null
          status?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          crawl_config?: Json | null
          crawl_method?: string | null
          created_at?: string
          error_message?: string | null
          exclude_paths?: string[] | null
          id?: string
          include_paths?: string[] | null
          is_active?: boolean | null
          last_crawled_at?: string | null
          links_crawled?: number | null
          links_total?: number | null
          max_pages?: number | null
          name?: string
          pages_crawled?: number | null
          status?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_configs: {
        Row: {
          created_at: string
          embedded_chatbot_id: string | null
          event_types: string[] | null
          headers: Json | null
          id: string
          is_active: boolean | null
          name: string
          payload_template: Json | null
          retry_count: number | null
          secret_token: string | null
          timeout_seconds: number | null
          updated_at: string
          user_id: string
          webhook_url: string
        }
        Insert: {
          created_at?: string
          embedded_chatbot_id?: string | null
          event_types?: string[] | null
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          payload_template?: Json | null
          retry_count?: number | null
          secret_token?: string | null
          timeout_seconds?: number | null
          updated_at?: string
          user_id: string
          webhook_url: string
        }
        Update: {
          created_at?: string
          embedded_chatbot_id?: string | null
          event_types?: string[] | null
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          payload_template?: Json | null
          retry_count?: number | null
          secret_token?: string | null
          timeout_seconds?: number | null
          updated_at?: string
          user_id?: string
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_configs_embedded_chatbot_id_fkey"
            columns: ["embedded_chatbot_id"]
            isOneToOne: false
            referencedRelation: "embedded_chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_configurations: {
        Row: {
          created_at: string
          events: string[]
          failure_count: number
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          retry_count: number
          secret_key: string
          success_count: number
          timeout_seconds: number
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          retry_count?: number
          secret_key: string
          success_count?: number
          timeout_seconds?: number
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          retry_count?: number
          secret_key?: string
          success_count?: number
          timeout_seconds?: number
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          is_active: boolean
          name: string
          sample_payload: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          is_active?: boolean
          name: string
          sample_payload?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          is_active?: boolean
          name?: string
          sample_payload?: Json | null
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          attempt_number: number
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          response_time_ms: number | null
          success: boolean
          webhook_id: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          response_time_ms?: number | null
          success?: boolean
          webhook_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          response_time_ms?: number | null
          success?: boolean
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          auth_config: Json | null
          auth_type: string | null
          created_at: string
          description: string | null
          events: string[] | null
          failure_count: number
          headers: Json | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          method: string
          name: string
          retry_count: number
          secret_key: string | null
          success_count: number
          timeout_seconds: number
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          auth_config?: Json | null
          auth_type?: string | null
          created_at?: string
          description?: string | null
          events?: string[] | null
          failure_count?: number
          headers?: Json | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          method?: string
          name: string
          retry_count?: number
          secret_key?: string | null
          success_count?: number
          timeout_seconds?: number
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          auth_config?: Json | null
          auth_type?: string | null
          created_at?: string
          description?: string | null
          events?: string[] | null
          failure_count?: number
          headers?: Json | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          method?: string
          name?: string
          retry_count?: number
          secret_key?: string | null
          success_count?: number
          timeout_seconds?: number
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      widget_access_logs: {
        Row: {
          access_granted: boolean
          created_at: string
          denial_reason: string | null
          domain: string
          embedded_chatbot_id: string
          id: string
          ip_address: unknown | null
          page_url: string | null
          referrer_url: string | null
          user_agent: string | null
        }
        Insert: {
          access_granted: boolean
          created_at?: string
          denial_reason?: string | null
          domain: string
          embedded_chatbot_id: string
          id?: string
          ip_address?: unknown | null
          page_url?: string | null
          referrer_url?: string | null
          user_agent?: string | null
        }
        Update: {
          access_granted?: boolean
          created_at?: string
          denial_reason?: string | null
          domain?: string
          embedded_chatbot_id?: string
          id?: string
          ip_address?: unknown | null
          page_url?: string | null
          referrer_url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "widget_access_logs_embedded_chatbot_id_fkey"
            columns: ["embedded_chatbot_id"]
            isOneToOne: false
            referencedRelation: "embedded_chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      legacy_profiles_view: {
        Row: {
          avatar_url: string | null
          business_description: string | null
          chat_interface_config: Json | null
          company_name: string | null
          contact_number: string | null
          created_at: string | null
          default_chatbot_config: Json | null
          default_document_agent_id: string | null
          designation: string | null
          email: string | null
          full_name: string | null
          id: string | null
          industry: string | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_step: number | null
          selected_template_id: string | null
          updated_at: string | null
          website_url: string | null
        }
        Relationships: []
      }
      legacy_subscriptions_view: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          features: Json | null
          id: string | null
          monthly_message_limit: number | null
          monthly_token_limit: number | null
          plan_name: string | null
          status: Database["public"]["Enums"]["subscription_status"] | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
      legacy_voice_notes_view: {
        Row: {
          audio_url: string | null
          created_at: string | null
          duration_seconds: number | null
          enhanced_content: string | null
          id: string | null
          status: string | null
          tags: string[] | null
          title: string | null
          transcription: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      batch_delete_documents: {
        Args: { document_ids: string[] }
        Returns: undefined
      }
      batch_delete_embedded_chatbots: {
        Args: { chatbot_ids: string[] }
        Returns: undefined
      }
      calculate_lead_quality_score: {
        Args: {
          _device_type: string
          _engagement_time_seconds: number
          _form_completion_time_seconds: number
          _message_count: number
          _page_views: number
          _returning_visitor: boolean
          _traffic_source: string
        }
        Returns: number
      }
      can_access_lead_templates: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      can_modify_admin_role_secure: {
        Args: {
          _modifier_id: string
          _new_role: Database["public"]["Enums"]["admin_role"]
          _target_user_id: string
        }
        Returns: boolean
      }
      check_account_lockout: {
        Args: { _email: string }
        Returns: Json
      }
      check_and_enforce_note_limit: {
        Args: { _user_id: string }
        Returns: Json
      }
      check_pass_active: {
        Args: { _user_id?: string }
        Returns: Json
      }
      check_password_reset_rate_limit: {
        Args: { user_email: string; user_ip?: unknown }
        Returns: Json
      }
      check_rate_limit: {
        Args:
          | {
              _endpoint: string
              _identifier: string
              _max_attempts?: number
              _window_minutes?: number
            }
          | {
              p_identifier: string
              p_max_requests?: number
              p_window_seconds?: number
            }
        Returns: Json
      }
      check_rate_limit_with_logging: {
        Args: {
          _endpoint: string
          _identifier: string
          _ip_address?: unknown
          _max_attempts?: number
          _user_agent?: string
          _window_minutes?: number
        }
        Returns: boolean
      }
      check_voice_processing_limit: {
        Args: { _duration_seconds: number; _user_id: string }
        Returns: Json
      }
      classify_sensitive_data: {
        Args: Record<PropertyKey, never>
        Returns: {
          access_pattern: string
          classification: string
          has_rls: boolean
          risk_level: string
          table_name: string
        }[]
      }
      cleanup_old_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_voice_notes: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      cleanup_security_logs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      detect_suspicious_activity: {
        Args: { _timeframe_hours?: number; _user_id?: string }
        Returns: {
          event_count: number
          event_type: string
          last_occurrence: string
          severity: string
        }[]
      }
      encrypt_webhook_secret: {
        Args: { _secret: string }
        Returns: string
      }
      generate_referral_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_widget_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_active_referral_configuration: {
        Args: Record<PropertyKey, never>
        Returns: {
          friend_discount_percentage: number
          id: string
          is_active: boolean
          max_earnings_per_referral: number
          payment_processing_day: number
          payment_processing_delay_days: number
          referral_bonus_amount: number
        }[]
      }
      get_admin_referral_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_admin_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["admin_role"]
      }
      get_api_key_by_tier_and_scope: {
        Args: {
          _organization_id?: string
          _scope?: Database["public"]["Enums"]["api_key_scope"]
          _tier?: Database["public"]["Enums"]["api_key_tier"]
          _user_id: string
        }
        Returns: {
          api_key_id: string
          encrypted_key: string
          key_name: string
          scope: Database["public"]["Enums"]["api_key_scope"]
          service_name: string
          tier: Database["public"]["Enums"]["api_key_tier"]
        }[]
      }
      get_conversations_with_stats: {
        Args: { p_chatbot_id: string }
        Returns: {
          country_code: string
          created_at: string
          embedded_chatbot_id: string
          first_message_at: string
          id: string
          last_message_at: string
          message_count: number
          page_url: string
          referrer_url: string
          session_id: string
          total_tokens_used: number
          updated_at: string
          user_agent: string
          visitor_metadata: Json
        }[]
      }
      get_document_analytics: {
        Args: { _user_id?: string }
        Returns: {
          avg_confidence_score: number
          chatbot_id: string
          chunk_count: number
          created_at: string
          document_id: string
          filename: string
          last_used_at: string
          status: Database["public"]["Enums"]["document_status"]
          usage_count: number
          user_id: string
        }[]
      }
      get_documents_with_stats: {
        Args: { p_chatbot_id?: string; p_user_id: string }
        Returns: {
          avg_confidence: number
          chatbot_id: string
          chunk_count: number
          created_at: string
          filename: string
          id: string
          last_used_at: string
          status: string
          updated_at: string
          usage_count: number
          user_id: string
        }[]
      }
      get_incident_metrics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_or_create_referral_code: {
        Args: { _user_id: string }
        Returns: string
      }
      get_public_referral_info: {
        Args: { _referral_code: string }
        Returns: Json
      }
      get_public_widget_config: {
        Args: { widget_id_param: string }
        Returns: Json
      }
      get_public_widget_config_fixed: {
        Args: { widget_id_param: string }
        Returns: Json
      }
      get_public_widget_config_secure: {
        Args: { widget_id_param: string }
        Returns: Json
      }
      get_secure_widget_config: {
        Args: { widget_id_param: string }
        Returns: Json
      }
      get_security_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_security_table_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          classification: string
          has_rls_policies: boolean
          rls_enabled: boolean
          table_name: string
        }[]
      }
      get_system_configuration: {
        Args: Record<PropertyKey, never>
        Returns: {
          allowed_file_types: string[]
          created_at: string
          default_chunk_overlap: number
          default_chunk_size: number
          default_chunking_strategy: string
          default_embedding_dimensions: number
          default_embedding_model: string
          global_webhook_retry_count: number
          global_webhook_timeout_seconds: number
          id: string
          max_concurrent_processing_jobs: number
          max_document_size_mb: number
          n8n_webhook_base_url: string
          processing_mode: string
          processing_queue_timeout_minutes: number
          require_api_key_encryption: boolean
          updated_at: string
          webhook_rate_limit_per_minute: number
        }[]
      }
      get_system_resilience_score: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_user_current_organization: {
        Args: { _user_id: string }
        Returns: string
      }
      get_user_organizations: {
        Args: { _user_id?: string }
        Returns: {
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_statistics: {
        Args: { _user_id?: string }
        Returns: {
          chatbot_count: number
          conversation_count: number
          created_at: string
          document_count: number
          email: string
          embedded_chatbot_count: number
          full_name: string
          id: string
          last_activity_at: string
          message_count: number
          total_tokens_used: number
        }[]
      }
      handle_failed_login: {
        Args: { user_email: string }
        Returns: undefined
      }
      has_organization_role: {
        Args: {
          _organization_id: string
          _role: Database["public"]["Enums"]["organization_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_label_usage: {
        Args: { p_label_name: string; p_user_id: string }
        Returns: undefined
      }
      increment_usage: {
        Args: { _key_name: string }
        Returns: number
      }
      is_admin: {
        Args: {
          _role?: Database["public"]["Enums"]["admin_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_organization_admin: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
      }
      is_organization_member: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
      }
      log_chatbot_access_attempt: {
        Args: {
          _access_type: string
          _success?: boolean
          _user_id?: string
          _widget_id: string
        }
        Returns: undefined
      }
      log_critical_operation: {
        Args: {
          operation_details?: Json
          operation_type: string
          target_table: string
        }
        Returns: string
      }
      log_password_reset_attempt: {
        Args: {
          error_code?: string
          error_message?: string
          is_success?: boolean
          user_agent?: string
          user_email: string
          user_ip?: unknown
        }
        Returns: string
      }
      log_policy_violation: {
        Args: { _details?: Json; _event_type: string; _table_name: string }
        Returns: undefined
      }
      log_security_access_attempt: {
        Args: {
          _access_granted?: boolean
          _reason?: string
          _resource_id?: string
          _resource_type: string
        }
        Returns: undefined
      }
      log_security_event: {
        Args: {
          _details?: Json
          _event_type: string
          _ip_address?: unknown
          _severity?: string
          _user_agent?: string
          _user_id?: string
        }
        Returns: string
      }
      log_security_violation: {
        Args: {
          _attempted_data?: Json
          _ip_address?: unknown
          _operation: string
          _policy_violated: string
          _table_name: string
          _user_agent?: string
        }
        Returns: undefined
      }
      log_sensitive_access: {
        Args: { p_operation: string; p_table: string; p_user_id?: string }
        Returns: undefined
      }
      log_sensitive_table_access: {
        Args: { p_operation: string; p_table_name: string; p_user_id?: string }
        Returns: undefined
      }
      log_voice_note_processing: {
        Args: {
          _duration_seconds: number
          _error_message?: string
          _file_size: number
          _processing_time_ms?: number
          _user_id: string
        }
        Returns: undefined
      }
      monitor_suspicious_access: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      process_referral_signup: {
        Args: { _referral_code: string; _referred_user_id: string }
        Returns: Json
      }
      reset_failed_attempts: {
        Args: { user_email: string }
        Returns: undefined
      }
      retrieve_encrypted_credential: {
        Args: { _credential_name: string }
        Returns: string
      }
      secure_change_user_role: {
        Args:
          | {
              _new_role: Database["public"]["Enums"]["admin_role"]
              _reason?: string
              _target_user_id: string
            }
          | {
              _new_role: Database["public"]["Enums"]["app_role"]
              _reason?: string
              _target_user_id: string
            }
        Returns: Json
      }
      secure_role_modification_enhanced: {
        Args: {
          _new_role: Database["public"]["Enums"]["admin_role"]
          _reason: string
          _target_user_id: string
        }
        Returns: Json
      }
      store_encrypted_credential: {
        Args: {
          _credential_name: string
          _credential_value: string
          _encryption_key_id?: string
        }
        Returns: Json
      }
      trigger_webhook_for_event: {
        Args: {
          event_type_param: string
          payload_param: Json
          user_id_param?: string
        }
        Returns: undefined
      }
      validate_and_sanitize_input: {
        Args:
          | { _input: string; _input_type?: string; _max_length?: number }
          | { allow_html?: boolean; input_text: string; max_length?: number }
        Returns: Json
      }
      validate_complete_security: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      validate_final_security_posture: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      validate_security_configuration: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      validate_webhook_secret_strength: {
        Args: { _secret: string }
        Returns: Json
      }
    }
    Enums: {
      admin_role: "system_admin" | "developer" | "support" | "template_manager"
      ai_action_status: "active" | "inactive" | "draft" | "archived"
      ai_action_type:
        | "form_action"
        | "button_action"
        | "web_search"
        | "slack_integration"
        | "calendly_integration"
        | "custom_api"
        | "email_action"
        | "webhook_action"
        | "lead_collection"
      api_key_scope: "global" | "organization" | "user"
      api_key_tier: "system" | "free" | "user"
      app_role: "admin" | "moderator" | "user"
      chatbot_status: "active" | "training" | "paused" | "draft"
      clean_subscription_status: "active" | "canceled" | "past_due" | "trialing"
      clean_voice_note_status: "processing" | "completed" | "error"
      document_status: "uploading" | "processing" | "ready" | "error"
      execution_status: "success" | "failure" | "pending" | "timeout"
      message_role: "user" | "assistant" | "system"
      organization_role:
        | "org_admin"
        | "org_manager"
        | "org_member"
        | "org_viewer"
      referral_status: "pending" | "paid" | "cancelled"
      subscription_status: "active" | "canceled" | "past_due" | "incomplete"
      usage_type:
        | "message"
        | "token"
        | "document_upload"
        | "api_call"
        | "bot_event"
        | "event_dispatch"
        | "webhook_config"
        | "n8n_workflow"
        | "webhook_endpoint"
        | "chatbot_template"
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
      admin_role: ["system_admin", "developer", "support", "template_manager"],
      ai_action_status: ["active", "inactive", "draft", "archived"],
      ai_action_type: [
        "form_action",
        "button_action",
        "web_search",
        "slack_integration",
        "calendly_integration",
        "custom_api",
        "email_action",
        "webhook_action",
        "lead_collection",
      ],
      api_key_scope: ["global", "organization", "user"],
      api_key_tier: ["system", "free", "user"],
      app_role: ["admin", "moderator", "user"],
      chatbot_status: ["active", "training", "paused", "draft"],
      clean_subscription_status: ["active", "canceled", "past_due", "trialing"],
      clean_voice_note_status: ["processing", "completed", "error"],
      document_status: ["uploading", "processing", "ready", "error"],
      execution_status: ["success", "failure", "pending", "timeout"],
      message_role: ["user", "assistant", "system"],
      organization_role: [
        "org_admin",
        "org_manager",
        "org_member",
        "org_viewer",
      ],
      referral_status: ["pending", "paid", "cancelled"],
      subscription_status: ["active", "canceled", "past_due", "incomplete"],
      usage_type: [
        "message",
        "token",
        "document_upload",
        "api_call",
        "bot_event",
        "event_dispatch",
        "webhook_config",
        "n8n_workflow",
        "webhook_endpoint",
        "chatbot_template",
      ],
    },
  },
} as const
