import React, { useEffect, useState } from 'react';
import { Spinner } from "@heroui/react";
import clsx from "clsx";

interface GlobalLoadingSpinnerProps {
   /** Идет ли загрузка данных (useProjectData) */
   isPageDataLoading: boolean;
   /** Готово ли приложение к показу (внутренняя готовность) */
   isAppReady: boolean;
   /** Загружена ли локализация */
   isUILoaded: boolean;
   /** Минимальное время показа спиннера (мс) */
   minDisplayTime?: number;
   /** Колбэк, вызываемый когда спиннер полностью исчез */
   onFadeOutComplete?: () => void;
}

export function GlobalLoadingSpinner({ 
   isPageDataLoading, 
   isAppReady, 
   isUILoaded,
   minDisplayTime = 1000,
   onFadeOutComplete
}: GlobalLoadingSpinnerProps) {
   
   // Состояние минимального времени показа (для UX, чтобы не мигало)
   const [isMinTimePassed, setIsMinTimePassed] = useState(false);
   
   // Состояние для плавного исчезновения спиннера (класс opacity)
   const [fadeOutSpinner, setFadeOutSpinner] = useState(false);

   // Состояние для физического присутствия в DOM
   const [isVisible, setIsVisible] = useState(true);

   // Запускаем таймер минимального показа
   useEffect(() => {
      const timer = setTimeout(() => {
         setIsMinTimePassed(true);
      }, minDisplayTime);
      return () => clearTimeout(timer);
   }, [minDisplayTime]);

   // Общая загрузка: ждем данные ИЛИ инициализацию приложения ИЛИ минимальное время ИЛИ локализацию
   const showGlobalSpinner = isPageDataLoading || !isAppReady || !isMinTimePassed || !isUILoaded;

   useEffect(() => {
      // Как только всё готово, запускаем цепочку исчезновения
      if (!showGlobalSpinner) {
         // 1. Небольшая задержка перед началом анимации
         const startFadeOutTimer = setTimeout(() => {
            setFadeOutSpinner(true); // Запускаем CSS transition (opacity -> 0)
            
            // 2. Ждем окончания анимации (300ms) и удаляем из DOM
            const removeTimer = setTimeout(() => {
               setIsVisible(false);
               
               // Добавляем паузу перед появлением контента
               setTimeout(() => {
                  onFadeOutComplete?.(); 
               }, 100);

            }, 300); // Должно совпадать с duration-300

            return () => clearTimeout(removeTimer);
         }, 100); 

         return () => clearTimeout(startFadeOutTimer);
      } else {
         // Если снова начали грузиться
         setFadeOutSpinner(false);
         setIsVisible(true);
      }
   }, [showGlobalSpinner]);

   if (!isVisible) return null;

   return (
      <div
         className={clsx(
            "fixed inset-0 flex items-center justify-center z-[9999] bg-background transition-opacity duration-300",
            fadeOutSpinner ? 'opacity-0 pointer-events-none' : 'opacity-100'
         )}
      >
         <Spinner size="lg" />
      </div>
   );
}








