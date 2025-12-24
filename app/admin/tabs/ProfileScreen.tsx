'use client';

import React, { useState, useEffect } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { useUser } from '@clerk/nextjs';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { Input, Spinner, Button, Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { User, RefreshCw as IconRefresh, Camera, Check, X, Upload } from 'lucide-react';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { usePermission } from '@/app/admin/_services/usePermission';
import { PERMISSIONS } from '@/app/admin/_services/acl';
import { useProfileAction } from '@/app/admin/tabs/hooks/useProfileAction';
import { useAvatarUpload } from '@/app/admin/tabs/hooks/useAvatarUpload';
import { AdminUserMenu, triggerProfileUpdate } from '@/app/admin/AdminUserMenu';
import { motion } from 'framer-motion';
import { AvatarCropper } from '@/app/admin/tabs/components/AvatarCropper';
import { AvatarCamera } from '@/app/admin/tabs/components/AvatarCamera';


const UPLOAD_CONFIG = {
   video_effect: 'rise' as 'rise' | 'crossfade',
};


interface ProfileScreenProps {
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

export const ProfileScreen = ({ onReady, isActive, texts, showToast = true }: ProfileScreenProps) => {
   const logger = createLogger('ProfileScreen');
   const { user, isLoaded } = useUser();
   const { supabase } = useSupabase();
   const { can } = usePermission();
   
   const [username, setUsername] = useState<string>('');
   const [fullName, setFullName] = useState<string>('');
   const [initialUsername, setInitialUsername] = useState<string>('');
   const [initialFullName, setInitialFullName] = useState<string>('');
   const [isLoading, setIsLoading] = useState(true);
   
   const [validationError, setValidationError] = useState<string | null>(null);
   const [fullNameError, setFullNameError] = useState<string | null>(null);
   const [isValidating, setIsValidating] = useState(false);

   // Подключаем хук действий
   const { updateProfile, isUpdating, checkUsernameAvailability } = useProfileAction();

   const fetchProfile = async () => {
      if (!user) return;
      try {
         logger.info('Fetching profile for user', { userId: user.id });
         const { data, error } = await supabase
            .from('profiles')
            .select('username, full_name, avatar_url')
            .eq('user_id', user.id)
            .single();

         if (error) {
            logger.error('Error fetching profile', error);
         } else if (data) {
            setUsername(data.username || '');
            setFullName(data.full_name || '');
            setInitialUsername(data.username || '');
            setInitialFullName(data.full_name || '');
            setInitialUrl(data.avatar_url);
         }
      } catch (err) {
         logger.error('Unexpected error fetching profile', err);
      }
   };

   // Хук загрузки аватара
   const {
       avatarUrl,
       isUploading,
       isDeleting,
       uploadSuccess,
       handleFileSelect,
       deleteAvatar,
       setInitialUrl,
       prevAvatarUrl,
       cropModalOpen,
       cropImageSrc,
       onCropComplete,
       onCropCancel,
       isCameraOpen,
       onCameraOpen,
       onCameraClose,
       onCameraCapture
   } = useAvatarUpload(null, () => fetchProfile());

   // Эффекты валидации
   useEffect(() => {
      if (isLoading) return;
      if (!fullName.trim()) setFullNameError('Full name cannot be empty');
      else setFullNameError(null);
   }, [fullName, isLoading]);

   useEffect(() => {
      if (isLoading) return;
      const validateUsername = async () => {
         if (!username.trim()) { setValidationError('Username cannot be empty'); return; }
         if (username.length < 3) { setValidationError('Minimum 3 characters'); return; }
         if (!/^[a-zA-Z0-9_-]+$/.test(username)) { setValidationError('Only Latin letters, numbers, "-" and "_" allowed'); return; }

         setIsValidating(true);
         try {
            const isAvailable = await checkUsernameAvailability(username, user!.id);
            if (!isAvailable) setValidationError('Username is already taken');
            else setValidationError(null);
         } catch (err) {
             logger.error('Failed to validate username', err); 
            } 
            finally { setIsValidating(false); }
      };
      const timer = setTimeout(validateUsername, 300);
      return () => clearTimeout(timer);
   }, [username, user, checkUsernameAvailability, isLoading]);

   // Async Actions
   const { execute: executeRefresh, status: refreshStatus, error: refreshError } = useAsyncAction({
      minDuration: 1000, useToast: showToast, loadingMessage: texts.refreshLoading, successMessage: texts.refreshSuccess, errorMessage: 'Ошибка обновления'
   });

   const { execute: executeSave, status: saveStatus, error: saveError } = useAsyncAction({
      useToast: showToast, minDuration: 800, successDuration: 2000, loadingMessage: texts.saveLoading, successMessage: texts.saveSuccess, errorMessage: (err) => `Error: ${err.message}`
   });

   const isRefreshing = refreshStatus !== 'idle';
   const badgeStatus = isRefreshing ? refreshStatus : saveStatus;
   const badgeError = refreshStatus === 'error' ? refreshError?.message : saveError?.message;
   const loadingText = isRefreshing ? texts.refreshLoading : texts.saveLoading;
   const successText = isRefreshing ? texts.refreshSuccess : texts.saveSuccess;

   useEffect(() => {
      if (!isActive) {
         setValidationError(null);
         setFullNameError(null);
         loadData();
      }
   }, [isActive]);

   const loadData = async (isManualRefresh = false) => {
      if (!isLoaded || !user) return;
      if (!isManualRefresh) setIsLoading(true);

      if (isManualRefresh) await executeRefresh(fetchProfile);
      else await fetchProfile();

      if (!isManualRefresh) setIsLoading(false);
      if (onReady) setTimeout(() => onReady(), 0);
   };

   useEffect(() => { loadData(); }, [isLoaded, user, supabase]);

   const handleSave = async () => {
      if (!user) return;
      if (validationError || fullNameError) return;

      const canEditUsername = can(PERMISSIONS.CUSTOM_USERNAME);
      const isFullNameChanged = fullName !== initialFullName;
      const isUsernameChanged = canEditUsername && (username !== initialUsername);

      if (!isFullNameChanged && !isUsernameChanged) return;

      try {
         await executeSave(async () => {
            const updates: { username?: string; full_name?: string } = {};
            if (isFullNameChanged) updates.full_name = fullName;
            if (isUsernameChanged) updates.username = username;
            
            await updateProfile(user.id, updates);
            
            // Update initial state after successful save
            if (isFullNameChanged) {
               setInitialFullName(fullName);
               triggerProfileUpdate(); // Обновляем имя в хедере
            }
            if (isUsernameChanged) setInitialUsername(username);
         });
      } catch (err) { logger.error('Failed to update profile', err); }
   };

   const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
   };

   if (!isLoaded || !user) return null;
   const canEditUsername = can(PERMISSIONS.CUSTOM_USERNAME);

   return (
      <div className="h-full flex flex-col max-w-2xl">

         <div className="flex justify-between items-center pb-4 min-h-[60px]">

            <div className="flex items-center gap-3">
               {/* <User size={28} className="text-default-500" /> */}
               <h1 className="tab-title">My Profile</h1>
            </div>

            <div className="flex items-center gap-2">
               <div className="w-[140px] flex justify-end">
                  <StatusBadge 
                     status={badgeStatus} errorMessage={badgeError}
                     loadingText={loadingText} successText={successText}
                  />
               </div>
               <Button 
                  isIconOnly variant="flat" onPress={() => loadData(true)} 
                  isLoading={isLoading} className="shadow-lg bg-background/80 backdrop-blur-md border border-default-200"
               >
                  <IconRefresh size={16} />
               </Button>

               <AdminUserMenu />
            </div>
         </div>

         <div className="flex flex-col gap-4 bg-default-50 p-6 rounded-lg border border-default-200">
            
            {/* Avatar Section */}
            <div className="flex flex-col  gap-2 mb-2">
               <Popover 
                  isOpen={cropModalOpen || isCameraOpen} 
                  onOpenChange={(open) => {
                     if (!open) {
                        if (cropModalOpen) onCropCancel();
                        if (isCameraOpen) onCameraClose();
                     }
                  }}
                  placement="right" 
                  offset={20}
                  // showArrow
               >
                  <PopoverTrigger>
                     <div className="relative group w-32 h-32 rounded-full overflow-hidden bg-default-200 shadow-md flex items-center justify-center cursor-default">
                        
                        {/* Base Icon / Background Layer */}
                        <div className="absolute inset-0 flex items-center justify-center bg-default-100">
                            {isUploading && prevAvatarUrl ? (
                                <img 
                                    src={prevAvatarUrl} 
                                    alt="Previous" 
                                    className="w-full h-full object-cover"
                                    style={{
                                       filter: UPLOAD_CONFIG.video_effect === 'crossfade'
                                          ? `blur(20px)` 
                                          : 'none'
                                    }}
                                />
                            ) : (
                                <User className="text-default-400 w-18 h-18" />
                            )}
                        </div>

                        {/* LIQUID RENDER */}
                        {avatarUrl && (
                           <motion.div 
                              key={isUploading ? 'uploading' : 'static'}
                              initial={isUploading ? { height: '0%', opacity: 1 } : { height: '100%', opacity: 1 }}
                              animate={{ 
                                 // Rise: height changes, opacity 1
                                 // Crossfade: opacity changes, height 100%
                                 height: UPLOAD_CONFIG.video_effect === 'crossfade' 
                                    ? '100%' 
                                    : (isDeleting ? '0%' : '100%'),
                                 opacity: UPLOAD_CONFIG.video_effect === 'crossfade' 
                                    ? (isUploading ? 1 : 1) // need to think about crossfade animation separately
                                    : 1,
                              }}
                              transition={{ duration: 2, ease: "easeInOut", delay: 0.5 }}
                              className={`absolute overflow-hidden z-10 ${
                                 UPLOAD_CONFIG.video_effect === 'crossfade' ? 'inset-0' : 'bottom-0 left-0 w-full'
                              }`}
                              // Handle crossfade styles via style prop if needed for blur animation via MotionValue, 
                              // but sticking to rise as default simplifies things
                           >
                              <img 
                                 src={avatarUrl} 
                                 alt="Avatar" 
                                 className={`absolute ${UPLOAD_CONFIG.video_effect === 'crossfade' ? 'inset-0 w-full h-full' : 'bottom-0 left-0 w-32 h-32 max-w-none'} object-cover`} 
                              />
                              {/* Wave Border (Only for Rise) */}
                              {UPLOAD_CONFIG.video_effect === 'rise' && (isUploading || isDeleting) && (
                                 <div className="absolute top-0 w-full h-[1px] bg-white/50 shadow-[0_-2px_10px_rgba(255,255,255,0.5)]" />
                              )}
                           </motion.div>
                        )}

                        {/* Hover Overlay */}
                        <div className={`absolute inset-0 transition-all duration-300 z-30 
                           ${isUploading || isDeleting || uploadSuccess ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100 bg-black/40 backdrop-blur-[2px]'}`}>
                           
                           {/* Delete Button */}
                           {avatarUrl && !isDeleting && (
                              <div className="absolute top-[18px] right-[18px] z-30" onClick={(e) => e.stopPropagation()}>
                                 <button 
                                    className="p-1 bg-default-400 text-white rounded-full hover:bg-danger transition-colors duration-300 shadow-sm cursor-pointer"
                                    title="Remove"
                                    onClick={deleteAvatar}
                                 >
                                    <X size={14} strokeWidth={3} />
                                 </button>
                              </div>
                           )}

                           {/* Upload Actions Overlay */}
                           <div className="absolute inset-x-0 bottom-8 flex justify-center gap-4 z-20">
                              {/* Upload File */}
                              <label className="cursor-pointer group/btn transition-transform duration-300 ease-out translate-y-12 group-hover:translate-y-4">
                                 <div className="drop-shadow-lg transition-transform duration-200 hover:scale-110">
                                    <Upload className="text-white drop-shadow-md" size={26} />
                                 </div>
                                 <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} disabled={isUploading || isDeleting} />
                              </label>

                              {/* Camera */}
                              <button 
                                 type="button"
                                 onClick={(e) => { e.stopPropagation(); onCameraOpen(); }}
                                 disabled={isUploading || isDeleting}
                                 className="cursor-pointer group/btn border-none bg-transparent outline-none transition-transform duration-300 ease-out translate-y-12 group-hover:translate-y-4"
                              >
                                 <div className="drop-shadow-lg transition-transform duration-200 hover:scale-110">
                                    <Camera className="text-white drop-shadow-md" size={26} />
                                 </div>
                              </button>
                           </div>
                        </div>

                        {/* Status Overlay */}
                        {(isUploading || isDeleting || uploadSuccess) && (
                           <div className="absolute inset-0 z-40 pointer-events-none">
                              {uploadSuccess ? (
                                 <div className="absolute left-1/2 -translate-x-1/2 bottom-10 translate-y-8">
                                    <Check 
                                       className="text-success drop-shadow-lg check-pop-in-out" 
                                       size={30} 
                                       strokeWidth={4} 
                                    />
                                 </div>
                              ) : (
                                 <div className="absolute left-1/2 -translate-x-1/2 bottom-10 translate-y-8">
                                    <Spinner size="sm" color="primary" classNames={{ wrapper: "w-6 h-6" }} /> 
                                 </div>
                              )}
                           </div>
                        )}
                     </div>
                  </PopoverTrigger>
                  <PopoverContent className="p-4">
                     {cropImageSrc && (
                        <AvatarCropper 
                           imageSrc={cropImageSrc}
                           onCropComplete={onCropComplete}
                           onCancel={onCropCancel}
                        />
                     )}
                     {isCameraOpen && (
                        <AvatarCamera 
                           onCapture={onCameraCapture}
                           onCancel={onCameraClose}
                        />
                     )}
                  </PopoverContent>
               </Popover>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {/* <Input label="Clerk ID" value={user.id} isReadOnly variant="flat" description="Ваш уникальный идентификатор в системе авторизации" /> */}
                <Input label="Full Name" value={fullName} onValueChange={setFullName} onBlur={handleSave} onKeyDown={handleKeyDown} variant="bordered" placeholder="Enter your full name" maxLength={30} isInvalid={!!fullNameError} errorMessage={fullNameError} description={fullNameError ? undefined : (<div className="flex justify-end text-tiny text-default-400 gap-0"><span>{fullName.length}</span><span>/</span><span>30</span></div>)} />
                <Input label="Username" value={username} onValueChange={(val) => { setUsername(val); setValidationError(null); }} onBlur={handleSave} onKeyDown={handleKeyDown} placeholder="No username set" variant={canEditUsername ? "bordered" : "flat"} isReadOnly={!canEditUsername} isDisabled={!canEditUsername} isInvalid={!!validationError || !!badgeError} errorMessage={validationError || badgeError} endContent={isValidating ? <Spinner size="sm" /> : null} maxLength={15} description={(validationError || badgeError) ? undefined : (canEditUsername ? (<div className="flex justify-end text-tiny text-default-400 gap-0"><span>{username.length}</span><span>/</span><span>15</span></div>) : "Изменение username доступно только на тарифе PRO")} />
            </div>
         </div>
         
      </div>
   );
};
