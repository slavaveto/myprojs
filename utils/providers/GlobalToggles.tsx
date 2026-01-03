'use client';

import React, { useEffect, useState } from 'react';
import ThemeToggle from '@/utils/providers/ThemeToggle';
import LangToggle from '@/utils/localization/LangToggle';
import { useWindowSize } from '@/utils/hooks/useWindowSize';
import { usePathname } from 'next/navigation';

export default function GlobalToggles({ isLocal = false }: { isLocal?: boolean }) {
   const [isMounted, setIsMounted] = useState(false);
   const { winWidth } = useWindowSize();
   const pathname = usePathname();

   useEffect(() => {
      const timer = setTimeout(() => {
         setIsMounted(true);
      }, 1500);
      return () => clearTimeout(timer);
   }, []);

   // Проверяем, находимся ли мы на странице комнаты (например /family, /work и т.д.)
   const isRoomPage = pathname && pathname.length > 1 && pathname !== '/admin' && !pathname.startsWith('/admin/');

   // Не рендерим на страницах комнат (там свой RoomToggles)
   if (isRoomPage) {
      return null;
   }

   // Не рендерим ничего до монтирования или если ширина меньше 1000px
   if (!isMounted || winWidth < 1000) {
      return null;
   }

   return (
      <div
         className={`fixed bottom-[14px] right-[14px] flex gap-2 items-center text-[14px]  rounded z-50 transition-opacity duration-500 ${
            isMounted ? 'opacity-100' : 'opacity-0'
         }`}
      >
         <LangToggle />
         <ThemeToggle />
      </div>
   );
}
