import { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('ProfileService');
const TABLE_NAME = '_profiles';

export interface Profile {
  user_id: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  updated_at?: string;
}

export const profileService = {
  // --- READ ---
  async getProfile(supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('username, full_name, avatar_url')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data as Partial<Profile>;
  },

  async checkUsernameAvailability(supabase: SupabaseClient, username: string, currentUserId: string): Promise<boolean> {
      if (!username) return true;
      
      const { data } = await supabase
         .from(TABLE_NAME)
         .select('user_id')
         .eq('username', username)
         .neq('user_id', currentUserId)
         .maybeSingle();

      return !data;
  },

  // --- WRITE ---
  async updateProfile(supabase: SupabaseClient, userId: string, updates: { username?: string; full_name?: string; avatar_url?: string }) {
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) throw error;
  }
};

