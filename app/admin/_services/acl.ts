// Конфигурация прав доступа (ACL)

// 1. Список всех возможных прав (Features)
export const PERMISSIONS = {
   // --- SUPER ADMIN ONLY ---
   MANAGE_USERS: 'manage_users', // Управление пользователями
   SHOW_ADMIN_DEV_INFO: 'show_admin_dev_info', // Дебаг-панель
   SHOW_DEBUG_PANEL: 'show_debug_panel', // Дебаг-панель
   MANAGE_LOGGER: 'manage_logger', // Редактирование логгера

   // --- PRO PLAN ---
   CUSTOM_USERNAME: 'custom_username', // Редактирование username

   // --- BASIC ADMIN ---
   VIEW_ADMIN_PANEL: 'view_admin_panel', // Вход в админку
   MANAGE_OWN_PROFILE: 'manage_own_profile', // Свой профиль
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// 2. Типы планов (на будущее)
export type PlanTier = 'free' | 'pro';

export const LIMITS = {
   FREE_ROOMS: 3,
   PRO_ROOMS: 50,
   SUPER_ROOMS: 9999,
};

// 3. Интерфейс пользователя для проверки прав
export interface UserAccessContext {
   isSuperAdmin: boolean;
   isOwner?: boolean;
   plan: PlanTier;
   isLocal: boolean;
}

// 4. Логика проверки (Главная функция)
export function checkPermission(permission: Permission, user: UserAccessContext): boolean {
   // Логика для остальных
   switch (permission) {
      case PERMISSIONS.VIEW_ADMIN_PANEL:
      case PERMISSIONS.MANAGE_OWN_PROFILE:
         case PERMISSIONS.MANAGE_USERS:
         
         return true; // Доступно всем админам

      case PERMISSIONS.CUSTOM_USERNAME: // Редактирование username
      
         return user.plan === 'pro' || user.isSuperAdmin; // PRO или Супер-Админ

     
      case PERMISSIONS.SHOW_DEBUG_PANEL:
         return user.isLocal; // Показывать дебаг-консоль локально всегда (даже без логина)

      case PERMISSIONS.MANAGE_LOGGER:
      case PERMISSIONS.SHOW_ADMIN_DEV_INFO:
         // Супер-Админ + ОБЯЗАТЕЛЬНО Local environment
         // return user.isSuperAdmin; // Только Супер-Админ (везде)
         return user.isLocal;

      default:
         return user.isSuperAdmin; // По умолчанию супер-админ может всё, если не указано иное
   }
}

// 5. Хелпер для лимитов
export function getRoomLimit(user: UserAccessContext): number {
   if (user.isSuperAdmin) return LIMITS.SUPER_ROOMS;
   if (user.plan === 'pro') return LIMITS.PRO_ROOMS;
   return LIMITS.FREE_ROOMS;
}
