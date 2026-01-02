export type Language = 'ru' | 'uk' | 'en';

export interface UIElement {
    item_id: string;
    ru: string;
    uk: string;
    en: string;
    updated_at: string;
    tab_id?: string | null;
    sort_order?: number;
    item_type?: string | null;
    isNew?: boolean;
    _tempId?: string;
}

// Базовый интерфейс для элементов с кэшем
export interface CacheItem {
    updated_at: string;
    [key: string]: any;
}

export interface CachedData<T> {
    items: Record<string, T>;
    lastSync: string;
}
