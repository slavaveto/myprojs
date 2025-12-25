import { TabId, AppTabStaticConfig } from './types';

export const APP_SETTINGS = {
   showToast: false
};

export const APP_TABS_DATA: Record<TabId, AppTabStaticConfig> = {
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
   rooms: {
      label: 'My Rooms',
      texts: {
         saveLoading: 'Сохраняем комнату...',
         saveSuccess: 'Комната сохранена!',
         refreshLoading: 'Обновляем комнаты...',
         refreshSuccess: 'Готово',
      }
   },
   localization: {
      label: 'Localization',
      texts: {
         saveLoading: 'Сохраняем перевод...',
         saveSuccess: 'Перевод сохранен!',
         refreshLoading: 'Обновляем переводы...',
         refreshSuccess: 'Переводы обновлены',
      }
   },
   logs: {
      label: 'Logs',
      texts: {
         saveLoading: 'Сохранение...',
         saveSuccess: 'Сохранено',
         refreshLoading: 'Обновляем логи...',
         refreshSuccess: 'Логи обновлены',
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
