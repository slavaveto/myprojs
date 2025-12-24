import { useState, useEffect } from 'react';

export function useWindowSize() {
   const [size, setSize] = useState(() => ({
      winWidth: typeof window !== 'undefined' ? window.innerWidth : 1280,
      winHeight: typeof window !== 'undefined' ? window.innerHeight : 800,
   }));

   useEffect(() => {
      const handleResize = () => {
         setSize({
            winWidth: window.innerWidth,
            winHeight: window.innerHeight,
         });
      };

      window.addEventListener('resize', handleResize);
      // ловим смену ориентации как отдельное событие
      window.addEventListener('orientationchange', handleResize);

      return () => {
         window.removeEventListener('resize', handleResize);
         window.removeEventListener('orientationchange', handleResize);
      };
   }, []);

   return size;
}
