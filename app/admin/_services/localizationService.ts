import { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/utils/logger/Logger';
import { UIElement } from '@/utils/providers/localization/types';

const logger = createLogger('LocService');
const TABLE_NAME = '_ui';

export const localizationService = {
  // --- READ ---
  async getAllItems(supabase: SupabaseClient) {
     const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('item_id', { ascending: true });

     if (error) throw error;
     return data as UIElement[];
  },

  async checkIdExists(supabase: SupabaseClient, itemId: string) {
     const { data } = await supabase
        .from(TABLE_NAME)
        .select('item_id')
        .eq('item_id', itemId)
        .maybeSingle();
     return !!data;
  },

  // --- WRITE ---
  async createItem(supabase: SupabaseClient, item: Partial<UIElement>) {
      // Проверка дубликатов может быть и тут, но лучше в бизнес-логике (Actions) или на уровне БД
      const payload = {
          item_id: item.item_id,
          ru: item.ru || '',
          uk: item.uk || '',
          en: item.en || '',
          tab_id: item.tab_id || 'misc',
          sort_order: item.sort_order || 0,
          updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from(TABLE_NAME).insert(payload);
      if (error) throw error;
      return payload;
  },

  async updateItem(supabase: SupabaseClient, itemId: string, updates: Partial<UIElement>) {
     const { error } = await supabase
        .from(TABLE_NAME)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('item_id', itemId);

     if (error) throw error;
  },

  async deleteItem(supabase: SupabaseClient, itemId: string) {
     const { error } = await supabase.from(TABLE_NAME).delete().eq('item_id', itemId);
     if (error) throw error;
  },

  async updateSortOrders(supabase: SupabaseClient, updates: { item_id: string; sort_order: number }[]) {
     const promises = updates.map(u => 
          supabase
             .from(TABLE_NAME)
             .update({ sort_order: u.sort_order, updated_at: new Date().toISOString() })
             .eq('item_id', u.item_id)
      );
      await Promise.all(promises);
  }
};

