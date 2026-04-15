// ============================================================
// Database types — auto-generated stub
// For full type safety, run: npx supabase gen types typescript
// > supabase/database.types.ts and copy here
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id:         string
          email:      string
          full_name:  string | null
          li_session: string | null
          timezone:   string
          settings:   Json
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['users']['Row']>
        Update: Partial<Database['public']['Tables']['users']['Row']>
      }
      campaigns: {
        Row: {
          id:                       string
          user_id:                  string
          name:                     string
          description:              string | null
          status:                   string
          dm_trigger_comments:      number
          dm_trigger_days:          number
          template_connection_note: string | null
          template_dm:              string | null
          created_at:               string
          updated_at:               string
        }
        Insert: Partial<Database['public']['Tables']['campaigns']['Row']>
        Update: Partial<Database['public']['Tables']['campaigns']['Row']>
      }
      leads: {
        Row: {
          id:                  string
          campaign_id:         string
          user_id:             string
          full_name:           string
          first_name:          string
          linkedin_url:        string
          company:             string | null
          job_title:           string | null
          industry:            string | null
          notes:               string | null
          stage:               string
          enrichment_data:     Json
          comment_count:       number
          imported_at:         string
          connection_sent_at:  string | null
          connected_at:        string | null
          dm_ready_at:         string | null
          dm_sent_at:          string | null
          last_activity_at:    string | null
          created_at:          string
          updated_at:          string
        }
        Insert: Partial<Database['public']['Tables']['leads']['Row']>
        Update: Partial<Database['public']['Tables']['leads']['Row']>
      }
      pending_actions: {
        Row: {
          id:            string
          lead_id:       string
          user_id:       string
          campaign_id:   string
          action_type:   string
          status:        string
          execute_after: string
          payload:       Json
          result:        Json | null
          attempts:      number
          last_error:    string | null
          started_at:    string | null
          completed_at:  string | null
          created_at:    string
        }
        Insert: Partial<Database['public']['Tables']['pending_actions']['Row']>
        Update: Partial<Database['public']['Tables']['pending_actions']['Row']>
      }
      dm_drafts: {
        Row: {
          id:             string
          lead_id:        string
          campaign_id:    string
          draft_text:     string
          status:         string
          edited_text:    string | null
          approved_by:    string | null
          send_action_id: string | null
          drafted_at:     string
          approved_at:    string | null
          sent_at:        string | null
        }
        Insert: Partial<Database['public']['Tables']['dm_drafts']['Row']>
        Update: Partial<Database['public']['Tables']['dm_drafts']['Row']>
      }
      comments: {
        Row: {
          id:           string
          lead_id:      string
          action_id:    string | null
          post_url:     string
          post_snippet: string | null
          comment_text: string
          status:       string
          posted_at:    string
        }
        Insert: Partial<Database['public']['Tables']['comments']['Row']>
        Update: Partial<Database['public']['Tables']['comments']['Row']>
      }
      ai_settings: {
        Row: {
          id:                    string
          user_id:               string
          tone:                  string
          personalisation_depth: number
          temperature:           number
          sender_name:           string
          sender_role:           string
          sender_company:        string
          target_industry:       string
          custom_instructions:   string | null
          banned_phrases:        string[]
          allow_connection_notes: boolean
          allow_comments:        boolean
          allow_dms:             boolean
          created_at:            string
          updated_at:            string
        }
        Insert: Partial<Database['public']['Tables']['ai_settings']['Row']>
        Update: Partial<Database['public']['Tables']['ai_settings']['Row']>
      }
      ai_generations: {
        Row: {
          id:              string
          user_id:         string
          lead_id:         string | null
          action_id:       string | null
          dm_draft_id:     string | null
          generation_type: string
          prompt_snapshot: string
          raw_response:    string
          final_output:    string | null
          safety_passed:   boolean
          safety_flags:    string[]
          model:           string
          input_tokens:    number | null
          output_tokens:   number | null
          temperature:     number | null
          was_used:        boolean | null
          occurred_at:     string
        }
        Insert: Partial<Database['public']['Tables']['ai_generations']['Row']>
        Update: Partial<Database['public']['Tables']['ai_generations']['Row']>
      }
      audit_log: {
        Row: {
          id:          string
          user_id:     string
          lead_id:     string | null
          action_id:   string | null
          event_type:  string
          payload:     Json
          worker_ip:   string | null
          occurred_at: string
        }
        Insert: Partial<Database['public']['Tables']['audit_log']['Row']>
        Update: Partial<Database['public']['Tables']['audit_log']['Row']>
      }
      templates: {
        Row: {
          id:         string
          user_id:    string
          name:       string
          type:       string
          content:    string
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['templates']['Row']>
        Update: Partial<Database['public']['Tables']['templates']['Row']>
      }
    }
    Views:   Record<string, never>
    Functions: Record<string, never>
    Enums:   Record<string, never>
  }
}
