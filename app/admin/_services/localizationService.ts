import { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/utils/logger/Logger';
import { UIElement, LocalizTab } from '@/utils/providers/localization/types';
import { DB_TABLES } from '@/utils/supabase/db_tables';

const logger = createLogger('LocService');

// Дефолтные табы на случай, если конфига нет в базе
const DEFAULT_TABS: LocalizTab[] = [
    { id: 'entry', label: 'Entry Screen', order: 0 },
    { id: 'room', label: 'Room Screen', order: 1 },
    { id: 'misc', label: 'Misc', order: 2 },
];

export const localizationService = {
  // --- READ ---
  async getAllItems(supabase: SupabaseClient) {
     const { data, error } = await supabase
        .from(DB_TABLES.UI_ITEMS)
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('item_id', { ascending: true });

     if (error) throw error;

     const rawData = data as UIElement[];

     // 1. Ищем конфиг табов
     const configItem = rawData.find((i) => i.item_id === '_FOLDERS_CONFIG');
     let tabs: LocalizTab[] = DEFAULT_TABS;

     if (configItem && configItem.config) {
         tabs = configItem.config;
         // Сортируем табы по order
         tabs.sort((a, b) => (a.order || 0) - (b.order || 0));
     }

     // 2. Фильтруем данные (убираем спец. строки конфига из списка переводов)
     const items = rawData.filter((i) => i.item_id !== '_FOLDERS_CONFIG' && i.item_type !== 'group'); // is_section -> type === 'group'
     // is_config мы не добавили в типы базы явно везде, но _FOLDERS_CONFIG фильтруем по ID.
     // UPD: В типах UIElement нет поля is_config, но оно нам и не нужно, фильтруем по ID.

     return { items, tabs };
  },

  async checkIdExists(supabase: SupabaseClient, itemId: string) {
     const { data } = await supabase
        .from(DB_TABLES.UI_ITEMS)
        .select('item_id')
        .eq('item_id', itemId)
        .maybeSingle();
     return !!data;
  },

  // --- WRITE ---
  async createItem(supabase: SupabaseClient, item: Partial<UIElement>) {
      const payload = {
          item_id: item.item_id,
          ru: item.ru || '',
          uk: item.uk || '',
          en: item.en || '',
          tab_id: item.tab_id || 'misc',
          sort_order: item.sort_order || 0,
          item_type: item.item_type || null,
          updated_at: new Date().toISOString(),
          config: item.config || null,
      };

      const { data, error } = await supabase
        .from(DB_TABLES.UI_ITEMS)
        .insert(payload)
        .select();
        
      if (error) {
        console.error('[LocService] Create Error:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.warn('[LocService] Insert successful but no data returned. Check RLS policies?');
      } else {
        console.log('[LocService] Created:', data[0]);
      }
      
      return payload;
  },

  async updateItem(supabase: SupabaseClient, itemId: string, updates: Partial<UIElement>) {
     // Убираем undefined поля, чтобы не затереть их в базе (хотя update игнорит undefined, но лучше явно)
     const cleanUpdates = { ...updates, updated_at: new Date().toISOString() };
     
     const { error } = await supabase
        .from(DB_TABLES.UI_ITEMS)
        .update(cleanUpdates)
        .eq('item_id', itemId);

     if (error) throw error;
  },

  async deleteItem(supabase: SupabaseClient, itemId: string) {
     const { error } = await supabase.from(DB_TABLES.UI_ITEMS).delete().eq('item_id', itemId);
     if (error) throw error;
  },

  async updateSortOrders(supabase: SupabaseClient, updates: { item_id: string; sort_order: number }[]) {
     const promises = updates.map(u => 
          supabase
             .from(DB_TABLES.UI_ITEMS)
             .update({ sort_order: u.sort_order, updated_at: new Date().toISOString() })
             .eq('item_id', u.item_id)
      );
      await Promise.all(promises);
  },
  
  // Новый метод для сохранения конфигурации табов
  async saveTabsConfig(supabase: SupabaseClient, tabs: LocalizTab[]) {
      const payload = {
          config: tabs,
          updated_at: new Date().toISOString()
      };
      
      // Используем upsert, так как запись может не существовать
      const { error } = await supabase
        .from(DB_TABLES.UI_ITEMS)
        .upsert({ 
            item_id: '_FOLDERS_CONFIG', 
            ...payload
        });

      if (error) throw error;
  }
};
