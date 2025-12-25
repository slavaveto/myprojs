import React from 'react';

export const AvatarMask = () => (
   <div 
      className="absolute inset-0 pointer-events-none z-10 bg-black/30"
      style={{
         backdropFilter: 'blur(2px)',
         WebkitBackdropFilter: 'blur(2px)',
         // Mask cuts out the center circle:
         // - transparent (center): Hides this div (so no blur, no dark overlay)
         // - black (outside): Shows this div (blur + dark overlay)
         WebkitMaskImage: 'radial-gradient(circle closest-side, transparent 100%, black 100%)',
         maskImage: 'radial-gradient(circle closest-side, transparent 100%, black 100%)'
      }}
   />
);
