import { useEffect, useRef } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import NoSleep from 'nosleep.js';

const logger = createLogger('useWakeLock');

export const useWakeLock = (isEnabled: boolean = true) => {
   const noSleepRef = useRef<NoSleep | null>(null);
   const wakeLockSentinelRef = useRef<WakeLockSentinel | null>(null);

   useEffect(() => {
      if (!isEnabled) return;

      // Инициализация NoSleep (фолбек)
      if (!noSleepRef.current) {
         noSleepRef.current = new NoSleep();
      }

      const requestWakeLock = async () => {
         try {
            // 1. Пробуем Native API
            if ('wakeLock' in navigator) {
               const sentinel = await navigator.wakeLock!.request('screen');
               wakeLockSentinelRef.current = sentinel;
               logger.success('Native WakeLock activated');

               // Если лок "слетел" (например, при сворачивании), ставим его заново
               sentinel.addEventListener('release', () => {
                  logger.info('Native WakeLock released');
                  // Здесь можно было бы попробовать восстановить, но обычно 
                  // восстановление происходит в document.visibilitychange
               });
            } else {
               // 2. Фолбек на NoSleep.js (для старых iOS)
               // Важно: NoSleep требует взаимодействия с пользователем для активации (tap).
               // Но в React useEffect часто срабатывает вне контекста клика.
               // Однако, современные браузеры часто позволяют это делать, если контекст аудио/видео активен.
               // В любом случае, пробуем.
               noSleepRef.current?.enable();
               logger.info('NoSleep.js enabled');
            }
         } catch (err: any) {
            logger.error('Failed to activate WakeLock', err);
            // Если Native упал, пробуем NoSleep как запасной вариант
            try {
               noSleepRef.current?.enable();
               logger.info('NoSleep.js fallback enabled after error');
            } catch (e) {
               logger.warning('NoSleep.js fallback also failed', e);
            }
         }
      };

      const releaseWakeLock = async () => {
         // Release Native
         if (wakeLockSentinelRef.current) {
            try {
               await wakeLockSentinelRef.current.release();
               wakeLockSentinelRef.current = null;
            } catch (e) {
               logger.warning('Error releasing Native WakeLock', e);
            }
         }
         
         // Release NoSleep
         if (noSleepRef.current) {
            noSleepRef.current.disable();
         }
      };

      // Восстановление при возвращении на вкладку
      const handleVisibilityChange = async () => {
         if (document.visibilityState === 'visible' && isEnabled) {
            await requestWakeLock();
         }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      requestWakeLock();

      return () => {
         document.removeEventListener('visibilitychange', handleVisibilityChange);
         releaseWakeLock();
      };
   }, [isEnabled]);
};

