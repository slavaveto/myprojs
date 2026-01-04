'use client';

import { useCallback, useRef, useEffect } from 'react';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('useNotificationSound');

// Базовый URL для звуков в Google Cloud
const bucketName = process.env.GOOGLE_CLOUD_SOUNDS_BUCKET_NAME || 'app_sounds';
const SOUNDS_BASE_URL = `https://storage.googleapis.com/${bucketName}`;


export const useNotificationSound = () => {
   // Рефы для аудио элементов
   const shutterAudioRef = useRef<HTMLAudioElement | null>(null);
   const countdownAudioRef = useRef<HTMLAudioElement | null>(null);
   const joinAudioRef = useRef<HTMLAudioElement | null>(null);
   const leaveAudioRef = useRef<HTMLAudioElement | null>(null);
   const knockAudioRef = useRef<HTMLAudioElement | null>(null);

   // Предзагрузка при монтировании компонента
   useEffect(() => {
      if (typeof window !== 'undefined') {
         const preloadAudio = (url: string, volume: number = 0.5): HTMLAudioElement => {
            const audio = new Audio(url);
            audio.preload = 'auto';
            audio.volume = volume;
            audio.load();
            return audio;
         };

         // Инициализация звуков
         shutterAudioRef.current = preloadAudio(`${SOUNDS_BASE_URL}/shutter.mp3`, 0.5);
         countdownAudioRef.current = preloadAudio(`${SOUNDS_BASE_URL}/countdown.mp3`, 0.3);

         // Новые звуки (файлы в Google Cloud)
         joinAudioRef.current = preloadAudio(`${SOUNDS_BASE_URL}/join.mp3`, 0.5);
         leaveAudioRef.current = preloadAudio(`${SOUNDS_BASE_URL}/leave.mp3`, 0.5);
         knockAudioRef.current = preloadAudio(`${SOUNDS_BASE_URL}/knock.mp3`, 0.5); // Запрос на вход

         logger.info('🎵 Все звуки (remote) предзагружены');
      }
   }, []);

   // Оставляем для совместимости, но для mp3 файлов AudioContext не обязателен
   const initializeAudio = useCallback(() => {
      // No-op for file-based audio
   }, []);

   const playSound = useCallback(
      (
         audioRef: React.MutableRefObject<HTMLAudioElement | null>,
         name: string,
         fallbackUrl: string
      ) => {
         try {
            if (audioRef.current) {
               audioRef.current.currentTime = 0;
               audioRef.current.play().catch((e) => {
                  logger.warning('⚠️ Не удалось воспроизвести звук (возможно, нет файла)', {
                     name,
                     error: e,
                  });
               });
               logger.success('✅ Звук запущен', { name });
            } else {
               // Fallback если реф потерялся
               const audio = new Audio(fallbackUrl);
               audio.volume = 0.5;
               audio
                  .play()
                  .catch((e) => logger.warning('⚠️ Fallback play error', { name, error: e }));
            }
         } catch (error) {
            logger.error('❌ Ошибка воспроизведения', { name, error });
         }
      },
      []
   );

   // Функция для воспроизведения звука подключения
   const playConnectionSound = useCallback(() => {
      logger.info('🎵 Играю звук подключения...');
      playSound(joinAudioRef, 'join', `${SOUNDS_BASE_URL}/join.mp3`);
   }, [playSound]);

   // Функция для воспроизведения звука отключения
   const playDisconnectionSound = useCallback(() => {
      logger.info('🔊 Играю звук отключения...');
      playSound(leaveAudioRef, 'leave', `${SOUNDS_BASE_URL}/leave.mp3`);
   }, [playSound]);

   // Функция для воспроизведения звука запроса (колокольчик)
   const playKnockSound = useCallback(() => {
      logger.info('🔔 Играю звук запроса...');

      playSound(knockAudioRef, 'knock', `${SOUNDS_BASE_URL}/knock.mp3`);
   }, [playSound]);

   // Отсчет
   const playCountdownSound = useCallback(() => {
      playSound(countdownAudioRef, 'countdown', `${SOUNDS_BASE_URL}/countdown.mp3`);
   }, [playSound]);

   // Затвор
   const playShutterSound = useCallback(() => {
      playSound(shutterAudioRef, 'shutter', `${SOUNDS_BASE_URL}/shutter.mp3`);
   }, [playSound]);

   return {
      initializeAudio,
      playConnectionSound,
      playDisconnectionSound,
      playKnockSound,
      playCountdownSound,
      playShutterSound,
   };
};
