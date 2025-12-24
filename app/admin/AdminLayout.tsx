'use client';

import React from 'react';
import { useAuth } from '@clerk/nextjs';
import { clsx } from 'clsx';
import { Spinner } from '@heroui/react';
import { AdminLoaderProvider, useAdminLoader } from './AdminLoader';

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
   const { isLoaded } = useAuth();
   const { isLoading: isAppLoading } = useAdminLoader();
   
   // --- ЕДИНЫЙ ГЛОБАЛЬНЫЙ СПИННЕР ---
   // Показываем если:
   // 1. Clerk еще не загрузился (!isLoaded)
   // 2. ИЛИ приложение (страница или задержка входа) просит показать загрузку (isAppLoading)
   // ПРИМЕЧАНИЕ: isAppLoading по умолчанию true. AdminPage должен сделать его false, когда загрузится.
   const showGlobalSpinner = !isLoaded || isAppLoading;
   

   return (
      <>
         {/* СПИННЕР - ОДИН НА ВСЕ ВРЕМЯ ЖИЗНИ LAYOUT */}
         <div 
            className={clsx(
               "fixed inset-0 flex items-center justify-center bg-content1 z-[9999] transition-opacity duration-500",
               showGlobalSpinner ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )}
         >
            <Spinner size="lg" color="primary" />
         </div>

         {/* Контент рендерится всегда, но может быть перекрыт спиннером */}
         {/* Важно: AdminPage внутри children должен вызвать setLoading(false) когда будет готов. */}
         {children}
      </>
   );
}

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
   return (
      <AdminLoaderProvider>
         <AdminLayoutContent>{children}</AdminLayoutContent>
      </AdminLoaderProvider>
   );
}

