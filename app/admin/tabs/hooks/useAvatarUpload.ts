import { useState, useCallback } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { triggerAvatarUpdate, triggerProfileUpdate } from '@/app/admin/AdminUserMenu';
import toast from 'react-hot-toast';
import { logService } from '@/app/admin/_services/logService';
import { useSupabase } from '@/utils/supabase/useSupabase';

const logger = createLogger('useAvatarUpload');

export function useAvatarUpload(
    initialAvatarUrl: string | null, 
    onUploadComplete?: () => void,

) {
   const { supabase, userId: currentUserId } = useSupabase();
   const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
   const [prevAvatarUrl, setPrevAvatarUrl] = useState<string | null>(initialAvatarUrl);
   
   const [isUploading, setIsUploading] = useState(false);
   const [isDeleting, setIsDeleting] = useState(false);
   const [uploadSuccess, setUploadSuccess] = useState(false);
   
   // Crop State
   const [cropModalOpen, setCropModalOpen] = useState(false);
   const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
   const [fileType, setFileType] = useState<string>('image/jpeg');

   // Camera State
   const [isCameraOpen, setIsCameraOpen] = useState(false);
   
   // Core Upload Logic
   const startUpload = useCallback(async (file: Blob) => {
      setIsUploading(true);
      const previewUrl = URL.createObjectURL(file);
      setAvatarUrl(previewUrl);

      const formData = new FormData();
      // If Blob, append as file with name
      formData.append('file', file, 'avatar.jpg');

      const uploadPromise = new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/admin/avatar-upload', true);
          xhr.onload = () => {
              if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
              else reject(new Error(xhr.responseText));
          };
          xhr.onerror = () => reject(new Error('Network error'));
          xhr.send(formData);
      });

      const duration = 2600; // Match animation (0.5s delay + 2s duration + buffer)
      const minTimePromise = new Promise(resolve => setTimeout(resolve, duration));

      try {
          await Promise.all([uploadPromise, minTimePromise]);
          setUploadSuccess(true);
          setPrevAvatarUrl(avatarUrl);
          
          if (onUploadComplete) onUploadComplete();
          triggerAvatarUpdate(); // Обновляем аватарку в хедере

          if (currentUserId) {
            await logService.logAction(supabase, {
               action: 'PROFILE_UPDATE',
               entity: 'profile',
               details: { event: 'avatar-upload', success: true },
               userId: currentUserId
            });
          }

          setTimeout(() => {
             setUploadSuccess(false);
              setIsUploading(false);
          }, 2000);
      } catch (err) {
          logger.error('Upload failed', err);
          toast.error('Failed to upload avatar');
          setAvatarUrl(prevAvatarUrl);
          setIsUploading(false);
      }
   }, [avatarUrl, prevAvatarUrl, onUploadComplete, currentUserId, supabase]);


   const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsCameraOpen(false); // Close camera if open

      const reader = new FileReader();
      reader.addEventListener('load', () => {
         setCropImageSrc(reader.result?.toString() || null);
         setFileType(file.type);
         setCropModalOpen(true);
      });
      reader.readAsDataURL(file);
      
      e.target.value = '';
   };

   const onCropComplete = useCallback(async (croppedBlob: Blob) => {
      setCropModalOpen(false);
      setCropImageSrc(null); // Clear image src
      
      // Update preview immediately
      // const previewUrl = URL.createObjectURL(croppedBlob);
      // setAvatarUrl(previewUrl);

      // Start upload with delay (300ms)
      setTimeout(() => {
         startUpload(croppedBlob);
      }, 300);
   }, [startUpload]);

   const onCropCancel = useCallback(() => {
      setCropModalOpen(false);
      setCropImageSrc(null);
   }, []);

   const onCameraOpen = useCallback(() => {
      setCropModalOpen(false);
      setCropImageSrc(null);
      setIsCameraOpen(true);
   }, []);

   const onCameraClose = useCallback(() => {
      setIsCameraOpen(false);
   }, []);

   const onCameraCapture = useCallback((blob: Blob) => {
      setIsCameraOpen(false);
      // Start upload with delay (300ms) like in crop
      setTimeout(() => {
         startUpload(blob);
      }, 300);
   }, [startUpload]);

   const deleteAvatar = useCallback(async () => {
      // Liquid Delete Animation
      setIsDeleting(true);

      const duration = 2600; // Match animation (0.5s delay + 2s duration + buffer)

      // API call Promise
      const deletePromise = new Promise(async (resolve, reject) => {
          try {
              const res = await fetch('/api/admin/avatar-upload', { method: 'DELETE' });
              if (!res.ok) throw new Error('Delete failed');
              resolve(true);
          } catch (err) {
              reject(err);
          }
      });

      // Min Time Promise
      const minTimePromise = new Promise(resolve => setTimeout(resolve, duration));

      try {
          // Wait for BOTH
          await Promise.all([deletePromise, minTimePromise]);
          
          // Clear
          setAvatarUrl(null);
          setPrevAvatarUrl(null);
          // Keep isDeleting=true during the small delay to prevent hover flickering
          
          if (currentUserId) {
            await logService.logAction(supabase, {
               action: 'PROFILE_UPDATE',
               entity: 'profile',
               details: { event: 'avatar_delete', success: true },
               userId: currentUserId
            });
          }

          // Small delay before checkmark
          setTimeout(() => {
              setIsDeleting(false); // Reset deleting state just before showing success
              setUploadSuccess(true); // Show success checkmark
              triggerAvatarUpdate(); // Обновляем аватарку в хедере (удаление)
              triggerProfileUpdate();
              if (onUploadComplete) onUploadComplete();

              setTimeout(() => {
                 setUploadSuccess(false);
              }, 2000);
          }, 300);
          
      } catch (err) {
          logger.error('Failed to delete avatar', err);
          toast.error('Failed to delete avatar');
          setIsDeleting(false);
      }
   }, [onUploadComplete, currentUserId, supabase]);

   const setInitialUrl = useCallback((url: string | null) => {
       if (!isUploading && !isDeleting) {
           setAvatarUrl(url);
           setPrevAvatarUrl(url);
       }
   }, [isUploading, isDeleting]);

   return {
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
   };
}
