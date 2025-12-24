'use client';

import React, { useState, useEffect } from 'react';
import { LoggerManagerPage } from '@/utils/logger/LogsManager';
import { createLogger } from '@/utils/logger/Logger';
import { LoggerEvent } from '@/utils/logger/types';
import { globalStorage } from '@/utils/storage';
import { Settings } from 'lucide-react';
import { Spinner, Select, SelectItem } from '@heroui/react';
import { useSupabase } from '@/utils/supabase/useSupabase';

import { useAuth } from '@clerk/nextjs';
import { useIsSuperAdmin } from '@/utils/supabase/useIsSuperAdmin';
import { usePermission } from '@/app/admin/_services/usePermission';
import { useIsLocal } from '@/utils/useIsLocal';
import { PERMISSIONS } from '@/app/admin/_services/acl';
import { AdminUserMenu } from '@/app/admin/AdminUserMenu';

interface LoggerScreenProps {
   onReady?: () => void;
   isActive: boolean;
   texts: {
      saveLoading: string;
      saveSuccess: string;
      refreshLoading: string;
      refreshSuccess: string;
   };
   showToast?: boolean;
}

export function LoggerScreen({ onReady, isActive, texts, showToast = true }: LoggerScreenProps) {
   const { supabase } = useSupabase(); // Добавляем useSupabase
   const logger = createLogger('LoggerScreen');
   const isLocal = useIsLocal();
   const { isSignedIn } = useAuth();
   const { isSuperAdmin, isLoading: isSuperAdminLoading } = useIsSuperAdmin();
   const { can } = usePermission();

   // Сигнализируем о готовности, когда загрузка завершена
   useEffect(() => {
      // Вызываем onReady только ОДИН раз, когда загрузка завершилась
      if (!isSuperAdminLoading && onReady) {
         // Используем requestAnimationFrame или setTimeout(..., 0) чтобы разорвать стек обновлений
         // и избежать ошибки "Maximum update depth exceeded"
         const timer = setTimeout(() => {
            onReady();
         }, 0);
         return () => clearTimeout(timer);
      }
   }, [isSuperAdminLoading]); // Убираем onReady из зависимостей, чтобы эффект не перезапускался при смене функции

   const [isClient, setIsClient] = useState(false);

   useEffect(() => {
      setIsClient(true);
   }, []);



   // Высота AdminNavbar (40px) + border (1px) = 41px.
   // LoggerManagerLayout использует это для calc(100vh - tabHeight)
   const tabHeight = 0;


   // Добавляем проверку на права
   if (!can(PERMISSIONS.MANAGE_LOGGER)) {
      return <div className=" p-8 text-center text-red-500">Доступ запрещен</div>;
   }

   return (
      <div className="relative h-full flex flex-col">
         {/* Абсолютно позиционированное меню в правом верхнем углу */}
         {/* <div className="absolute top-2 right-4 z-50">
            <AdminUserMenu showSeparator={false} />
         </div> */}
         <LoggerManagerPage tabHeight={tabHeight} isActive={isActive} />
      </div>
   );
}
