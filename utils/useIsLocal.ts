'use client';

import { useState, useEffect } from 'react';

export function useIsLocal() {
   const [isLocal, setIsLocal] = useState(false);

   useEffect(() => {
      if (typeof window !== 'undefined') {
         const hostname = window.location.hostname;
         setIsLocal(hostname === 'localhost' || hostname === '127.0.0.1');
      }
   }, []);

   return isLocal;
}

