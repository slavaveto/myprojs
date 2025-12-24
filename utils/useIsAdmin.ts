import { useAuth } from '@clerk/nextjs';
import { useIsLocal } from './useIsLocal';
import { useProjectData } from '@/app/providers/ProjectDataProvider';

/**
 * Централизованная проверка админа ПРОЕКТА
 * 
 * Возвращает true, если:
 * 1. Localhost + ?admin=true (режим отладки)
 * 2. Текущий пользователь - Владелец проекта (userId === projectData.user_id)
 */
export function useIsAdmin(): boolean {
   const { userId } = useAuth();
   const isLocal = useIsLocal();
   const { projectData } = useProjectData(); // Данные текущего проекта

   // 1. SSR Check
   if (typeof window === 'undefined') {
      return false; 
   }
   
   // 2. Localhost Debug Override
   // if (isLocal) {
   //    // На localhost проверяем ТОЛЬКО query параметр
   //    const hasAdminParam = new URLSearchParams(window.location.search).get('admin') === 'true';
   //    return hasAdminParam;
   // }
   
   // 3. ProjectOwner Check
   // Если данных проекта еще нет или юзер не залогинен - не админ
   if (!userId || !projectData) {
      return false;
   }

   // Сравниваем ID текущего юзера с ID создателя проекта
   return userId === projectData.user_id;
}
