/**
 * Generated Supabase Database type -- single source of truth for the
 * PepNationLab schema (project ydsaqnnuwyvtyxgvrnys).
 *
 * Regenerate with: supabase gen types typescript --project-id ydsaqnnuwyvtyxgvrnys
 * Do NOT hand-edit. Thread through the Supabase clients via createClient<Database>().
 */
/* eslint-disable */
// @ts-nocheck
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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      abandoned_cart_reminders: {
        Row: {
          cart_state_snapshot: Json | null
          cart_value: number | null
          channel: string
          id: string
          recovered_order_id: string | null
          sent_at: string
          step_index: number
          user_id: string
          variant_name: string | null
        }
        Insert: {
          cart_state_snapshot?: Json | null
          cart_value?: number | null
          channel: string
          id?: string
          recovered_order_id?: string | null
          sent_at?: string
          step_index?: number
          user_id: string
          variant_name?: string | null
        }
        Update: {
          cart_state_snapshot?: Json | null
          cart_value?: number | null
          channel?: string
          id?: string
          recovered_order_id?: string | null
          sent_at?: string
          step_index?: number
          user_id?: string
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_cart_reminders_recovered_order_id_fkey"
            columns: ["recovered_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abandoned_cart_reminders_recovered_order_id_fkey"
            columns: ["recovered_order_id"]
            isOneToOne: false
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abandoned_cart_reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      account_audit_log: {
        Row: {
          created_at: string
          details: Json | null
          event: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          event?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      account_export_jobs: {
        Row: {
          completed_at: string | null
          file_path: string | null
          id: string
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          file_path?: string | null
          id?: string
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          file_path?: string | null
          id?: string
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_search_no_results_log: {
        Row: {
          admin_id: string | null
          created_at: string
          filters: Json | null
          id: string
          query: string
          scope: string
          user_agent: string | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          filters?: Json | null
          id?: string
          query: string
          scope?: string
          user_agent?: string | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          filters?: Json | null
          id?: string
          query?: string
          scope?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_shadow_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          pinned: boolean
          subject_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          pinned?: boolean
          subject_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          pinned?: boolean
          subject_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_broadcasts: {
        Row: {
          agent_id: string
          body: string
          created_at: string
          id: string
          recipient_count: number
          sent_count: number
          title: string
          url: string | null
        }
        Insert: {
          agent_id: string
          body: string
          created_at?: string
          id?: string
          recipient_count?: number
          sent_count?: number
          title: string
          url?: string | null
        }
        Update: {
          agent_id?: string
          body?: string
          created_at?: string
          id?: string
          recipient_count?: number
          sent_count?: number
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_broadcasts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_domains: {
        Row: {
          agent_id: string
          created_at: string
          hostname: string
          id: string
          status: string
          verified_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          hostname: string
          id?: string
          status?: string
          verified_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          hostname?: string
          id?: string
          status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_domains_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_inventory: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          low_stock_alerted_at: string | null
          low_stock_threshold: number
          product_id: string
          stock_count: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          low_stock_alerted_at?: string | null
          low_stock_threshold?: number
          product_id: string
          stock_count?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          low_stock_alerted_at?: string | null
          low_stock_threshold?: number
          product_id?: string
          stock_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_inventory_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          id: string
          intended_account_type: string | null
          intended_credit_limit: number | null
          intended_prepaid_balance: number | null
          intended_role: string
          intended_tier: string | null
          invited_by: string
          metadata: Json
          parent_agent_id: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          intended_account_type?: string | null
          intended_credit_limit?: number | null
          intended_prepaid_balance?: number | null
          intended_role?: string
          intended_tier?: string | null
          invited_by: string
          metadata?: Json
          parent_agent_id?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          token: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          intended_account_type?: string | null
          intended_credit_limit?: number | null
          intended_prepaid_balance?: number | null
          intended_role?: string
          intended_tier?: string | null
          invited_by?: string
          metadata?: Json
          parent_agent_id?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_invitations_parent_agent_id_fkey"
            columns: ["parent_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_invitations_redeemed_by_fkey"
            columns: ["redeemed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_invoices: {
        Row: {
          agent_id: string
          created_at: string | null
          disputed_at: string | null
          due_date: string | null
          id: string
          paid_at: string | null
          payment_method: string | null
          status: string | null
          super_agent_id: string
          total_cogs: number
          total_owed: number
          total_shipping: number
          updated_at: string | null
          week_end: string
          week_start: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          disputed_at?: string | null
          due_date?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          super_agent_id: string
          total_cogs?: number
          total_owed?: number
          total_shipping?: number
          updated_at?: string | null
          week_end: string
          week_start: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          disputed_at?: string | null
          due_date?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          super_agent_id?: string
          total_cogs?: number
          total_owed?: number
          total_shipping?: number
          updated_at?: string | null
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_agent_invoices_sub_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_agent_invoices_super_agent_id_fkey"
            columns: ["super_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_products: {
        Row: {
          agent_id: string
          created_at: string | null
          custom_description: string | null
          custom_image_url: string | null
          custom_name: string | null
          id: string
          is_on_sale: boolean | null
          is_visible: boolean | null
          margin_percent: number
          product_id: string
          retail_price: number
          sale_price: number | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          custom_description?: string | null
          custom_image_url?: string | null
          custom_name?: string | null
          id?: string
          is_on_sale?: boolean | null
          is_visible?: boolean | null
          margin_percent?: number
          product_id: string
          retail_price: number
          sale_price?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          custom_description?: string | null
          custom_image_url?: string | null
          custom_name?: string | null
          id?: string
          is_on_sale?: boolean | null
          is_visible?: boolean | null
          margin_percent?: number
          product_id?: string
          retail_price?: number
          sale_price?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_products_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_profiles: {
        Row: {
          accent_color: string | null
          bio: string | null
          bulk_discount_tiers: Json | null
          bundles_config: Json | null
          created_at: string | null
          display_name: string
          display_name_changed_at: string | null
          dynamic_pricing_tiers: Json | null
          enable_bulk_discounts: boolean | null
          enable_dynamic_pricing: boolean | null
          featured_products: string[] | null
          hero_image_url: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          min_order_qty: number | null
          min_overall_qty: number | null
          payment_handles: Json | null
          previous_display_name: string | null
          previous_display_name_dismissed: boolean | null
          primary_color: string | null
          qr_code_data: string | null
          qr_code_url: string | null
          secondary_color: string | null
          slug: string
          storefront_renamed_at: string | null
          tagline: string | null
          theme_config: Json | null
          updated_at: string | null
          volume_pricing_enabled: boolean
          warehouse_address: Json | null
          warehouse_origin_id: string | null
        }
        Insert: {
          accent_color?: string | null
          bio?: string | null
          bulk_discount_tiers?: Json | null
          bundles_config?: Json | null
          created_at?: string | null
          display_name: string
          display_name_changed_at?: string | null
          dynamic_pricing_tiers?: Json | null
          enable_bulk_discounts?: boolean | null
          enable_dynamic_pricing?: boolean | null
          featured_products?: string[] | null
          hero_image_url?: string | null
          id: string
          is_active?: boolean
          logo_url?: string | null
          min_order_qty?: number | null
          min_overall_qty?: number | null
          payment_handles?: Json | null
          previous_display_name?: string | null
          previous_display_name_dismissed?: boolean | null
          primary_color?: string | null
          qr_code_data?: string | null
          qr_code_url?: string | null
          secondary_color?: string | null
          slug: string
          storefront_renamed_at?: string | null
          tagline?: string | null
          theme_config?: Json | null
          updated_at?: string | null
          volume_pricing_enabled?: boolean
          warehouse_address?: Json | null
          warehouse_origin_id?: string | null
        }
        Update: {
          accent_color?: string | null
          bio?: string | null
          bulk_discount_tiers?: Json | null
          bundles_config?: Json | null
          created_at?: string | null
          display_name?: string
          display_name_changed_at?: string | null
          dynamic_pricing_tiers?: Json | null
          enable_bulk_discounts?: boolean | null
          enable_dynamic_pricing?: boolean | null
          featured_products?: string[] | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          min_order_qty?: number | null
          min_overall_qty?: number | null
          payment_handles?: Json | null
          previous_display_name?: string | null
          previous_display_name_dismissed?: boolean | null
          primary_color?: string | null
          qr_code_data?: string | null
          qr_code_url?: string | null
          secondary_color?: string | null
          slug?: string
          storefront_renamed_at?: string | null
          tagline?: string | null
          theme_config?: Json | null
          updated_at?: string | null
          volume_pricing_enabled?: boolean
          warehouse_address?: Json | null
          warehouse_origin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_profiles_warehouse_origin_id_fkey"
            columns: ["warehouse_origin_id"]
            isOneToOne: false
            referencedRelation: "shipping_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_researcher_growth_goals: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          period_end: string
          period_start: string
          target_count: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          target_count: number
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          target_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_researcher_growth_goals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_researcher_notes: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          note: string
          researcher_id: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          note?: string
          researcher_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          note?: string
          researcher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_researcher_notes_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_researcher_notes_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_researcher_pins: {
        Row: {
          agent_id: string
          id: string
          pinned_at: string
          researcher_id: string
        }
        Insert: {
          agent_id: string
          id?: string
          pinned_at?: string
          researcher_id: string
        }
        Update: {
          agent_id?: string
          id?: string
          pinned_at?: string
          researcher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_researcher_pins_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_researcher_pins_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_researcher_reminders: {
        Row: {
          agent_id: string
          completed_at: string | null
          created_at: string
          id: string
          remind_at: string
          researcher_id: string
          title: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          remind_at: string
          researcher_id: string
          title: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          remind_at?: string
          researcher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_researcher_reminders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_researcher_reminders_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_researcher_tags: {
        Row: {
          agent_id: string
          color: string | null
          created_at: string
          id: string
          researcher_id: string
          tag: string
        }
        Insert: {
          agent_id: string
          color?: string | null
          created_at?: string
          id?: string
          researcher_id: string
          tag: string
        }
        Update: {
          agent_id?: string
          color?: string | null
          created_at?: string
          id?: string
          researcher_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_researcher_tags_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_researcher_tags_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_sales_goals: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          period_end: string
          period_start: string
          target_cents: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          target_cents: number
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          target_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_sales_goals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_saved_segments: {
        Row: {
          agent_id: string
          created_at: string
          filters: Json
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          filters?: Json
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_saved_segments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_saved_views: {
        Row: {
          agent_id: string
          created_at: string
          filters_jsonb: Json
          id: string
          is_default: boolean | null
          name: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          filters_jsonb?: Json
          id?: string
          is_default?: boolean | null
          name: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          filters_jsonb?: Json
          id?: string
          is_default?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_saved_views_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_storefront_events: {
        Row: {
          agent_id: string
          amount_cents: number | null
          created_at: string
          event_type: string
          id: number
          is_wholesale: boolean
          order_id: string | null
          path: string | null
          product_id: string | null
          quantity: number | null
          search_term: string | null
          session_id: string
          user_agent: string | null
          visitor_id: string | null
        }
        Insert: {
          agent_id: string
          amount_cents?: number | null
          created_at?: string
          event_type: string
          id?: number
          is_wholesale?: boolean
          order_id?: string | null
          path?: string | null
          product_id?: string | null
          quantity?: number | null
          search_term?: string | null
          session_id: string
          user_agent?: string | null
          visitor_id?: string | null
        }
        Update: {
          agent_id?: string
          amount_cents?: number | null
          created_at?: string
          event_type?: string
          id?: number
          is_wholesale?: boolean
          order_id?: string | null
          path?: string | null
          product_id?: string | null
          quantity?: number | null
          search_term?: string | null
          session_id?: string
          user_agent?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_storefront_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_storefront_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_storefront_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_storefront_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          rate_limit_per_day: number | null
          rate_limit_per_minute: number | null
          revoked_at: string | null
          scopes: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          rate_limit_per_day?: number | null
          rate_limit_per_minute?: number | null
          revoked_at?: string | null
          scopes?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          rate_limit_per_day?: number | null
          rate_limit_per_minute?: number | null
          revoked_at?: string | null
          scopes?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      api_request_log: {
        Row: {
          api_key_id: string | null
          created_at: string | null
          endpoint: string
          id: string
          ip_address: unknown
          latency_ms: number | null
          method: string
          status_code: number | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string | null
          endpoint: string
          id?: string
          ip_address?: unknown
          latency_ms?: number | null
          method: string
          status_code?: number | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string | null
          endpoint?: string
          id?: string
          ip_address?: unknown
          latency_ms?: number | null
          method?: string
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_conversations: {
        Row: {
          archived_at: string | null
          counterpart_id: string
          id: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          counterpart_id: string
          id?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          counterpart_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      availability_failed_attempts: {
        Row: {
          caller_id: string | null
          field: string
          id: number
          ip: string | null
          normalized: string
          occurred_at: string
          reason: string
          reason_code: string
          user_agent: string | null
          value: string
        }
        Insert: {
          caller_id?: string | null
          field: string
          id?: number
          ip?: string | null
          normalized: string
          occurred_at?: string
          reason: string
          reason_code: string
          user_agent?: string | null
          value: string
        }
        Update: {
          caller_id?: string | null
          field?: string
          id?: number
          ip?: string | null
          normalized?: string
          occurred_at?: string
          reason?: string
          reason_code?: string
          user_agent?: string | null
          value?: string
        }
        Relationships: []
      }
      balance_transactions: {
        Row: {
          agent_id: string
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          created_by: string | null
          description: string
          id: string
          reference_id: string | null
          reference_type: string | null
          type: string
        }
        Insert: {
          agent_id: string
          amount: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type: string
        }
        Update: {
          agent_id?: string
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_transactions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balance_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_recovery_variants: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          name: string
          steps: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: []
      }
      client_error_events: {
        Row: {
          context: string | null
          created_at: string
          id: string
          kind: string | null
          message: string
          meta: Json | null
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          message: string
          meta?: Json | null
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          message?: string
          meta?: Json | null
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      compliance_benefit_terms: {
        Row: {
          created_at: string
          term: string
        }
        Insert: {
          created_at?: string
          term: string
        }
        Update: {
          created_at?: string
          term?: string
        }
        Relationships: []
      }
      compliance_humanuse_terms: {
        Row: {
          created_at: string
          term: string
        }
        Insert: {
          created_at?: string
          term: string
        }
        Update: {
          created_at?: string
          term?: string
        }
        Relationships: []
      }
      compound_chembl_bindings: {
        Row: {
          activity_id: string | null
          assay_type: string | null
          chembl_id: string | null
          compound_slug: string
          document_chembl_id: string | null
          document_pmid: string | null
          fetched_at: string | null
          id: string
          pchembl_value: number | null
          standard_type: string | null
          standard_units: string | null
          standard_value: number | null
          target_chembl_id: string | null
          target_name: string
          target_organism: string | null
          target_uniprot: string | null
        }
        Insert: {
          activity_id?: string | null
          assay_type?: string | null
          chembl_id?: string | null
          compound_slug: string
          document_chembl_id?: string | null
          document_pmid?: string | null
          fetched_at?: string | null
          id?: string
          pchembl_value?: number | null
          standard_type?: string | null
          standard_units?: string | null
          standard_value?: number | null
          target_chembl_id?: string | null
          target_name: string
          target_organism?: string | null
          target_uniprot?: string | null
        }
        Update: {
          activity_id?: string | null
          assay_type?: string | null
          chembl_id?: string | null
          compound_slug?: string
          document_chembl_id?: string | null
          document_pmid?: string | null
          fetched_at?: string | null
          id?: string
          pchembl_value?: number | null
          standard_type?: string | null
          standard_units?: string | null
          standard_value?: number | null
          target_chembl_id?: string | null
          target_name?: string
          target_organism?: string | null
          target_uniprot?: string | null
        }
        Relationships: []
      }
      compound_clinical_trials: {
        Row: {
          compound_slug: string
          condition: string | null
          enrollment: number | null
          fetched_at: string
          id: string
          intervention: string | null
          lead_sponsor: string | null
          nct_id: string
          phase: string | null
          primary_completion_date: string | null
          primary_outcome: string | null
          raw_data: Json | null
          start_date: string | null
          status: string | null
          title: string | null
          url: string | null
        }
        Insert: {
          compound_slug: string
          condition?: string | null
          enrollment?: number | null
          fetched_at?: string
          id?: string
          intervention?: string | null
          lead_sponsor?: string | null
          nct_id: string
          phase?: string | null
          primary_completion_date?: string | null
          primary_outcome?: string | null
          raw_data?: Json | null
          start_date?: string | null
          status?: string | null
          title?: string | null
          url?: string | null
        }
        Update: {
          compound_slug?: string
          condition?: string | null
          enrollment?: number | null
          fetched_at?: string
          id?: string
          intervention?: string | null
          lead_sponsor?: string | null
          nct_id?: string
          phase?: string | null
          primary_completion_date?: string | null
          primary_outcome?: string | null
          raw_data?: Json | null
          start_date?: string | null
          status?: string | null
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      compound_companion_papers: {
        Row: {
          co_occurrence_count: number
          companion_slug: string
          compound_slug: string
          computed_at: string | null
          id: string
          shared_pmids: string[] | null
        }
        Insert: {
          co_occurrence_count?: number
          companion_slug: string
          compound_slug: string
          computed_at?: string | null
          id?: string
          shared_pmids?: string[] | null
        }
        Update: {
          co_occurrence_count?: number
          companion_slug?: string
          compound_slug?: string
          computed_at?: string | null
          id?: string
          shared_pmids?: string[] | null
        }
        Relationships: []
      }
      compound_fact_citations: {
        Row: {
          compound_slug: string
          confidence_level: string
          created_at: string | null
          evidence_count: number | null
          fact_text: string
          field_name: string
          id: string
          reference_id: string | null
          reference_pmid: string | null
        }
        Insert: {
          compound_slug: string
          confidence_level: string
          created_at?: string | null
          evidence_count?: number | null
          fact_text: string
          field_name: string
          id?: string
          reference_id?: string | null
          reference_pmid?: string | null
        }
        Update: {
          compound_slug?: string
          confidence_level?: string
          created_at?: string | null
          evidence_count?: number | null
          fact_text?: string
          field_name?: string
          id?: string
          reference_id?: string | null
          reference_pmid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compound_fact_citations_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "compound_references"
            referencedColumns: ["id"]
          },
        ]
      }
      compound_grants_funding: {
        Row: {
          abstract: string | null
          award_amount_usd: number | null
          compound_slug: string
          fetched_at: string | null
          fiscal_year: number | null
          funder: string | null
          grant_number: string
          id: string
          institution: string | null
          pi_name: string | null
          url: string | null
        }
        Insert: {
          abstract?: string | null
          award_amount_usd?: number | null
          compound_slug: string
          fetched_at?: string | null
          fiscal_year?: number | null
          funder?: string | null
          grant_number: string
          id?: string
          institution?: string | null
          pi_name?: string | null
          url?: string | null
        }
        Update: {
          abstract?: string | null
          award_amount_usd?: number | null
          compound_slug?: string
          fetched_at?: string | null
          fiscal_year?: number | null
          funder?: string | null
          grant_number?: string
          id?: string
          institution?: string | null
          pi_name?: string | null
          url?: string | null
        }
        Relationships: []
      }
      compound_orthologs: {
        Row: {
          compound_slug: string
          fetched_at: string | null
          id: string
          notes: string | null
          sequence: string | null
          sequence_identity: number | null
          sequence_length: number | null
          signal_peptide_end: number | null
          species: string
          species_taxon: number | null
          uniprot_id: string
        }
        Insert: {
          compound_slug: string
          fetched_at?: string | null
          id?: string
          notes?: string | null
          sequence?: string | null
          sequence_identity?: number | null
          sequence_length?: number | null
          signal_peptide_end?: number | null
          species: string
          species_taxon?: number | null
          uniprot_id: string
        }
        Update: {
          compound_slug?: string
          fetched_at?: string | null
          id?: string
          notes?: string | null
          sequence?: string | null
          sequence_identity?: number | null
          sequence_length?: number | null
          signal_peptide_end?: number | null
          species?: string
          species_taxon?: number | null
          uniprot_id?: string
        }
        Relationships: []
      }
      compound_pdb_structures: {
        Row: {
          cif_url: string | null
          compound_slug: string
          experimental_method: string | null
          fetched_at: string | null
          id: string
          pdb_id: string | null
          release_year: number | null
          resolution_a: number | null
          source: string
          title: string | null
          url: string | null
        }
        Insert: {
          cif_url?: string | null
          compound_slug: string
          experimental_method?: string | null
          fetched_at?: string | null
          id?: string
          pdb_id?: string | null
          release_year?: number | null
          resolution_a?: number | null
          source: string
          title?: string | null
          url?: string | null
        }
        Update: {
          cif_url?: string | null
          compound_slug?: string
          experimental_method?: string | null
          fetched_at?: string | null
          id?: string
          pdb_id?: string | null
          release_year?: number | null
          resolution_a?: number | null
          source?: string
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      compound_pubmed_cache: {
        Row: {
          compound_slug: string
          fetched_at: string
          id: string
          pmid_list: string[]
          query: string
          raw_response: Json | null
          total_count: number
        }
        Insert: {
          compound_slug: string
          fetched_at?: string
          id?: string
          pmid_list?: string[]
          query: string
          raw_response?: Json | null
          total_count?: number
        }
        Update: {
          compound_slug?: string
          fetched_at?: string
          id?: string
          pmid_list?: string[]
          query?: string
          raw_response?: Json | null
          total_count?: number
        }
        Relationships: []
      }
      compound_recall_alerts: {
        Row: {
          agency: string | null
          alert_class: string | null
          alert_date: string | null
          alert_type: string
          compound_slug: string
          created_at: string | null
          id: string
          raw_data: Json | null
          summary: string | null
          title: string
          url: string | null
        }
        Insert: {
          agency?: string | null
          alert_class?: string | null
          alert_date?: string | null
          alert_type: string
          compound_slug: string
          created_at?: string | null
          id?: string
          raw_data?: Json | null
          summary?: string | null
          title: string
          url?: string | null
        }
        Update: {
          agency?: string | null
          alert_class?: string | null
          alert_date?: string | null
          alert_type?: string
          compound_slug?: string
          created_at?: string | null
          id?: string
          raw_data?: Json | null
          summary?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      compound_references: {
        Row: {
          abstract: string | null
          added_at: string | null
          authors: string | null
          citation_count: number | null
          compound_id: string | null
          compound_slug: string
          created_at: string | null
          doi: string | null
          evidence_grade: string | null
          external_id: string | null
          id: string
          is_pivotal: boolean | null
          journal: string | null
          metadata: Json | null
          pages: string | null
          pdf_url: string | null
          pmid: string | null
          published_date: string | null
          ref_type: string
          source: string | null
          source_type: string | null
          title: string
          updated_at: string | null
          url: string | null
          volume: string | null
          year: number | null
        }
        Insert: {
          abstract?: string | null
          added_at?: string | null
          authors?: string | null
          citation_count?: number | null
          compound_id?: string | null
          compound_slug: string
          created_at?: string | null
          doi?: string | null
          evidence_grade?: string | null
          external_id?: string | null
          id?: string
          is_pivotal?: boolean | null
          journal?: string | null
          metadata?: Json | null
          pages?: string | null
          pdf_url?: string | null
          pmid?: string | null
          published_date?: string | null
          ref_type: string
          source?: string | null
          source_type?: string | null
          title: string
          updated_at?: string | null
          url?: string | null
          volume?: string | null
          year?: number | null
        }
        Update: {
          abstract?: string | null
          added_at?: string | null
          authors?: string | null
          citation_count?: number | null
          compound_id?: string | null
          compound_slug?: string
          created_at?: string | null
          doi?: string | null
          evidence_grade?: string | null
          external_id?: string | null
          id?: string
          is_pivotal?: boolean | null
          journal?: string | null
          metadata?: Json | null
          pages?: string | null
          pdf_url?: string | null
          pmid?: string | null
          published_date?: string | null
          ref_type?: string
          source?: string | null
          source_type?: string | null
          title?: string
          updated_at?: string | null
          url?: string | null
          volume?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compound_references_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compound_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compound_references_compound_id_fkey"
            columns: ["compound_id"]
            isOneToOne: false
            referencedRelation: "compounds"
            referencedColumns: ["id"]
          },
        ]
      }
      compound_wada_history: {
        Row: {
          compound_slug: string
          created_at: string | null
          id: string
          notes: string | null
          source_url: string | null
          status: string
          year: number
        }
        Insert: {
          compound_slug: string
          created_at?: string | null
          id?: string
          notes?: string | null
          source_url?: string | null
          status: string
          year: number
        }
        Update: {
          compound_slug?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          source_url?: string | null
          status?: string
          year?: number
        }
        Relationships: []
      }
      compounds: {
        Row: {
          active_trial_count: number | null
          aliases: string[]
          alphafold_id: string | null
          auc_ng_ml_hr: number | null
          benefits: string | null
          best_stacked_with: string[]
          cas_number: string | null
          category: string | null
          chembl_id: string | null
          chembl_last_synced_at: string | null
          cmax_ng_ml: number | null
          coa_url: string | null
          completed_trial_count: number | null
          compound_class: string | null
          created_at: string
          dailymed_last_synced_at: string | null
          dailymed_setid: string | null
          dea_schedule: string | null
          discontinuation_reason: string | null
          discontinuation_year: number | null
          display_name: string
          efficacy_scores: Json
          eli5_summary: string | null
          ema_approval_year: number | null
          embedding: string | null
          evidence_tier: string
          faers_event_count: number | null
          faers_last_synced_at: string | null
          fda_approval_year: number | null
          gravy_hydrophobicity: number | null
          half_life: string | null
          handling: Json
          id: string
          identity: Json
          intranasal_bioavailability_pct: number | null
          intranasal_note: string | null
          intranasal_status: string | null
          is_discontinued: boolean | null
          is_glp1: boolean
          is_orphan_drug: boolean | null
          is_pro_angiogenic: boolean
          is_repurposed: boolean | null
          is_stack: boolean
          is_temp_sensitive: boolean
          isoelectric_point: number | null
          last_evidence_synced_at: string | null
          last_reviewed_at: string | null
          match_phrases: string[] | null
          measured_half_life_hours: number | null
          mechanism: string | null
          molecular_target: string | null
          molecular_weight_da: number | null
          oral_bioavailability_pct: number | null
          orphan_indications: string[] | null
          patent_expiry_year: number | null
          patent_status: string | null
          pdb_ids: string[] | null
          pipeline_indication: string | null
          pipeline_phase: string | null
          pipeline_status: string | null
          pk_summary: string | null
          plain_summary: string | null
          predicted_half_life_hours: number | null
          pubchem_cid: number | null
          pubmed_citation_count: number | null
          purity_percentage: number | null
          quality_score: number | null
          receptors: string[] | null
          recommended_action: string
          reconstitution_shelf_days: number | null
          regulatory: string | null
          repurposed_from: string | null
          repurposed_to: string | null
          research_areas: string[]
          risk_level: string
          risk_reasons: string[]
          route_of_admin: string[] | null
          rxnorm_cui: string | null
          search_keywords: string[] | null
          sequence_one_letter: string | null
          sequence_three_letter: string | null
          side_effects: string | null
          slug: string
          sources: string[]
          stack_components: string[]
          stack_rationale: string | null
          studied_for: string[]
          tmax_hours: number | null
          typical_frequency: string | null
          unii: string | null
          uniprot_id: string | null
          uniprot_last_synced_at: string | null
          updated_at: string
          wada_status: string
          warnings: string | null
          year_discovered: number | null
          year_first_approved: number | null
          year_first_human_trial: number | null
        }
        Insert: {
          active_trial_count?: number | null
          aliases?: string[]
          alphafold_id?: string | null
          auc_ng_ml_hr?: number | null
          benefits?: string | null
          best_stacked_with?: string[]
          cas_number?: string | null
          category?: string | null
          chembl_id?: string | null
          chembl_last_synced_at?: string | null
          cmax_ng_ml?: number | null
          coa_url?: string | null
          completed_trial_count?: number | null
          compound_class?: string | null
          created_at?: string
          dailymed_last_synced_at?: string | null
          dailymed_setid?: string | null
          dea_schedule?: string | null
          discontinuation_reason?: string | null
          discontinuation_year?: number | null
          display_name: string
          efficacy_scores?: Json
          eli5_summary?: string | null
          ema_approval_year?: number | null
          embedding?: string | null
          evidence_tier?: string
          faers_event_count?: number | null
          faers_last_synced_at?: string | null
          fda_approval_year?: number | null
          gravy_hydrophobicity?: number | null
          half_life?: string | null
          handling?: Json
          id?: string
          identity?: Json
          intranasal_bioavailability_pct?: number | null
          intranasal_note?: string | null
          intranasal_status?: string | null
          is_discontinued?: boolean | null
          is_glp1?: boolean
          is_orphan_drug?: boolean | null
          is_pro_angiogenic?: boolean
          is_repurposed?: boolean | null
          is_stack?: boolean
          is_temp_sensitive?: boolean
          isoelectric_point?: number | null
          last_evidence_synced_at?: string | null
          last_reviewed_at?: string | null
          match_phrases?: string[] | null
          measured_half_life_hours?: number | null
          mechanism?: string | null
          molecular_target?: string | null
          molecular_weight_da?: number | null
          oral_bioavailability_pct?: number | null
          orphan_indications?: string[] | null
          patent_expiry_year?: number | null
          patent_status?: string | null
          pdb_ids?: string[] | null
          pipeline_indication?: string | null
          pipeline_phase?: string | null
          pipeline_status?: string | null
          pk_summary?: string | null
          plain_summary?: string | null
          predicted_half_life_hours?: number | null
          pubchem_cid?: number | null
          pubmed_citation_count?: number | null
          purity_percentage?: number | null
          quality_score?: number | null
          receptors?: string[] | null
          recommended_action?: string
          reconstitution_shelf_days?: number | null
          regulatory?: string | null
          repurposed_from?: string | null
          repurposed_to?: string | null
          research_areas?: string[]
          risk_level?: string
          risk_reasons?: string[]
          route_of_admin?: string[] | null
          rxnorm_cui?: string | null
          search_keywords?: string[] | null
          sequence_one_letter?: string | null
          sequence_three_letter?: string | null
          side_effects?: string | null
          slug: string
          sources?: string[]
          stack_components?: string[]
          stack_rationale?: string | null
          studied_for?: string[]
          tmax_hours?: number | null
          typical_frequency?: string | null
          unii?: string | null
          uniprot_id?: string | null
          uniprot_last_synced_at?: string | null
          updated_at?: string
          wada_status?: string
          warnings?: string | null
          year_discovered?: number | null
          year_first_approved?: number | null
          year_first_human_trial?: number | null
        }
        Update: {
          active_trial_count?: number | null
          aliases?: string[]
          alphafold_id?: string | null
          auc_ng_ml_hr?: number | null
          benefits?: string | null
          best_stacked_with?: string[]
          cas_number?: string | null
          category?: string | null
          chembl_id?: string | null
          chembl_last_synced_at?: string | null
          cmax_ng_ml?: number | null
          coa_url?: string | null
          completed_trial_count?: number | null
          compound_class?: string | null
          created_at?: string
          dailymed_last_synced_at?: string | null
          dailymed_setid?: string | null
          dea_schedule?: string | null
          discontinuation_reason?: string | null
          discontinuation_year?: number | null
          display_name?: string
          efficacy_scores?: Json
          eli5_summary?: string | null
          ema_approval_year?: number | null
          embedding?: string | null
          evidence_tier?: string
          faers_event_count?: number | null
          faers_last_synced_at?: string | null
          fda_approval_year?: number | null
          gravy_hydrophobicity?: number | null
          half_life?: string | null
          handling?: Json
          id?: string
          identity?: Json
          intranasal_bioavailability_pct?: number | null
          intranasal_note?: string | null
          intranasal_status?: string | null
          is_discontinued?: boolean | null
          is_glp1?: boolean
          is_orphan_drug?: boolean | null
          is_pro_angiogenic?: boolean
          is_repurposed?: boolean | null
          is_stack?: boolean
          is_temp_sensitive?: boolean
          isoelectric_point?: number | null
          last_evidence_synced_at?: string | null
          last_reviewed_at?: string | null
          match_phrases?: string[] | null
          measured_half_life_hours?: number | null
          mechanism?: string | null
          molecular_target?: string | null
          molecular_weight_da?: number | null
          oral_bioavailability_pct?: number | null
          orphan_indications?: string[] | null
          patent_expiry_year?: number | null
          patent_status?: string | null
          pdb_ids?: string[] | null
          pipeline_indication?: string | null
          pipeline_phase?: string | null
          pipeline_status?: string | null
          pk_summary?: string | null
          plain_summary?: string | null
          predicted_half_life_hours?: number | null
          pubchem_cid?: number | null
          pubmed_citation_count?: number | null
          purity_percentage?: number | null
          quality_score?: number | null
          receptors?: string[] | null
          recommended_action?: string
          reconstitution_shelf_days?: number | null
          regulatory?: string | null
          repurposed_from?: string | null
          repurposed_to?: string | null
          research_areas?: string[]
          risk_level?: string
          risk_reasons?: string[]
          route_of_admin?: string[] | null
          rxnorm_cui?: string | null
          search_keywords?: string[] | null
          sequence_one_letter?: string | null
          sequence_three_letter?: string | null
          side_effects?: string | null
          slug?: string
          sources?: string[]
          stack_components?: string[]
          stack_rationale?: string | null
          studied_for?: string[]
          tmax_hours?: number | null
          typical_frequency?: string | null
          unii?: string | null
          uniprot_id?: string | null
          uniprot_last_synced_at?: string | null
          updated_at?: string
          wada_status?: string
          warnings?: string | null
          year_discovered?: number | null
          year_first_approved?: number | null
          year_first_human_trial?: number | null
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          code: string
          coupon_id: string
          id: string
          order_id: string | null
          redeemed_at: string
          user_id: string | null
        }
        Insert: {
          code: string
          coupon_id: string
          id?: string
          order_id?: string | null
          redeemed_at?: string
          user_id?: string | null
        }
        Update: {
          code?: string
          coupon_id?: string
          id?: string
          order_id?: string | null
          redeemed_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          agent_id: string
          code: string
          created_at: string | null
          deleted_at: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          max_uses_per_user: number | null
          min_order_amount: number | null
          new_customers_only: boolean
          notes: string | null
          stacking_policy: Json
          starts_at: string | null
          uses_count: number | null
        }
        Insert: {
          agent_id: string
          code: string
          created_at?: string | null
          deleted_at?: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          max_uses_per_user?: number | null
          min_order_amount?: number | null
          new_customers_only?: boolean
          notes?: string | null
          stacking_policy?: Json
          starts_at?: string | null
          uses_count?: number | null
        }
        Update: {
          agent_id?: string
          code?: string
          created_at?: string | null
          deleted_at?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          max_uses_per_user?: number | null
          min_order_amount?: number | null
          new_customers_only?: boolean
          notes?: string | null
          stacking_policy?: Json
          starts_at?: string | null
          uses_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_progress: {
        Row: {
          assessment_score: number | null
          assessment_total: number | null
          certified_at: string | null
          completed_modules: Json
          course: string
          created_at: string
          current_screen: string | null
          id: string
          quiz_scores: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          assessment_score?: number | null
          assessment_total?: number | null
          certified_at?: string | null
          completed_modules?: Json
          course?: string
          created_at?: string
          current_screen?: string | null
          id?: string
          quiz_scores?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          assessment_score?: number | null
          assessment_total?: number | null
          certified_at?: string | null
          completed_modules?: Json
          course?: string
          created_at?: string
          current_screen?: string | null
          id?: string
          quiz_scores?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_increase_requests: {
        Row: {
          agent_id: string
          created_at: string
          current_limit: number
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          reason: string | null
          requested_limit: number
          status: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          current_limit: number
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          reason?: string | null
          requested_limit: number
          status?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          current_limit?: number
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          reason?: string | null
          requested_limit?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_increase_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_increase_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_runs: {
        Row: {
          finished_at: string | null
          id: string
          job_name: string
          notes: string | null
          partition_key: string
          started_at: string
          status: string
          summary: string | null
        }
        Insert: {
          finished_at?: string | null
          id?: string
          job_name: string
          notes?: string | null
          partition_key: string
          started_at?: string
          status?: string
          summary?: string | null
        }
        Update: {
          finished_at?: string | null
          id?: string
          job_name?: string
          notes?: string | null
          partition_key?: string
          started_at?: string
          status?: string
          summary?: string | null
        }
        Relationships: []
      }
      disclaimer_acceptances: {
        Row: {
          accepted_at: string | null
          age_verified: boolean
          created_at: string | null
          disclaimer_version: string
          id: string
          ip_address: string | null
          layer: Database["public"]["Enums"]["disclaimer_layer"]
          order_id: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
          verified_age: number | null
        }
        Insert: {
          accepted_at?: string | null
          age_verified?: boolean
          created_at?: string | null
          disclaimer_version?: string
          id?: string
          ip_address?: string | null
          layer: Database["public"]["Enums"]["disclaimer_layer"]
          order_id?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          verified_age?: number | null
        }
        Update: {
          accepted_at?: string | null
          age_verified?: boolean
          created_at?: string | null
          disclaimer_version?: string
          id?: string
          ip_address?: string | null
          layer?: Database["public"]["Enums"]["disclaimer_layer"]
          order_id?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          verified_age?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "disclaimer_acceptances_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disclaimer_acceptances_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disclaimer_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          created_at: string
          error: string | null
          id: string
          ok: boolean
          provider_id: string | null
          recipient: string
          skipped: boolean
          subject: string
          template: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          ok: boolean
          provider_id?: string | null
          recipient: string
          skipped?: boolean
          subject: string
          template?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          ok?: boolean
          provider_id?: string | null
          recipient?: string
          skipped?: boolean
          subject?: string
          template?: string | null
        }
        Relationships: []
      }
      email_verification_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed: boolean
          created_at: string
          email: string
          expires_at: string
          id: string
          purpose: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed?: boolean
          created_at?: string
          email: string
          expires_at: string
          id?: string
          purpose?: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed?: boolean
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          purpose?: string
        }
        Relationships: []
      }
      faq_clicks: {
        Row: {
          created_at: string
          faq_id: string
          id: number
          ip_hash: string | null
          source: string | null
          user_agent: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          created_at?: string
          faq_id: string
          id?: number
          ip_hash?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          created_at?: string
          faq_id?: string
          id?: number
          ip_hash?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      flash_sales: {
        Row: {
          banner_text: string | null
          created_at: string
          created_by: string | null
          discount_pct: number
          ends_at: string
          id: string
          is_active: boolean
          name: string
          starts_at: string
        }
        Insert: {
          banner_text?: string | null
          created_at?: string
          created_by?: string | null
          discount_pct?: number
          ends_at: string
          id?: string
          is_active?: boolean
          name: string
          starts_at?: string
        }
        Update: {
          banner_text?: string | null
          created_at?: string
          created_by?: string | null
          discount_pct?: number
          ends_at?: string
          id?: string
          is_active?: boolean
          name?: string
          starts_at?: string
        }
        Relationships: []
      }
      function_rewrites: {
        Row: {
          applied_at: string
          applied_by: string | null
          body_hash: string | null
          body_preview: string | null
          function_name: string
          id: number
          migration_name: string | null
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          body_hash?: string | null
          body_preview?: string | null
          function_name: string
          id?: number
          migration_name?: string | null
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          body_hash?: string | null
          body_preview?: string | null
          function_name?: string
          id?: number
          migration_name?: string | null
        }
        Relationships: []
      }
      house_tiers: {
        Row: {
          level: number
          markup: number
          max_volume: number | null
          min_volume: number
          name: string
          updated_at: string
        }
        Insert: {
          level: number
          markup: number
          max_volume?: number | null
          min_volume?: number
          name: string
          updated_at?: string
        }
        Update: {
          level?: number
          markup?: number
          max_volume?: number | null
          min_volume?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          key: string
          request_hash: string
          response_body: Json
          response_status: number
          route: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          key: string
          request_hash: string
          response_body?: Json
          response_status?: number
          route: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          key?: string
          request_hash?: string
          response_body?: Json
          response_status?: number
          route?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      impersonation_sessions: {
        Row: {
          ended_at: string | null
          id: string
          impersonator_id: string
          ip_address: string | null
          reason: string | null
          started_at: string
          target_user_id: string
          user_agent: string | null
        }
        Insert: {
          ended_at?: string | null
          id?: string
          impersonator_id: string
          ip_address?: string | null
          reason?: string | null
          started_at?: string
          target_user_id: string
          user_agent?: string | null
        }
        Update: {
          ended_at?: string | null
          id?: string
          impersonator_id?: string
          ip_address?: string | null
          reason?: string | null
          started_at?: string
          target_user_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_impersonator_id_fkey"
            columns: ["impersonator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_messages: {
        Row: {
          attachment_url: string | null
          body: string
          created_at: string
          deleted_at: string | null
          due_date: string | null
          edited_at: string | null
          id: string
          invoice_amount: number | null
          invoice_status: string | null
          is_broadcast: boolean | null
          is_read: boolean
          line_items: Json | null
          receiver_id: string
          reply_to_id: string | null
          sender_id: string | null
          subject: string
          type: string | null
        }
        Insert: {
          attachment_url?: string | null
          body: string
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          edited_at?: string | null
          id?: string
          invoice_amount?: number | null
          invoice_status?: string | null
          is_broadcast?: boolean | null
          is_read?: boolean
          line_items?: Json | null
          receiver_id: string
          reply_to_id?: string | null
          sender_id?: string | null
          subject: string
          type?: string | null
        }
        Update: {
          attachment_url?: string | null
          body?: string
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          edited_at?: string | null
          id?: string
          invoice_amount?: number | null
          invoice_status?: string | null
          is_broadcast?: boolean | null
          is_read?: boolean
          line_items?: Json | null
          receiver_id?: string
          reply_to_id?: string | null
          sender_id?: string | null
          subject?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "internal_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      label_jobs: {
        Row: {
          agent_charged_cents: number | null
          agent_id: string | null
          attempts: number
          completed_at: string | null
          created_at: string
          from_address: Json | null
          id: string
          label_file_type: string
          label_url: string | null
          last_error: string | null
          next_attempt_at: string
          order_id: string
          origin_id: string | null
          parcel: Json | null
          preferred_service_level: string | null
          provider_transaction_id: string | null
          requested_by: string | null
          service_level_token: string | null
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          agent_charged_cents?: number | null
          agent_id?: string | null
          attempts?: number
          completed_at?: string | null
          created_at?: string
          from_address?: Json | null
          id?: string
          label_file_type?: string
          label_url?: string | null
          last_error?: string | null
          next_attempt_at?: string
          order_id: string
          origin_id?: string | null
          parcel?: Json | null
          preferred_service_level?: string | null
          provider_transaction_id?: string | null
          requested_by?: string | null
          service_level_token?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          agent_charged_cents?: number | null
          agent_id?: string | null
          attempts?: number
          completed_at?: string | null
          created_at?: string
          from_address?: Json | null
          id?: string
          label_file_type?: string
          label_url?: string | null
          last_error?: string | null
          next_attempt_at?: string
          order_id?: string
          origin_id?: string | null
          parcel?: Json | null
          preferred_service_level?: string | null
          provider_transaction_id?: string | null
          requested_by?: string | null
          service_level_token?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "label_jobs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_jobs_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "shipping_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_sequences: {
        Row: {
          compound_slug: string
          next_seq: number
          updated_at: string
        }
        Insert: {
          compound_slug: string
          next_seq?: number
          updated_at?: string
        }
        Update: {
          compound_slug?: string
          next_seq?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketing_attribution: {
        Row: {
          converted_at: string | null
          created_at: string
          first_landing_path: string | null
          first_referrer: string | null
          first_touch_at: string
          first_utm_campaign: string | null
          first_utm_content: string | null
          first_utm_medium: string | null
          first_utm_source: string | null
          first_utm_term: string | null
          id: string
          last_touch_at: string | null
          last_utm_campaign: string | null
          last_utm_content: string | null
          last_utm_medium: string | null
          last_utm_source: string | null
          last_utm_term: string | null
          order_id: string | null
          revenue_cents: number | null
          signed_up_at: string | null
          updated_at: string
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          first_landing_path?: string | null
          first_referrer?: string | null
          first_touch_at?: string
          first_utm_campaign?: string | null
          first_utm_content?: string | null
          first_utm_medium?: string | null
          first_utm_source?: string | null
          first_utm_term?: string | null
          id?: string
          last_touch_at?: string | null
          last_utm_campaign?: string | null
          last_utm_content?: string | null
          last_utm_medium?: string | null
          last_utm_source?: string | null
          last_utm_term?: string | null
          order_id?: string | null
          revenue_cents?: number | null
          signed_up_at?: string | null
          updated_at?: string
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          first_landing_path?: string | null
          first_referrer?: string | null
          first_touch_at?: string
          first_utm_campaign?: string | null
          first_utm_content?: string | null
          first_utm_medium?: string | null
          first_utm_source?: string | null
          first_utm_term?: string | null
          id?: string
          last_touch_at?: string | null
          last_utm_campaign?: string | null
          last_utm_content?: string | null
          last_utm_medium?: string | null
          last_utm_source?: string | null
          last_utm_term?: string | null
          order_id?: string | null
          revenue_cents?: number | null
          signed_up_at?: string | null
          updated_at?: string
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_attribution_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_attribution_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          channel_id: string
          created_at: string
          destination_path: string
          end_date: string | null
          id: string
          monthly_cap_cents: number
          name: string
          notes: string | null
          start_date: string | null
          status: string
          tracked_url: string | null
          utm_campaign: string
          utm_content: string | null
          utm_medium: string
          utm_source: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          destination_path?: string
          end_date?: string | null
          id?: string
          monthly_cap_cents?: number
          name: string
          notes?: string | null
          start_date?: string | null
          status?: string
          tracked_url?: string | null
          utm_campaign: string
          utm_content?: string | null
          utm_medium: string
          utm_source: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          destination_path?: string
          end_date?: string | null
          id?: string
          monthly_cap_cents?: number
          name?: string
          notes?: string | null
          start_date?: string | null
          status?: string
          tracked_url?: string | null
          utm_campaign?: string
          utm_content?: string | null
          utm_medium?: string
          utm_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketing_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_channels: {
        Row: {
          created_at: string
          display_name: string
          id: string
          monthly_cap_cents: number
          notes: string | null
          policy_strikes: number
          risk_tier: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          monthly_cap_cents?: number
          notes?: string | null
          policy_strikes?: number
          risk_tier?: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          monthly_cap_cents?: number
          notes?: string | null
          policy_strikes?: number
          risk_tier?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_compliance_log: {
        Row: {
          asset_ref: string | null
          asset_type: string
          content_excerpt: string | null
          content_hash: string | null
          created_at: string
          id: string
          reviewed_by: string | null
          rules_triggered: string[]
          verdict: string
        }
        Insert: {
          asset_ref?: string | null
          asset_type: string
          content_excerpt?: string | null
          content_hash?: string | null
          created_at?: string
          id?: string
          reviewed_by?: string | null
          rules_triggered?: string[]
          verdict: string
        }
        Update: {
          asset_ref?: string | null
          asset_type?: string
          content_excerpt?: string | null
          content_hash?: string | null
          created_at?: string
          id?: string
          reviewed_by?: string | null
          rules_triggered?: string[]
          verdict?: string
        }
        Relationships: []
      }
      marketing_experiments: {
        Row: {
          channel_id: string | null
          created_at: string
          ended_at: string | null
          hypothesis: string
          id: string
          lift_pct: number | null
          primary_metric: string
          started_at: string | null
          variant_a: Json
          variant_b: Json
          winner: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          ended_at?: string | null
          hypothesis: string
          id?: string
          lift_pct?: number | null
          primary_metric?: string
          started_at?: string | null
          variant_a: Json
          variant_b: Json
          winner?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          ended_at?: string | null
          hypothesis?: string
          id?: string
          lift_pct?: number | null
          primary_metric?: string
          started_at?: string | null
          variant_a?: Json
          variant_b?: Json
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_experiments_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketing_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_proposals: {
        Row: {
          channel_id: string | null
          created_at: string
          current_value: Json | null
          evidence: Json
          executed_at: string | null
          id: string
          kind: string
          proposed_by: string
          proposed_value: Json | null
          rationale: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          current_value?: Json | null
          evidence?: Json
          executed_at?: string | null
          id?: string
          kind: string
          proposed_by?: string
          proposed_value?: Json | null
          rationale: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          current_value?: Json | null
          evidence?: Json
          executed_at?: string | null
          id?: string
          kind?: string
          proposed_by?: string
          proposed_value?: Json | null
          rationale?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_proposals_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketing_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_spend_daily: {
        Row: {
          channel_id: string
          clicks: number
          created_at: string
          id: string
          impressions: number
          source: string
          spend_cents: number
          spend_date: string
        }
        Insert: {
          channel_id: string
          clicks?: number
          created_at?: string
          id?: string
          impressions?: number
          source?: string
          spend_cents?: number
          spend_date: string
        }
        Update: {
          channel_id?: string
          clicks?: number
          created_at?: string
          id?: string
          impressions?: number
          source?: string
          spend_cents?: number
          spend_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_spend_daily_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketing_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "internal_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          category: string | null
          created_at: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      messenger_admin_messages: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          message_id: string
          message_text: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          sender_id: string | null
          status: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          message_id: string
          message_text?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sender_id?: string | null
          status?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          message_id?: string
          message_text?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sender_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_admin_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "messenger_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_admin_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messenger_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_blocked: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
          id: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      messenger_bookmarks: {
        Row: {
          created_at: string | null
          id: string
          message_id: string
          message_text: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id: string
          message_text?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string
          message_text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_bookmarks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messenger_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_calls: {
        Row: {
          answered_at: string | null
          call_type: string
          conversation_id: string
          ended_at: string | null
          id: string
          initiator_id: string | null
          livekit_room: string
          started_at: string | null
          status: string
        }
        Insert: {
          answered_at?: string | null
          call_type: string
          conversation_id: string
          ended_at?: string | null
          id?: string
          initiator_id?: string | null
          livekit_room: string
          started_at?: string | null
          status?: string
        }
        Update: {
          answered_at?: string | null
          call_type?: string
          conversation_id?: string
          ended_at?: string | null
          id?: string
          initiator_id?: string | null
          livekit_room?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "messenger_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_conversation_labels: {
        Row: {
          color: string | null
          conversation_id: string
          created_at: string | null
          id: string
          label: string
          user_id: string
        }
        Insert: {
          color?: string | null
          conversation_id: string
          created_at?: string | null
          id?: string
          label: string
          user_id: string
        }
        Update: {
          color?: string | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          label?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_conversation_labels_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "messenger_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_conversations: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_archived: boolean | null
          is_support: boolean
          last_message_at: string | null
          last_message_text: string | null
          metadata: Json | null
          support_first_response_at: string | null
          support_last_researcher_message_at: string | null
          support_order_id: string | null
          support_snoozed_until: string | null
          support_status: string | null
          support_topic: string | null
          title: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_archived?: boolean | null
          is_support?: boolean
          last_message_at?: string | null
          last_message_text?: string | null
          metadata?: Json | null
          support_first_response_at?: string | null
          support_last_researcher_message_at?: string | null
          support_order_id?: string | null
          support_snoozed_until?: string | null
          support_status?: string | null
          support_topic?: string | null
          title?: string | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_archived?: boolean | null
          is_support?: boolean
          last_message_at?: string | null
          last_message_text?: string | null
          metadata?: Json | null
          support_first_response_at?: string | null
          support_last_researcher_message_at?: string | null
          support_order_id?: string | null
          support_snoozed_until?: string | null
          support_status?: string | null
          support_topic?: string | null
          title?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messenger_conversations_support_order_fk"
            columns: ["support_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_conversations_support_order_fk"
            columns: ["support_order_id"]
            isOneToOne: false
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_edit_history: {
        Row: {
          edited_at: string | null
          edited_by: string | null
          id: string
          message_id: string
          previous_text: string | null
        }
        Insert: {
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          message_id: string
          previous_text?: string | null
        }
        Update: {
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          message_id?: string
          previous_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messenger_edit_history_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messenger_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_favorites: {
        Row: {
          created_at: string | null
          favorite_user_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          favorite_user_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          favorite_user_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      messenger_labels: {
        Row: {
          created_at: string | null
          id: string
          label: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_labels_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messenger_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_link_previews: {
        Row: {
          description: string | null
          fetched_at: string | null
          host: string | null
          image_url: string | null
          title: string | null
          url: string
          url_hash: string
        }
        Insert: {
          description?: string | null
          fetched_at?: string | null
          host?: string | null
          image_url?: string | null
          title?: string | null
          url: string
          url_hash: string
        }
        Update: {
          description?: string | null
          fetched_at?: string | null
          host?: string | null
          image_url?: string | null
          title?: string | null
          url?: string
          url_hash?: string
        }
        Relationships: []
      }
      messenger_message_dismissals: {
        Row: {
          dismissed_at: string | null
          message_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string | null
          message_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string | null
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_message_dismissals_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messenger_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_messages: {
        Row: {
          client_message_id: string | null
          conversation_id: string
          created_at: string | null
          delete_scope: string | null
          expires_at: string | null
          id: string
          is_deleted: boolean | null
          is_edited: boolean | null
          labels: string[] | null
          media_metadata: Json | null
          media_url: string | null
          message_type: string
          metadata: Json | null
          priority: string | null
          reply_to_id: string | null
          sender_id: string | null
          status: string | null
          text: string | null
          thread_parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          client_message_id?: string | null
          conversation_id: string
          created_at?: string | null
          delete_scope?: string | null
          expires_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          labels?: string[] | null
          media_metadata?: Json | null
          media_url?: string | null
          message_type?: string
          metadata?: Json | null
          priority?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
          status?: string | null
          text?: string | null
          thread_parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          client_message_id?: string | null
          conversation_id?: string
          created_at?: string | null
          delete_scope?: string | null
          expires_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          labels?: string[] | null
          media_metadata?: Json | null
          media_url?: string | null
          message_type?: string
          metadata?: Json | null
          priority?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
          status?: string | null
          text?: string | null
          thread_parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messenger_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "messenger_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messenger_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_messages_thread_parent_id_fkey"
            columns: ["thread_parent_id"]
            isOneToOne: false
            referencedRelation: "messenger_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_participants: {
        Row: {
          conversation_id: string
          id: string
          is_muted: boolean | null
          is_pinned: boolean | null
          joined_at: string | null
          last_read_at: string | null
          last_read_message_id: string | null
          mute_until: string | null
          role: string
          settings: Json | null
          unread_count: number | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_muted?: boolean | null
          is_pinned?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          last_read_message_id?: string | null
          mute_until?: string | null
          role?: string
          settings?: Json | null
          unread_count?: number | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_muted?: boolean | null
          is_pinned?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          last_read_message_id?: string | null
          mute_until?: string | null
          role?: string
          settings?: Json | null
          unread_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "messenger_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_pins: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          message_id: string
          pinned_by: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          message_id: string
          pinned_by: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          message_id?: string
          pinned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_pins_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "messenger_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_pins_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messenger_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_reactions: {
        Row: {
          conversation_id: string
          created_at: string | null
          emoji: string | null
          gif_url: string | null
          id: string
          message_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          emoji?: string | null
          gif_url?: string | null
          id?: string
          message_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          emoji?: string | null
          gif_url?: string | null
          id?: string
          message_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_reactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "messenger_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messenger_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_reminders: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          fired_at: string | null
          id: string
          message_id: string | null
          message_preview: string | null
          note: string | null
          remind_at: string
          status: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          fired_at?: string | null
          id?: string
          message_id?: string | null
          message_preview?: string | null
          note?: string | null
          remind_at: string
          status?: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          fired_at?: string | null
          id?: string
          message_id?: string | null
          message_preview?: string | null
          note?: string | null
          remind_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_reminders_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "messenger_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_reminders_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messenger_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_reports: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          message_id: string
          note: string | null
          reason: string
          reporter_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          message_id: string
          note?: string | null
          reason: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          message_id?: string
          note?: string | null
          reason?: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "messenger_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messenger_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_scheduled: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          media_metadata: Json | null
          media_url: string | null
          message_type: string
          reply_to_id: string | null
          scheduled_at: string
          sender_id: string
          status: string
          text: string | null
          updated_at: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          media_metadata?: Json | null
          media_url?: string | null
          message_type?: string
          reply_to_id?: string | null
          scheduled_at: string
          sender_id: string
          status?: string
          text?: string | null
          updated_at?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          media_metadata?: Json | null
          media_url?: string | null
          message_type?: string
          reply_to_id?: string | null
          scheduled_at?: string
          sender_id?: string
          status?: string
          text?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messenger_scheduled_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "messenger_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messenger_scheduled_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messenger_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_support_internal_notes: {
        Row: {
          author_id: string
          body: string
          conversation_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          author_id: string
          body: string
          conversation_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_support_internal_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "messenger_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      messenger_support_quick_replies: {
        Row: {
          body: string
          created_at: string | null
          id: string
          label: string
          slash_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          label: string
          slash_key: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          label?: string
          slash_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messenger_templates: {
        Row: {
          body: string
          category: string | null
          created_at: string | null
          id: string
          shortcut: string | null
          title: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string | null
          id?: string
          shortcut?: string | null
          title: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string | null
          id?: string
          shortcut?: string | null
          title?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      messenger_themes: {
        Row: {
          conversation_id: string
          id: string
          theme_value: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          theme_value: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          theme_value?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messenger_themes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "messenger_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      missed_searches: {
        Row: {
          created_at: string
          id: string
          query: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          source?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          browser_push: boolean | null
          created_at: string | null
          email_digest_messenger: boolean | null
          email_on_invoice: boolean | null
          email_on_message: boolean | null
          events_order_approved: boolean
          events_order_delivered: boolean
          events_order_shipped: boolean
          events_payment_reminder: boolean
          id: string
          mute_all: boolean | null
          push_enabled: boolean
          push_events_marketing: boolean
          push_events_messages: boolean
          push_events_order: boolean
          push_type_prefs: Json
          send_read_receipts: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          browser_push?: boolean | null
          created_at?: string | null
          email_digest_messenger?: boolean | null
          email_on_invoice?: boolean | null
          email_on_message?: boolean | null
          events_order_approved?: boolean
          events_order_delivered?: boolean
          events_order_shipped?: boolean
          events_payment_reminder?: boolean
          id?: string
          mute_all?: boolean | null
          push_enabled?: boolean
          push_events_marketing?: boolean
          push_events_messages?: boolean
          push_events_order?: boolean
          push_type_prefs?: Json
          send_read_receipts?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          browser_push?: boolean | null
          created_at?: string | null
          email_digest_messenger?: boolean | null
          email_on_invoice?: boolean | null
          email_on_message?: boolean | null
          events_order_approved?: boolean
          events_order_delivered?: boolean
          events_order_shipped?: boolean
          events_payment_reminder?: boolean
          id?: string
          mute_all?: boolean | null
          push_enabled?: boolean
          push_events_marketing?: boolean
          push_events_messages?: boolean
          push_events_order?: boolean
          push_type_prefs?: Json
          send_read_receipts?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: number
          read_at: string | null
          title: string
          type: string
          url: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: number
          read_at?: string | null
          title: string
          type: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: number
          read_at?: string | null
          title?: string
          type?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          agent_product_id: string | null
          coa_url: string | null
          created_at: string | null
          fulfilled_locally: boolean
          id: string
          lot_number: string | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_cost_price: number
          unit_retail_price: number
          unit_super_agent_cost: number | null
        }
        Insert: {
          agent_product_id?: string | null
          coa_url?: string | null
          created_at?: string | null
          fulfilled_locally?: boolean
          id?: string
          lot_number?: string | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_cost_price: number
          unit_retail_price: number
          unit_super_agent_cost?: number | null
        }
        Update: {
          agent_product_id?: string | null
          coa_url?: string | null
          created_at?: string | null
          fulfilled_locally?: boolean
          id?: string
          lot_number?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_cost_price?: number
          unit_retail_price?: number
          unit_super_agent_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_agent_product_id_fkey"
            columns: ["agent_product_id"]
            isOneToOne: false
            referencedRelation: "agent_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          agent_approval_notes: string | null
          agent_approved_at: string | null
          agent_charged_cents: number | null
          agent_id: string | null
          buyer_email: string | null
          buyer_id: string | null
          buyer_name: string | null
          cancellation_reason: string | null
          cancelled_by: string | null
          carrier: string | null
          coupon_code: string | null
          created_at: string | null
          credits_redeemed: number | null
          delivered_at: string | null
          delivery_eta: string | null
          discount_amount: number | null
          fulfillment_method:
            | Database["public"]["Enums"]["fulfillment_method"]
            | null
          id: string
          idempotency_key: string | null
          inventory_reserved: boolean
          is_wholesale_restock: boolean | null
          label_cost_cents: number | null
          label_url: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          referring_sub_agent_id: string | null
          refill_reminder_sent_at: string | null
          service_level: string | null
          shipped_at: string | null
          shipping_address: Json | null
          shipping_cost: number | null
          shipping_origin_id: string | null
          shipping_paid_by: string | null
          status: Database["public"]["Enums"]["order_status"]
          sub_agent_commission_amount: number | null
          sub_agent_commission_pct: number | null
          subtotal: number
          total: number
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          agent_approval_notes?: string | null
          agent_approved_at?: string | null
          agent_charged_cents?: number | null
          agent_id?: string | null
          buyer_email?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          carrier?: string | null
          coupon_code?: string | null
          created_at?: string | null
          credits_redeemed?: number | null
          delivered_at?: string | null
          delivery_eta?: string | null
          discount_amount?: number | null
          fulfillment_method?:
            | Database["public"]["Enums"]["fulfillment_method"]
            | null
          id?: string
          idempotency_key?: string | null
          inventory_reserved?: boolean
          is_wholesale_restock?: boolean | null
          label_cost_cents?: number | null
          label_url?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          referring_sub_agent_id?: string | null
          refill_reminder_sent_at?: string | null
          service_level?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          shipping_origin_id?: string | null
          shipping_paid_by?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          sub_agent_commission_amount?: number | null
          sub_agent_commission_pct?: number | null
          subtotal: number
          total: number
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_approval_notes?: string | null
          agent_approved_at?: string | null
          agent_charged_cents?: number | null
          agent_id?: string | null
          buyer_email?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          carrier?: string | null
          coupon_code?: string | null
          created_at?: string | null
          credits_redeemed?: number | null
          delivered_at?: string | null
          delivery_eta?: string | null
          discount_amount?: number | null
          fulfillment_method?:
            | Database["public"]["Enums"]["fulfillment_method"]
            | null
          id?: string
          idempotency_key?: string | null
          inventory_reserved?: boolean
          is_wholesale_restock?: boolean | null
          label_cost_cents?: number | null
          label_url?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          referring_sub_agent_id?: string | null
          refill_reminder_sent_at?: string | null
          service_level?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          shipping_origin_id?: string | null
          shipping_paid_by?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          sub_agent_commission_amount?: number | null
          sub_agent_commission_pct?: number | null
          subtotal?: number
          total?: number
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_referring_sub_agent_id_fkey"
            columns: ["referring_sub_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_origin_id_fkey"
            columns: ["shipping_origin_id"]
            isOneToOne: false
            referencedRelation: "shipping_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_proofs: {
        Row: {
          id: string
          mime_type: string | null
          order_id: string
          size_bytes: number | null
          storage_key: string
          uploaded_at: string
          uploader_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          id?: string
          mime_type?: string | null
          order_id: string
          size_bytes?: number | null
          storage_key: string
          uploaded_at?: string
          uploader_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          id?: string
          mime_type?: string | null
          order_id?: string
          size_bytes?: number | null
          storage_key?: string
          uploaded_at?: string
          uploader_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_records: {
        Row: {
          agent_id: string
          amount: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payment_method: string
          reference_number: string | null
          status: string
        }
        Insert: {
          agent_id: string
          amount: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          reference_number?: string | null
          status?: string
        }
        Update: {
          agent_id?: string
          amount?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          reference_number?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_records_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_audit_logs: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          new_margin_percent: number | null
          new_retail_price: number
          old_margin_percent: number | null
          old_retail_price: number | null
          product_id: string
          reason: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          new_margin_percent?: number | null
          new_retail_price: number
          old_margin_percent?: number | null
          old_retail_price?: number | null
          product_id: string
          reason: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          new_margin_percent?: number | null
          new_retail_price?: number
          old_margin_percent?: number | null
          old_retail_price?: number | null
          product_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_audit_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_audit_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_tiers: {
        Row: {
          description: string | null
          display_name: string
          id: string
          multiplier: number
          tier_name: Database["public"]["Enums"]["tier_name"]
          updated_at: string | null
        }
        Insert: {
          description?: string | null
          display_name: string
          id?: string
          multiplier?: number
          tier_name: Database["public"]["Enums"]["tier_name"]
          updated_at?: string | null
        }
        Update: {
          description?: string | null
          display_name?: string
          id?: string
          multiplier?: number
          tier_name?: Database["public"]["Enums"]["tier_name"]
          updated_at?: string | null
        }
        Relationships: []
      }
      product_alerts: {
        Row: {
          agent_id: string | null
          alert_type: string
          created_at: string
          id: string
          notified_at: string | null
          product_id: string
          reference_price: number | null
          status: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          notified_at?: string | null
          product_id: string
          reference_price?: number | null
          status?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          notified_at?: string | null
          product_id?: string
          reference_price?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_alerts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_lots: {
        Row: {
          appearance: string | null
          chromatogram_storage_key: string | null
          coa_file_size: number | null
          coa_mime_type: string | null
          coa_retracted_at: string | null
          coa_retracted_by: string | null
          coa_retraction_reason: string | null
          coa_storage_key: string | null
          coa_uploaded_at: string | null
          coa_uploaded_by: string | null
          coa_verified_at: string | null
          coa_verified_by: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          hplc_column: string | null
          hplc_wavelength_nm: number | null
          id: string
          is_active: boolean
          lab_accreditation: string | null
          lab_is_third_party: boolean | null
          lab_report_number: string | null
          lot_number: string
          manufactured_at: string | null
          ms_method: string | null
          ms_observed_mass_da: number | null
          ms_theoretical_mass_da: number | null
          net_peptide_content_pct: number | null
          next_rotation_at: string | null
          notes: string | null
          product_id: string
          purity_method: string | null
          purity_pct: number | null
          received_at: string
          storage: string | null
          superseded_by: string | null
          supplier: string | null
          test_date: string | null
          testing_lab: string | null
          updated_at: string
          water_content_pct: number | null
        }
        Insert: {
          appearance?: string | null
          chromatogram_storage_key?: string | null
          coa_file_size?: number | null
          coa_mime_type?: string | null
          coa_retracted_at?: string | null
          coa_retracted_by?: string | null
          coa_retraction_reason?: string | null
          coa_storage_key?: string | null
          coa_uploaded_at?: string | null
          coa_uploaded_by?: string | null
          coa_verified_at?: string | null
          coa_verified_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          hplc_column?: string | null
          hplc_wavelength_nm?: number | null
          id?: string
          is_active?: boolean
          lab_accreditation?: string | null
          lab_is_third_party?: boolean | null
          lab_report_number?: string | null
          lot_number: string
          manufactured_at?: string | null
          ms_method?: string | null
          ms_observed_mass_da?: number | null
          ms_theoretical_mass_da?: number | null
          net_peptide_content_pct?: number | null
          next_rotation_at?: string | null
          notes?: string | null
          product_id: string
          purity_method?: string | null
          purity_pct?: number | null
          received_at?: string
          storage?: string | null
          superseded_by?: string | null
          supplier?: string | null
          test_date?: string | null
          testing_lab?: string | null
          updated_at?: string
          water_content_pct?: number | null
        }
        Update: {
          appearance?: string | null
          chromatogram_storage_key?: string | null
          coa_file_size?: number | null
          coa_mime_type?: string | null
          coa_retracted_at?: string | null
          coa_retracted_by?: string | null
          coa_retraction_reason?: string | null
          coa_storage_key?: string | null
          coa_uploaded_at?: string | null
          coa_uploaded_by?: string | null
          coa_verified_at?: string | null
          coa_verified_by?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          hplc_column?: string | null
          hplc_wavelength_nm?: number | null
          id?: string
          is_active?: boolean
          lab_accreditation?: string | null
          lab_is_third_party?: boolean | null
          lab_report_number?: string | null
          lot_number?: string
          manufactured_at?: string | null
          ms_method?: string | null
          ms_observed_mass_da?: number | null
          ms_theoretical_mass_da?: number | null
          net_peptide_content_pct?: number | null
          next_rotation_at?: string | null
          notes?: string | null
          product_id?: string
          purity_method?: string | null
          purity_pct?: number | null
          received_at?: string
          storage?: string | null
          superseded_by?: string | null
          supplier?: string | null
          test_date?: string | null
          testing_lab?: string | null
          updated_at?: string
          water_content_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_lots_coa_retracted_by_fkey"
            columns: ["coa_retracted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_lots_coa_uploaded_by_fkey"
            columns: ["coa_uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_lots_coa_verified_by_fkey"
            columns: ["coa_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_lots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_lots_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "product_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tier_overrides: {
        Row: {
          custom_multiplier: number
          id: string
          product_id: string
          tier_name: Database["public"]["Enums"]["tier_name"]
        }
        Insert: {
          custom_multiplier: number
          id?: string
          product_id: string
          tier_name: Database["public"]["Enums"]["tier_name"]
        }
        Update: {
          custom_multiplier?: number
          id?: string
          product_id?: string
          tier_name?: Database["public"]["Enums"]["tier_name"]
        }
        Relationships: [
          {
            foreignKeyName: "product_tier_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          admin_bulk_price: number | null
          admin_bulk_threshold: number | null
          backorder_days: number
          base_cost: number
          category: string
          compound_slug: string | null
          created_at: string | null
          description: string | null
          embedding: string | null
          id: string
          image_url: string | null
          in_stock: boolean
          inventory_count: number
          is_active: boolean | null
          is_banned: boolean | null
          low_stock_threshold: number
          market_avg_price: number | null
          market_high_price: number | null
          market_low_price: number | null
          market_researched_at: string | null
          max_margin_percent: number | null
          min_retail_price: number
          name: string
          sku: string | null
          slug: string
          unit_measure: string
          unit_size: string | null
          updated_at: string | null
          weight_oz: number | null
        }
        Insert: {
          admin_bulk_price?: number | null
          admin_bulk_threshold?: number | null
          backorder_days?: number
          base_cost: number
          category: string
          compound_slug?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean
          inventory_count?: number
          is_active?: boolean | null
          is_banned?: boolean | null
          low_stock_threshold?: number
          market_avg_price?: number | null
          market_high_price?: number | null
          market_low_price?: number | null
          market_researched_at?: string | null
          max_margin_percent?: number | null
          min_retail_price: number
          name: string
          sku?: string | null
          slug: string
          unit_measure?: string
          unit_size?: string | null
          updated_at?: string | null
          weight_oz?: number | null
        }
        Update: {
          admin_bulk_price?: number | null
          admin_bulk_threshold?: number | null
          backorder_days?: number
          base_cost?: number
          category?: string
          compound_slug?: string | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean
          inventory_count?: number
          is_active?: boolean | null
          is_banned?: boolean | null
          low_stock_threshold?: number
          market_avg_price?: number | null
          market_high_price?: number | null
          market_low_price?: number | null
          market_researched_at?: string | null
          max_margin_percent?: number | null
          min_retail_price?: number
          name?: string
          sku?: string | null
          slug?: string
          unit_measure?: string
          unit_size?: string | null
          updated_at?: string | null
          weight_oz?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_activated_at: string | null
          account_type: Database["public"]["Enums"]["account_type"] | null
          acquisition_metadata: Json | null
          acquisition_source: string | null
          auto_approve_orders: boolean | null
          auto_pay_enabled: boolean | null
          auto_responder_enabled: boolean | null
          auto_responder_message: string | null
          avatar_url: string | null
          bio: string | null
          cart_state: Json | null
          cart_updated_at: string | null
          commission_active_since: string | null
          commission_ladder_config: Json | null
          commission_max_pct: number | null
          commission_pct: number | null
          commission_rate: number | null
          contact_email: string | null
          created_at: string | null
          created_by_agent_id: string | null
          created_by_role: string | null
          credit_limit: number | null
          credit_used: number
          custom_markup_override: number | null
          deactivated_at: string | null
          default_agent_markup_pct: number | null
          default_agent_pricing_mode: string
          default_payment_method: string | null
          default_sub_commission_pct: number | null
          disclaimer_accepted_at: string | null
          disclaimer_ip: string | null
          disclaimer_v1_accepted: boolean | null
          email: string | null
          email_opt_out: boolean
          email_verified: boolean
          first_name: string | null
          first_sign_in_at: string | null
          fixed_scale_override: boolean
          frozen_at: string | null
          frozen_by: string | null
          frozen_reason: string | null
          full_name: string | null
          gamification_override: boolean | null
          grace_period_tier_level: number | null
          house_tier_level: number | null
          id: string
          is_active: boolean | null
          is_sub_agent: boolean
          is_super_agent: boolean | null
          is_transactions_frozen: boolean
          last_active_at: string | null
          last_balance_alert_at: string | null
          last_cart_reminder_at: string | null
          last_name: string | null
          last_sign_in_at: string | null
          locale: string | null
          locked_tier_level: number | null
          max_auto_approve_limit: number | null
          max_commission_pct: number | null
          monthly_sales_goal: number | null
          must_change_password: boolean
          onboarding_completed_at: string | null
          onboarding_progress: Json
          parent_agent_id: string | null
          payment_handles: Json
          phone: string | null
          phone_verified_at: string | null
          preferred_payout_handle: string | null
          prepaid_balance: number | null
          pronouns: string | null
          provisioned_password: string | null
          pwa_dismissed: boolean | null
          referral_code: string | null
          referring_agent_id: string | null
          referring_sub_agent_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          sign_in_count: number
          tier: Database["public"]["Enums"]["agent_tier"] | null
          tier_grace_period_expires_at: string | null
          timezone: string | null
          updated_at: string | null
          username: string | null
          username_changed_at: string | null
          velocity_cap: number | null
        }
        Insert: {
          account_activated_at?: string | null
          account_type?: Database["public"]["Enums"]["account_type"] | null
          acquisition_metadata?: Json | null
          acquisition_source?: string | null
          auto_approve_orders?: boolean | null
          auto_pay_enabled?: boolean | null
          auto_responder_enabled?: boolean | null
          auto_responder_message?: string | null
          avatar_url?: string | null
          bio?: string | null
          cart_state?: Json | null
          cart_updated_at?: string | null
          commission_active_since?: string | null
          commission_ladder_config?: Json | null
          commission_max_pct?: number | null
          commission_pct?: number | null
          commission_rate?: number | null
          contact_email?: string | null
          created_at?: string | null
          created_by_agent_id?: string | null
          created_by_role?: string | null
          credit_limit?: number | null
          credit_used?: number
          custom_markup_override?: number | null
          deactivated_at?: string | null
          default_agent_markup_pct?: number | null
          default_agent_pricing_mode?: string
          default_payment_method?: string | null
          default_sub_commission_pct?: number | null
          disclaimer_accepted_at?: string | null
          disclaimer_ip?: string | null
          disclaimer_v1_accepted?: boolean | null
          email?: string | null
          email_opt_out?: boolean
          email_verified?: boolean
          first_name?: string | null
          first_sign_in_at?: string | null
          fixed_scale_override?: boolean
          frozen_at?: string | null
          frozen_by?: string | null
          frozen_reason?: string | null
          full_name?: string | null
          gamification_override?: boolean | null
          grace_period_tier_level?: number | null
          house_tier_level?: number | null
          id: string
          is_active?: boolean | null
          is_sub_agent?: boolean
          is_super_agent?: boolean | null
          is_transactions_frozen?: boolean
          last_active_at?: string | null
          last_balance_alert_at?: string | null
          last_cart_reminder_at?: string | null
          last_name?: string | null
          last_sign_in_at?: string | null
          locale?: string | null
          locked_tier_level?: number | null
          max_auto_approve_limit?: number | null
          max_commission_pct?: number | null
          monthly_sales_goal?: number | null
          must_change_password?: boolean
          onboarding_completed_at?: string | null
          onboarding_progress?: Json
          parent_agent_id?: string | null
          payment_handles?: Json
          phone?: string | null
          phone_verified_at?: string | null
          preferred_payout_handle?: string | null
          prepaid_balance?: number | null
          pronouns?: string | null
          provisioned_password?: string | null
          pwa_dismissed?: boolean | null
          referral_code?: string | null
          referring_agent_id?: string | null
          referring_sub_agent_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          sign_in_count?: number
          tier?: Database["public"]["Enums"]["agent_tier"] | null
          tier_grace_period_expires_at?: string | null
          timezone?: string | null
          updated_at?: string | null
          username?: string | null
          username_changed_at?: string | null
          velocity_cap?: number | null
        }
        Update: {
          account_activated_at?: string | null
          account_type?: Database["public"]["Enums"]["account_type"] | null
          acquisition_metadata?: Json | null
          acquisition_source?: string | null
          auto_approve_orders?: boolean | null
          auto_pay_enabled?: boolean | null
          auto_responder_enabled?: boolean | null
          auto_responder_message?: string | null
          avatar_url?: string | null
          bio?: string | null
          cart_state?: Json | null
          cart_updated_at?: string | null
          commission_active_since?: string | null
          commission_ladder_config?: Json | null
          commission_max_pct?: number | null
          commission_pct?: number | null
          commission_rate?: number | null
          contact_email?: string | null
          created_at?: string | null
          created_by_agent_id?: string | null
          created_by_role?: string | null
          credit_limit?: number | null
          credit_used?: number
          custom_markup_override?: number | null
          deactivated_at?: string | null
          default_agent_markup_pct?: number | null
          default_agent_pricing_mode?: string
          default_payment_method?: string | null
          default_sub_commission_pct?: number | null
          disclaimer_accepted_at?: string | null
          disclaimer_ip?: string | null
          disclaimer_v1_accepted?: boolean | null
          email?: string | null
          email_opt_out?: boolean
          email_verified?: boolean
          first_name?: string | null
          first_sign_in_at?: string | null
          fixed_scale_override?: boolean
          frozen_at?: string | null
          frozen_by?: string | null
          frozen_reason?: string | null
          full_name?: string | null
          gamification_override?: boolean | null
          grace_period_tier_level?: number | null
          house_tier_level?: number | null
          id?: string
          is_active?: boolean | null
          is_sub_agent?: boolean
          is_super_agent?: boolean | null
          is_transactions_frozen?: boolean
          last_active_at?: string | null
          last_balance_alert_at?: string | null
          last_cart_reminder_at?: string | null
          last_name?: string | null
          last_sign_in_at?: string | null
          locale?: string | null
          locked_tier_level?: number | null
          max_auto_approve_limit?: number | null
          max_commission_pct?: number | null
          monthly_sales_goal?: number | null
          must_change_password?: boolean
          onboarding_completed_at?: string | null
          onboarding_progress?: Json
          parent_agent_id?: string | null
          payment_handles?: Json
          phone?: string | null
          phone_verified_at?: string | null
          preferred_payout_handle?: string | null
          prepaid_balance?: number | null
          pronouns?: string | null
          provisioned_password?: string | null
          pwa_dismissed?: boolean | null
          referral_code?: string | null
          referring_agent_id?: string | null
          referring_sub_agent_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          sign_in_count?: number
          tier?: Database["public"]["Enums"]["agent_tier"] | null
          tier_grace_period_expires_at?: string | null
          timezone?: string | null
          updated_at?: string | null
          username?: string | null
          username_changed_at?: string | null
          velocity_cap?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_created_by_agent_id_fkey"
            columns: ["created_by_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_parent_agent_id_fkey"
            columns: ["parent_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referring_agent_id_fkey"
            columns: ["referring_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referring_sub_agent_id_fkey"
            columns: ["referring_sub_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_outbox: {
        Row: {
          attempts: number
          badge_url: string | null
          body: string
          created_at: string
          event: string | null
          failure_reason: string | null
          icon_url: string | null
          id: string
          recipient_user_id: string | null
          related_order_id: string | null
          sent_at: string | null
          status: string
          tag: string | null
          title: string
          url: string | null
        }
        Insert: {
          attempts?: number
          badge_url?: string | null
          body: string
          created_at?: string
          event?: string | null
          failure_reason?: string | null
          icon_url?: string | null
          id?: string
          recipient_user_id?: string | null
          related_order_id?: string | null
          sent_at?: string | null
          status?: string
          tag?: string | null
          title: string
          url?: string | null
        }
        Update: {
          attempts?: number
          badge_url?: string | null
          body?: string
          created_at?: string
          event?: string | null
          failure_reason?: string | null
          icon_url?: string | null
          id?: string
          recipient_user_id?: string | null
          related_order_id?: string | null
          sent_at?: string | null
          status?: string
          tag?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_outbox_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_outbox_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_outbox_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_label: string | null
          endpoint: string
          failure_count: number
          id: string
          is_active: boolean
          last_failure_reason: string | null
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_label?: string | null
          endpoint: string
          failure_count?: number
          id?: string
          is_active?: boolean
          last_failure_reason?: string | null
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_label?: string | null
          endpoint?: string
          failure_count?: number
          id?: string
          is_active?: boolean
          last_failure_reason?: string | null
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reconstitution_logs: {
        Row: {
          compound_slug: string
          created_at: string
          id: string
          label: string | null
          product_id: string | null
          reconstituted_on: string
          shelf_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          compound_slug: string
          created_at?: string
          id?: string
          label?: string | null
          product_id?: string | null
          reconstituted_on?: string
          shelf_days?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          compound_slug?: string
          created_at?: string
          id?: string
          label?: string | null
          product_id?: string | null
          reconstituted_on?: string
          shelf_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_promotions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          priority: number
          referee_reward: number
          referrer_reward: number
          starts_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          referee_reward?: number
          referrer_reward?: number
          starts_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          referee_reward?: number
          referrer_reward?: number
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_promotions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_settings: {
        Row: {
          id: number
          is_active: boolean
          min_order_total: number
          referee_reward: number
          referrer_reward: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id: number
          is_active?: boolean
          min_order_total?: number
          referee_reward?: number
          referrer_reward?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          is_active?: boolean
          min_order_total?: number
          referee_reward?: number
          referrer_reward?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      research_events: {
        Row: {
          compound_slug: string | null
          created_at: string
          detail: string | null
          event_type: string
          id: number
          path: string | null
          session_id: string
          tool: string | null
          url_host: string | null
          visitor_id: string | null
        }
        Insert: {
          compound_slug?: string | null
          created_at?: string
          detail?: string | null
          event_type: string
          id?: number
          path?: string | null
          session_id: string
          tool?: string | null
          url_host?: string | null
          visitor_id?: string | null
        }
        Update: {
          compound_slug?: string | null
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: number
          path?: string | null
          session_id?: string
          tool?: string | null
          url_host?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      research_match_analytics: {
        Row: {
          budget: string | null
          created_at: string
          evidence_comfort: string
          exclude_injectables: boolean | null
          goal: string
          id: string
          preference: string | null
          require_long_half_life: boolean | null
          result_count: number | null
          risk_tolerance: string
          wada_constraint: string
        }
        Insert: {
          budget?: string | null
          created_at?: string
          evidence_comfort: string
          exclude_injectables?: boolean | null
          goal: string
          id?: string
          preference?: string | null
          require_long_half_life?: boolean | null
          result_count?: number | null
          risk_tolerance: string
          wada_constraint: string
        }
        Update: {
          budget?: string | null
          created_at?: string
          evidence_comfort?: string
          exclude_injectables?: boolean | null
          goal?: string
          id?: string
          preference?: string | null
          require_long_half_life?: boolean | null
          result_count?: number | null
          risk_tolerance?: string
          wada_constraint?: string
        }
        Relationships: []
      }
      researcher_biometrics: {
        Row: {
          created_at: string | null
          id: string
          measured_at: string | null
          metric_name: string
          metric_value: number
          notes: string | null
          unit: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          measured_at?: string | null
          metric_name: string
          metric_value: number
          notes?: string | null
          unit?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          measured_at?: string | null
          metric_name?: string
          metric_value?: number
          notes?: string | null
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      researcher_comparisons: {
        Row: {
          created_at: string
          folder_name: string | null
          id: string
          notes: string | null
          product_ids: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          folder_name?: string | null
          id?: string
          notes?: string | null
          product_ids: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          folder_name?: string | null
          id?: string
          notes?: string | null
          product_ids?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "researcher_comparisons_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      researcher_doses: {
        Row: {
          compound_slug: string
          created_at: string | null
          dose_amount: number
          dosed_at: string | null
          id: string
          injection_site: string | null
          notes: string | null
          unit: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          compound_slug: string
          created_at?: string | null
          dose_amount: number
          dosed_at?: string | null
          id?: string
          injection_site?: string | null
          notes?: string | null
          unit: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          compound_slug?: string
          created_at?: string | null
          dose_amount?: number
          dosed_at?: string | null
          id?: string
          injection_site?: string | null
          notes?: string | null
          unit?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      researcher_favorites: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "researcher_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "researcher_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      researcher_goals: {
        Row: {
          created_at: string | null
          goal_name: string
          id: string
          is_active: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          goal_name: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          goal_name?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      researcher_inventory: {
        Row: {
          expiration_date: string | null
          id: string
          lot_number: string | null
          on_hand: number | null
          product_id: string
          recon_dose: number | null
          recon_mg: number | null
          recon_ml: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          expiration_date?: string | null
          id?: string
          lot_number?: string | null
          on_hand?: number | null
          product_id: string
          recon_dose?: number | null
          recon_mg?: number | null
          recon_ml?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          expiration_date?: string | null
          id?: string
          lot_number?: string | null
          on_hand?: number | null
          product_id?: string
          recon_dose?: number | null
          recon_mg?: number | null
          recon_ml?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      researcher_notes: {
        Row: {
          compound_slug: string | null
          created_at: string
          id: string
          note_text: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          compound_slug?: string | null
          created_at?: string
          id?: string
          note_text: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          compound_slug?: string | null
          created_at?: string
          id?: string
          note_text?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "researcher_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      researcher_progress_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          storage_path: string
          taken_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          storage_path: string
          taken_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          storage_path?: string
          taken_at?: string
          user_id?: string
        }
        Relationships: []
      }
      researcher_recently_viewed: {
        Row: {
          agent_id: string | null
          product_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          agent_id?: string | null
          product_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          agent_id?: string | null
          product_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "researcher_recently_viewed_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "researcher_recently_viewed_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "researcher_recently_viewed_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      researcher_referrals: {
        Row: {
          applied_at: string | null
          code: string
          created_at: string
          expires_at: string | null
          id: string
          notes: string | null
          qualifying_order_id: string | null
          referee_email: string | null
          referee_id: string | null
          referee_reward_amount: number | null
          referrer_id: string
          referrer_reward_amount: number | null
          rewarded_at: string | null
          status: string
        }
        Insert: {
          applied_at?: string | null
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          qualifying_order_id?: string | null
          referee_email?: string | null
          referee_id?: string | null
          referee_reward_amount?: number | null
          referrer_id: string
          referrer_reward_amount?: number | null
          rewarded_at?: string | null
          status?: string
        }
        Update: {
          applied_at?: string | null
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          qualifying_order_id?: string | null
          referee_email?: string | null
          referee_id?: string | null
          referee_reward_amount?: number | null
          referrer_id?: string
          referrer_reward_amount?: number | null
          rewarded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "researcher_referrals_qualifying_order_id_fkey"
            columns: ["qualifying_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "researcher_referrals_qualifying_order_id_fkey"
            columns: ["qualifying_order_id"]
            isOneToOne: false
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "researcher_referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "researcher_referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      researcher_scheduled_protocols: {
        Row: {
          amount: number
          compound_slug: string
          created_at: string | null
          frequency: string
          id: string
          unit: string
          user_id: string
        }
        Insert: {
          amount: number
          compound_slug: string
          created_at?: string | null
          frequency: string
          id?: string
          unit: string
          user_id: string
        }
        Update: {
          amount?: number
          compound_slug?: string
          created_at?: string | null
          frequency?: string
          id?: string
          unit?: string
          user_id?: string
        }
        Relationships: []
      }
      reserved_slugs: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          notes: string | null
          reason: string
          slug: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          notes?: string | null
          reason?: string
          slug: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          notes?: string | null
          reason?: string
          slug?: string
        }
        Relationships: []
      }
      rma_attachments: {
        Row: {
          id: string
          mime_type: string | null
          rma_id: string
          size_bytes: number | null
          storage_key: string
          uploaded_at: string
          uploader_id: string
        }
        Insert: {
          id?: string
          mime_type?: string | null
          rma_id: string
          size_bytes?: number | null
          storage_key: string
          uploaded_at?: string
          uploader_id: string
        }
        Update: {
          id?: string
          mime_type?: string | null
          rma_id?: string
          size_bytes?: number | null
          storage_key?: string
          uploaded_at?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rma_attachments_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rma_items: {
        Row: {
          condition_received: string | null
          id: string
          order_item_id: string | null
          product_name: string
          quantity: number
          rma_id: string
          unit_amount: number
        }
        Insert: {
          condition_received?: string | null
          id?: string
          order_item_id?: string | null
          product_name: string
          quantity: number
          rma_id: string
          unit_amount: number
        }
        Update: {
          condition_received?: string | null
          id?: string
          order_item_id?: string | null
          product_name?: string
          quantity?: number
          rma_id?: string
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "rma_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean
          is_default_from: boolean
          is_ship_from: boolean
          is_ship_to: boolean
          label: string | null
          state: string
          street1: string
          street2: string | null
          updated_at: string
          user_id: string
          zip: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean
          is_default_from?: boolean
          is_ship_from?: boolean
          is_ship_to?: boolean
          label?: string | null
          state: string
          street1: string
          street2?: string | null
          updated_at?: string
          user_id: string
          zip: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean
          is_default_from?: boolean
          is_ship_from?: boolean
          is_ship_to?: boolean
          label?: string | null
          state?: string
          street1?: string
          street2?: string | null
          updated_at?: string
          user_id?: string
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_price_changes: {
        Row: {
          adjustment_type: string
          agent_id: string | null
          agent_product_id: string | null
          applied_at: string | null
          applied_by: string | null
          created_at: string
          created_by: string
          effective_at: string
          failed_at: string | null
          failure_reason: string | null
          id: string
          new_value: number
          notes: string | null
          product_id: string | null
          scope: string
          tier_name: string | null
        }
        Insert: {
          adjustment_type: string
          agent_id?: string | null
          agent_product_id?: string | null
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string
          created_by: string
          effective_at: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          new_value: number
          notes?: string | null
          product_id?: string | null
          scope: string
          tier_name?: string | null
        }
        Update: {
          adjustment_type?: string
          agent_id?: string | null
          agent_product_id?: string | null
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string
          created_by?: string
          effective_at?: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          new_value?: number
          notes?: string | null
          product_id?: string | null
          scope?: string
          tier_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_price_changes_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_price_changes_agent_product_id_fkey"
            columns: ["agent_product_id"]
            isOneToOne: false
            referencedRelation: "agent_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_price_changes_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_price_changes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_price_changes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      search_queries: {
        Row: {
          clicked_position: number | null
          clicked_slug: string | null
          created_at: string | null
          id: string
          intent: string | null
          latency_ms: number | null
          no_result: boolean | null
          query_normalized: string
          query_text: string
          result_count: number
          top_result_slug: string | null
        }
        Insert: {
          clicked_position?: number | null
          clicked_slug?: string | null
          created_at?: string | null
          id?: string
          intent?: string | null
          latency_ms?: number | null
          no_result?: boolean | null
          query_normalized: string
          query_text: string
          result_count?: number
          top_result_slug?: string | null
        }
        Update: {
          clicked_position?: number | null
          clicked_slug?: string | null
          created_at?: string | null
          id?: string
          intent?: string | null
          latency_ms?: number | null
          no_result?: boolean | null
          query_normalized?: string
          query_text?: string
          result_count?: number
          top_result_slug?: string | null
        }
        Relationships: []
      }
      shared_research_protocols: {
        Row: {
          created_at: string
          id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      shipping_label_purchases: {
        Row: {
          agent_charged_cents: number
          agent_id: string | null
          carrier: string
          created_at: string
          id: string
          label_amount_cents: number | null
          label_cost_cents: number
          label_file_type: string
          label_job_id: string | null
          label_url: string
          mode: string
          order_id: string
          origin_id: string | null
          paid_by: string
          parcel_template: string | null
          parcel_weight_oz: number
          provider: string
          provider_rate_id: string | null
          provider_refund_id: string | null
          provider_shipment_id: string | null
          provider_transaction_id: string
          refund_cents: number | null
          refunded: boolean
          refunded_at: string | null
          service_level: string
          tracking_number: string
          tracking_url_provider: string | null
        }
        Insert: {
          agent_charged_cents: number
          agent_id?: string | null
          carrier: string
          created_at?: string
          id?: string
          label_amount_cents?: number | null
          label_cost_cents: number
          label_file_type?: string
          label_job_id?: string | null
          label_url: string
          mode: string
          order_id: string
          origin_id?: string | null
          paid_by: string
          parcel_template?: string | null
          parcel_weight_oz: number
          provider?: string
          provider_rate_id?: string | null
          provider_refund_id?: string | null
          provider_shipment_id?: string | null
          provider_transaction_id: string
          refund_cents?: number | null
          refunded?: boolean
          refunded_at?: string | null
          service_level: string
          tracking_number: string
          tracking_url_provider?: string | null
        }
        Update: {
          agent_charged_cents?: number
          agent_id?: string | null
          carrier?: string
          created_at?: string
          id?: string
          label_amount_cents?: number | null
          label_cost_cents?: number
          label_file_type?: string
          label_job_id?: string | null
          label_url?: string
          mode?: string
          order_id?: string
          origin_id?: string | null
          paid_by?: string
          parcel_template?: string | null
          parcel_weight_oz?: number
          provider?: string
          provider_rate_id?: string | null
          provider_refund_id?: string | null
          provider_shipment_id?: string | null
          provider_transaction_id?: string
          refund_cents?: number | null
          refunded?: boolean
          refunded_at?: string | null
          service_level?: string
          tracking_number?: string
          tracking_url_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_label_purchases_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_label_purchases_label_job_id_fkey"
            columns: ["label_job_id"]
            isOneToOne: false
            referencedRelation: "label_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_label_purchases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_label_purchases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_label_purchases_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "shipping_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_origins: {
        Row: {
          city: string
          company: string | null
          country: string
          created_at: string
          email: string
          id: string
          is_active: boolean
          is_default: boolean
          label: string
          name: string
          phone: string
          provider_address_id: string | null
          state: string
          street1: string
          street2: string | null
          updated_at: string
          zip: string
        }
        Insert: {
          city: string
          company?: string | null
          country?: string
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          label: string
          name: string
          phone: string
          provider_address_id?: string | null
          state: string
          street1: string
          street2?: string | null
          updated_at?: string
          zip: string
        }
        Update: {
          city?: string
          company?: string | null
          country?: string
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          label?: string
          name?: string
          phone?: string
          provider_address_id?: string | null
          state?: string
          street1?: string
          street2?: string | null
          updated_at?: string
          zip?: string
        }
        Relationships: []
      }
      shipping_provider_credentials: {
        Row: {
          api_key_ciphertext: string
          api_key_iv: string
          api_key_last4: string
          api_key_tag: string
          connected_at: string
          connected_by: string | null
          id: string
          is_active: boolean
          last_validated_at: string | null
          last_validation_error: string | null
          mode: string
          provider: string
          rotated_from: string | null
          webhook_secret_ciphertext: string | null
          webhook_secret_iv: string | null
          webhook_secret_tag: string | null
        }
        Insert: {
          api_key_ciphertext: string
          api_key_iv: string
          api_key_last4: string
          api_key_tag: string
          connected_at?: string
          connected_by?: string | null
          id?: string
          is_active?: boolean
          last_validated_at?: string | null
          last_validation_error?: string | null
          mode: string
          provider?: string
          rotated_from?: string | null
          webhook_secret_ciphertext?: string | null
          webhook_secret_iv?: string | null
          webhook_secret_tag?: string | null
        }
        Update: {
          api_key_ciphertext?: string
          api_key_iv?: string
          api_key_last4?: string
          api_key_tag?: string
          connected_at?: string
          connected_by?: string | null
          id?: string
          is_active?: boolean
          last_validated_at?: string | null
          last_validation_error?: string | null
          mode?: string
          provider?: string
          rotated_from?: string | null
          webhook_secret_ciphertext?: string | null
          webhook_secret_iv?: string | null
          webhook_secret_tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_shippo_credentials_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_shippo_credentials_rotated_from_fkey"
            columns: ["rotated_from"]
            isOneToOne: false
            referencedRelation: "shipping_provider_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          id: string
          max_weight_oz: number
          min_weight_oz: number
          name: string
          rate: number
          updated_at: string | null
        }
        Insert: {
          id?: string
          max_weight_oz: number
          min_weight_oz?: number
          name: string
          rate: number
          updated_at?: string | null
        }
        Update: {
          id?: string
          max_weight_oz?: number
          min_weight_oz?: number
          name?: string
          rate?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      shipping_tracking_events: {
        Row: {
          carrier: string | null
          id: number
          location: Json | null
          occurred_at: string
          order_id: string
          raw_payload: Json
          received_at: string
          status: string
          status_details: string | null
          substatus: string | null
          tracking_number: string
        }
        Insert: {
          carrier?: string | null
          id?: number
          location?: Json | null
          occurred_at: string
          order_id: string
          raw_payload: Json
          received_at?: string
          status: string
          status_details?: string | null
          substatus?: string | null
          tracking_number: string
        }
        Update: {
          carrier?: string | null
          id?: number
          location?: Json | null
          occurred_at?: string
          order_id?: string
          raw_payload?: Json
          received_at?: string
          status?: string
          status_details?: string | null
          substatus?: string | null
          tracking_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_tracking_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_tracking_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_webhook_deliveries: {
        Row: {
          dead_lettered: boolean
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          provider_event_id: string | null
          received_at: string
          signature_valid: boolean
        }
        Insert: {
          dead_lettered?: boolean
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          provider_event_id?: string | null
          received_at?: string
          signature_valid: boolean
        }
        Update: {
          dead_lettered?: boolean
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          provider_event_id?: string | null
          received_at?: string
          signature_valid?: boolean
        }
        Relationships: []
      }
      shipping_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          provider: string
          received_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          received_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          received_at?: string
        }
        Relationships: []
      }
      slug_reservations: {
        Row: {
          caller_id: string | null
          consumed: boolean
          consumed_at: string | null
          created_at: string
          exclude_id: string | null
          expires_at: string
          field: string
          ip: string | null
          normalized: string
          token: string
        }
        Insert: {
          caller_id?: string | null
          consumed?: boolean
          consumed_at?: string | null
          created_at?: string
          exclude_id?: string | null
          expires_at?: string
          field: string
          ip?: string | null
          normalized: string
          token?: string
        }
        Update: {
          caller_id?: string | null
          consumed?: boolean
          consumed_at?: string | null
          created_at?: string
          exclude_id?: string | null
          expires_at?: string
          field?: string
          ip?: string | null
          normalized?: string
          token?: string
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          access_token: string | null
          account_ref: Json
          connected_at: string | null
          created_at: string
          display_label: string | null
          expires_at: string | null
          id: string
          provider: string
          refresh_token: string | null
          scope: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_ref?: Json
          connected_at?: string | null
          created_at?: string
          display_label?: string | null
          expires_at?: string | null
          id?: string
          provider: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_ref?: Json
          connected_at?: string | null
          created_at?: string
          display_label?: string | null
          expires_at?: string | null
          id?: string
          provider?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          attempts: number
          caption: string
          compliance_checked: boolean
          compliance_notes: string | null
          created_at: string
          dedupe_key: string | null
          error: string | null
          id: string
          link: string | null
          media_type: string
          media_url: string | null
          platform: string
          platform_post_id: string | null
          platform_url: string | null
          posted_at: string | null
          posting_started_at: string | null
          scheduled_for: string
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          caption: string
          compliance_checked?: boolean
          compliance_notes?: string | null
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: string
          link?: string | null
          media_type?: string
          media_url?: string | null
          platform: string
          platform_post_id?: string | null
          platform_url?: string | null
          posted_at?: string | null
          posting_started_at?: string | null
          scheduled_for?: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          caption?: string
          compliance_checked?: boolean
          compliance_notes?: string | null
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: string
          link?: string | null
          media_type?: string
          media_url?: string | null
          platform?: string
          platform_post_id?: string | null
          platform_url?: string | null
          posted_at?: string | null
          posting_started_at?: string | null
          scheduled_for?: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      statement_orders: {
        Row: {
          id: string
          order_id: string
          statement_id: string
        }
        Insert: {
          id?: string
          order_id: string
          statement_id: string
        }
        Update: {
          id?: string
          order_id?: string
          statement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_orders_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "weekly_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      store_credits: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          source_order_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          source_order_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          source_order_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_credits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_credits_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_credits_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_agent_commission_ledger: {
        Row: {
          accrued_at: string
          commission_amount: number
          commission_pct: number
          gross_product_subtotal: number
          id: string
          order_id: string
          parent_agent_id: string
          parent_delta_amount: number | null
          parent_delta_pct: number | null
          settled_at: string | null
          settlement_id: string | null
          status: string
          sub_agent_id: string
          voided_at: string | null
        }
        Insert: {
          accrued_at?: string
          commission_amount: number
          commission_pct: number
          gross_product_subtotal: number
          id?: string
          order_id: string
          parent_agent_id: string
          parent_delta_amount?: number | null
          parent_delta_pct?: number | null
          settled_at?: string | null
          settlement_id?: string | null
          status?: string
          sub_agent_id: string
          voided_at?: string | null
        }
        Update: {
          accrued_at?: string
          commission_amount?: number
          commission_pct?: number
          gross_product_subtotal?: number
          id?: string
          order_id?: string
          parent_agent_id?: string
          parent_delta_amount?: number | null
          parent_delta_pct?: number | null
          settled_at?: string | null
          settlement_id?: string | null
          status?: string
          sub_agent_id?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sub_agent_commission_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_agent_commission_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_agent_commission_ledger_parent_agent_id_fkey"
            columns: ["parent_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_agent_commission_ledger_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "sub_agent_settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_agent_commission_ledger_sub_agent_id_fkey"
            columns: ["sub_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_agent_commission_plan: {
        Row: {
          parent_agent_id: string | null
          steps: Json
          sub_agent_id: string
          updated_at: string
        }
        Insert: {
          parent_agent_id?: string | null
          steps?: Json
          sub_agent_id: string
          updated_at?: string
        }
        Update: {
          parent_agent_id?: string | null
          steps?: Json
          sub_agent_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_agent_commission_plan_sub_agent_id_fkey"
            columns: ["sub_agent_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_agent_commission_plan_super_agent_id_fkey"
            columns: ["parent_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_agent_settlements: {
        Row: {
          id: string
          orders_count: number
          parent_agent_id: string
          settled_at: string
          sub_agent_id: string
          total_commission: number
          week_end: string
          week_start: string
        }
        Insert: {
          id?: string
          orders_count: number
          parent_agent_id: string
          settled_at?: string
          sub_agent_id: string
          total_commission: number
          week_end: string
          week_start: string
        }
        Update: {
          id?: string
          orders_count?: number
          parent_agent_id?: string
          settled_at?: string
          sub_agent_id?: string
          total_commission?: number
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_agent_settlements_parent_agent_id_fkey"
            columns: ["parent_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_agent_settlements_sub_agent_id_fkey"
            columns: ["sub_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_runs: {
        Row: {
          failure_reason: string | null
          id: string
          notes: string | null
          order_id: string | null
          run_at: string
          status: string
          subscription_id: string
        }
        Insert: {
          failure_reason?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          run_at?: string
          status: string
          subscription_id: string
        }
        Update: {
          failure_reason?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          run_at?: string
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_runs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_runs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_runs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          agent_id: string
          cadence_days: number
          cancelled_at: string | null
          created_at: string
          failure_count: number
          fulfillment_method: string
          id: string
          items_snapshot: Json
          last_failure_reason: string | null
          last_order_id: string | null
          last_run_at: string | null
          next_run_at: string
          paused_at: string | null
          payment_method: string
          researcher_id: string
          shipping_address: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          cadence_days: number
          cancelled_at?: string | null
          created_at?: string
          failure_count?: number
          fulfillment_method?: string
          id?: string
          items_snapshot?: Json
          last_failure_reason?: string | null
          last_order_id?: string | null
          last_run_at?: string | null
          next_run_at: string
          paused_at?: string | null
          payment_method: string
          researcher_id: string
          shipping_address?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          cadence_days?: number
          cancelled_at?: string | null
          created_at?: string
          failure_count?: number
          fulfillment_method?: string
          id?: string
          items_snapshot?: Json
          last_failure_reason?: string | null
          last_order_id?: string | null
          last_run_at?: string | null
          next_run_at?: string
          paused_at?: string | null
          payment_method?: string
          researcher_id?: string
          shipping_address?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_last_order_id_fkey"
            columns: ["last_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_last_order_id_fkey"
            columns: ["last_order_id"]
            isOneToOne: false
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      super_agent_pricing: {
        Row: {
          baseline_cost: number
          bulk_baseline_cost: number | null
          bulk_threshold: number | null
          created_at: string | null
          id: string
          product_id: string
          super_agent_id: string
          updated_at: string | null
        }
        Insert: {
          baseline_cost: number
          bulk_baseline_cost?: number | null
          bulk_threshold?: number | null
          created_at?: string | null
          id?: string
          product_id: string
          super_agent_id: string
          updated_at?: string | null
        }
        Update: {
          baseline_cost?: number
          bulk_baseline_cost?: number | null
          bulk_threshold?: number | null
          created_at?: string | null
          id?: string
          product_id?: string
          super_agent_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "super_agent_pricing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "super_agent_pricing_super_agent_id_fkey"
            columns: ["super_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      test_realtime_rls: {
        Row: {
          id: string
          user_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_compound_subscriptions: {
        Row: {
          compound_slug: string
          created_at: string | null
          id: string
          notify_new_evidence: boolean | null
          notify_recall: boolean | null
          notify_trial_status: boolean | null
          notify_wada_change: boolean | null
          user_id: string
        }
        Insert: {
          compound_slug: string
          created_at?: string | null
          id?: string
          notify_new_evidence?: boolean | null
          notify_recall?: boolean | null
          notify_trial_status?: boolean | null
          notify_wada_change?: boolean | null
          user_id: string
        }
        Update: {
          compound_slug?: string
          created_at?: string | null
          id?: string
          notify_new_evidence?: boolean | null
          notify_recall?: boolean | null
          notify_trial_status?: boolean | null
          notify_wada_change?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      user_reading_queue: {
        Row: {
          compound_slug: string | null
          created_at: string | null
          id: string
          position: number | null
          read_at: string | null
          reference_id: string | null
          user_id: string
        }
        Insert: {
          compound_slug?: string | null
          created_at?: string | null
          id?: string
          position?: number | null
          read_at?: string | null
          reference_id?: string | null
          user_id: string
        }
        Update: {
          compound_slug?: string | null
          created_at?: string | null
          id?: string
          position?: number | null
          read_at?: string | null
          reference_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reading_queue_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "compound_references"
            referencedColumns: ["id"]
          },
        ]
      }
      user_saved_compounds: {
        Row: {
          collection_name: string | null
          compound_slug: string
          created_at: string | null
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          collection_name?: string | null
          compound_slug: string
          created_at?: string | null
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          collection_name?: string | null
          compound_slug?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_saved_matches: {
        Row: {
          created_at: string
          id: string
          match_input: Json
          results: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_input: Json
          results: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_input?: Json
          results?: Json
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          device_name: string | null
          id: string
          ip: unknown
          last_seen: string
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          id?: string
          ip?: unknown
          last_seen?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          id?: string
          ip?: unknown
          last_seen?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      username_changes: {
        Row: {
          changed_at: string
          id: string
          new_username: string
          old_username: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          new_username: string
          old_username?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          new_username?: string
          old_username?: string | null
          user_id?: string
        }
        Relationships: []
      }
      web_vitals: {
        Row: {
          created_at: string
          id: string
          metric: string
          metric_id: string | null
          navigation_type: string | null
          path: string | null
          rating: string | null
          user_id: string | null
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric: string
          metric_id?: string | null
          navigation_type?: string | null
          path?: string | null
          rating?: string | null
          user_id?: string | null
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          metric?: string
          metric_id?: string | null
          navigation_type?: string | null
          path?: string | null
          rating?: string | null
          user_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "web_vitals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          endpoint_id: string
          event_type: string
          id: string
          last_attempted_at: string | null
          last_response_body: string | null
          last_status_code: number | null
          next_attempt_at: string
          payload: Json
          related_order_id: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id: string
          event_type: string
          id?: string
          last_attempted_at?: string | null
          last_response_body?: string | null
          last_status_code?: number | null
          next_attempt_at?: string
          payload: Json
          related_order_id?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id?: string
          event_type?: string
          id?: string
          last_attempted_at?: string | null
          last_response_body?: string | null
          last_status_code?: number | null
          next_attempt_at?: string
          payload?: Json
          related_order_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders_view"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          event_types: string[]
          failure_count: number
          id: string
          is_active: boolean
          last_failure_at: string | null
          last_failure_reason: string | null
          last_success_at: string | null
          name: string
          owner_id: string | null
          owner_type: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          event_types?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_success_at?: string | null
          name: string
          owner_id?: string | null
          owner_type: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          event_types?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_success_at?: string | null
          name?: string
          owner_id?: string | null
          owner_type?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_statements: {
        Row: {
          admin_notes: string | null
          agent_id: string
          created_at: string | null
          dispute_reason: string | null
          dispute_resolution: string | null
          dispute_resolved_at: string | null
          dispute_resolved_by: string | null
          disputed_at: string | null
          due_date: string | null
          id: string
          paid_at: string | null
          payment_method: string | null
          payment_proof_id: string | null
          payment_reference: string | null
          status: Database["public"]["Enums"]["statement_status"] | null
          total_cogs: number | null
          total_owed: number | null
          total_shipping: number | null
          week_end: string
          week_start: string
        }
        Insert: {
          admin_notes?: string | null
          agent_id: string
          created_at?: string | null
          dispute_reason?: string | null
          dispute_resolution?: string | null
          dispute_resolved_at?: string | null
          dispute_resolved_by?: string | null
          disputed_at?: string | null
          due_date?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_proof_id?: string | null
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["statement_status"] | null
          total_cogs?: number | null
          total_owed?: number | null
          total_shipping?: number | null
          week_end: string
          week_start: string
        }
        Update: {
          admin_notes?: string | null
          agent_id?: string
          created_at?: string | null
          dispute_reason?: string | null
          dispute_resolution?: string | null
          dispute_resolved_at?: string | null
          dispute_resolved_by?: string | null
          disputed_at?: string | null
          due_date?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_proof_id?: string | null
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["statement_status"] | null
          total_cogs?: number | null
          total_owed?: number | null
          total_shipping?: number | null
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_statements_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      agent_storefront_analytics_30d: {
        Row: {
          add_to_cart_30d: number | null
          agent_id: string | null
          checkout_starts_30d: number | null
          conversion_pct_30d: number | null
          orders_30d: number | null
          pageviews_30d: number | null
          revenue_cents_30d: number | null
          unique_sessions_30d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_storefront_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_top_search_terms_30d: {
        Row: {
          agent_id: string | null
          searches: number | null
          term: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_storefront_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compound_search: {
        Row: {
          active_trial_count: number | null
          aliases: string[] | null
          benefits: string | null
          category: string | null
          compound_class: string | null
          display_name: string | null
          evidence_tier: string | null
          id: string | null
          is_glp1: boolean | null
          is_pro_angiogenic: boolean | null
          is_stack: boolean | null
          measured_half_life_hours: number | null
          mechanism: string | null
          molecular_target: string | null
          molecular_weight_da: number | null
          plain_summary: string | null
          predicted_half_life_hours: number | null
          pubmed_citation_count: number | null
          quality_score: number | null
          research_areas: string[] | null
          risk_level: string | null
          search_text: string | null
          search_vec: unknown
          slug: string | null
          studied_for: string[] | null
          wada_status: string | null
        }
        Relationships: []
      }
      marketing_channel_report: {
        Row: {
          channel: string | null
          channel_status: string | null
          conversions: number | null
          display_name: string | null
          identified: number | null
          monthly_cap_cents: number | null
          revenue_cents: number | null
          risk_tier: string | null
          spend_cents_all_time: number | null
          visitors: number | null
        }
        Relationships: []
      }
      orders_view: {
        Row: {
          agent_approval_notes: string | null
          agent_approved_at: string | null
          agent_id: string | null
          buyer_id: string | null
          created_at: string | null
          fulfillment_method:
            | Database["public"]["Enums"]["fulfillment_method"]
            | null
          id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          shipping_address: Json | null
          shipping_cost: number | null
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal: number | null
          total: number | null
          total_amount: number | null
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          agent_approval_notes?: string | null
          agent_approved_at?: string | null
          agent_id?: string | null
          buyer_id?: string | null
          created_at?: string | null
          fulfillment_method?:
            | Database["public"]["Enums"]["fulfillment_method"]
            | null
          id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal?: number | null
          total?: number | null
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_approval_notes?: string | null
          agent_approved_at?: string | null
          agent_id?: string | null
          buyer_id?: string | null
          created_at?: string | null
          fulfillment_method?:
            | Database["public"]["Enums"]["fulfillment_method"]
            | null
          id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal?: number | null
          total?: number | null
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_copurchase_pairs: {
        Row: {
          pair_count: number | null
          product_a: string | null
          product_b: string | null
        }
        Relationships: []
      }
      product_popular_60d: {
        Row: {
          product_id: string | null
          units: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_credit_balances: {
        Row: {
          balance: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accrue_sub_agent_commission: {
        Args: { p_order_id: string }
        Returns: string
      }
      active_referral_promotion: {
        Args: never
        Returns: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          priority: number
          referee_reward: number
          referrer_reward: number
          starts_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "referral_promotions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_adjust_balance: {
        Args: {
          p_agent_id: string
          p_amount: number
          p_created_by: string
          p_description: string
          p_reference_id?: string
          p_reference_type?: string
          p_type: string
        }
        Returns: {
          balance_after: number
          balance_before: number
          transaction_id: string
        }[]
      }
      admin_credit_account: {
        Args: {
          p_agent_id: string
          p_amount: number
          p_created_by: string
          p_description?: string
        }
        Returns: Json
      }
      admin_reassign_researcher: {
        Args: {
          p_new_parent_agent_id: string
          p_new_referring_agent_id: string
          p_researcher_id: string
        }
        Returns: undefined
      }
      agent_inventory_for_storefront: {
        Args: { p_slug: string }
        Returns: {
          product_id: string
          stock_count: number
        }[]
      }
      agent_inventory_in_stock: {
        Args: { p_agent_id: string; p_product_id: string }
        Returns: boolean
      }
      agent_sales_kpis: {
        Args: { p_agent_id: string; p_end: string; p_start: string }
        Returns: {
          aov_cents: number
          cancelled_count: number
          new_researchers: number
          orders_count: number
          profit_cents: number
          revenue_cents: number
        }[]
      }
      agent_sales_summary: {
        Args: { p_agent_id: string }
        Returns: {
          gross_total: number
          last30_total: number
          noncancelled_count: number
          orders_count: number
        }[]
      }
      agent_sales_tax_summary: {
        Args: { p_agent_id: string; p_year: number }
        Returns: {
          gross_revenue_cents: number
          orders_count: number
          state: string
        }[]
      }
      agent_sales_timeseries: {
        Args: { p_agent_id: string; p_end: string; p_start: string }
        Returns: {
          day: string
          orders_count: number
          profit_cents: number
          revenue_cents: number
        }[]
      }
      agent_team_org_chart: {
        Args: { p_root: string }
        Returns: {
          depth: number
          full_name: string
          id: string
          parent_id: string
          role: string
          username: string
        }[]
      }
      apply_due_price_changes: { Args: never; Returns: number }
      apply_referral_code: {
        Args: { p_code: string; p_referee_id: string }
        Returns: string
      }
      approve_agent_order_atomic: {
        Args: {
          p_agent_id: string
          p_amount: number
          p_approved_at?: string
          p_new_status: string
          p_order_id: string
          p_tracking_no?: string
        }
        Returns: Json
      }
      auto_pay_due_statements: { Args: never; Returns: number }
      cancel_order: {
        Args: {
          p_actor_id: string
          p_order_id: string
          p_reason: string
          p_refund_type: string
        }
        Returns: string
      }
      cancel_stale_pending_orders: {
        Args: { p_hours?: number }
        Returns: number
      }
      capitalize_words_preserve_case: {
        Args: { input_text: string }
        Returns: string
      }
      charge_credit_line: {
        Args: {
          p_agent_id: string
          p_amount: number
          p_created_by?: string
          p_description?: string
          p_order_id: string
        }
        Returns: number
      }
      charge_order_credit_line: {
        Args: { p_created_by: string; p_order_id: string }
        Returns: undefined
      }
      check_api_rate_limit: {
        Args: { p_key_id: string }
        Returns: {
          allowed: boolean
          remaining_day: number
          remaining_min: number
          retry_after_sec: number
        }[]
      }
      check_credit_chain: {
        Args: { p_additional_owed: number; p_billed_agent_id: string }
        Returns: {
          available_credit: number
          blocked: boolean
          blocked_level: number
          blocked_profile_id: string
          blocked_reason: string
          projected_total: number
        }[]
      }
      claim_push_outbox_batch: {
        Args: { p_limit?: number; p_max_attempts?: number }
        Returns: {
          attempts: number
          badge_url: string
          body: string
          icon_url: string
          id: string
          recipient_user_id: string
          tag: string
          title: string
          url: string
        }[]
      }
      coa_admin_catalogue: {
        Args: never
        Returns: {
          draft_count: number
          molecular_weight_da: number
          name: string
          primary_product_id: string
          published_count: number
          sequence_one_letter: string
          sku_count: number
          slug: string
        }[]
      }
      coa_coverage_gaps: {
        Args: { p_stale_days?: number }
        Returns: {
          gap_reason: string
          inventory_count: number
          latest_test_date: string
          product_id: string
          product_name: string
          product_slug: string
          verified_coa_count: number
        }[]
      }
      coa_preview_catalogue: {
        Args: never
        Returns: {
          id: string
          molecular_weight_da: number
          name: string
          sequence_one_letter: string
          slug: string
        }[]
      }
      coa_primary_product: { Args: { p_product_id: string }; Returns: string }
      coa_verified_lot_for_product: {
        Args: { p_product_id: string }
        Returns: string
      }
      compute_compound_quality_score: {
        Args: { c: Database["public"]["Tables"]["compounds"]["Row"] }
        Returns: number
      }
      consume_slug_reservation: {
        Args: { p_field: string; p_normalized: string; p_token: string }
        Returns: boolean
      }
      coupons_daily_expiry_sweep: { Args: never; Returns: number }
      credit_prepaid_balance: {
        Args: {
          p_amount: number
          p_description?: string
          p_reference_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
      decide_credit_increase: {
        Args: {
          p_admin: string
          p_decision: string
          p_note?: string
          p_request_id: string
        }
        Returns: Json
      }
      deduct_prepaid_balance: {
        Args: {
          agent_id: string
          amount: number
          p_description?: string
          p_order_id?: string
        }
        Returns: boolean
      }
      exec_disable_coa_triggers: { Args: never; Returns: undefined }
      exec_enable_coa_triggers: { Args: never; Returns: undefined }
      fn_admin_downline_tree: {
        Args: { p_days?: number }
        Returns: {
          depth: number
          email: string
          gmv: number
          id: string
          is_active: boolean
          is_super_agent: boolean
          name: string
          order_count: number
          parent_id: string
          path: string
          role: string
          username: string
        }[]
      }
      fn_admin_operational_nudges: {
        Args: never
        Returns: {
          abandoned_carts: number
          active_agents_no_warehouse: number
          agent_approval_pending: number
          expired_active_coupons: number
          negative_prepaid_balance: number
          open_statements_past_due: number
          out_of_stock_active_products: number
          pending_customer_payment: number
          researchers_first_login: number
          shipped_no_tracking: number
          stale_approved_ship: number
        }[]
      }
      fn_admin_search_orders: {
        Args: {
          p_agent_id?: string
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_max_total?: number
          p_min_total?: number
          p_payment_method?: string
          p_query?: string
          p_status?: string
        }
        Returns: {
          agent_id: string
          buyer_email: string
          buyer_name: string
          created_at: string
          id: string
          match_score: number
          payment_method: string
          status: string
          total: number
          tracking_number: string
        }[]
      }
      fn_agent_effective_markup: { Args: { p_agent: string }; Returns: number }
      fn_agent_own_wholesale_30d: { Args: { p_agent: string }; Returns: number }
      fn_agent_own_wholesale_30d_batch: {
        Args: { agent_ids: string[] }
        Returns: {
          agent_id: string
          volume: number
        }[]
      }
      fn_agent_volume_30d: { Args: { p_agent: string }; Returns: number }
      fn_ensure_admin_conversations_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      fn_find_direct_conversation: {
        Args: { a: string; b: string }
        Returns: string
      }
      fn_get_user_conversations: {
        Args: { p_user: string }
        Returns: {
          avatar_url: string
          conversation_id: string
          counterparty_avatar_url: string
          counterparty_full_name: string
          counterparty_id: string
          counterparty_role: string
          counterparty_username: string
          is_muted: boolean
          is_pinned: boolean
          last_message_at: string
          last_message_text: string
          title: string
          type: string
          unread_count: number
        }[]
      }
      fn_house_default_commission_steps: { Args: never; Returns: Json }
      fn_is_blocked_either: {
        Args: { p_a: string; p_b: string }
        Returns: boolean
      }
      fn_is_platform_admin: { Args: { p_user_id: string }; Returns: boolean }
      fn_messenger_create_conversation: {
        Args: {
          p_avatar: string
          p_caller_id: string
          p_participant_ids: string[]
          p_title: string
          p_type: string
        }
        Returns: string
      }
      fn_messenger_get_participant: {
        Args: { p_conv_id: string; p_user_id: string }
        Returns: {
          id: string
          role: string
        }[]
      }
      fn_messenger_is_admin_or_owner: {
        Args: { p_conv_id: string; p_user_id: string }
        Returns: boolean
      }
      fn_messenger_is_participant: {
        Args: { p_conv_id: string; p_user_id: string }
        Returns: boolean
      }
      fn_messenger_mark_read: {
        Args: { p_caller_id: string; p_conv_id: string; p_last_msg_id: string }
        Returns: {
          last_read_at: string
          last_read_message_id: string
          unread_count: number
        }[]
      }
      fn_messenger_support_open: {
        Args: { p_order_id?: string; p_topic?: string; p_user_id: string }
        Returns: string
      }
      fn_messenger_support_set_status: {
        Args: { p_conv: string; p_status: string }
        Returns: undefined
      }
      fn_messenger_support_snooze: {
        Args: { p_conv: string; p_until: string }
        Returns: undefined
      }
      fn_provisioned_accounts: {
        Args: { p_creator_scope?: string; p_only_pending?: boolean }
        Returns: {
          account_activated_at: string
          creator_full_name: string
          creator_id: string
          creator_role: string
          creator_role_at_creation: string
          creator_username: string
          first_sign_in_at: string
          last_sign_in_at: string
          sign_in_count: number
          user_created_at: string
          user_full_name: string
          user_id: string
          user_is_active: boolean
          user_role: string
          user_username: string
        }[]
      }
      fn_resolve_house_tier_level: {
        Args: { p_agent: string }
        Returns: number
      }
      fn_sub_agent_consumed_velocity: {
        Args: { p_sub: string }
        Returns: number
      }
      fn_sub_agent_effective_commission: {
        Args: { p_sub: string }
        Returns: number
      }
      fn_sub_agent_month_retail: { Args: { p_sub: string }; Returns: number }
      fn_validate_pricing: {
        Args: never
        Returns: {
          actual_retail: number
          agent_username: string
          base_cost: number
          effective_markup: number
          expected_value: number
          margin_percent: number
          product_name: string
          violation: string
        }[]
      }
      forecast_next_statement: { Args: { p_agent_id: string }; Returns: number }
      freeze_account: {
        Args: { p_reason: string; p_target_id: string }
        Returns: Json
      }
      fulfil_referral_reward: {
        Args: { p_qualifying_order_id: string; p_referral_id: string }
        Returns: boolean
      }
      fulfil_researcher_referral: {
        Args: { p_referral_id: string }
        Returns: undefined
      }
      get_copurchase_recommendations: {
        Args: { p_limit?: number; p_product_id: string }
        Returns: {
          pair_count: number
          related_product_id: string
        }[]
      }
      get_or_create_referral_code: {
        Args: { p_user_id: string }
        Returns: string
      }
      get_statement_detail: {
        Args: { p_statement_id: string }
        Returns: {
          buyer_email: string
          buyer_name: string
          line_items: Json
          order_created_at: string
          order_id: string
          order_status: string
          shipping_cost: number
          subtotal: number
          total: number
        }[]
      }
      get_sub_agent_ids: {
        Args: { super_agent_uuid: string }
        Returns: {
          id: string
        }[]
      }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      guarded_function_lock_key: {
        Args: { p_function_name: string }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      is_agent_or_above: { Args: never; Returns: boolean }
      is_chain_frozen: {
        Args: { p_agent_id: string }
        Returns: {
          frozen: boolean
          frozen_at_id: string
          frozen_at_level: number
          reason: string
        }[]
      }
      is_sub_agent: { Args: never; Returns: boolean }
      is_super_agent: { Args: never; Returns: boolean }
      issue_refund: {
        Args: {
          p_actor_id: string
          p_amount: number
          p_is_partial: boolean
          p_notes: string
          p_order_id: string
          p_reason: string
          p_refund_type: string
        }
        Returns: string
      }
      issue_store_credit: {
        Args: {
          p_amount: number
          p_created_by: string
          p_description?: string
          p_user_id: string
        }
        Returns: number
      }
      lock_guarded_function: {
        Args: { p_function_name: string }
        Returns: undefined
      }
      log_account_event: {
        Args: { p_details?: Json; p_event: string; p_user_id: string }
        Returns: string
      }
      log_marketing_spend: {
        Args: {
          p_amount_cents: number
          p_channel_slug: string
          p_clicks?: number
          p_impressions?: number
          p_spend_date: string
        }
        Returns: {
          out_cap_cents: number
          out_cap_exceeded: boolean
          out_channel: string
          out_day_cents: number
          out_mtd_cents: number
          out_spend_date: string
        }[]
      }
      lookup_coa_by_id: {
        Args: { p_id: string }
        Returns: {
          appearance: string
          approved_by_name: string
          cas_number: string
          chromatogram_storage_key: string
          coa_storage_key: string
          coa_verified_at: string
          expires_at: string
          hplc_column: string
          hplc_wavelength_nm: number
          lab_accreditation: string
          lab_is_third_party: boolean
          lab_report_number: string
          lot_id: string
          lot_number: string
          manufactured_at: string
          ms_method: string
          ms_observed_mass_da: number
          ms_theoretical_mass_da: number
          net_peptide_content_pct: number
          product_name: string
          product_slug: string
          purity_method: string
          purity_pct: number
          reference_mass_da: number
          sequence_one_letter: string
          supplier: string
          test_date: string
          testing_lab: string
          water_content_pct: number
        }[]
      }
      lookup_coa_by_lot: {
        Args: { p_lot: string }
        Returns: {
          appearance: string
          approved_by_name: string
          cas_number: string
          chromatogram_storage_key: string
          coa_storage_key: string
          coa_verified_at: string
          expires_at: string
          hplc_column: string
          hplc_wavelength_nm: number
          lab_accreditation: string
          lab_is_third_party: boolean
          lab_report_number: string
          lot_id: string
          lot_number: string
          manufactured_at: string
          ms_method: string
          ms_observed_mass_da: number
          ms_theoretical_mass_da: number
          net_peptide_content_pct: number
          product_name: string
          product_slug: string
          purity_method: string
          purity_pct: number
          reference_mass_da: number
          sequence_one_letter: string
          supplier: string
          test_date: string
          testing_lab: string
          water_content_pct: number
        }[]
      }
      mark_message_read: { Args: { p_message_id: string }; Returns: undefined }
      match_compounds_vector: {
        Args: {
          match_limit: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          display_name: string
          evidence_tier: string
          id: string
          plain_summary: string
          similarity: number
          slug: string
          wada_status: string
        }[]
      }
      match_products_vector: {
        Args: {
          match_limit: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          product_id: string
          similarity: number
        }[]
      }
      next_lot_seq: { Args: { p_slug: string }; Returns: number }
      pay_invoice: {
        Args: {
          p_amount: number
          p_handle: string
          p_proof_id: string
          p_target_id: string
          p_target_type: string
        }
        Returns: Json
      }
      pay_weekly_statement: {
        Args: {
          p_amount: number
          p_handle: string
          p_proof_id?: string
          p_statement_id: string
        }
        Returns: {
          new_balance: number
          txn_id: string
        }[]
      }
      payment_proof_order_id: { Args: { p_name: string }; Returns: string }
      provision_agent_storefront: {
        Args: { p_agent_id: string }
        Returns: string
      }
      prune_old_notifications: { Args: never; Returns: undefined }
      purge_analytics_data: {
        Args: never
        Returns: {
          deleted_rows: number
          purged_table: string
        }[]
      }
      recalculate_agent_product_prices: {
        Args: {
          p_agent_id?: string
          p_category?: string
          p_product_id?: string
        }
        Returns: undefined
      }
      record_attribution: {
        Args: {
          p_landing_path?: string
          p_referrer?: string
          p_user_id?: string
          p_utm_campaign?: string
          p_utm_content?: string
          p_utm_medium?: string
          p_utm_source?: string
          p_utm_term?: string
          p_visitor_id: string
        }
        Returns: undefined
      }
      record_function_rewrite: {
        Args: {
          p_body: string
          p_function_name: string
          p_migration_name?: string
        }
        Returns: undefined
      }
      redeem_coupon: {
        Args: {
          p_agent_id: string
          p_code: string
          p_order_subtotal: number
          p_user_id?: string
        }
        Returns: {
          coupon_id: string
          discount_amount: number
          discount_type: string
          discount_value: number
        }[]
      }
      redeem_store_credit: {
        Args: {
          p_amount: number
          p_description?: string
          p_order_id: string
          p_user_id: string
        }
        Returns: number
      }
      refresh_compound_search: { Args: never; Returns: undefined }
      refresh_recommendation_views: { Args: never; Returns: undefined }
      refresh_recommendation_views_plain: { Args: never; Returns: undefined }
      refund_prepaid_balance: {
        Args: {
          p_agent_id: string
          p_amount: number
          p_description?: string
          p_reference_id?: string
        }
        Returns: boolean
      }
      release_inventory: {
        Args: { p_agent_id?: string; p_is_agent_ship?: boolean; p_items: Json }
        Returns: undefined
      }
      release_store_credit: {
        Args: {
          p_amount: number
          p_description?: string
          p_order_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      requeue_stuck_push_outbox: {
        Args: { p_stale_minutes?: number }
        Returns: number
      }
      reserve_inventory: {
        Args: { p_agent_id?: string; p_is_agent_ship?: boolean; p_items: Json }
        Returns: undefined
      }
      resolve_statement_dispute: {
        Args: {
          p_admin: string
          p_note?: string
          p_resolution: string
          p_statement_id: string
        }
        Returns: boolean
      }
      reverse_order_credit_charge: {
        Args: { p_actor_id?: string; p_order_id: string }
        Returns: number
      }
      screen_marketing_creative: {
        Args: {
          p_asset_ref?: string
          p_asset_type?: string
          p_log?: boolean
          p_text: string
        }
        Returns: {
          rules_triggered: string[]
          verdict: string
        }[]
      }
      search_compounds_rank: {
        Args: { p_limit?: number; p_offset?: number; p_tsquery: string }
        Returns: {
          category: string
          compound_class: string
          display_name: string
          evidence_tier: string
          plain_summary: string
          score: number
          slug: string
          snippet: string
          total_count: number
          wada_status: string
        }[]
      }
      search_compounds_trgm: {
        Args: { p_limit?: number; p_term: string }
        Returns: {
          category: string
          compound_class: string
          display_name: string
          evidence_tier: string
          plain_summary: string
          score: number
          slug: string
          snippet: string
          wada_status: string
        }[]
      }
      settle_sub_agent_week: {
        Args: {
          p_sub_agent_id: string
          p_week_end: string
          p_week_start: string
        }
        Returns: string
      }
      shipping_enqueue_label_job: {
        Args: {
          p_order_id: string
          p_origin_id?: string
          p_preferred_service_level?: string
        }
        Returns: {
          agent_charged_cents: number | null
          agent_id: string | null
          attempts: number
          completed_at: string | null
          created_at: string
          from_address: Json | null
          id: string
          label_file_type: string
          label_url: string | null
          last_error: string | null
          next_attempt_at: string
          order_id: string
          origin_id: string | null
          parcel: Json | null
          preferred_service_level: string | null
          provider_transaction_id: string | null
          requested_by: string | null
          service_level_token: string | null
          status: string
          tracking_number: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "label_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      shipping_record_refund: {
        Args: {
          p_initiated_by?: string
          p_label_purchase_id: string
          p_provider_refund_id?: string
          p_reason?: string
          p_refund_amount_cents: number
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      slugify_for_storefront: { Args: { p_input: string }; Returns: string }
      super_credit_agent_balance: {
        Args: {
          p_agent_id: string
          p_amount: number
          p_created_by: string
          p_description?: string
        }
        Returns: number
      }
      unfreeze_account: { Args: { p_target_id: string }; Returns: Json }
      unredeem_coupon: { Args: { p_coupon_id: string }; Returns: undefined }
      upsert_agent_invoice_atomic: {
        Args: {
          p_agent_id: string
          p_super_agent_id: string
          p_total_cogs: number
          p_total_owed: number
          p_total_shipping: number
          p_week_end: string
          p_week_start: string
        }
        Returns: string
      }
      void_sub_agent_commission: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      walk_billing_chain: {
        Args: { p_agent_id: string }
        Returns: {
          account_type: string
          credit_limit: number
          credit_used: number
          is_sub_agent: boolean
          is_super_agent: boolean
          is_transactions_frozen: boolean
          level: number
          parent_agent_id: string
          profile_id: string
          role: string
        }[]
      }
      wallet_transfer: {
        Args: {
          p_amount: number
          p_note?: string
          p_recipient: string
          p_sender: string
        }
        Returns: Json
      }
    }
    Enums: {
      account_type: "credit" | "prepaid"
      agent_tier: "tier_1" | "tier_2" | "tier_3" | "tier_4" | "tier_5"
      disclaimer_layer:
        | "site_entry"
        | "registration"
        | "add_to_cart"
        | "checkout"
      discount_type: "percent" | "fixed"
      fulfillment_method: "ship" | "agent_pickup"
      order_status:
        | "pending_customer_payment"
        | "agent_approval_pending"
        | "admin_approval_pending"
        | "approved_ship"
        | "approved_pickup"
        | "in_fulfillment"
        | "shipped"
        | "delivered"
        | "cancelled"
      payment_method:
        | "zelle"
        | "cashapp"
        | "venmo"
        | "apple_pay"
        | "apple_cash"
        | "paypal"
        | "google_wallet"
        | "wise"
        | "chime"
        | "varo"
      statement_status: "open" | "pending_payment" | "paid"
      tier_name: "tier_1" | "tier_2" | "tier_3" | "tier_4" | "tier_5"
      user_role:
        | "researcher"
        | "agent"
        | "super_agent"
        | "admin"
        | "shipping"
        | "doctor"
        | "patient"
        | "pharmacy"
        | "rx_admin"
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
      account_type: ["credit", "prepaid"],
      agent_tier: ["tier_1", "tier_2", "tier_3", "tier_4", "tier_5"],
      disclaimer_layer: [
        "site_entry",
        "registration",
        "add_to_cart",
        "checkout",
      ],
      discount_type: ["percent", "fixed"],
      fulfillment_method: ["ship", "agent_pickup"],
      order_status: [
        "pending_customer_payment",
        "agent_approval_pending",
        "admin_approval_pending",
        "approved_ship",
        "approved_pickup",
        "in_fulfillment",
        "shipped",
        "delivered",
        "cancelled",
      ],
      payment_method: [
        "zelle",
        "cashapp",
        "venmo",
        "apple_pay",
        "apple_cash",
        "paypal",
        "google_wallet",
        "wise",
        "chime",
        "varo",
      ],
      statement_status: ["open", "pending_payment", "paid"],
      tier_name: ["tier_1", "tier_2", "tier_3", "tier_4", "tier_5"],
      user_role: [
        "researcher",
        "agent",
        "super_agent",
        "admin",
        "shipping",
        "doctor",
        "patient",
        "pharmacy",
        "rx_admin",
      ],
    },
  },
} as const

