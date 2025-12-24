'use client';

import React from 'react';
import { useDevice } from '@/utils/providers/MobileDetect';
import { clsx } from 'clsx';

export const DeviceFrame = ({ children, isLocal }: { children: React.ReactNode; isLocal: boolean }) => {
   const { forcedMode } = useDevice();
   
   // Если мы НЕ на локалке, или режим Авто - отключаем эмуляцию
   // Но если на локалке мы выбрали forcedMode, то показываем
   const isAuto = !forcedMode;

   if (!isLocal) {
      return <>{children}</>;
   }
   
   // --- КОНТЕЙНЕР ---
   // Всегда fixed на весь экран. 
   // Это позволяет плавно менять фон и не дергать лейаут страницы.
   const containerClasses = clsx(
      "fixed inset-0 z-0 w-full h-full flex items-center justify-center overflow-hidden transition-colors duration-500 ease-in-out",
      isAuto ? "bg-background" : "bg-neutral-900" 
      // В режиме Auto фон bg-background (обычный цвет сайта), 
      // В Mobile - темный фон эмулятора.
   );

   // --- ФРЕЙМ ---
   const frameClasses = clsx(
      "bg-background overflow-hidden relative flex flex-col transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]", // Плавная кривая Безье
      isAuto 
         ? "w-full h-full rounded-none border-0 shadow-none" // Auto: на весь экран
         : clsx(
            forcedMode === 'mobile' ? 'w-[390px]' : 'w-[820px]',
            "h-[844px] max-h-[calc(100vh-40px)]", 
            "rounded-[40px] border border-default-200 shadow-2xl"
         )
   );

   return (
      <div className={containerClasses}>
         <div className={frameClasses}>
            {/* 
               ВАЖНЫЙ ХАК:
               Мы добавляем [&_.h-screen]:!h-full, чтобы все элементы внутри, 
               которые используют h-screen (высота браузера),
               принудительно становились h-full (высота этого контейнера/телефона).
               Это заставляет приложение "думать", что высота экрана = высоте телефона.
            */}
            <div className={clsx(
               "w-full h-full overflow-y-auto overflow-x-hidden scrollbar-hide",
               // Переопределяем поведение h-screen и min-h-screen внутри эмулятора
               !isAuto && "[&_.h-screen]:!h-full [&_.min-h-screen]:!min-h-full"
            )}>
               {children}
            </div>
         </div>
      </div>
   );
};
