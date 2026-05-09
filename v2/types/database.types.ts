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
      admin_trusted_devices: {
        Row: {
          device_id: string
          id: string
          ip_address: string | null
          label: string | null
          last_seen_at: string | null
          revoked_at: string | null
          trusted_at: string | null
          user_agent: string | null
        }
        Insert: {
          device_id: string
          id?: string
          ip_address?: string | null
          label?: string | null
          last_seen_at?: string | null
          revoked_at?: string | null
          trusted_at?: string | null
          user_agent?: string | null
        }
        Update: {
          device_id?: string
          id?: string
          ip_address?: string | null
          label?: string | null
          last_seen_at?: string | null
          revoked_at?: string | null
          trusted_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      aiq_answers: {
        Row: {
          answer_idx: number | null
          answered_at: string | null
          id: string
          player_id: string
          q_idx: number
          room_id: string | null
        }
        Insert: {
          answer_idx?: number | null
          answered_at?: string | null
          id?: string
          player_id: string
          q_idx: number
          room_id?: string | null
        }
        Update: {
          answer_idx?: number | null
          answered_at?: string | null
          id?: string
          player_id?: string
          q_idx?: number
          room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aiq_answers_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "aiq_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      aiq_players: {
        Row: {
          color: string
          emoji: string
          id: string
          is_host: boolean | null
          joined_at: string | null
          name: string
          room_id: string | null
          score: number | null
        }
        Insert: {
          color: string
          emoji: string
          id: string
          is_host?: boolean | null
          joined_at?: string | null
          name: string
          room_id?: string | null
          score?: number | null
        }
        Update: {
          color?: string
          emoji?: string
          id?: string
          is_host?: boolean | null
          joined_at?: string | null
          name?: string
          room_id?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "aiq_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "aiq_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      aiq_rooms: {
        Row: {
          code: string
          created_at: string | null
          current_q_idx: number | null
          host_id: string
          id: string
          question_order: Json | null
          status: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          current_q_idx?: number | null
          host_id: string
          id: string
          question_order?: Json | null
          status?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          current_q_idx?: number | null
          host_id?: string
          id?: string
          question_order?: Json | null
          status?: string | null
        }
        Relationships: []
      }
      analytics: {
        Row: {
          created_at: string | null
          data: Json | null
          device: string | null
          event_type: string
          id: string
          session_id: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          device?: string | null
          event_type: string
          id?: string
          session_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          device?: string | null
          event_type?: string
          id?: string
          session_id?: string | null
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          category: string | null
          checked_in_at: string
          event_date: string | null
          event_id: string
          event_name: string | null
          id: string
          image_url: string | null
          user_id: string
          venue_id: string | null
          venue_name: string | null
        }
        Insert: {
          category?: string | null
          checked_in_at?: string
          event_date?: string | null
          event_id: string
          event_name?: string | null
          id?: string
          image_url?: string | null
          user_id: string
          venue_id?: string | null
          venue_name?: string | null
        }
        Update: {
          category?: string | null
          checked_in_at?: string
          event_date?: string | null
          event_id?: string
          event_name?: string | null
          id?: string
          image_url?: string | null
          user_id?: string
          venue_id?: string | null
          venue_name?: string | null
        }
        Relationships: []
      }
      config: {
        Row: {
          key: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      eschatology_quiz_submissions: {
        Row: {
          best_match: string | null
          created_at: string | null
          id: string
          percentages: Json | null
          quiz_type: string | null
          referrer: string | null
          scores: Json | null
          second_match: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          best_match?: string | null
          created_at?: string | null
          id?: string
          percentages?: Json | null
          quiz_type?: string | null
          referrer?: string | null
          scores?: Json | null
          second_match?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          best_match?: string | null
          created_at?: string | null
          id?: string
          percentages?: Json | null
          quiz_type?: string | null
          referrer?: string | null
          scores?: Json | null
          second_match?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      event_enrichments: {
        Row: {
          artist_bio: string | null
          enriched_at: string
          enriched_by: string | null
          event_id: string
          id: string
          local_notes: string | null
          tags: string[] | null
          updated_at: string
          venue_tips: string | null
        }
        Insert: {
          artist_bio?: string | null
          enriched_at?: string
          enriched_by?: string | null
          event_id: string
          id?: string
          local_notes?: string | null
          tags?: string[] | null
          updated_at?: string
          venue_tips?: string | null
        }
        Update: {
          artist_bio?: string | null
          enriched_at?: string
          enriched_by?: string | null
          event_id?: string
          id?: string
          local_notes?: string | null
          tags?: string[] | null
          updated_at?: string
          venue_tips?: string | null
        }
        Relationships: []
      }
      event_flags: {
        Row: {
          admin_note: string | null
          created_at: string | null
          event_id: string
          event_name: string | null
          id: string
          message: string
          status: string
          submitted_by: string | null
          updated_at: string | null
        }
        Insert: {
          admin_note?: string | null
          created_at?: string | null
          event_id: string
          event_name?: string | null
          id?: string
          message: string
          status?: string
          submitted_by?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_note?: string | null
          created_at?: string | null
          event_id?: string
          event_name?: string | null
          id?: string
          message?: string
          status?: string
          submitted_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      event_overrides: {
        Row: {
          data: Json | null
          id: string
          updated_at: string | null
        }
        Insert: {
          data?: Json | null
          id: string
          updated_at?: string | null
        }
        Update: {
          data?: Json | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      event_reminders: {
        Row: {
          endpoint: string
          event_date: string
          event_id: string
          event_name: string
          id: number
          remind_on_date: string
          reminder_days: number
          sent: boolean
          updated_at: string
        }
        Insert: {
          endpoint: string
          event_date: string
          event_id: string
          event_name: string
          id?: number
          remind_on_date: string
          reminder_days?: number
          sent?: boolean
          updated_at?: string
        }
        Update: {
          endpoint?: string
          event_date?: string
          event_id?: string
          event_name?: string
          id?: number
          remind_on_date?: string
          reminder_days?: number
          sent?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      event_reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          event_id: string
          event_title: string | null
          id: string
          message: string | null
          report_type: string
          reviewed_at: string | null
          status: string
          user_email: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          event_id: string
          event_title?: string | null
          id?: string
          message?: string | null
          report_type: string
          reviewed_at?: string | null
          status?: string
          user_email?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          event_id?: string
          event_title?: string | null
          id?: string
          message?: string | null
          report_type?: string
          reviewed_at?: string | null
          status?: string
          user_email?: string | null
        }
        Relationships: []
      }
      event_submissions: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          end_time: string | null
          event_date: string
          id: string
          is_free: boolean | null
          neighborhood_slug: string | null
          photo_url: string | null
          price_max_cents: number | null
          price_min_cents: number | null
          published_event_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          start_time: string | null
          status: string | null
          submitted_by: string | null
          submitter_ip: string | null
          ticket_url: string | null
          title: string
          updated_at: string | null
          user_agent: string | null
          venue_address: string | null
          venue_name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          event_date: string
          id?: string
          is_free?: boolean | null
          neighborhood_slug?: string | null
          photo_url?: string | null
          price_max_cents?: number | null
          price_min_cents?: number | null
          published_event_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          start_time?: string | null
          status?: string | null
          submitted_by?: string | null
          submitter_ip?: string | null
          ticket_url?: string | null
          title: string
          updated_at?: string | null
          user_agent?: string | null
          venue_address?: string | null
          venue_name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string
          id?: string
          is_free?: boolean | null
          neighborhood_slug?: string | null
          photo_url?: string | null
          price_max_cents?: number | null
          price_min_cents?: number | null
          published_event_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          start_time?: string | null
          status?: string | null
          submitted_by?: string | null
          submitter_ip?: string | null
          ticket_url?: string | null
          title?: string
          updated_at?: string | null
          user_agent?: string | null
          venue_address?: string | null
          venue_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_submissions_published_event_id_fkey"
            columns: ["published_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          ai_enrichment: Json | null
          cached_photo_url: string | null
          cached_thumbnail_url: string | null
          category: string | null
          created_at: string | null
          event_date: string | null
          featured: boolean | null
          hidden: boolean | null
          id: string
          image_status: string | null
          neighborhood: string | null
          neighborhood_slug: string | null
          pinned_last: boolean
          popularity_score: number | null
          raw: Json
          source: string
          submitted_by: string | null
          updated_at: string | null
          venue_name: string | null
          venue_slug: string | null
          venue_zip: string | null
        }
        Insert: {
          ai_enrichment?: Json | null
          cached_photo_url?: string | null
          cached_thumbnail_url?: string | null
          category?: string | null
          created_at?: string | null
          event_date?: string | null
          featured?: boolean | null
          hidden?: boolean | null
          id: string
          image_status?: string | null
          neighborhood?: string | null
          neighborhood_slug?: string | null
          pinned_last?: boolean
          popularity_score?: number | null
          raw: Json
          source: string
          submitted_by?: string | null
          updated_at?: string | null
          venue_name?: string | null
          venue_slug?: string | null
          venue_zip?: string | null
        }
        Update: {
          ai_enrichment?: Json | null
          cached_photo_url?: string | null
          cached_thumbnail_url?: string | null
          category?: string | null
          created_at?: string | null
          event_date?: string | null
          featured?: boolean | null
          hidden?: boolean | null
          id?: string
          image_status?: string | null
          neighborhood?: string | null
          neighborhood_slug?: string | null
          pinned_last?: boolean
          popularity_score?: number | null
          raw?: Json
          source?: string
          submitted_by?: string | null
          updated_at?: string | null
          venue_name?: string | null
          venue_slug?: string | null
          venue_zip?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          admin_notes: string | null
          category: string | null
          contact_email: string | null
          created_at: string | null
          device: string | null
          email: string | null
          event_id: string | null
          id: string
          message: string
          name: string | null
          page: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string | null
          status: string | null
          subject: string | null
          submitted_by: string | null
          submitter_ip: string | null
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          admin_notes?: string | null
          category?: string | null
          contact_email?: string | null
          created_at?: string | null
          device?: string | null
          email?: string | null
          event_id?: string | null
          id?: string
          message: string
          name?: string | null
          page?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          status?: string | null
          subject?: string | null
          submitted_by?: string | null
          submitter_ip?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          admin_notes?: string | null
          category?: string | null
          contact_email?: string | null
          created_at?: string | null
          device?: string | null
          email?: string | null
          event_id?: string | null
          id?: string
          message?: string
          name?: string | null
          page?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          status?: string | null
          subject?: string | null
          submitted_by?: string | null
          submitter_ip?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_post_log: {
        Row: {
          caption: string | null
          created_at: string
          event_id: string | null
          id: string
          image_url: string
          media_type: string
          post_id: string
          posted_at: string
          slide_count: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          image_url: string
          media_type: string
          post_id: string
          posted_at?: string
          slide_count?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          image_url?: string
          media_type?: string
          post_id?: string
          posted_at?: string
          slide_count?: number
        }
        Relationships: []
      }
      ig_scheduled_posts: {
        Row: {
          caption: string | null
          created_at: string
          error_msg: string | null
          event_id: string | null
          id: string
          image_urls: string[]
          location_id: string | null
          media_type: string
          post_id: string | null
          published_at: string | null
          scheduled_for: string
          status: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          error_msg?: string | null
          event_id?: string | null
          id?: string
          image_urls: string[]
          location_id?: string | null
          media_type: string
          post_id?: string | null
          published_at?: string | null
          scheduled_for: string
          status?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          error_msg?: string | null
          event_id?: string | null
          id?: string
          image_urls?: string[]
          location_id?: string | null
          media_type?: string
          post_id?: string | null
          published_at?: string | null
          scheduled_for?: string
          status?: string
        }
        Relationships: []
      }
      leaderboard: {
        Row: {
          count: number | null
          display_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          count?: number | null
          display_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          count?: number | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_matches: {
        Row: {
          channels_sent: string[]
          dismissed: boolean
          event_id: string
          id: number
          match_reasons: string[]
          matched_at: string
          score: number
          sent_at: string | null
          user_id: string
        }
        Insert: {
          channels_sent?: string[]
          dismissed?: boolean
          event_id: string
          id?: number
          match_reasons?: string[]
          matched_at?: string
          score?: number
          sent_at?: string | null
          user_id: string
        }
        Update: {
          channels_sent?: string[]
          dismissed?: boolean
          event_id?: string
          id?: number
          match_reasons?: string[]
          matched_at?: string
          score?: number
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          event_id: string | null
          id: string
          message: string | null
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          message?: string | null
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          message?: string | null
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          badges: Json
          bio: string | null
          check_ins: string[] | null
          created_at: string | null
          display_name: string | null
          events_approved: number | null
          events_attended: number
          events_submitted: number | null
          handle: string | null
          id: string
          is_banned: boolean | null
          is_public: boolean
          joined_at: string
          neighborhood: string | null
          preferences: Json
          reviews_written: number
          showcase_badge: string | null
          streak_days: number
          streak_last_date: string | null
          streak_pauses_used: number
          streak_weeks: number
          total_check_ins: number
          trust_score: number | null
          updated_at: string | null
          venues_visited: number
        }
        Insert: {
          avatar_url?: string | null
          badges?: Json
          bio?: string | null
          check_ins?: string[] | null
          created_at?: string | null
          display_name?: string | null
          events_approved?: number | null
          events_attended?: number
          events_submitted?: number | null
          handle?: string | null
          id: string
          is_banned?: boolean | null
          is_public?: boolean
          joined_at?: string
          neighborhood?: string | null
          preferences?: Json
          reviews_written?: number
          showcase_badge?: string | null
          streak_days?: number
          streak_last_date?: string | null
          streak_pauses_used?: number
          streak_weeks?: number
          total_check_ins?: number
          trust_score?: number | null
          updated_at?: string | null
          venues_visited?: number
        }
        Update: {
          avatar_url?: string | null
          badges?: Json
          bio?: string | null
          check_ins?: string[] | null
          created_at?: string | null
          display_name?: string | null
          events_approved?: number | null
          events_attended?: number
          events_submitted?: number | null
          handle?: string | null
          id?: string
          is_banned?: boolean | null
          is_public?: boolean
          joined_at?: string
          neighborhood?: string | null
          preferences?: Json
          reviews_written?: number
          showcase_badge?: string | null
          streak_days?: number
          streak_last_date?: string | null
          streak_pauses_used?: number
          streak_weeks?: number
          total_check_ins?: number
          trust_score?: number | null
          updated_at?: string | null
          venues_visited?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          prefs: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          prefs?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          prefs?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          rating: number
          target_id: string
          target_name: string | null
          target_type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          rating: number
          target_id: string
          target_name?: string | null
          target_type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          rating?: number
          target_id?: string
          target_name?: string | null
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      social_visibility: {
        Row: {
          share_checkins: boolean
          share_saves: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          share_checkins?: boolean
          share_saves?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          share_checkins?: boolean
          share_saves?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_visibility_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "leaderboard_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_visibility_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_pauses: {
        Row: {
          created_at: string
          id: string
          paused_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          paused_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          paused_date?: string
          user_id?: string
        }
        Relationships: []
      }
      umami_snapshots: {
        Row: {
          captured_at: string
          error: string | null
          id: number
          series_30d: Json | null
          stats_30d: Json | null
          stats_30d_prev: Json | null
          stats_7d: Json | null
          stats_7d_prev: Json | null
          top_pages_30d: Json | null
          top_refs_30d: Json | null
        }
        Insert: {
          captured_at?: string
          error?: string | null
          id?: number
          series_30d?: Json | null
          stats_30d?: Json | null
          stats_30d_prev?: Json | null
          stats_7d?: Json | null
          stats_7d_prev?: Json | null
          top_pages_30d?: Json | null
          top_refs_30d?: Json | null
        }
        Update: {
          captured_at?: string
          error?: string | null
          id?: number
          series_30d?: Json | null
          stats_30d?: Json | null
          stats_30d_prev?: Json | null
          stats_7d?: Json | null
          stats_7d_prev?: Json | null
          top_pages_30d?: Json | null
          top_refs_30d?: Json | null
        }
        Relationships: []
      }
      user_email_prefs: {
        Row: {
          created_at: string
          email: string
          frequency: string | null
          id: string
          last_sent_at: string | null
          opted_in: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          frequency?: string | null
          id?: string
          last_sent_at?: string | null
          opted_in?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          frequency?: string | null
          id?: string
          last_sent_at?: string | null
          opted_in?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_event_preferences: {
        Row: {
          categories: string[]
          channels: string[]
          created_at: string
          days_ahead: number
          digest_day: number
          digest_hour: number
          enabled: boolean
          family_friendly: boolean
          include_free: boolean
          include_paid: boolean
          keywords: string[]
          moods: string[]
          neighborhoods: string[]
          price_max_cents: number | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          subcategory_tags: string[]
          updated_at: string
          user_id: string
          venues: string[]
        }
        Insert: {
          categories?: string[]
          channels?: string[]
          created_at?: string
          days_ahead?: number
          digest_day?: number
          digest_hour?: number
          enabled?: boolean
          family_friendly?: boolean
          include_free?: boolean
          include_paid?: boolean
          keywords?: string[]
          moods?: string[]
          neighborhoods?: string[]
          price_max_cents?: number | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          subcategory_tags?: string[]
          updated_at?: string
          user_id: string
          venues?: string[]
        }
        Update: {
          categories?: string[]
          channels?: string[]
          created_at?: string
          days_ahead?: number
          digest_day?: number
          digest_hour?: number
          enabled?: boolean
          family_friendly?: boolean
          include_free?: boolean
          include_paid?: boolean
          keywords?: string[]
          moods?: string[]
          neighborhoods?: string[]
          price_max_cents?: number | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          subcategory_tags?: string[]
          updated_at?: string
          user_id?: string
          venues?: string[]
        }
        Relationships: []
      }
      user_events: {
        Row: {
          added_at: string
          category: string | null
          event_date: string | null
          event_id: string
          event_name: string | null
          id: string
          image_url: string | null
          state: string
          ticket_url: string | null
          user_id: string
          venue_name: string | null
        }
        Insert: {
          added_at?: string
          category?: string | null
          event_date?: string | null
          event_id: string
          event_name?: string | null
          id?: string
          image_url?: string | null
          state?: string
          ticket_url?: string | null
          user_id: string
          venue_name?: string | null
        }
        Update: {
          added_at?: string
          category?: string | null
          event_date?: string | null
          event_id?: string
          event_name?: string | null
          id?: string
          image_url?: string | null
          state?: string
          ticket_url?: string | null
          user_id?: string
          venue_name?: string | null
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          category: string | null
          context_id: string | null
          context_name: string | null
          context_type: string | null
          created_at: string | null
          id: string
          message: string
          url: string | null
          user_email: string | null
        }
        Insert: {
          category?: string | null
          context_id?: string | null
          context_name?: string | null
          context_type?: string | null
          created_at?: string | null
          id?: string
          message: string
          url?: string | null
          user_email?: string | null
        }
        Update: {
          category?: string | null
          context_id?: string | null
          context_name?: string | null
          context_type?: string | null
          created_at?: string | null
          id?: string
          message?: string
          url?: string | null
          user_email?: string | null
        }
        Relationships: []
      }
      user_saved_events: {
        Row: {
          categories: string[] | null
          event_date: string | null
          event_id: string
          event_name: string
          event_source: string
          id: string
          image_url: string | null
          saved_at: string
          user_id: string
        }
        Insert: {
          categories?: string[] | null
          event_date?: string | null
          event_id: string
          event_name: string
          event_source: string
          id?: string
          image_url?: string | null
          saved_at?: string
          user_id: string
        }
        Update: {
          categories?: string[] | null
          event_date?: string | null
          event_id?: string
          event_name?: string
          event_source?: string
          id?: string
          image_url?: string | null
          saved_at?: string
          user_id?: string
        }
        Relationships: []
      }
      venue_mayors: {
        Row: {
          checkin_count: number
          crowned_at: string
          id: string
          is_current: boolean
          period_start: string
          updated_at: string
          user_id: string
          venue_id: string
          venue_name: string
        }
        Insert: {
          checkin_count?: number
          crowned_at?: string
          id?: string
          is_current?: boolean
          period_start: string
          updated_at?: string
          user_id: string
          venue_id: string
          venue_name: string
        }
        Update: {
          checkin_count?: number
          crowned_at?: string
          id?: string
          is_current?: boolean
          period_start?: string
          updated_at?: string
          user_id?: string
          venue_id?: string
          venue_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard_view: {
        Row: {
          avatar_url: string | null
          badges: Json | null
          display_name: string | null
          handle: string | null
          id: string | null
          is_public: boolean | null
          joined_at: string | null
          neighborhood: string | null
          streak_weeks: number | null
          total_checkins: number | null
          unique_days: number | null
          unique_venues: number | null
          weekly_checkins: number | null
        }
        Relationships: []
      }
      leaderboard_weekly: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          handle: string | null
          neighborhood: string | null
          rank: number | null
          user_id: string | null
          weekly_count: number | null
        }
        Relationships: []
      }
      mayorships: {
        Row: {
          checkin_count: number | null
          last_seen: string | null
          user_id: string | null
          venue_name: string | null
        }
        Relationships: []
      }
      umami_latest: {
        Row: {
          captured_at: string | null
          error: string | null
          id: number | null
          series_30d: Json | null
          stats_30d: Json | null
          stats_30d_prev: Json | null
          stats_7d: Json | null
          stats_7d_prev: Json | null
          top_pages_30d: Json | null
          top_refs_30d: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      backfill_event_categories: {
        Args: never
        Returns: {
          source: string
          updated_count: number
        }[]
      }
      fn_backfill_cached_photo_url: { Args: never; Returns: undefined }
      generate_keywords_from_types: {
        Args: { input_types: string[] }
        Returns: string[]
      }
      purge_old_events: { Args: never; Returns: number }
      purge_past_events: { Args: never; Returns: number }
      read_secret: { Args: { secret_name: string }; Returns: string }
      refresh_umami_snapshot: { Args: never; Returns: number }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      upsert_events: { Args: { p_events: Json }; Returns: undefined }
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
