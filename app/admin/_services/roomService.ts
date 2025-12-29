import { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/utils/logger/Logger';
import { DB_TABLES } from '@/utils/supabase/db_tables';

const logger = createLogger('RoomService');

export interface Room {
  room_id: string;
  room_title: string;
  user_id: string;
  created_at: string;
  is_active: boolean;
  is_section: boolean;
  sort_order: number;
  // UI fields
  isNew?: boolean;
}

export const roomService = {
  // --- READ ---
  async getRooms(supabase: SupabaseClient, userId: string) {
    const { data, error } = await supabase
      .from(DB_TABLES.ROOMS)
      .select('room_id, room_title, sort_order, is_section, is_active')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data as Room[];
  },

  async checkRoomIdExists(supabase: SupabaseClient, roomId: string): Promise<boolean> {
    const { data } = await supabase
        .from(DB_TABLES.ROOMS)
        .select('room_id')
        .eq('room_id', roomId)
        .maybeSingle();
    return !!data;
  },

  // --- WRITE ---
  async createRoom(supabase: SupabaseClient, room: Partial<Room>) {
    const { error } = await supabase.from(DB_TABLES.ROOMS).insert(room);
    if (error) throw error;
  },

  async updateRoom(supabase: SupabaseClient, roomId: string, updates: Partial<Room>) {
    const { error } = await supabase
      .from(DB_TABLES.ROOMS)
      .update({
        ...updates,
        // created_at обычно не меняют при апдейте, но если есть updated_at - можно добавить
      })
      .eq('room_id', roomId);

    if (error) throw error;
  },

  async deleteRoom(supabase: SupabaseClient, roomId: string) {
    const { error } = await supabase
      .from(DB_TABLES.ROOMS)
      .delete()
      .eq('room_id', roomId);
    
    if (error) throw error;
  },

  // Массовое обновление порядка (сортировка)
  async updateSortOrders(supabase: SupabaseClient, updates: { room_id: string; sort_order: number }[]) {
     const promises = updates.map(u => 
        supabase
           .from(DB_TABLES.ROOMS)
           .update({ sort_order: u.sort_order })
           .eq('room_id', u.room_id)
     );
     await Promise.all(promises);
  }
};

