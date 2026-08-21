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
      calls: {
        Row: {
          call_type: string
          caller_id: string
          conversation_id: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          started_at: string
          status: string
        }
        Insert: {
          call_type: string
          caller_id: string
          conversation_id: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Update: {
          call_type?: string
          caller_id?: string
          conversation_id?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          id: string
          is_group: boolean
          last_message_at: string
          name: string | null
          user1_id: string | null
          user2_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          last_message_at?: string
          name?: string | null
          user1_id?: string | null
          user2_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          last_message_at?: string
          name?: string | null
          user1_id?: string | null
          user2_id?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      live_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          pinned: boolean
          stream_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          pinned?: boolean
          stream_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          pinned?: boolean
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_comments_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_guest_requests: {
        Row: {
          created_at: string
          id: string
          status: string
          stream_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          stream_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_guest_requests_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          stream_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          stream_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_reactions_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_streams: {
        Row: {
          audience: string
          category: string | null
          comments_enabled: boolean
          created_at: string
          ended_at: string | null
          host_id: string
          id: string
          peak_viewers: number
          replay_saved: boolean
          replay_url: string | null
          scheduled_at: string | null
          started_at: string
          status: string
          thumbnail_url: string | null
          title: string
          total_viewers: number
        }
        Insert: {
          audience?: string
          category?: string | null
          comments_enabled?: boolean
          created_at?: string
          ended_at?: string | null
          host_id: string
          id?: string
          peak_viewers?: number
          replay_saved?: boolean
          replay_url?: string | null
          scheduled_at?: string | null
          started_at?: string
          status?: string
          thumbnail_url?: string | null
          title: string
          total_viewers?: number
        }
        Update: {
          audience?: string
          category?: string | null
          comments_enabled?: boolean
          created_at?: string
          ended_at?: string | null
          host_id?: string
          id?: string
          peak_viewers?: number
          replay_saved?: boolean
          replay_url?: string | null
          scheduled_at?: string | null
          started_at?: string
          status?: string
          thumbnail_url?: string | null
          title?: string
          total_viewers?: number
        }
        Relationships: []
      }
      live_viewers: {
        Row: {
          id: string
          joined_at: string
          last_seen_at: string
          left_at: string | null
          stream_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          last_seen_at?: string
          left_at?: string | null
          stream_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          last_seen_at?: string
          left_at?: string | null
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_viewers_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
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
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string
          created_at: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          expires_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      phone_verifications: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          purpose: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          purpose?: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          purpose?: string
        }
        Relationships: []
      }
      post_shares: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
          location: string | null
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          location?: string | null
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          location?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          close_friends_ids: string[]
          created_at: string
          full_name: string | null
          id: string
          interests: string[]
          is_private: boolean
          last_seen_at: string | null
          onboarded: boolean
          phone: string | null
          show_activity_status: boolean
          updated_at: string
          username: string
          verified: boolean
          verified_until: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          close_friends_ids?: string[]
          created_at?: string
          full_name?: string | null
          id: string
          interests?: string[]
          is_private?: boolean
          last_seen_at?: string | null
          onboarded?: boolean
          phone?: string | null
          show_activity_status?: boolean
          updated_at?: string
          username: string
          verified?: boolean
          verified_until?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          close_friends_ids?: string[]
          created_at?: string
          full_name?: string | null
          id?: string
          interests?: string[]
          is_private?: boolean
          last_seen_at?: string | null
          onboarded?: boolean
          phone?: string | null
          show_activity_status?: boolean
          updated_at?: string
          username?: string
          verified?: boolean
          verified_until?: string | null
          website?: string | null
        }
        Relationships: []
      }
      reel_likes: {
        Row: {
          created_at: string
          reel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reel_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_likes_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reels: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          thumbnail_url: string | null
          user_id: string
          video_url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          thumbnail_url?: string | null
          user_id: string
          video_url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          thumbnail_url?: string | null
          user_id?: string
          video_url?: string
        }
        Relationships: []
      }
      saved_collections: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_posts: {
        Row: {
          collection_id: string | null
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          collection_id?: string | null
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          collection_id?: string | null
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "saved_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string
          user_id?: string
        }
        Relationships: []
      }
      story_views: {
        Row: {
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          allow_message_requests: boolean
          email_notifications: boolean
          is_private: boolean
          language: string
          push_notifications: boolean
          show_activity_status: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_message_requests?: boolean
          email_notifications?: boolean
          is_private?: boolean
          language?: string
          push_notifications?: boolean
          show_activity_status?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_message_requests?: boolean
          email_notifications?: boolean
          is_private?: boolean
          language?: string
          push_notifications?: boolean
          show_activity_status?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_group_member: {
        Args: { _conv: string; _user: string }
        Returns: undefined
      }
      create_group_conversation: {
        Args: { _avatar_url?: string; _member_ids: string[]; _name: string }
        Returns: string
      }
      get_email_by_username: { Args: { _username: string }; Returns: string }
      get_or_create_conversation: {
        Args: { other_user: string }
        Returns: string
      }
      get_presence: {
        Args: { _ids: string[] }
        Returns: {
          last_seen_at: string
          user_id: string
        }[]
      }
      is_conv_admin: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_conv_member: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      leave_group: { Args: { _conv: string }; Returns: undefined }
      remove_group_member: {
        Args: { _conv: string; _user: string }
        Returns: undefined
      }
      set_group_member_role: {
        Args: { _conv: string; _role: string; _user: string }
        Returns: undefined
      }
      touch_last_seen: { Args: never; Returns: undefined }
      update_group_meta: {
        Args: { _avatar_url: string; _conv: string; _name: string }
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
