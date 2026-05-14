export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          id: number
          occurred_at: string
          row_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          id?: number
          occurred_at?: string
          row_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          id?: number
          occurred_at?: string
          row_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cards: {
        Row: {
          attributes: Json
          canonical_name: string
          card_number: string | null
          created_at: string
          game: Database["public"]["Enums"]["game_kind"]
          id: string
          image_url: string | null
          is_sealed: boolean
          language: string
          rarity: string | null
          set_code: string | null
          set_name: string | null
          updated_at: string
        }
        Insert: {
          attributes?: Json
          canonical_name: string
          card_number?: string | null
          created_at?: string
          game: Database["public"]["Enums"]["game_kind"]
          id?: string
          image_url?: string | null
          is_sealed?: boolean
          language?: string
          rarity?: string | null
          set_code?: string | null
          set_name?: string | null
          updated_at?: string
        }
        Update: {
          attributes?: Json
          canonical_name?: string
          card_number?: string | null
          created_at?: string
          game?: Database["public"]["Enums"]["game_kind"]
          id?: string
          image_url?: string | null
          is_sealed?: boolean
          language?: string
          rarity?: string | null
          set_code?: string | null
          set_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          base_ccy: Database["public"]["Enums"]["currency_code"]
          fetched_at: string
          quote_ccy: Database["public"]["Enums"]["currency_code"]
          rate: number
          rate_date: string
          source: string
        }
        Insert: {
          base_ccy: Database["public"]["Enums"]["currency_code"]
          fetched_at?: string
          quote_ccy: Database["public"]["Enums"]["currency_code"]
          rate: number
          rate_date: string
          source?: string
        }
        Update: {
          base_ccy?: Database["public"]["Enums"]["currency_code"]
          fetched_at?: string
          quote_ccy?: Database["public"]["Enums"]["currency_code"]
          rate?: number
          rate_date?: string
          source?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          allocated_travel: number
          allocated_travel_manual: boolean
          bought_on: string | null
          buy_cost_local: number
          buy_currency: Database["public"]["Enums"]["currency_code"]
          buy_location: string | null
          card_id: string
          consignor_id: string | null
          created_at: string
          created_by: string | null
          fx_rate_locked: number | null
          id: string
          listed_at: string | null
          listed_price: number | null
          margin_cd_override: number | null
          margin_pp_override: number | null
          notes: string | null
          partner_owner: string | null
          sell_currency: Database["public"]["Enums"]["currency_code"] | null
          sold_at: string | null
          sold_price: number | null
          sold_to: string | null
          source: string | null
          status: Database["public"]["Enums"]["inventory_status"]
          target_market: string | null
          trip_id: string | null
          updated_at: string
          visibility_buyer: boolean
        }
        Insert: {
          allocated_travel?: number
          allocated_travel_manual?: boolean
          bought_on?: string | null
          buy_cost_local: number
          buy_currency: Database["public"]["Enums"]["currency_code"]
          buy_location?: string | null
          card_id: string
          consignor_id?: string | null
          created_at?: string
          created_by?: string | null
          fx_rate_locked?: number | null
          id?: string
          listed_at?: string | null
          listed_price?: number | null
          margin_cd_override?: number | null
          margin_pp_override?: number | null
          notes?: string | null
          partner_owner?: string | null
          sell_currency?: Database["public"]["Enums"]["currency_code"] | null
          sold_at?: string | null
          sold_price?: number | null
          sold_to?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
          target_market?: string | null
          trip_id?: string | null
          updated_at?: string
          visibility_buyer?: boolean
        }
        Update: {
          allocated_travel?: number
          allocated_travel_manual?: boolean
          bought_on?: string | null
          buy_cost_local?: number
          buy_currency?: Database["public"]["Enums"]["currency_code"]
          buy_location?: string | null
          card_id?: string
          consignor_id?: string | null
          created_at?: string
          created_by?: string | null
          fx_rate_locked?: number | null
          id?: string
          listed_at?: string | null
          listed_price?: number | null
          margin_cd_override?: number | null
          margin_pp_override?: number | null
          notes?: string | null
          partner_owner?: string | null
          sell_currency?: Database["public"]["Enums"]["currency_code"] | null
          sold_at?: string | null
          sold_price?: number | null
          sold_to?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
          target_market?: string | null
          trip_id?: string | null
          updated_at?: string
          visibility_buyer?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_consignor_id_fkey"
            columns: ["consignor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_totals"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "inventory_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      product_drops: {
        Row: {
          id: string
          game: Database["public"]["Enums"]["game_kind"]
          name: string
          set_code: string | null
          set_name: string | null
          product_type: string | null
          image_url: string | null
          release_date: string | null
          msrp_usd: number | null
          msrp_eur: number | null
          notes: string | null
          status: "upcoming" | "live" | "released"
          card_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          game: Database["public"]["Enums"]["game_kind"]
          name: string
          set_code?: string | null
          set_name?: string | null
          product_type?: string | null
          image_url?: string | null
          release_date?: string | null
          msrp_usd?: number | null
          msrp_eur?: number | null
          notes?: string | null
          status?: "upcoming" | "live" | "released"
          card_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          game?: Database["public"]["Enums"]["game_kind"]
          name?: string
          set_code?: string | null
          set_name?: string | null
          product_type?: string | null
          image_url?: string | null
          release_date?: string | null
          msrp_usd?: number | null
          msrp_eur?: number | null
          notes?: string | null
          status?: "upcoming" | "live" | "released"
          card_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_drops_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      drop_retailer_links: {
        Row: {
          id: string
          drop_id: string
          retailer: string
          region: string
          url: string
          price_local: number | null
          price_currency: Database["public"]["Enums"]["currency_code"] | null
          sort_order: number
          in_stock: boolean | null
          stock_checked_at: string | null
          notes: string | null
          price_usd: number | null
          price_eur: number | null
        }
        Insert: {
          id?: string
          drop_id: string
          retailer: string
          region?: string
          url: string
          price_local?: number | null
          price_currency?: Database["public"]["Enums"]["currency_code"] | null
          sort_order?: number
          in_stock?: boolean | null
          stock_checked_at?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          drop_id?: string
          retailer?: string
          region?: string
          url?: string
          price_local?: number | null
          price_currency?: Database["public"]["Enums"]["currency_code"] | null
          sort_order?: number
          in_stock?: boolean | null
          stock_checked_at?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drop_retailer_links_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "product_drops"
            referencedColumns: ["id"]
          },
        ]
      }
      prices: {
        Row: {
          captured_at: string
          card_id: string
          condition: Database["public"]["Enums"]["condition_grade"] | null
          currency: Database["public"]["Enums"]["currency_code"]
          id: number
          is_foil: boolean | null
          price_high: number | null
          price_low: number | null
          price_market: number | null
          price_mid: number | null
          raw_payload: Json | null
          source: Database["public"]["Enums"]["price_source"]
          variant_label: string | null
        }
        Insert: {
          captured_at?: string
          card_id: string
          condition?: Database["public"]["Enums"]["condition_grade"] | null
          currency: Database["public"]["Enums"]["currency_code"]
          id?: number
          is_foil?: boolean | null
          price_high?: number | null
          price_low?: number | null
          price_market?: number | null
          price_mid?: number | null
          raw_payload?: Json | null
          source: Database["public"]["Enums"]["price_source"]
          variant_label?: string | null
        }
        Update: {
          captured_at?: string
          card_id?: string
          condition?: Database["public"]["Enums"]["condition_grade"] | null
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: number
          is_foil?: boolean | null
          price_high?: number | null
          price_low?: number | null
          price_market?: number | null
          price_mid?: number | null
          raw_payload?: Json | null
          source?: Database["public"]["Enums"]["price_source"]
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prices_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          is_active: boolean
          notes: string | null
          partner_code: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          is_active?: boolean
          notes?: string | null
          partner_code?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          partner_code?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      trips: {
        Row: {
          allocation_method: string
          arrived_on: string | null
          closed_at: string | null
          cost_flight: number
          cost_miles_or_gas: number
          cost_misc: number
          cost_shipping: number
          created_at: string
          created_by: string | null
          departed_on: string | null
          direction: Database["public"]["Enums"]["trip_direction"]
          fx_rate_locked: number | null
          id: string
          label: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          allocation_method?: string
          arrived_on?: string | null
          closed_at?: string | null
          cost_flight?: number
          cost_miles_or_gas?: number
          cost_misc?: number
          cost_shipping?: number
          created_at?: string
          created_by?: string | null
          departed_on?: string | null
          direction: Database["public"]["Enums"]["trip_direction"]
          fx_rate_locked?: number | null
          id?: string
          label: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          allocation_method?: string
          arrived_on?: string | null
          closed_at?: string | null
          cost_flight?: number
          cost_miles_or_gas?: number
          cost_misc?: number
          cost_shipping?: number
          created_at?: string
          created_by?: string | null
          departed_on?: string | null
          direction?: Database["public"]["Enums"]["trip_direction"]
          fx_rate_locked?: number | null
          id?: string
          label?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      latest_prices: {
        Row: {
          captured_at: string | null
          card_id: string | null
          condition: Database["public"]["Enums"]["condition_grade"] | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          is_foil: boolean | null
          price_high: number | null
          price_low: number | null
          price_market: number | null
          price_mid: number | null
          source: Database["public"]["Enums"]["price_source"] | null
          variant_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prices_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_totals: {
        Row: {
          buy_currency: Database["public"]["Enums"]["currency_code"] | null
          direction: Database["public"]["Enums"]["trip_direction"] | null
          label: string | null
          sell_currency: Database["public"]["Enums"]["currency_code"] | null
          total_travel_cost: number | null
          trip_id: string | null
        }
        Insert: {
          buy_currency?: never
          direction?: Database["public"]["Enums"]["trip_direction"] | null
          label?: string | null
          sell_currency?: never
          total_travel_cost?: never
          trip_id?: string | null
        }
        Update: {
          buy_currency?: never
          direction?: Database["public"]["Enums"]["trip_direction"] | null
          label?: string | null
          sell_currency?: never
          total_travel_cost?: never
          trip_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calc_floor_price: {
        Args: {
          p_allocated_travel?: number
          p_buy_cost_local: number
          p_buy_currency: Database["public"]["Enums"]["currency_code"]
          p_fx_rate?: number
          p_margin_cd?: number
          p_margin_pp?: number
        }
        Returns: Json
      }
      calc_max_buy_price: {
        Args: {
          p_allocated_travel?: number
          p_fx_rate?: number
          p_margin_cd?: number
          p_margin_pp?: number
          p_sell_currency: Database["public"]["Enums"]["currency_code"]
          p_target_sell_price: number
        }
        Returns: Json
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: {
        Args: never
        Returns: boolean
      }
    }
    Enums: {
      condition_grade:
        | "mint"
        | "near_mint"
        | "lightly_played"
        | "moderately_played"
        | "heavily_played"
        | "damaged"
        | "graded"
      currency_code: "USD" | "EUR" | "GBP" | "JPY" | "CAD"
      game_kind:
        | "pokemon"
        | "one_piece"
        | "magic"
        | "lorcana"
        | "yugioh"
        | "other"
      inventory_status:
        | "pending"
        | "bought"
        | "in_transit"
        | "landed"
        | "listed"
        | "sold"
        | "cancelled"
      price_source:
        | "manual"
        | "cardmarket_csv"
        | "cardmarket_api"
        | "tcgplayer_market"
        | "tcgplayer_low"
        | "ebay_sold"
        | "pricecharting"
        | "scrydex"
        | "justtcg"
      trip_direction: "US_TO_EU" | "EU_TO_US"
      user_role: "admin" | "staff" | "consignor" | "buyer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]),
> = (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends { Row: infer R }
  ? R
  : never

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Update: infer U } ? U : never

export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T]
