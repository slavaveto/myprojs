import { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('RoomService');
const TABLE_NAME = 'rooms'; // Таблицу комнат мы не переименовывали в _rooms?

// Если переименовывали, нужно поменять на '_rooms'.
// Пока оставляю 'rooms', как было в коде, но слежу за твоей реакцией.

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
      .from(TABLE_NAME)
      .select('room_id, room_title, sort_order, is_section, is_active')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data as Room[];
  },

  async checkRoomIdExists(supabase: SupabaseClient, roomId: string): Promise<boolean> {
    const { data } = await supabase
        .from(TABLE_NAME)
        .select('room_id')
        .eq('room_id', roomId)
        .maybeSingle();
    return !!data;
  },

  // --- WRITE ---
  async createRoom(supabase: SupabaseClient, room: Partial<Room>) {
    const { error } = await supabase.from(TABLE_NAME).insert(room);
    if (error) throw error;
  },

  async updateRoom(supabase: SupabaseClient, roomId: string, updates: Partial<Room>) {
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({
        ...updates,
        // created_at обычно не меняют при апдейте, но если есть updated_at - можно добавить
      })
      .eq('room_id', roomId);

    if (error) throw error;
  },

  async deleteRoom(supabase: SupabaseClient, roomId: string) {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('room_id', roomId);
    
    if (error) throw error;
  },

  // Массовое обновление порядка (сортировка)
  async updateSortOrders(supabase: SupabaseClient, updates: { room_id: string; sort_order: number }[]) {
     const promises = updates.map(u => 
        supabase
           .from(TABLE_NAME)
           .update({ sort_order: u.sort_order })
           .eq('room_id', u.room_id)
     );
     await Promise.all(promises);
  }
};

