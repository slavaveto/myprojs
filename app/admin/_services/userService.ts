import { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('UserService');
const USERS_TABLE = '_users';
const PROFILES_TABLE = '_profiles';

export interface UserData {
  user_id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  is_super_admin: boolean;
  is_owner?: boolean;
  email: string;
  plan: string;
  subscription_status: string;
  created_at?: string;
}

export const userService = {
  async getAllUsers(supabase: SupabaseClient) {
    // 1. Грузим юзеров
    const { data: usersData, error: usersError } = await supabase.from(USERS_TABLE).select('*');
    if (usersError) throw usersError;

    if (!usersData || usersData.length === 0) {
       return [];
    }

    // 2. Грузим профили для этих юзеров
    const userIds = usersData.map(u => u.user_id);
    const { data: profilesData, error: profilesError } = await supabase
      .from(PROFILES_TABLE)
      .select('user_id, username, full_name, avatar_url')
      .in('user_id', userIds);
      
    if (profilesError) {
       logger.error('Error fetching profiles', profilesError);
    }

    // 3. Склеиваем
    const mappedData: UserData[] = usersData.map(u => {
       const profile = profilesData?.find(p => p.user_id === u.user_id);
       return {
          ...u,
          username: profile?.username || u.username || '-', // Приоритет профилю
          full_name: profile?.full_name || '',
          avatar_url: profile?.avatar_url
       };
    });

    return mappedData;
  },

  async updateUser(supabase: SupabaseClient, userId: string, updates: Partial<UserData>) {
     const { error } = await supabase
        .from(USERS_TABLE)
        .update({
           ...updates,
           updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
     
     if (error) throw error;
  },
  
  async getUser(supabase: SupabaseClient, userId: string) {
     const { data, error } = await supabase
        .from(USERS_TABLE)
        .select('*')
        .eq('user_id', userId)
        .single();
        
     if (error) throw error;
     return data;
  }
};

