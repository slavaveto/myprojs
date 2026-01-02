import { TabId, AdminTabStaticConfig } from './types';

export const ADMIN_SETTINGS = {
   showToast: false
};

export const ADMIN_TABS_DATA: Record<TabId, AdminTabStaticConfig> = {
   profile: {
      label: 'My Profile',
      texts: {
         saveLoading: 'Сохраняем профиль...',
         saveSuccess: 'Профиль обновлен!',
         refreshLoading: 'Загружаем данные...',
         refreshSuccess: 'Данные обновлены',
      }
   },
   users: {
      label: 'Users',
      texts: {
         saveLoading: 'Обновляем права...',
         saveSuccess: 'Права изменены!',
         refreshLoading: 'Обновляем список...',
         refreshSuccess: 'Список актуален',
      }
   },
   logger: {
      label: 'Logger',
      texts: {
         saveLoading: 'Сохранение...',
         saveSuccess: 'Сохранено',
         refreshLoading: 'Обновляем логи...',
         refreshSuccess: 'Логи обновлены',
      }
   },
};
