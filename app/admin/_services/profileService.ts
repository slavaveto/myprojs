import { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/utils/logger/Logger';
import { DB_TABLES } from '@/utils/supabase/db_tables';

const logger = createLogger('ProfileService');

export interface Profile {
  user_id: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  about_me?: string;
  updated_at?: string;
}

export const profileService = {
  // --- READ ---
  async getProfile(supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase
      .from(DB_TABLES.PROFILES)
      .select('*') // Select all to avoid errors if specific columns (like about_me) are missing
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
       // logger.error('Profile fetch error', error); // Logger is not available here easily without importing
       throw error;
    }
    return (data || {}) as Partial<Profile>;
  },

  async checkUsernameAvailability(supabase: SupabaseClient, username: string, currentUserId: string): Promise<boolean> {
      if (!username) return true;
      
      const { data } = await supabase
         .from(DB_TABLES.PROFILES)
         .select('user_id')
         .eq('username', username)
         .neq('user_id', currentUserId)
         .maybeSingle();

      return !data;
  },

  // --- WRITE ---
  async updateProfile(supabase: SupabaseClient, userId: string, updates: { username?: string; full_name?: string; avatar_url?: string; about_me?: string }) {
    const { error } = await supabase
      .from(DB_TABLES.PROFILES)
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) throw error;
  }
};

