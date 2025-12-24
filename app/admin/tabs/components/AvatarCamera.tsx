'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button, Spinner, Select, SelectItem, SelectSection } from '@heroui/react';
import { createLogger } from '@/utils/logger/Logger';
import { useNotificationSound } from '@/utils/hooks/useNotificationSound';

import { globalStorage } from '@/utils/storage';
const logger = createLogger('AvatarCamera');

import { Camera, RefreshCcw, Check } from 'lucide-react';
import { AvatarMask } from '@/app/admin/tabs/components/AvatarMask';


import { ZoomSlider, FloatingZoomControls } from '@/app/admin/tabs/components/ZoomSlider';

interface AvatarCameraProps {
   onCapture: (blob: Blob) => void;
   onCancel: () => void;
}

export const AvatarCamera = ({ onCapture, onCancel }: AvatarCameraProps) => {
   const videoRef = useRef<HTMLVideoElement>(null);
   const containerRef = useRef<HTMLDivElement>(null);
   const [isStreamReady, setIsStreamReady] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [zoom, setZoom] = useState(1);
   const [pan, setPan] = useState({ x: 0, y: 0 });
   const [isDragging, setIsDragging] = useState(false);
   const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
   
   // Sounds
   const { playCountdownSound, playShutterSound } = useNotificationSound();
   
   // Countdown State
   const [countdown, setCountdown] = useState<number | null>(null);
   const [showCountdownNumber, setShowCountdownNumber] = useState(false);
   const [isFlashing, setIsFlashing] = useState(false);
   
   // Preview State
   const [capturedImage, setCapturedImage] = useState<string | null>(null);
   const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

   // Device Management
   const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
   const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

   // Get Cameras and Restore Selection
   useEffect(() => {
      const initCameras = async () => {
         try {
            // 1. Get Permission (to see labels)
            try {
               const stream = await navigator.mediaDevices.getUserMedia({ video: true });
               stream.getTracks().forEach((t) => t.stop());
            } catch (err) {
               logger.error('Permission denied', err);
               setError('Camera access required');
               return;
            }

            // 2. List Devices
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = allDevices.filter((device) => device.kind === 'videoinput');
            setDevices(videoDevices);

            // 3. Restore Selection
            const savedId = globalStorage.getItem('admin_camera_device_id');
            const savedDeviceExists = videoDevices.some(d => d.deviceId === savedId);

            if (savedId && savedDeviceExists) {
               setSelectedDeviceId(savedId);
            } else if (videoDevices.length > 0) {
               // Fallback to first available
               setSelectedDeviceId(videoDevices[0].deviceId);
            }
         } catch (err) {
            logger.error('Failed to init cameras', err);
            setError('Failed to initialize camera');
         }
      };

      initCameras();
   }, []);

   // Start Camera Stream
   useEffect(() => {
      if (!selectedDeviceId || capturedImage) return;

      let stream: MediaStream | null = null;
      setIsStreamReady(false);

      const startCamera = async () => {
         try {
            stream = await navigator.mediaDevices.getUserMedia({
               video: {
                  width: { ideal: 720 },
                  height: { ideal: 720 },
                  aspectRatio: 1,
                  deviceId: { exact: selectedDeviceId },
               },
            });

            if (videoRef.current) {
               videoRef.current.srcObject = stream;
               videoRef.current.onloadedmetadata = () => {
                  videoRef.current?.play();
                  setIsStreamReady(true);
               };
            }
         } catch (err: any) {
            logger.error('Failed to access camera', err);
            setError('Camera error');
         }
      };

      startCamera();

      return () => {
         if (stream) stream.getTracks().forEach((track) => track.stop());
      };
   }, [selectedDeviceId, capturedImage]);

   const handleCapture = useCallback(() => {
      if (!videoRef.current || !isStreamReady) return;

      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const size = Math.min(video.videoWidth, video.videoHeight);

      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const containerWidth = containerRef.current?.offsetWidth || 320;

      // Calculate center crop with zoom
      const sourceSize = size / zoom; 
      
      const pixelRatio = video.videoWidth / (containerWidth * zoom);
      const panXSource = pan.x * pixelRatio;
      const panYSource = -pan.y * pixelRatio;

      const xOffset = ((video.videoWidth - sourceSize) / 2) + panXSource;
      const yOffset = ((video.videoHeight - sourceSize) / 2) + panYSource;

      // Flip horizontal for mirror effect consistency
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
      
      ctx.drawImage(
         video,
         xOffset, yOffset, sourceSize, sourceSize, 
         0, 0, size, size 
      );

      canvas.toBlob(
         (blob) => {
            if (blob) {
               const url = URL.createObjectURL(blob);
               setCapturedImage(url);
               setCapturedBlob(blob);
               // onCapture(blob); // Don't submit immediately
            }
         },
         'image/jpeg',
         0.9
      );
   }, [isStreamReady, zoom, pan]);

   const handleRetake = () => {
      if (capturedImage) URL.revokeObjectURL(capturedImage);
      setCapturedImage(null);
      setCapturedBlob(null);
   };

   const handleConfirm = () => {
      if (capturedBlob) {
         onCapture(capturedBlob);
      }
   };

   const handleStartCountdown = useCallback(() => {
      setTimeout(() => {
         setCountdown(3);
      }, 0);
   }, []);

   useEffect(() => {
      if (countdown === null) {
         setShowCountdownNumber(false);
         return;
      }

      if (countdown > 0) {
         setShowCountdownNumber(true);
         
         // Play sound when fully visible (matches duration-200)
         const soundTimer = setTimeout(() => {
            playCountdownSound();
         }, 0);
         
         // Hide number after 400ms
         const hideTimer = setTimeout(() => {
            setShowCountdownNumber(false);
         }, 400);

         const timer = setTimeout(() => {
            setCountdown((prev) => (prev !== null ? prev - 1 : null));
         }, 1100);
         
         return () => {
            clearTimeout(timer);
            clearTimeout(hideTimer);
            clearTimeout(soundTimer);
         };
      } else {
         // Countdown finished -> Snap!
         setShowCountdownNumber(false);
         setIsFlashing(true); // 1. Turn on lights
         playShutterSound();
         
         // 2. Wait for screen to light up face, then capture
         setTimeout(() => {
            handleCapture();
            
            // 3. Turn off
            setTimeout(() => {
               setIsFlashing(false);
               setCountdown(null);
            }, 300);
         }, 150);
      }
   }, [countdown, handleCapture, playCountdownSound, playShutterSound]);

   // Pan Logic
   const handlePointerDown = (e: React.PointerEvent) => {
      if (!isStreamReady || capturedImage || zoom <= 1) return;
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = {
         x: e.clientX,
         y: e.clientY,
         panX: pan.x,
         panY: pan.y
      };
   };

   const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      e.preventDefault();

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      const containerWidth = containerRef.current?.offsetWidth || 320;
      const maxPan = (containerWidth * (zoom - 1)) / 2;

      let newX = dragStartRef.current.panX + dx;
      let newY = dragStartRef.current.panY + dy;

      if (newX > maxPan) newX = maxPan;
      if (newX < -maxPan) newX = -maxPan;
      if (newY > maxPan) newY = maxPan;
      if (newY < -maxPan) newY = -maxPan;

      setPan({ x: newX, y: newY });
   };

   const handlePointerUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
   };

   // Clamp pan when zoom changes
   useEffect(() => {
      const containerWidth = containerRef.current?.offsetWidth || 320;
      const maxPan = (containerWidth * (zoom - 1)) / 2;
      
      setPan(prev => {
         let newX = prev.x;
         let newY = prev.y;
         let changed = false;

         if (Math.abs(newX) > maxPan) {
            newX = newX > 0 ? maxPan : -maxPan;
            changed = true;
         }
         if (Math.abs(newY) > maxPan) {
            newY = newY > 0 ? maxPan : -maxPan;
            changed = true;
         }

         return changed ? { x: newX, y: newY } : prev;
      });
   }, [zoom]);

   if (error) {
      return (
         <div className="w-[320px] aspect-square flex flex-col items-center justify-center gap-4 bg-default-100 rounded-lg">
            <p className="text-danger">{error}</p>
            <Button onPress={onCancel}>Close</Button>
         </div>
      );
   }

   return (
      <div className="flex flex-col gap-4 w-[320px]">
         <div 
            ref={containerRef}
            className={`relative w-full aspect-square bg-default-500 rounded-lg overflow-hidden group touch-none ${zoom > 1 && !capturedImage ? 'cursor-move' : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
         >
            {/* Video Feed */}
            {capturedImage ? (
               <img 
                  src={capturedImage} 
                  className="w-full h-full object-cover" 
                  alt="Captured"
               />
            ) : (
               <video
                  ref={videoRef}
                  className="w-full h-full object-cover origin-center" 
                  style={{ 
                     transform: `translate(${pan.x}px, ${pan.y}px) scaleX(-1) scale(${zoom})` 
                  }}
                  playsInline
                  muted
               />
            )}

            {/* Loading State */}
            {!isStreamReady && !capturedImage && (
               <div className="absolute inset-0 flex items-center justify-center bg-default-100 z-10">
                  <Spinner label="Starting camera..." />
               </div>
            )}

            {/* Overlay Mask (Circle Crop Preview) - Implements react-easy-crop look */}
            {isStreamReady && !capturedImage && (
               <>
                  <AvatarMask />
                  <FloatingZoomControls zoom={zoom} setZoom={setZoom} storageKey="admin_camera_zoom_hint" />
                  
                  {/* Countdown Overlay */}
                  {countdown !== null && countdown > 0 && (
                     <div 
                        className={`absolute right-3 top-1 flex items-center justify-center z-50 transition-all transform ${
                           showCountdownNumber 
                              ? 'opacity-100 scale-120 duration-200 ease-out' 
                              : 'opacity-0 scale-100 duration-400 ease-in'
                        }`}
                     >
                        <span className="text-white text-6xl font-bold drop-shadow-2xl">
                           {countdown}
                        </span>
                     </div>
                  )}

                  {/* Flash Effect */}
                  {isFlashing && typeof document !== 'undefined' && createPortal(
                     <div 
                        className="fixed top-0 left-0 w-full h-full bg-white z-[999999] pointer-events-none" 
                        style={{ filter: 'brightness(200%) contrast(200%)' }} 
                     />,
                     document.body
                  )}
               </>
            )}
         </div>

        
            {!capturedImage && devices.length > 1 && (
                <div className="px-1 ">
               <Select
                  size="sm"
                  aria-label="Select Camera"
                  selectedKeys={selectedDeviceId ? [selectedDeviceId] : []}
                  onChange={(e) => {
                     const val = e.target.value;
                     if (val) {
                        setSelectedDeviceId(val);
                        globalStorage.setItem('admin_camera_device_id', val);
                     }
                  }}
                  startContent={<Camera size={14} />}
                  classNames={{
                     trigger: 'cursor-pointer',
                  }}
               >
                  <SelectSection >
                     {devices.map((device) => (
                        <SelectItem key={device.deviceId}>
                           {device.label || `Camera ${devices.indexOf(device) + 1}`}
                        </SelectItem>
                     ))}
                  </SelectSection>
               </Select>
               </div>
            )}
         

       
            <div className="flex items-center justify-center px-2 pt-2 pb-2">
               {capturedImage ? (
                  <>
                     <Button 
                        size="sm" 
                        color="danger" 
                        variant="light" 
                        onPress={handleRetake}
                        className="min-w-0 px-3 mr-2"
                        // startContent={<RefreshCcw size={18} />}
                     >
                        Переснять
                     </Button>
                     
                     <Button
                        size="md"
                        color="primary"
                        className="font-medium px-4 shadow-md"
                        onPress={handleConfirm}
                        // startContent={<Check size={20} />}
                     >
                        Сохранить
                     </Button>
                  </>
               ) : (
                  <>
                     {/* <Button 
                        size="sm" 
                        color="danger" 
                        variant="light" 
                        onPress={onCancel}
                        className="min-w-0 px-3 mr-2"
                     >
                        Cancel
                     </Button> */}
                     
                     <Button
                        size="md"
                        color="primary"
                        className="font-medium px-5 shadow-md"
                        onPress={handleStartCountdown}
                        isDisabled={!isStreamReady || countdown !== null}
                        startContent={<Camera size={20} />}
                     >
                        Snap
                     </Button>
                     
                     
                  </>
               )}
            </div>
         
     
      </div>
   );
};
