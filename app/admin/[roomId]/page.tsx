'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Spinner } from '@heroui/react';
import { ArrowLeft, Settings } from 'lucide-react';
import { SignedIn, SignedOut, SignIn } from '@clerk/nextjs';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { RoomSettingsPanel } from './RoomSettingsPanel';
import { createLogger } from '@/utils/logger/Logger';
import clsx from 'clsx';

const logger = createLogger('AdminRoomSettingsPage');

export default function AdminRoomSettingsPage() {
   const { supabase } = useSupabase(); // Используем хук
   const params = useParams();
   const roomId = params.roomId as string;
   const [roomTitle, setRoomTitle] = useState<string>('');
   const [isValidRoom, setIsValidRoom] = useState(true); // Пока грузится - считаем что ок, или false
   const [isLoading, setIsLoading] = useState(true);
   
   const [fadeInContent, setFadeInContent] = useState(false);
   const [showSpinner, setShowSpinner] = useState(true);
   const [fadeOutSpinner, setFadeOutSpinner] = useState(false);

   useEffect(() => {
      async function fetchRoom() {
         const { data, error } = await supabase
            .from('rooms')
            .select('room_title')
            .eq('room_id', roomId)
            .maybeSingle();

         if (data) {
             setRoomTitle(data.room_title);
             setIsValidRoom(true);
         } else {
             setIsValidRoom(false);
         }
         setIsLoading(false);
      }
      fetchRoom();
   }, [roomId]);

   useEffect(() => {
      logger.info('🔧 Страница администрирования комнаты загружена', { roomId });

      const spinnerTimer = setTimeout(() => {
         setFadeOutSpinner(true);

         setTimeout(() => {
            setShowSpinner(false);

            setTimeout(() => {
               setFadeInContent(true);
            }, 50);
         }, 300);
      }, 700);
      
      return () => clearTimeout(spinnerTimer);
   }, [roomId]);

   if (!isLoading && !isValidRoom) {
      return (
         <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
               <h1 className="text-2xl font-bold text-danger mb-4">Комната не найдена</h1>
               <Link href="/admin">
                  <Button color="primary">
                     <ArrowLeft size={18} />
                     Вернуться к списку комнат
                  </Button>
               </Link>
            </div>
         </div>
      );
   }

   return (
      <div className="p-6">
         {/* Спиннер загрузки */}
         {showSpinner && (
            <div
               className={`fixed inset-0 flex items-center justify-center z-50 bg-content1 transition-opacity duration-300 ${
                  fadeOutSpinner ? 'opacity-0' : 'opacity-100'
               }`}
            >
               <Spinner size="lg" />
            </div>
         )}

         <div
            className={clsx(
               'transition-opacity duration-500 p-8',
               fadeInContent ? 'opacity-100' : 'opacity-0'
            )}
         >
            <SignedOut>
               <div className="fixed inset-0 mt-[-30px] flex items-center justify-center">
                  <SignIn
                     routing="hash"
                     afterSignInUrl={`/admin/${roomId}`}
                     appearance={{
                        elements: {
                           card: 'bg-content2 dark:bg-content3',
                           headerTitle: 'text-default-500',
                           formFieldLabel: '!text-default-500',
                           formFieldInput: 'bg-default-50 !text-default-500',
                           formButtonPrimary:
                              'text-white bg-default-700 dark:bg-default-300 hover:bg-default-600 dark:hover:bg-default-200 transition-color duration-200',
                           footer: 'hidden',
                        },
                     }}
                  />
               </div>
            </SignedOut>

            <SignedIn>
               <div className="max-w-4xl mx-auto">
                  {/* Хедер */}
                  <div className="flex items-center justify-between mb-6">
                     <div className="flex items-center gap-4">
                        <Link href="/admin">
                           <Button variant="flat" color="default" size="sm">
                              <ArrowLeft size={18} />
                              Назад
                           </Button>
                        </Link>
                        <div>
                           <h1 className="text-3xl font-bold flex items-center gap-3">
                              <Settings size={32} className="text-primary" />
                              {roomTitle || `Комната ${roomId}`}
                           </h1>
                           <p className="text-sm text-default-500 mt-1">
                              Администрирование настроек комнаты
                           </p>
                        </div>
                     </div>
                     
                     <Link href={`/${roomId}`} target="_blank">
                        <Button color="primary" variant="flat">
                           Открыть комнату
                        </Button>
                     </Link>
                  </div>

                  {/* Панель настроек */}
                  <RoomSettingsPanel roomId={roomId} />
               </div>
            </SignedIn>
         </div>
      </div>
   );
}

