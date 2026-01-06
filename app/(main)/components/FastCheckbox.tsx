import React from 'react';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';

interface FastCheckboxProps {
   isSelected: boolean;
   onValueChange: (isSelected: boolean) => void;
   className?: string;
   size?: 'sm' | 'md' | 'lg';
}

export const FastCheckbox = ({
   isSelected,
   onValueChange,
   className,
   size = 'md'
}: FastCheckboxProps) => {
   // Sizes mapping to match HeroUI roughly
   const sizeClass = size === 'sm' ? 'w-4 h-4 rounded-[4px]' : 'w-5 h-5 rounded-md';
   const iconSize = size === 'sm' ? 12 : 14;

   return (
      <label 
         className={clsx(
            "group relative inline-flex items-center justify-center cursor-pointer select-none m-0 p-0",
            className
         )}
         onClick={(e) => e.stopPropagation()} // Prevent row click events
      >
         <input
            type="checkbox"
            className="sr-only"
            checked={isSelected}
            onChange={(e) => onValueChange(e.target.checked)}
         />
         <div
            className={clsx(
               "flex items-center justify-center border-2 transition-colors duration-200",
               sizeClass,
               isSelected 
                  ? "bg-primary border-primary text-white" 
                  : "bg-transparent border-default-400 group-hover:bg-default-100"
            )}
         >
            <Check 
               size={iconSize} 
               strokeWidth={3}
               className={clsx(
                  "transition-opacity duration-200",
                  isSelected ? "opacity-100" : "opacity-0"
               )} 
            />
         </div>
      </label>
   );
};

