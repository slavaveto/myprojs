'use client';

import React from 'react';
import { 
  Popover, 
  PopoverTrigger, 
  PopoverContent, 
  Button, 
  Avatar
} from '@heroui/react';
import { LogOut, User as IconUser, Settings } from 'lucide-react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { profileService } from '@/app/admin/_services/profileService'; // Можно переиспользовать или вынести в общий
import { createLogger } from '@/utils/logger/Logger';
import { useRouter } from 'next/navigation';

const logger = createLogger('UserHeaderMenu');

// Слушаем то же событие, что и в админке, чтобы синхронизировать аватарки везде
const profileUpdateEventTarget = typeof window !== 'undefined' ? window : null; 

export const UserHeaderMenu = ({ showSeparator = true }: { showSeparator?: boolean }) => {
   const { user, isLoaded } = useUser();
   const { signOut } = useClerk();
   const { supabase } = useSupabase();
   const router = useRouter();
   
   const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
   const [fullName, setFullName] = React.useState<string>(user?.fullName || 'User');

   const fetchProfile = React.useCallback(async () => {
      if (!user) return;
      try {
         const data = await profileService.getProfile(supabase, user.id);
         setAvatarUrl(data?.avatar_url || null);
         if (data?.full_name) {
            setFullName(data.full_name);
         }
      } catch (err) {
         logger.error('Failed to fetch user profile', err);
      }
   }, [user, supabase]);

   React.useEffect(() => {
      fetchProfile();

      // Слушаем глобальное событие обновления профиля (если оно диспатчится через window)
      // В AdminUserMenu мы использовали `profileUpdateEvent` (EventTarget).
      // Чтобы синхронизировать, нужно импортировать тот же EventTarget.
      // Но пока просто загрузим при маунте.
   }, [fetchProfile]);

   const handleSignOut = async () => {
      await signOut({ redirectUrl: '/' });
   };

   if (!isLoaded || !user) return null;

   const userEmail = user.primaryEmailAddress?.emailAddress;

   return (
      <div className="flex items-center">
         {showSeparator && <div className="h-6 w-[1px] bg-default-300 mx-1 mr-3"></div>}
         <Popover placement="bottom-end" showArrow offset={10}>
         <PopoverTrigger>
            <div className="cursor-pointer transition-opacity hover:opacity-80 min-w-[32px] min-h-[32px]">
               {avatarUrl ? (
                   <img 
                       src={avatarUrl} 
                       alt={fullName}
                       className="w-8 h-8 rounded-full object-cover border border-default-200 block"
                   />
               ) : (
                   <div className="w-8 h-8 rounded-full bg-default-100 flex items-center justify-center border border-default-200">
                       <IconUser size={16} className="text-default-500" />
                   </div>
               )}
            </div>
         </PopoverTrigger>
         <PopoverContent className="p-1">
            <div className="w-full max-w-[240px] px-2 py-2">
               <div className="flex items-center gap-3 pb-2 mb-2 border-b border-default-200">
                  {avatarUrl ? (
                      <img 
                          src={avatarUrl} 
                          alt={fullName}
                          className="w-8 h-8 rounded-full object-cover border border-default-200"
                      />
                  ) : (
                      <div className="w-8 h-8 rounded-full bg-default-100 flex items-center justify-center border border-default-200">
                          <IconUser size={18} className="text-default-500" />
                      </div>
                  )}
                  <div className="flex flex-col overflow-hidden">
                     <span className="text-small font-bold truncate">{fullName}</span>
                     <span className="text-tiny text-default-500 truncate">{userEmail}</span>
                  </div>
               </div>
               
               <Button 
                  fullWidth
                  variant="light" 
                  size="sm"
                  startContent={<Settings size={16} />}
                  onPress={() => router.push('/admin')}
                  className="justify-start mb-1"
               >
                  Admin Panel
               </Button>

               <Button 
                  fullWidth
                  variant="flat" 
                  color="danger" 
                  size="sm"
                  startContent={<LogOut size={16} />}
                  onPress={handleSignOut}
                  className="justify-start"
               >
                  Sign Out
               </Button>
            </div>
         </PopoverContent>
      </Popover>
      </div>
   );
};

