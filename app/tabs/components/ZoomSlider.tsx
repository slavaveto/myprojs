import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { globalStorage } from '@/utils/storage';

interface ZoomSliderProps {
   zoom: number;
   setZoom: (zoom: number) => void;
   min?: number;
   max?: number;
   step?: number;
}

export const ZoomSlider = ({ zoom, setZoom, min = 1, max = 3, step = 0.1 }: ZoomSliderProps) => {
   return (
      <div className="flex-1 relative flex items-center h-4 w-full">
         <input 
            type="range"
            min={min}
            max={max}
            step={step}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
         />
         {/* Progress fill hack */}
         <div 
            className="absolute left-0 top-1.5 h-1 bg-white rounded-l-lg pointer-events-none"
            style={{ 
               width: `${((zoom - min) / (max - min)) * 100}%`,
               borderRadius: '9999px' // Force fully rounded on both sides
            }}
         />
      </div>
   );
};

// Set to true to always show the zoom slider
const ALWAYS_SHOW_ZOOM = true;

export const FloatingZoomControls = ({ zoom, setZoom, storageKey }: { zoom: number, setZoom: (z: number) => void, storageKey?: string }) => {
   const [forceVisible, setForceVisible] = useState(false);

   useEffect(() => {
      if (storageKey && !ALWAYS_SHOW_ZOOM) {
         const hasSeen = globalStorage.getItem(storageKey);
         if (!hasSeen) {
            setForceVisible(true);
            const timer = setTimeout(() => {
               setForceVisible(false);
               globalStorage.setItem(storageKey, 'true');
            }, 3000);
            return () => clearTimeout(timer);
         }
      }
   }, [storageKey]);

   const isVisible = ALWAYS_SHOW_ZOOM || forceVisible;

   return (
      <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-48 z-50 bg-black/40 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-2 shadow-xl border border-white/20 transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
         <Search size={14} className="text-white flex-shrink-0" />
         <ZoomSlider zoom={zoom} setZoom={setZoom} />
      </div>
   );
};
