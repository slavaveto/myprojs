'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button, Slider, Spinner } from '@heroui/react';
import Cropper from 'react-easy-crop';
import { motion } from 'framer-motion';
import { createLogger } from '@/utils/logger/Logger';
import getCroppedImg from '@/utils/hooks/cropImage';
import { Search } from 'lucide-react';

import { AvatarMask } from '@/app/admin/tabs/components/AvatarMask';

import { ZoomSlider, FloatingZoomControls } from '@/app/admin/tabs/components/ZoomSlider';

const logger = createLogger('AvatarCropper');

interface AvatarCropperProps {
   imageSrc: string;
   onCropComplete: (croppedBlob: Blob) => void;
   onCancel: () => void;
}

export const AvatarCropper = ({ imageSrc, onCropComplete, onCancel }: AvatarCropperProps) => {
   const [crop, setCrop] = useState({ x: 0, y: 0 });
   const [zoom, setZoom] = useState(1);
   const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
   const [cropSize, setCropSize] = useState<{ width: number; height: number }>({ width: 300, height: 300 });
   const [isCropperReady, setIsCropperReady] = useState(false);
   
   const cropContainerRef = useRef<HTMLDivElement>(null);

   // Measure crop container
   useEffect(() => {
      if (!cropContainerRef.current) return;

      const updateSize = () => {
         if (cropContainerRef.current) {
             const width = cropContainerRef.current.offsetWidth;
             const height = cropContainerRef.current.offsetHeight;
             // Берем меньшую сторону, чтобы круг вписался
             const size = Math.min(width, height);
             setCropSize({ width: size, height: size });
         }
      };

      updateSize();
      const observer = new ResizeObserver(updateSize);
      observer.observe(cropContainerRef.current);
      return () => observer.disconnect();
   }, []);

   // Delayed ready state for animation
   useEffect(() => {
      setIsCropperReady(false);
      const timer = setTimeout(() => setIsCropperReady(true), 1000); // Small delay for smooth appearance
      return () => clearTimeout(timer);
   }, []);

   const onCropCompleteHandler = useCallback((croppedArea: any, croppedAreaPixels: any) => {
       setCroppedAreaPixels(croppedAreaPixels);
   }, []);

   const handleSaveCrop = async () => {
       if (!imageSrc || !croppedAreaPixels) return;
       try {
           const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
           if (croppedImage) {
               onCropComplete(croppedImage);
           }
       } catch (e) {
           logger.error('Failed to crop image', e);
       }
   };

   return (
      <div className="flex flex-col gap-4 w-[320px]">
         <div ref={cropContainerRef} className="relative w-full aspect-square bg-default-500 rounded-lg overflow-hidden mx-auto group">
             {imageSrc && isCropperReady ? (
                 <motion.div
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     transition={{ duration: 0.3 }}
                     className="w-full h-full"
                 >
                     <Cropper
                         image={imageSrc}
                         crop={crop}
                         zoom={zoom}
                         aspect={1}
                         onCropChange={setCrop}
                         onCropComplete={onCropCompleteHandler}
                         onZoomChange={setZoom}
                         cropShape="round"
                         showGrid={false}
                         cropSize={cropSize}
                         objectFit="contain"
                         restrictPosition={false}
                         style={{ 
                            containerStyle: { width: '100%', height: '100%' },
                            // Hide default cropper mask because we use our custom AvatarMask
                            mediaStyle: { opacity: 1 },
                            cropAreaStyle: { opacity: 0 } 
                         }}
                     />
                     <AvatarMask />
                     
                     {/* Floating Zoom Control */}
                     <FloatingZoomControls zoom={zoom} setZoom={setZoom} storageKey="admin_cropper_zoom_hint" />
                 </motion.div>
             ) : (
                <div className="w-full h-full flex items-center justify-center">
                   <Spinner color="white" />
                </div>
             )}
         </div>
         
         <div className="flex justify-end gap-2 pt-2">
             <Button size="sm" color="danger" variant="light" onPress={onCancel}>
                 Cancel
             </Button>
             <Button size="sm" color="primary" onPress={handleSaveCrop}>
                 Save
             </Button>
         </div>
      </div>
   );
};
