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
      card_listings: {
        Row: {
          attributes: Json
          card_group_id: string
          cardmarket_product_id: number | null
          created_at: string
          id: string
          source: string
          tcg_product_id: number | null
        }
        Insert: {
          attributes?: Json
          card_group_id: string
          cardmarket_product_id?: number | null
          created_at?: string
          id?: string
          source: string
          tcg_product_id?: number | null
        }
        Update: {
          attributes?: Json
          card_group_id?: string
          cardmarket_product_id?: number | null
          created_at?: string
          id?: string
          source?: string
          tcg_product_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "card_listings_card_group_id_fkey"
            columns: ["card_group_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_listings_card_group_id_fkey"
            columns: ["card_group_id"]
            isOneToOne: false
            referencedRelation: "ebay_candidates_pool"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "card_listings_card_group_id_fkey"
            columns: ["card_group_id"]
            isOneToOne: false
            referencedRelation: "potential_deals"
            referencedColumns: ["card_id"]
          },
        ]
      }
      cards: {
        Row: {
          attributes: Json
          base_name_norm: string | null
          canonical_name: string
          card_number: string | null
          created_at: string
          game: Database["public"]["Enums"]["game_kind"]
          id: string
          image_url: string | null
          is_base_variant: boolean | null
          is_scannable: boolean
          is_sealed: boolean
          language: string
          primary_card_id: string | null
          proper_set_code: string | null
          proper_set_name: string | null
          rarity: string | null
          set_code: string | null
          set_name: string | null
          updated_at: string
          variant_group_id: string | null
        }
        Insert: {
          attributes?: Json
          base_name_norm?: string | null
          canonical_name: string
          card_number?: string | null
          created_at?: string
          game: Database["public"]["Enums"]["game_kind"]
          id?: string
          image_url?: string | null
          is_base_variant?: boolean | null
          is_scannable?: boolean
          is_sealed?: boolean
          language?: string
          primary_card_id?: string | null
          proper_set_code?: string | null
          proper_set_name?: string | null
          rarity?: string | null
          set_code?: string | null
          set_name?: string | null
          updated_at?: string
          variant_group_id?: string | null
        }
        Update: {
          attributes?: Json
          base_name_norm?: string | null
          canonical_name?: string
          card_number?: string | null
          created_at?: string
          game?: Database["public"]["Enums"]["game_kind"]
          id?: string
          image_url?: string | null
          is_base_variant?: boolean | null
          is_scannable?: boolean
          is_sealed?: boolean
          language?: string
          primary_card_id?: string | null
          proper_set_code?: string | null
          proper_set_name?: string | null
          rarity?: string | null
          set_code?: string | null
          set_name?: string | null
          updated_at?: string
          variant_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_primary_card_id_fkey"
            columns: ["primary_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_primary_card_id_fkey"
            columns: ["primary_card_id"]
            isOneToOne: false
            referencedRelation: "ebay_candidates_pool"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "cards_primary_card_id_fkey"
            columns: ["primary_card_id"]
            isOneToOne: false
            referencedRelation: "potential_deals"
            referencedColumns: ["card_id"]
          },
        ]
      }
      drop_retailer_links: {
        Row: {
          drop_id: string
          id: string
          in_stock: boolean | null
          notes: string | null
          price_currency: Database["public"]["Enums"]["currency_code"] | null
          price_eur: number | null
          price_local: number | null
          price_usd: number | null
          region: string
          retailer: string
          sort_order: number
          stock_checked_at: string | null
          url: string
        }
        Insert: {
          drop_id: string
          id?: string
          in_stock?: boolean | null
          notes?: string | null
          price_currency?: Database["public"]["Enums"]["currency_code"] | null
          price_eur?: number | null
          price_local?: number | null
          price_usd?: number | null
          region: string
          retailer: string
          sort_order?: number
          stock_checked_at?: string | null
          url: string
        }
        Update: {
          drop_id?: string
          id?: string
          in_stock?: boolean | null
          notes?: string | null
          price_currency?: Database["public"]["Enums"]["currency_code"] | null
          price_eur?: number | null
          price_local?: number | null
          price_usd?: number | null
          region?: string
          retailer?: string
          sort_order?: number
          stock_checked_at?: string | null
          url?: string
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
      ebay_api_usage: {
        Row: {
          call_count: number
          call_date: string
          cap_hit_count: number
          failed_call_count: number
          first_call_at: string | null
          last_call_at: string | null
          notes: string | null
        }
        Insert: {
          call_count?: number
          call_date: string
          cap_hit_count?: number
          failed_call_count?: number
          first_call_at?: string | null
          last_call_at?: string | null
          notes?: string | null
        }
        Update: {
          call_count?: number
          call_date?: string
          cap_hit_count?: number
          failed_call_count?: number
          first_call_at?: string | null
          last_call_at?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      ebay_listings: {
        Row: {
          attributes: Json | null
          auction_ends_at: string | null
          card_id: string
          condition: string | null
          ebay_item_id: string
          expires_at: string | null
          fetched_at: string
          id: number
          image_url: string | null
          is_auction: boolean | null
          is_buy_it_now: boolean | null
          item_location: string | null
          item_url: string | null
          price_usd: number | null
          seller_feedback_count: number | null
          seller_feedback_pct: number | null
          seller_username: string | null
          shipping_usd: number | null
          title: string
          total_usd: number | null
        }
        Insert: {
          attributes?: Json | null
          auction_ends_at?: string | null
          card_id: string
          condition?: string | null
          ebay_item_id: string
          expires_at?: string | null
          fetched_at?: string
          id?: number
          image_url?: string | null
          is_auction?: boolean | null
          is_buy_it_now?: boolean | null
          item_location?: string | null
          item_url?: string | null
          price_usd?: number | null
          seller_feedback_count?: number | null
          seller_feedback_pct?: number | null
          seller_username?: string | null
          shipping_usd?: number | null
          title: string
          total_usd?: number | null
        }
        Update: {
          attributes?: Json | null
          auction_ends_at?: string | null
          card_id?: string
          condition?: string | null
          ebay_item_id?: string
          expires_at?: string | null
          fetched_at?: string
          id?: number
          image_url?: string | null
          is_auction?: boolean | null
          is_buy_it_now?: boolean | null
          item_location?: string | null
          item_url?: string | null
          price_usd?: number | null
          seller_feedback_count?: number | null
          seller_feedback_pct?: number | null
          seller_username?: string | null
          shipping_usd?: number | null
          title?: string
          total_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ebay_listings_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebay_listings_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "ebay_candidates_pool"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "ebay_listings_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "potential_deals"
            referencedColumns: ["card_id"]
          },
        ]
      }
      ebay_token_cache: {
        Row: {
          access_token: string
          expires_at: string
          fetched_at: string
          id: number
        }
        Insert: {
          access_token: string
          expires_at: string
          fetched_at?: string
          id?: number
        }
        Update: {
          access_token?: string
          expires_at?: string
          fetched_at?: string
          id?: number
        }
        Relationships: []
      }
      expansions: {
        Row: {
          attributes: Json
          created_at: string
          game: Database["public"]["Enums"]["game_kind"]
          id: string
          name: string
          release_date: string | null
          set_code: string
        }
        Insert: {
          attributes?: Json
          created_at?: string
          game: Database["public"]["Enums"]["game_kind"]
          id?: string
          name: string
          release_date?: string | null
          set_code: string
        }
        Update: {
          attributes?: Json
          created_at?: string
          game?: Database["public"]["Enums"]["game_kind"]
          id?: string
          name?: string
          release_date?: string | null
          set_code?: string
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          base_ccy: Database["public"]["Enums"]["currency_code"] | null
          base_currency: Database["public"]["Enums"]["currency_code"]
          captured_at: string
          id: number
          quote_ccy: Database["public"]["Enums"]["currency_code"] | null
          quote_currency: Database["public"]["Enums"]["currency_code"]
          rate: number
          rate_date: string | null
          source: string
        }
        Insert: {
          base_ccy?: Database["public"]["Enums"]["currency_code"] | null
          base_currency: Database["public"]["Enums"]["currency_code"]
          captured_at?: string
          id?: number
          quote_ccy?: Database["public"]["Enums"]["currency_code"] | null
          quote_currency: Database["public"]["Enums"]["currency_code"]
          rate: number
          rate_date?: string | null
          source?: string
        }
        Update: {
          base_ccy?: Database["public"]["Enums"]["currency_code"] | null
          base_currency?: Database["public"]["Enums"]["currency_code"]
          captured_at?: string
          id?: number
          quote_ccy?: Database["public"]["Enums"]["currency_code"] | null
          quote_currency?: Database["public"]["Enums"]["currency_code"]
          rate?: number
          rate_date?: string | null
          source?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          acquired_at: string | null
          allocated_travel: number
          allocated_travel_manual: boolean
          bought_on: string | null
          buy_cost_local: number
          buy_currency: Database["public"]["Enums"]["currency_code"]
          buy_location: string | null
          card_id: string | null
          condition: Database["public"]["Enums"]["condition_grade"] | null
          consignor_id: string | null
          created_at: string
          fx_rate_locked: number | null
          id: string
          is_foil: boolean | null
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
          user_id: string
          visibility_buyer: boolean
        }
        Insert: {
          acquired_at?: string | null
          allocated_travel?: number
          allocated_travel_manual?: boolean
          bought_on?: string | null
          buy_cost_local: number
          buy_currency: Database["public"]["Enums"]["currency_code"]
          buy_location?: string | null
          card_id?: string | null
          condition?: Database["public"]["Enums"]["condition_grade"] | null
          consignor_id?: string | null
          created_at?: string
          fx_rate_locked?: number | null
          id?: string
          is_foil?: boolean | null
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
          user_id: string
          visibility_buyer?: boolean
        }
        Update: {
          acquired_at?: string | null
          allocated_travel?: number
          allocated_travel_manual?: boolean
          bought_on?: string | null
          buy_cost_local?: number
          buy_currency?: Database["public"]["Enums"]["currency_code"]
          buy_location?: string | null
          card_id?: string | null
          condition?: Database["public"]["Enums"]["condition_grade"] | null
          consignor_id?: string | null
          created_at?: string
          fx_rate_locked?: number | null
          id?: string
          is_foil?: boolean | null
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
          user_id?: string
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
            foreignKeyName: "inventory_items_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "ebay_candidates_pool"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "inventory_items_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "potential_deals"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "inventory_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "open_trips"
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
      price_daily_snapshots: {
        Row: {
          archive_version: number
          archived_to_r2_at: string | null
          captured_at: string
          card_canonical_key: string
          card_listing_id: string
          cm_avg30: number | null
          condition: Database["public"]["Enums"]["condition_grade"] | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: number
          is_foil: boolean
          price_high: number | null
          price_low: number | null
          price_market: number | null
          snapshot_date: string
          source: string
          source_payload: Json | null
          variant_label: string | null
        }
        Insert: {
          archive_version?: number
          archived_to_r2_at?: string | null
          captured_at: string
          card_canonical_key: string
          card_listing_id: string
          cm_avg30?: number | null
          condition?: Database["public"]["Enums"]["condition_grade"] | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          id?: number
          is_foil?: boolean
          price_high?: number | null
          price_low?: number | null
          price_market?: number | null
          snapshot_date: string
          source: string
          source_payload?: Json | null
          variant_label?: string | null
        }
        Update: {
          archive_version?: number
          archived_to_r2_at?: string | null
          captured_at?: string
          card_canonical_key?: string
          card_listing_id?: string
          cm_avg30?: number | null
          condition?: Database["public"]["Enums"]["condition_grade"] | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: number
          is_foil?: boolean
          price_high?: number | null
          price_low?: number | null
          price_market?: number | null
          snapshot_date?: string
          source?: string
          source_payload?: Json | null
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_daily_snapshots_card_listing_id_fkey"
            columns: ["card_listing_id"]
            isOneToOne: false
            referencedRelation: "card_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      prices: {
        Row: {
          captured_at: string
          card_listing_id: string
          cm_avg30: number | null
          condition: Database["public"]["Enums"]["condition_grade"] | null
          currency: Database["public"]["Enums"]["currency_code"]
          id: number
          is_foil: boolean
          price_high: number | null
          price_low: number | null
          price_market: number | null
          source: string
          variant_label: string | null
        }
        Insert: {
          captured_at?: string
          card_listing_id: string
          cm_avg30?: number | null
          condition?: Database["public"]["Enums"]["condition_grade"] | null
          currency: Database["public"]["Enums"]["currency_code"]
          id?: number
          is_foil?: boolean
          price_high?: number | null
          price_low?: number | null
          price_market?: number | null
          source: string
          variant_label?: string | null
        }
        Update: {
          captured_at?: string
          card_listing_id?: string
          cm_avg30?: number | null
          condition?: Database["public"]["Enums"]["condition_grade"] | null
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: number
          is_foil?: boolean
          price_high?: number | null
          price_low?: number | null
          price_market?: number | null
          source?: string
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prices_card_listing_id_fkey"
            columns: ["card_listing_id"]
            isOneToOne: false
            referencedRelation: "card_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      product_drops: {
        Row: {
          card_id: string | null
          created_at: string
          game: Database["public"]["Enums"]["game_kind"]
          id: string
          image_url: string | null
          msrp_eur: number | null
          msrp_usd: number | null
          name: string
          notes: string | null
          product_type: string | null
          release_date: string | null
          set_code: string | null
          set_name: string | null
          source: string
          status: Database["public"]["Enums"]["drop_status"]
          tcgplayer_group_id: number | null
          tcgplayer_product_id: number | null
          updated_at: string
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          game: Database["public"]["Enums"]["game_kind"]
          id?: string
          image_url?: string | null
          msrp_eur?: number | null
          msrp_usd?: number | null
          name: string
          notes?: string | null
          product_type?: string | null
          release_date?: string | null
          set_code?: string | null
          set_name?: string | null
          source?: string
          status?: Database["public"]["Enums"]["drop_status"]
          tcgplayer_group_id?: number | null
          tcgplayer_product_id?: number | null
          updated_at?: string
        }
        Update: {
          card_id?: string | null
          created_at?: string
          game?: Database["public"]["Enums"]["game_kind"]
          id?: string
          image_url?: string | null
          msrp_eur?: number | null
          msrp_usd?: number | null
          name?: string
          notes?: string | null
          product_type?: string | null
          release_date?: string | null
          set_code?: string | null
          set_name?: string | null
          source?: string
          status?: Database["public"]["Enums"]["drop_status"]
          tcgplayer_group_id?: number | null
          tcgplayer_product_id?: number | null
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
          {
            foreignKeyName: "product_drops_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "ebay_candidates_pool"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "product_drops_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "potential_deals"
            referencedColumns: ["card_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
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
          value_num: number | null
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
          value_num?: number | null
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
          value_num?: number | null
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
          departed_on: string | null
          direction: Database["public"]["Enums"]["trip_direction"]
          ended_at: string | null
          fx_rate_locked: number | null
          id: string
          is_closed: boolean
          label: string | null
          name: string
          notes: string | null
          started_at: string | null
          travel_cost_local: number | null
          travel_currency: Database["public"]["Enums"]["currency_code"] | null
          user_id: string
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
          departed_on?: string | null
          direction?: Database["public"]["Enums"]["trip_direction"]
          ended_at?: string | null
          fx_rate_locked?: number | null
          id?: string
          is_closed?: boolean
          label?: string | null
          name: string
          notes?: string | null
          started_at?: string | null
          travel_cost_local?: number | null
          travel_currency?: Database["public"]["Enums"]["currency_code"] | null
          user_id: string
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
          departed_on?: string | null
          direction?: Database["public"]["Enums"]["trip_direction"]
          ended_at?: string | null
          fx_rate_locked?: number | null
          id?: string
          is_closed?: boolean
          label?: string | null
          name?: string
          notes?: string | null
          started_at?: string | null
          travel_cost_local?: number | null
          travel_currency?: Database["public"]["Enums"]["currency_code"] | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          preferences?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      ebay_candidates_pool: {
        Row: {
          card_id: string | null
          card_number: string | null
          game: Database["public"]["Enums"]["game_kind"] | null
          is_sealed: boolean | null
          language: string | null
          name: string | null
          set_code: string | null
          set_name: string | null
          us_market_min: number | null
        }
        Relationships: []
      }
      latest_eu_prices: {
        Row: {
          card_group_id: string | null
          eu_captured_at: string | null
          eu_low_min: number | null
          eu_market_avg: number | null
          eu_market_max: number | null
          eu_market_min: number | null
        }
        Relationships: [
          {
            foreignKeyName: "card_listings_card_group_id_fkey"
            columns: ["card_group_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_listings_card_group_id_fkey"
            columns: ["card_group_id"]
            isOneToOne: false
            referencedRelation: "ebay_candidates_pool"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "card_listings_card_group_id_fkey"
            columns: ["card_group_id"]
            isOneToOne: false
            referencedRelation: "potential_deals"
            referencedColumns: ["card_id"]
          },
        ]
      }
      latest_prices: {
        Row: {
          captured_at: string | null
          card_group_id: string | null
          cm_avg30: number | null
          condition: Database["public"]["Enums"]["condition_grade"] | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          is_foil: boolean | null
          price_high: number | null
          price_low: number | null
          price_market: number | null
          source: string | null
          variant_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_listings_card_group_id_fkey"
            columns: ["card_group_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_listings_card_group_id_fkey"
            columns: ["card_group_id"]
            isOneToOne: false
            referencedRelation: "ebay_candidates_pool"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "card_listings_card_group_id_fkey"
            columns: ["card_group_id"]
            isOneToOne: false
            referencedRelation: "potential_deals"
            referencedColumns: ["card_id"]
          },
        ]
      }
      open_trips: {
        Row: {
          arrived_on: string | null
          closed_at: string | null
          created_at: string | null
          departed_on: string | null
          direction: Database["public"]["Enums"]["trip_direction"] | null
          ended_at: string | null
          id: string | null
          is_closed: boolean | null
          label: string | null
          name: string | null
          notes: string | null
          started_at: string | null
          travel_cost_local: number | null
          travel_currency: Database["public"]["Enums"]["currency_code"] | null
          user_id: string | null
        }
        Insert: {
          arrived_on?: string | null
          closed_at?: string | null
          created_at?: string | null
          departed_on?: string | null
          direction?: Database["public"]["Enums"]["trip_direction"] | null
          ended_at?: string | null
          id?: string | null
          is_closed?: boolean | null
          label?: never
          name?: string | null
          notes?: string | null
          started_at?: string | null
          travel_cost_local?: number | null
          travel_currency?: Database["public"]["Enums"]["currency_code"] | null
          user_id?: string | null
        }
        Update: {
          arrived_on?: string | null
          closed_at?: string | null
          created_at?: string | null
          departed_on?: string | null
          direction?: Database["public"]["Enums"]["trip_direction"] | null
          ended_at?: string | null
          id?: string | null
          is_closed?: boolean | null
          label?: never
          name?: string | null
          notes?: string | null
          started_at?: string | null
          travel_cost_local?: number | null
          travel_currency?: Database["public"]["Enums"]["currency_code"] | null
          user_id?: string | null
        }
        Relationships: []
      }
      potential_deals: {
        Row: {
          best_direction: string | null
          card_id: string | null
          card_number: string | null
          computed_at: string | null
          ebay_active_count: number | null
          ebay_best_listing_url: string | null
          ebay_best_total_usd: number | null
          ebay_last_fetched_at: string | null
          eu_avg30_min: number | null
          eu_buy_eur: number | null
          eu_buy_usd: number | null
          eu_captured_at: string | null
          eu_languages: string[] | null
          eu_low_min: number | null
          eu_market_avg: number | null
          eu_market_max: number | null
          eu_market_min: number | null
          eu_sell_eur: number | null
          eu_sell_usd: number | null
          eu_variant_count: number | null
          floor_eur: number | null
          floor_usd: number | null
          game: Database["public"]["Enums"]["game_kind"] | null
          image_url: string | null
          is_foil: boolean | null
          is_sealed: boolean | null
          margin_pct: number | null
          margin_pct_at_eu_low: number | null
          margin_pct_eu_to_us: number | null
          match_confidence: string | null
          name: string | null
          price_quality: string | null
          profit_at_eu_low_eur: number | null
          profit_eu_to_us_eur: number | null
          profit_eu_to_us_usd: number | null
          profit_eur: number | null
          profit_usd: number | null
          proper_set_code: string | null
          rarity: string | null
          set_code: string | null
          set_name: string | null
          strike_aggressive_eur: number | null
          strike_aggressive_usd: number | null
          strike_at_eu_low_usd: number | null
          strike_at_us_low_eur: number | null
          strike_conservative_eur: number | null
          strike_conservative_usd: number | null
          strike_realistic_eur: number | null
          strike_realistic_usd: number | null
          us_buy_eur: number | null
          us_buy_usd: number | null
          us_captured_at: string | null
          us_low_min: number | null
          us_market_avg: number | null
          us_market_max: number | null
          us_market_min: number | null
          us_sell_eur: number | null
          us_sell_usd: number | null
          us_variant_count: number | null
          us_variants: Json | null
          usd_to_eur: number | null
          variant_group_id: string | null
          variant_spread_warning: boolean | null
        }
        Relationships: []
      }
      trip_totals: {
        Row: {
          buy_currency: Database["public"]["Enums"]["currency_code"] | null
          direction: Database["public"]["Enums"]["trip_direction"] | null
          item_count: number | null
          label: string | null
          name: string | null
          sold_buy_cost: number | null
          total_buy_cost: number | null
          total_sold: number | null
          total_travel_cost: number | null
          travel_currency: Database["public"]["Enums"]["currency_code"] | null
          trip_id: string | null
          user_id: string | null
        }
        Insert: {
          buy_currency?: never
          direction?: Database["public"]["Enums"]["trip_direction"] | null
          item_count?: never
          label?: never
          name?: never
          sold_buy_cost?: never
          total_buy_cost?: never
          total_sold?: never
          total_travel_cost?: never
          travel_currency?: Database["public"]["Enums"]["currency_code"] | null
          trip_id?: string | null
          user_id?: string | null
        }
        Update: {
          buy_currency?: never
          direction?: Database["public"]["Enums"]["trip_direction"] | null
          item_count?: never
          label?: never
          name?: never
          sold_buy_cost?: never
          total_buy_cost?: never
          total_sold?: never
          total_travel_cost?: never
          travel_currency?: Database["public"]["Enums"]["currency_code"] | null
          trip_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calc_floor_price: {
        Args: {
          p_allocated_travel?: number
          p_buy_cost_local: number
          p_buy_currency?: Database["public"]["Enums"]["currency_code"]
          p_fx_rate?: number
          p_margin_cd?: number
          p_margin_pp?: number
          p_sell_currency?: Database["public"]["Enums"]["currency_code"]
        }
        Returns: Json
      }
      calc_max_buy_price: {
        Args: {
          p_allocated_travel?: number
          p_buy_currency?: Database["public"]["Enums"]["currency_code"]
          p_fx_rate?: number
          p_margin_cd?: number
          p_margin_pp?: number
          p_sell_currency?: Database["public"]["Enums"]["currency_code"]
          p_target_sell_price: number
        }
        Returns: Json
      }
      card_price_provenance: {
        Args: { p_card_id: string }
        Returns: {
          captured_at: string
          cm_avg30: number
          condition: string
          currency: string
          is_foil: boolean
          price_high: number
          price_low: number
          price_market: number
          source: string
          variant_label: string
        }[]
      }
      compute_base_name_norm: {
        Args: { p_canonical_name: string; p_card_number: string }
        Returns: string
      }
      compute_variant_group_id: {
        Args: {
          p_base_name_norm: string
          p_card_number: string
          p_game: string
          p_proper_set_code: string
        }
        Returns: string
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      ebay_replace_listings: {
        Args: { p_card_id: string; p_listings: Json }
        Returns: Json
      }
      ebay_top_candidates: {
        Args: { p_limit?: number }
        Returns: {
          card_id: string
          card_number: string
          game: Database["public"]["Enums"]["game_kind"]
          is_sealed: boolean
          language: string
          last_fetched_at: string
          name: string
          set_code: string
          set_name: string
          us_market_min: number
        }[]
      }
      ebay_try_consume_call: { Args: { p_calls?: number }; Returns: Json }
      get_inventory_item_detail: { Args: { p_item_id: string }; Returns: Json }
      get_vault_secret: { Args: { p_name: string }; Returns: string }
      inventory_item_activity_log: {
        Args: { p_item_id: string }
        Returns: Json[]
      }
      is_admin: { Args: never; Returns: boolean }
      kick_off_cardmarket_pokemon: {
        Args: { p_batch_size?: number; p_batches?: number }
        Returns: Json
      }
      link_drops_to_cards: { Args: never; Returns: number }
      prune_old_snapshots: { Args: { p_keep_days?: number }; Returns: Json }
      reallocate_trip_travel: { Args: { p_trip_id: string }; Returns: Json }
      refresh_ebay_candidates_pool: { Args: never; Returns: undefined }
      refresh_potential_deals: { Args: never; Returns: Json }
      search_cards: {
        Args: {
          p_game?: Database["public"]["Enums"]["game_kind"]
          p_limit?: number
          p_query: string
        }
        Returns: {
          card_number: string
          game: Database["public"]["Enums"]["game_kind"]
          id: string
          image_url: string
          is_foil: boolean
          is_sealed: boolean
          language: string
          name: string
          rarity: string
          release_date: string
          release_year: number
          set_code: string
          set_name: string
        }[]
      }
      set_trip_status: {
        Args: { p_open: boolean; p_trip_id: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      snapshot_prices_daily: { Args: { p_date?: string }; Returns: Json }
      snapshots_unarchived_dates: {
        Args: never
        Returns: {
          snapshot_date: string
        }[]
      }
      trip_activity_log: { Args: { p_trip_id: string }; Returns: Json[] }
      unaccent: { Args: { "": string }; Returns: string }
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
        | "ungraded"
        | "sealed"
      currency_code: "USD" | "EUR" | "GBP" | "JPY" | "CAD" | "AUD" | "CHF"
      drop_status: "upcoming" | "live" | "released" | "cancelled"
      game_kind:
        | "pokemon"
        | "one_piece"
        | "magic"
        | "lorcana"
        | "yugioh"
        | "other"
      inventory_status:
        | "owned"
        | "listed"
        | "sold"
        | "returned"
        | "lost"
        | "pending"
        | "bought"
        | "in_transit"
        | "landed"
        | "cancelled"
      trip_direction: "US_TO_EU" | "EU_TO_US" | "DOMESTIC" | "OTHER"
      user_role: "admin" | "user"
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
      condition_grade: [
        "mint",
        "near_mint",
        "lightly_played",
        "moderately_played",
        "heavily_played",
        "damaged",
        "graded",
        "ungraded",
        "sealed",
      ],
      currency_code: ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF"],
      drop_status: ["upcoming", "live", "released", "cancelled"],
      game_kind: [
        "pokemon",
        "one_piece",
        "magic",
        "lorcana",
        "yugioh",
        "other",
      ],
      inventory_status: [
        "owned",
        "listed",
        "sold",
        "returned",
        "lost",
        "pending",
        "bought",
        "in_transit",
        "landed",
        "cancelled",
      ],
      trip_direction: ["US_TO_EU", "EU_TO_US", "DOMESTIC", "OTHER"],
      user_role: ["admin", "user"],
    },
  },
} as const

