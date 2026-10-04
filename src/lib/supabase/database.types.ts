export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ai_insights: {
        Row: {
          content: Json
          generated_at: string
          id: string
          kind: string
          model: string | null
          source: string
          user_id: string
        }
        Insert: {
          content: Json
          generated_at?: string
          id?: string
          kind?: string
          model?: string | null
          source: string
          user_id?: string
        }
        Update: {
          content?: Json
          generated_at?: string
          id?: string
          kind?: string
          model?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      alert_events: {
        Row: {
          alert_id: string
          id: string
          message: string
          observation_id: string | null
          observed_price: number
          read_at: string | null
          triggered_at: string
          user_id: string
        }
        Insert: {
          alert_id: string
          id?: string
          message: string
          observation_id?: string | null
          observed_price: number
          read_at?: string | null
          triggered_at?: string
          user_id?: string
        }
        Update: {
          alert_id?: string
          id?: string
          message?: string
          observation_id?: string | null
          observed_price?: number
          read_at?: string | null
          triggered_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_events_alert_fkey"
            columns: ["alert_id", "user_id"]
            referencedRelation: "alerts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "alert_events_observation_fkey"
            columns: ["observation_id", "user_id"]
            referencedRelation: "latest_price_observations"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "alert_events_observation_fkey"
            columns: ["observation_id", "user_id"]
            referencedRelation: "price_observations"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      alerts: {
        Row: {
          alert_type: string
          created_at: string
          direction: string
          id: string
          is_active: boolean
          is_triggered: boolean
          last_triggered_at: string | null
          lookback_hours: number | null
          note: string | null
          player_id: string
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          direction?: string
          id?: string
          is_active?: boolean
          is_triggered?: boolean
          last_triggered_at?: string | null
          lookback_hours?: number | null
          note?: string | null
          player_id: string
          target_value: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          direction?: string
          id?: string
          is_active?: boolean
          is_triggered?: boolean
          last_triggered_at?: string | null
          lookback_hours?: number | null
          note?: string | null
          player_id?: string
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_player_fkey"
            columns: ["player_id", "user_id"]
            referencedRelation: "players"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      coin_adjustments: {
        Row: {
          amount: number
          created_at: string
          id: string
          occurred_at: string
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          occurred_at?: string
          reason: string
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          occurred_at?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          club: string | null
          created_at: string
          id: string
          league: string | null
          name: string
          nation: string | null
          position: string | null
          rarity: string | null
          rating: number | null
          updated_at: string
          user_id: string
          version: string
        }
        Insert: {
          club?: string | null
          created_at?: string
          id?: string
          league?: string | null
          name: string
          nation?: string | null
          position?: string | null
          rarity?: string | null
          rating?: number | null
          updated_at?: string
          user_id?: string
          version?: string
        }
        Update: {
          club?: string | null
          created_at?: string
          id?: string
          league?: string | null
          name?: string
          nation?: string | null
          position?: string | null
          rarity?: string | null
          rating?: number | null
          updated_at?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      price_observations: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          observed_at: string
          player_id: string
          price: number
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          observed_at: string
          player_id: string
          price: number
          source?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          observed_at?: string
          player_id?: string
          price?: number
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_observations_player_fkey"
            columns: ["player_id", "user_id"]
            referencedRelation: "players"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      trade_sales: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          quantity: number
          sold_at: string
          tax_rate: number
          trade_id: string
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          quantity: number
          sold_at: string
          tax_rate: number
          trade_id: string
          unit_price: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          quantity?: number
          sold_at?: string
          tax_rate?: number
          trade_id?: string
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_sales_trade_fkey"
            columns: ["trade_id", "user_id"]
            referencedRelation: "trades"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      trades: {
        Row: {
          acquired_at: string
          created_at: string
          id: string
          notes: string | null
          player_id: string
          quantity: number
          unit_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          acquired_at: string
          created_at?: string
          id?: string
          notes?: string | null
          player_id: string
          quantity: number
          unit_cost: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          acquired_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          player_id?: string
          quantity?: number
          unit_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_player_fkey"
            columns: ["player_id", "user_id"]
            referencedRelation: "players"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      user_settings: {
        Row: {
          alert_notifications: boolean
          compact_numbers: boolean
          created_at: string
          number_locale: string
          starting_coin_balance: number
          tax_rate: number
          theme: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_notifications?: boolean
          compact_numbers?: boolean
          created_at?: string
          number_locale?: string
          starting_coin_balance?: number
          tax_rate?: number
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          alert_notifications?: boolean
          compact_numbers?: boolean
          created_at?: string
          number_locale?: string
          starting_coin_balance?: number
          tax_rate?: number
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          notes: string | null
          player_id: string
          target_buy_price: number | null
          target_sell_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          player_id: string
          target_buy_price?: number | null
          target_sell_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          player_id?: string
          target_buy_price?: number | null
          target_sell_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_items_player_fkey"
            columns: ["player_id", "user_id"]
            referencedRelation: "players"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      latest_price_observations: {
        Row: {
          id: string | null
          observed_at: string | null
          player_id: string | null
          price: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_observations_player_fkey"
            columns: ["player_id", "user_id"]
            referencedRelation: "players"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Functions: {
      consume_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      delete_my_account: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
